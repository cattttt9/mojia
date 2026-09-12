package com.inkshelf.memory;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import com.inkshelf.weread.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.temporal.TemporalAdjusters;
import java.time.temporal.WeekFields;
import java.util.*;

/**
 * 第二阶段核心服务：生成稳定报告快照，并从已同步的私密笔记制作时间胶囊。
 */
@Service
public class ReadingMemoryService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private final ReadingReportRepository reports;
    private final ReadingCapsuleRepository capsules;
    private final CapsuleReflectionRepository reflections;
    private final WeReadNoteRepository notes;
    private final WeReadNotebookRepository notebooks;
    private final WeReadCredentialRepository credentials;
    private final SecretCryptoService crypto;
    private final WeReadGatewayClient gateway;
    private final WeReadNoteService noteService;
    private final ObjectMapper json;

    public ReadingMemoryService(ReadingReportRepository r, ReadingCapsuleRepository c, CapsuleReflectionRepository f, WeReadNoteRepository n, WeReadNotebookRepository b, WeReadCredentialRepository wc, SecretCryptoService sc, WeReadGatewayClient g, WeReadNoteService ns, ObjectMapper j) {
        reports = r;
        capsules = c;
        reflections = f;
        notes = n;
        notebooks = b;
        credentials = wc;
        crypto = sc;
        gateway = g;
        noteService = ns;
        json = j;
    }

    /**
     * 返回最近一个完整自然周期；缺失时即时补生成一次。
     */
    public Map<String, Object> latestReport(Long userId, String type) {
        String normalized = type(type);
        LocalDate start = latestCompletedStart(normalized, LocalDate.now(ZONE));
        ReadingReport report = reports.findByUserIdAndPeriodTypeAndPeriodStart(userId, normalized, start).orElseGet(() -> generate(userId, normalized, start, false));
        return view(report, false);
    }

    public List<Map<String, Object>> history(Long userId, String type) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (ReadingReport report : reports.findTop12ByUserIdAndPeriodTypeOrderByPeriodStartDesc(userId, type(type)))
            result.add(view(report, false));
        return result;
    }

    public Map<String, Object> regenerate(Long userId, Long id) {
        ReadingReport old = reports.findByIdAndUserId(id, userId).orElseThrow(() -> new IllegalArgumentException("报告不存在"));
        return view(generate(userId, old.getPeriodType(), old.getPeriodStart(), true), false);
    }

    @Transactional
    public ReadingReport generate(Long userId, String type, LocalDate start, boolean force) {
        String normalized = type(type);
        Optional<ReadingReport> cached = reports.findByUserIdAndPeriodTypeAndPeriodStart(userId, normalized, start);
        if (cached.isPresent() && !force && snapshotVersion(cached.get()) >= 3) return cached.get();
        LocalDate end = "WEEKLY".equals(normalized) ? start.plusDays(6) : start.with(TemporalAdjusters.lastDayOfMonth());
        String mode = "WEEKLY".equals(normalized) ? "weekly" : "monthly";
        String key = apiKey(userId);
        JsonNode data = gateway.call(key, "/readdata/detail", params(mode, start));
        LocalDate previousStart = "WEEKLY".equals(normalized) ? start.minusWeeks(1) : start.minusMonths(1);
        JsonNode previous = gateway.call(key, "/readdata/detail", params(mode, previousStart));
        syncRankedBookNotes(userId, data.path("readLongest"), force);
        ObjectNode privateJson = buildReport(userId, normalized, start, end, data, previous), shareJson = privateJson.deepCopy();
        shareJson.remove(Arrays.asList("selectedMemory", "highlights", "notes"));
        shareJson.put("privacy", "可分享版已隐藏划线和个人想法原文");
        ReadingReport report = cached.orElseGet(ReadingReport::new);
        report.setUserId(userId);
        report.setPeriodType(normalized);
        report.setPeriodStart(start);
        report.setPeriodEnd(end);
        report.setReportJson(write(privateJson));
        report.setShareJson(write(shareJson));
        report.setGeneratedAt(Instant.now());
        report.setUpdatedAt(Instant.now());
        return reports.save(report);
    }

    private ObjectNode buildReport(Long userId, String type, LocalDate start, LocalDate end, JsonNode data, JsonNode previous) {
        ObjectNode out = json.createObjectNode();
        out.put("snapshotVersion", 3);
        out.put("periodType", type);
        out.put("periodStart", start.toString());
        out.put("periodEnd", end.toString());
        out.put("issueYear", start.get(WeekFields.ISO.weekBasedYear()));
        out.put("issueNumber", start.get(WeekFields.ISO.weekOfWeekBasedYear()));
        long total = data.path("totalReadTime").asLong(0), previousTotal = previous.path("totalReadTime").asLong(0), average = data.path("dayAverageReadTime").asLong(0), previousAverage = previous.path("dayAverageReadTime").asLong(0);
        out.put("totalReadTime", total);
        out.put("previousTotalReadTime", previousTotal);
        out.put("readDays", data.path("readDays").asInt(0));
        out.put("dayAverageReadTime", average);
        out.put("compare", previousAverage <= 0 ? 0 : (double) (average - previousAverage) / previousAverage);
        ObjectNode counts = json.createObjectNode();
        if (data.path("readStat").isArray()) for (JsonNode item : data.path("readStat"))
            counts.put(item.path("stat").asText("未知"), number(item.path("counts").asText("0")));
        out.set("counts", counts);
        Instant from = start.atStartOfDay(ZONE).toInstant(), to = end.plusDays(1).atStartOfDay(ZONE).toInstant();
        List<WeReadNote> periodNotes = notes.findByUserIdAndSourceCreatedAtBetweenOrderBySourceCreatedAtDesc(userId, from, to);
        out.put("newNotes", periodNotes.size());
        Map<String, WeReadNotebook> bookInfo = new HashMap<>();
        for (WeReadNotebook notebook : notebooks.findByUserIdOrderBySourceSortDesc(userId))
            bookInfo.put(notebook.getBookId(), notebook);
        out.set("timeline", timeline(data.path("readTimes"), periodNotes, bookInfo));
        ArrayNode booksJson = books(data.path("readLongest"), periodNotes, bookInfo);
        out.set("books", booksJson);
        out.set("topBook", booksJson.size() > 0 ? booksJson.get(0) : json.createObjectNode().put("title", "暂无"));
        out.set("highlights", highlights(periodNotes, bookInfo));
        out.set("notes", writtenNotes(periodNotes, bookInfo));
        ArrayNode categories = json.createArrayNode();
        if (data.path("preferCategory").isArray()) for (JsonNode item : data.path("preferCategory")) {
            ObjectNode row = json.createObjectNode();
            row.put("name", item.path("categoryTitle").asText("未分类"));
            row.put("seconds", item.path("readingTime").asLong(0));
            row.put("books", item.path("readingCount").asInt(0));
            row.put("weight", item.path("val").asDouble(0));
            categories.add(row);
        }
        out.set("categories", categories);
        out.put("preferTimeWord", data.path("preferTimeWord").asText(""));
        out.put("summary", ("WEEKLY".equals(type) ? "本周" : "本月") + "记录了 " + data.path("readDays").asInt(0) + " 天阅读，共 " + total + " 秒。");
        return out;
    }

    /**
     * 周报/月报中的书籍排行来自微信读书 /readdata/detail.readLongest。
     * 生成私密快照前，按排行顺序补拉这些电子书的划线和想法，避免“未打开过详情页就没有划线”的空快照。
     * 同步失败不会阻断报告生成：报告仍保留阅读时长排行，用户稍后刷新时会再次尝试。
     */
    private void syncRankedBookNotes(Long userId, JsonNode longest, boolean force) {
        if (!longest.isArray() || noteService == null) return;
        Set<String> seen = new HashSet<>();
        for (JsonNode item : longest) {
            if (!item.has("book")) continue; // 有声书/专辑暂不支持逐条划线导出。
            String bookId = item.path("book").path("bookId").asText("");
            if (bookId.isEmpty() || !seen.add(bookId)) continue;
            try {
                noteService.syncBook(userId, bookId, force);
            } catch (Exception ignored) {
                // 不记录 API Key、划线正文或个人想法；单本失败只影响本期摘录丰富度。
            }
        }
    }

    private ArrayNode timeline(JsonNode readTimes, List<WeReadNote> periodNotes, Map<String, WeReadNotebook> books) {
        ArrayNode result = json.createArrayNode();
        List<Map.Entry<String, JsonNode>> entries = new ArrayList<>();
        readTimes.fields().forEachRemaining(entries::add);
        entries.sort(Comparator.comparingLong(e -> Long.parseLong(e.getKey())));
        for (Map.Entry<String, JsonNode> entry : entries) {
            long timestamp = Long.parseLong(entry.getKey());
            LocalDate date = Instant.ofEpochSecond(timestamp).atZone(ZONE).toLocalDate();
            List<WeReadNote> daily = new ArrayList<>();
            for (WeReadNote note : periodNotes)
                if (note.getSourceCreatedAt() != null && date.equals(note.getSourceCreatedAt().atZone(ZONE).toLocalDate()))
                    daily.add(note);
            LinkedHashSet<String> titles = new LinkedHashSet<>();
            for (WeReadNote note : daily) {
                WeReadNotebook book = books.get(note.getBookId());
                if (book != null) titles.add(book.getTitle());
            }
            ObjectNode row = json.createObjectNode();
            row.put("timestamp", entry.getKey());
            row.put("date", date.toString());
            row.put("seconds", entry.getValue().asLong());
            row.put("noteCount", daily.size());
            row.set("books", json.valueToTree(titles));
            result.add(row);
        }
        return result;
    }

    private ArrayNode books(JsonNode longest, List<WeReadNote> periodNotes, Map<String, WeReadNotebook> cached) {
        ArrayNode result = json.createArrayNode();
        if (!longest.isArray()) return result;
        for (JsonNode item : longest) {
            JsonNode source = item.has("book") ? item.path("book") : item.path("albumInfo");
            String id = source.path("bookId").asText(source.path("albumId").asText(""));
            WeReadNotebook notebook = cached.get(id);
            int highlights = 0, written = 0;
            for (WeReadNote note : periodNotes)
                if (id.equals(note.getBookId())) {
                    if ("HIGHLIGHT".equals(note.getNoteType())) highlights++;
                    if (note.getContent() != null && !note.getContent().trim().isEmpty()) written++;
                }
            ObjectNode row = json.createObjectNode();
            row.put("bookId", id);
            row.put("title", source.path("title").asText(source.path("name").asText("未命名")));
            row.put("author", source.path("author").asText(source.path("authorName").asText("")));
            row.put("cover", source.path("cover").asText(""));
            row.put("seconds", item.path("readTime").asLong(0));
            row.put("progress", notebook == null ? 0 : notebook.getReadingProgress());
            row.put("noteCount", written);
            row.put("highlightCount", highlights);
            result.add(row);
        }
        return result;
    }

    private ArrayNode highlights(List<WeReadNote> periodNotes, Map<String, WeReadNotebook> books) {
        List<WeReadNote> values = new ArrayList<>();
        for (WeReadNote note : periodNotes)
            if (note.getOriginalText() != null && !note.getOriginalText().trim().isEmpty() && "HIGHLIGHT".equals(note.getNoteType()))
                values.add(note);
        values.sort((a, b) -> Integer.compare(highlightScore(b), highlightScore(a)));
        ArrayNode result = json.createArrayNode();
        for (WeReadNote note : values) result.add(noteJson(note, books));
        return result;
    }

    private int highlightScore(WeReadNote note) {
        int length = note.getOriginalText().length();
        return (length >= 30 && length <= 150 ? 20 : 0) + (note.getContent() != null && !note.getContent().trim().isEmpty() ? 50 : 0);
    }

    private ArrayNode writtenNotes(List<WeReadNote> periodNotes, Map<String, WeReadNotebook> books) {
        List<WeReadNote> values = new ArrayList<>();
        for (WeReadNote note : periodNotes)
            if (note.getContent() != null && !note.getContent().trim().isEmpty()) values.add(note);
        values.sort((a, b) -> Integer.compare(b.getContent().length(), a.getContent().length()));
        ArrayNode result = json.createArrayNode();
        for (WeReadNote note : values) result.add(noteJson(note, books));
        return result;
    }

    private ObjectNode noteJson(WeReadNote note, Map<String, WeReadNotebook> books) {
        WeReadNotebook book = books.get(note.getBookId());
        ObjectNode row = json.createObjectNode();
        row.put("id", note.getId());
        row.put("bookId", note.getBookId());
        row.put("bookTitle", book == null ? "" : book.getTitle());
        row.put("author", book == null ? "" : book.getAuthor());
        row.put("chapter", note.getChapterTitle());
        row.put("quote", note.getOriginalText());
        row.put("content", note.getContent());
        row.put("createdAt", note.getSourceCreatedAt() == null ? null : note.getSourceCreatedAt().toString());
        return row;
    }

    /**
     * 每个自然周只生成一枚胶囊，优先使用一个月前前后 3 天内的划线或想法。
     */
    @Transactional
    public Map<String, Object> currentCapsule(Long userId) {
        LocalDate today = LocalDate.now(ZONE), week = today.with(java.time.DayOfWeek.MONDAY);
        ReadingCapsule capsule = capsules.findByUserIdAndCapsuleDate(userId, week).orElseGet(() -> createCapsule(userId, week, today.minusMonths(1)));
        if ("DISMISSED".equals(capsule.getStatus())) return Collections.singletonMap("available", false);
        if (capsule.getShownAt() == null) {
            capsule.setShownAt(Instant.now());
            capsule.setStatus("SHOWN");
            capsules.save(capsule);
        }
        Map<String, Object> result = capsuleView(capsule);
        result.put("available", true);
        return result;
    }

    private ReadingCapsule createCapsule(Long userId, LocalDate capsuleDate, LocalDate target) {
        Instant from = target.minusDays(3).atStartOfDay(ZONE).toInstant(), to = target.plusDays(4).atStartOfDay(ZONE).toInstant();
        List<WeReadNote> candidates = notes.findByUserIdAndSourceCreatedAtBetweenOrderBySourceCreatedAtDesc(userId, from, to);
        ReadingCapsule capsule = new ReadingCapsule();
        capsule.setUserId(userId);
        capsule.setCapsuleDate(capsuleDate);
        capsule.setSourceDate(target);
        ObjectNode content = json.createObjectNode();
        if (!candidates.isEmpty()) {
            WeReadNote note = candidates.get(0);
            capsule.setSourceDate(note.getSourceCreatedAt().atZone(ZONE).toLocalDate());
            capsule.setSourceType(note.getOriginalText() != null ? "HIGHLIGHT" : "THOUGHT");
            capsule.setSourceBookId(note.getBookId());
            capsule.setSourceNoteId(note.getId());
            WeReadNotebook book = notebooks.findByUserIdAndBookId(userId, note.getBookId()).orElse(null);
            content.put("title", book == null ? "一本旧书" : book.getTitle());
            content.put("author", book == null ? "" : book.getAuthor());
            content.put("cover", book == null ? "" : book.getCoverUrl());
            content.put("chapter", note.getChapterTitle());
            content.put("quote", note.getOriginalText());
            content.put("thought", note.getContent());
            content.put("message", "一个月前，你曾在这本书里停留。");
        } else {
            capsule.setSourceType("QUIET_DAY");
            content.put("title", "一个安静的阅读日");
            content.put("message", "一个月前的这一周没有找到可展示的划线。空白也是阅读生活的一部分。");
        }
        capsule.setContentJson(write(content));
        return capsules.save(capsule);
    }

    @Transactional
    public Map<String, Object> reflect(Long userId, Long capsuleId, String content) {
        if (content == null || content.trim().isEmpty() || content.trim().length() > 2000)
            throw new IllegalArgumentException("回顾内容需为 1–2000 个字符");
        ReadingCapsule capsule = capsules.findByIdAndUserId(capsuleId, userId).orElseThrow(() -> new IllegalArgumentException("胶囊不存在"));
        CapsuleReflection reflection = reflections.findByUserIdAndCapsuleId(userId, capsuleId).orElseGet(CapsuleReflection::new);
        reflection.setUserId(userId);
        reflection.setCapsuleId(capsule.getId());
        reflection.setContent(content.trim());
        reflection.setUpdatedAt(Instant.now());
        reflections.save(reflection);
        return capsuleView(capsule);
    }

    @Transactional
    public void dismiss(Long userId, Long capsuleId) {
        ReadingCapsule capsule = capsules.findByIdAndUserId(capsuleId, userId).orElseThrow(() -> new IllegalArgumentException("胶囊不存在"));
        capsule.setStatus("DISMISSED");
        capsule.setDismissedAt(Instant.now());
        capsules.save(capsule);
    }

    private Map<String, Object> capsuleView(ReadingCapsule capsule) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", capsule.getId());
        result.put("sourceDate", capsule.getSourceDate());
        result.put("sourceType", capsule.getSourceType());
        result.put("status", capsule.getStatus());
        result.put("content", read(capsule.getContentJson()));
        CapsuleReflection reflection = reflections.findByUserIdAndCapsuleId(capsule.getUserId(), capsule.getId()).orElse(null);
        result.put("reflection", reflection == null ? null : reflection.getContent());
        return result;
    }

    private Map<String, Object> view(ReadingReport report, boolean share) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", report.getId());
        result.put("periodType", report.getPeriodType());
        result.put("periodStart", report.getPeriodStart());
        result.put("periodEnd", report.getPeriodEnd());
        result.put("generatedAt", report.getGeneratedAt());
        result.put("snapshot", read(share ? report.getShareJson() : report.getReportJson()));
        return result;
    }

    private String apiKey(Long userId) {
        WeReadCredential value = credentials.findById(userId).orElseThrow(() -> new IllegalArgumentException("请先绑定微信读书 API Key"));
        return crypto.decrypt(value.getEncryptedApiKey());
    }

    private Map<String, Object> params(String mode, LocalDate date) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("mode", mode);
        value.put("baseTime", date.atStartOfDay(ZONE).toEpochSecond());
        return value;
    }

    private String type(String value) {
        String normalized = value == null ? "" : value.toUpperCase(Locale.ROOT);
        if (!"WEEKLY".equals(normalized) && !"MONTHLY".equals(normalized))
            throw new IllegalArgumentException("报告类型仅支持 WEEKLY 或 MONTHLY");
        return normalized;
    }

    LocalDate latestCompletedStart(String type, LocalDate today) {
        return "WEEKLY".equals(type) ? today.with(java.time.DayOfWeek.MONDAY).minusWeeks(1) : today.withDayOfMonth(1).minusMonths(1);
    }

    private int number(String value) {
        String digits = value == null ? "" : value.replaceAll("[^0-9]", "");
        return digits.isEmpty() ? 0 : Integer.parseInt(digits);
    }

    private int snapshotVersion(ReadingReport report) {
        try {
            return json.readTree(report.getReportJson()).path("snapshotVersion").asInt(1);
        } catch (Exception e) {
            return 1;
        }
    }

    private String write(JsonNode value) {
        try {
            return json.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("阅读记忆快照生成失败");
        }
    }

    private JsonNode read(String value) {
        try {
            return json.readTree(value);
        } catch (Exception e) {
            throw new IllegalStateException("阅读记忆快照读取失败");
        }
    }
}
