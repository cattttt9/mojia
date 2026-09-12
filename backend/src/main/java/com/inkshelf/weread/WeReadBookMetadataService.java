package com.inkshelf.weread;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.annotation.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.*;

@Service
/**
 * 公共书籍元数据缓存与限速补全服务。
 * 单线程队列控制对微信读书的调用频率，同一 bookId 在进程内只允许一个任务执行。
 */
public class WeReadBookMetadataService {
    private static final Duration FRESH_FOR = Duration.ofDays(90), FIRST_RETRY = Duration.ofHours(1), MAX_RETRY = Duration.ofHours(24);
    private static final Pattern NUMBER = Pattern.compile("([0-9]+(?:\\.[0-9]+)?)");
    private final WeReadBookMetadataRepository metadata;
    private final WeReadCredentialRepository credentials;
    private final SecretCryptoService crypto;
    private final WeReadGatewayClient gateway;
    private final JdbcTemplate jdbc;
    private final WeReadCoverProxyService covers;
    private final BlockingQueue<Job> queue = new ArrayBlockingQueue<>(500);
    private final Set<String> inflight = ConcurrentHashMap.newKeySet();
    private volatile boolean running = true;
    private Thread worker;

    private static class Job {
        final Long userId;
        final String bookId;

        Job(Long u, String b) {
            userId = u;
            bookId = b;
        }
    }

    public WeReadBookMetadataService(WeReadBookMetadataRepository m, WeReadCredentialRepository c, SecretCryptoService s,
                                     WeReadGatewayClient g, JdbcTemplate j, WeReadCoverProxyService p) {
        metadata = m;
        credentials = c;
        crypto = s;
        gateway = g;
        jdbc = j;
        covers = p;
    }

    /**
     * 启动守护线程；应用关闭时由 stop() 中断，避免阻止 JVM 退出。
     */
    @PostConstruct
    public void start() {
        worker = new Thread(this::work, "weread-book-metadata");
        worker.setDaemon(true);
        worker.start();
    }

    @PreDestroy
    public void stop() {
        running = false;
        if (worker != null) worker.interrupt();
    }

    /**
     * 把数据库中已有的元数据合并进书架响应，不发起外部请求。
     * 上游书架自带的封面优先，只有缺失时才使用详情缓存补齐。
     */
    @Transactional
    public void attachCached(Long userId, JsonNode shelf) {
        if (shelf == null || !shelf.path("books").isArray()) return;
        List<String> ids = new ArrayList<>();
        shelf.path("books").forEach(b -> {
            String id = b.path("bookId").asText("");
            if (!id.isEmpty()) ids.add(id);
        });
        Map<String, WeReadBookMetadata> cached = byId(ids);
        Map<String, String> starCovers = cachedStarCovers(userId, ids);
        shelf.path("books").forEach(b -> {
            WeReadBookMetadata item = cached.get(b.path("bookId").asText());
            if (!(b instanceof ObjectNode)) return;
            ObjectNode book = (ObjectNode) b;
            if (item != null && item.getWordCount() != null) book.put("wordCount", item.getWordCount());
            if (item != null && !hasText(book.path("cover").asText(null)) && hasText(item.getCoverUrl()))
                book.put("cover", item.getCoverUrl());
            if (!hasText(book.path("cover").asText(null)) && hasText(starCovers.get(book.path("bookId").asText())))
                book.put("cover", starCovers.get(book.path("bookId").asText()));
            String cover = covers.proxiedUrl(book.path("cover").asText(null));
            if (hasText(cover)) book.put("cover", cover);
        });
    }

    /**
     * 跳过新鲜缓存和退避期记录，把其余 bookId 去重后放入有界队列。
     */
    @Transactional
    public void enqueue(Long userId, Collection<String> requested) {
        List<String> ids = clean(requested);
        if (ids.isEmpty()) return;
        Instant now = Instant.now();
        Map<String, WeReadBookMetadata> cached = byId(ids);
        for (String id : ids) {
            WeReadBookMetadata item = cached.get(id);
            if (item != null && "COMPLETE".equals(item.getStatus())
                    && item.getFetchedAt() != null && item.getFetchedAt().isAfter(now.minus(FRESH_FOR))
                    && item.getCoverFetchedAt() != null && item.getCoverFetchedAt().isAfter(now.minus(FRESH_FOR)))
                continue;
            if (item != null && "FAILED".equals(item.getStatus()) && item.getNextRetryAt() != null && item.getNextRetryAt().isAfter(now))
                continue;
            if (!inflight.add(id)) continue;
            if (item == null) {
                item = new WeReadBookMetadata();
                item.setBookId(id);
            }
            item.setStatus("PENDING");
            item.setUpdatedAt(now);
            metadata.save(item);
            if (!queue.offer(new Job(userId, id))) {
                inflight.remove(id);
                markQueueFull(item, now);
            }
        }
    }

    /**
     * 返回当前可用结果及待处理/失败数量，供前端决定是否继续轮询。
     */
    @Transactional(readOnly = true)
    public Map<String, Object> lookup(Collection<String> requested) {
        List<String> ids = clean(requested);
        Map<String, WeReadBookMetadata> cached = byId(ids);
        List<Map<String, Object>> items = new ArrayList<>();
        int pending = 0, failed = 0;
        for (String id : ids) {
            WeReadBookMetadata item = cached.get(id);
            if (item == null || "PENDING".equals(item.getStatus())) {
                pending++;
                continue;
            }
            if ("FAILED".equals(item.getStatus())) {
                failed++;
                continue;
            }
            if (item.getWordCount() != null || hasText(item.getCoverUrl())) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("bookId", id);
                if (item.getWordCount() != null) row.put("wordCount", item.getWordCount());
                if (hasText(item.getCoverUrl())) row.put("cover", covers.proxiedUrl(item.getCoverUrl()));
                items.add(row);
            }
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("pending", pending);
        result.put("failed", failed);
        result.put("complete", pending == 0);
        return result;
    }

    // 每个任务完成后至少等待 350ms；异常也不能让后台线程退出。
    private void work() {
        while (running) {
            try {
                Job job = queue.take();
                fetch(job);
                Thread.sleep(350);
            } catch (InterruptedException e) {
                if (!running) return;
                Thread.currentThread().interrupt();
                return;
            } catch (Exception ignored) {
            }
        }
    }

    private void fetch(Job job) {
        Instant now = Instant.now();
        WeReadBookMetadata item = metadata.findById(job.bookId).orElseGet(() -> {
            WeReadBookMetadata x = new WeReadBookMetadata();
            x.setBookId(job.bookId);
            return x;
        });
        Instant oldAttempt = item.getLastAttemptAt(), oldRetry = item.getNextRetryAt();
        item.setLastAttemptAt(now);
        item.setUpdatedAt(now);
        try {
            WeReadCredential credential = credentials.findById(job.userId).orElseThrow(() -> new IllegalStateException("credential unavailable"));
            JsonNode info = gateway.call(crypto.decrypt(credential.getEncryptedApiKey()), "/book/info", Collections.singletonMap("bookId", job.bookId));
            long count = parseWordCount(info.path("wordCount"));
            String cover = normalizeCover(info.path("cover").asText(""));
            if (count <= 0 && !hasText(cover)) throw new IllegalStateException("book metadata unavailable");
            if (count > 0) item.setWordCount(count);
            if (hasText(cover)) item.setCoverUrl(cover);
            item.setStatus("COMPLETE");
            Instant fetchedAt = Instant.now();
            item.setFetchedAt(fetchedAt);
            item.setCoverFetchedAt(fetchedAt);
            item.setNextRetryAt(null);
        }
        // 失败只记录状态和下次重试时间，不持久化异常文本或 API Key。
        catch (Exception e) {
            Duration delay = FIRST_RETRY;
            if (oldAttempt != null && oldRetry != null && oldRetry.isAfter(oldAttempt)) {
                long seconds = Math.min(MAX_RETRY.getSeconds(), Math.max(FIRST_RETRY.getSeconds(), Duration.between(oldAttempt, oldRetry).getSeconds() * 2));
                delay = Duration.ofSeconds(seconds);
            }
            item.setStatus("FAILED");
            item.setNextRetryAt(Instant.now().plus(delay));
        } finally {
            item.setUpdatedAt(Instant.now());
            metadata.save(item);
            inflight.remove(job.bookId);
        }
    }

    long parseWordCount(JsonNode node) {
        if (node == null || node.isNull()) return 0;
        if (node.isNumber()) return node.asLong();
        String raw = node.asText("").replace(",", "").trim();
        Matcher matcher = NUMBER.matcher(raw);
        if (!matcher.find()) return 0;
        double value = Double.parseDouble(matcher.group(1));
        if (raw.contains("万")) value *= 10000;
        else if (raw.contains("千")) value *= 1000;
        return Math.round(value);
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static String normalizeCover(String value) {
        if (!hasText(value)) return null;
        String cover = value.trim();
        return cover.startsWith("//") ? "https:" + cover : cover;
    }

    private List<String> clean(Collection<String> values) {
        LinkedHashSet<String> result = new LinkedHashSet<>();
        if (values != null) for (String id : values)
            if (id != null && id.matches("[A-Za-z0-9_-]{1,64}")) {
                result.add(id);
                if (result.size() == 120) break;
            }
        return new ArrayList<>(result);
    }

    private Map<String, WeReadBookMetadata> byId(Collection<String> ids) {
        Map<String, WeReadBookMetadata> result = new HashMap<>();
        metadata.findAllById(ids).forEach(x -> result.put(x.getBookId(), x));
        return result;
    }

    private Map<String, String> cachedStarCovers(Long userId, Collection<String> ids) {
        Map<String, String> result = new HashMap<>();
        if (userId == null || ids.isEmpty()) return result;
        Set<String> requested = new HashSet<>(ids);
        jdbc.query("SELECT book_id,cover_url FROM reading_star_book_profile WHERE user_id=? AND cover_url IS NOT NULL",
                (org.springframework.jdbc.core.RowCallbackHandler) row -> {
                    String id = row.getString(1), cover = row.getString(2);
                    if (requested.contains(id) && hasText(cover)) result.put(id, cover);
                }, userId);
        return result;
    }

    private void markQueueFull(WeReadBookMetadata item, Instant now) {
        item.setStatus("FAILED");
        item.setNextRetryAt(now.plus(Duration.ofMinutes(5)));
        item.setUpdatedAt(now);
        metadata.save(item);
    }
}
