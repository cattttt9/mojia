package com.inkshelf.weread;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;

import java.time.*;
import java.util.*;

/**
 * 微信读书个人笔记同步与用户隔离查询。
 */
@Service
public class WeReadNoteService {
    private static final String NOTEBOOKS = "NOTEBOOKS";
    private final WeReadCredentialRepository credentials;
    private final SecretCryptoService crypto;
    private final WeReadGatewayClient gateway;
    private final WeReadNotebookRepository notebooks;
    private final WeReadNoteRepository notes;
    private final NoteSyncStateRepository states;
    private final WeReadNotePersistenceService persistence;

    public WeReadNoteService(WeReadCredentialRepository c, SecretCryptoService s, WeReadGatewayClient g, WeReadNotebookRepository n, WeReadNoteRepository r, NoteSyncStateRepository st, WeReadNotePersistenceService p) {
        credentials = c;
        crypto = s;
        gateway = g;
        notebooks = n;
        notes = r;
        states = st;
        persistence = p;
    }

    /**
     * 同步所有笔记本概览；非强制请求在 12 小时内直接使用快照。
     */
    public Map<String, Object> syncOverview(Long userId, boolean force) {
        NoteSyncState state = state(userId, NOTEBOOKS);
        if (!force && fresh(state, Duration.ofHours(12))) return overviewResult(userId, state, false);
        if (!begin(state)) return overviewResult(userId, currentState(userId, NOTEBOOKS, state), false);
        try {
            String key = key(userId);
            List<WeReadNotebook> all = new ArrayList<>();
            Long lastSort = null;
            int pages = 0;
            do {
                Map<String, Object> params = new LinkedHashMap<>();
                params.put("count", 100);
                if (lastSort != null) params.put("lastSort", lastSort);
                JsonNode result = gateway.call(key, "/user/notebooks", params);
                JsonNode page = result.path("books");
                if (page.isArray()) for (JsonNode item : page) all.add(notebook(userId, item));
                boolean more = result.path("hasMore").asInt(0) == 1;
                if (!more || page.size() == 0) break;
                lastSort = page.get(page.size() - 1).path("sort").asLong();
                state.setCursorValue(String.valueOf(lastSort));
                states.save(state);
            } while (++pages < 100);
            persistence.saveNotebooks(all);
            success(state);
            return overviewResult(userId, state, true);
        } catch (Exception e) {
            failed(state, "UPSTREAM_SYNC_FAILED");
            throw e;
        }
    }

    /**
     * 拉取单本书全部可导出内容：划线 + 个人想法/点评；书签仍只保留数量。
     */
    public Map<String, Object> syncBook(Long userId, String bookId, boolean force) {
        validateBookId(bookId);
        String scope = "BOOK:" + bookId;
        NoteSyncState state = state(userId, scope);
        if (!force && fresh(state, Duration.ofHours(6))) return summary(userId, bookId);
        if (!begin(state)) return summary(userId, bookId);
        try {
            String key = key(userId);
            JsonNode bookmarks = gateway.call(key, "/book/bookmarklist", Collections.singletonMap("bookId", bookId));
            Map<String, String> chapters = chapters(bookmarks.path("chapters"));
            List<WeReadNote> collected = new ArrayList<>();
            JsonNode highlights = bookmarks.path("updated");
            if (highlights.isArray()) for (JsonNode item : highlights) {
                String id = item.path("bookmarkId").asText("");
                if (!id.isEmpty()) collected.add(highlight(userId, bookId, item, chapters));
            }
            long synckey = 0;
            int pages = 0;
            do {
                Map<String, Object> params = new LinkedHashMap<>();
                params.put("bookid", bookId);
                params.put("synckey", synckey);
                params.put("count", 100);
                JsonNode result = gateway.call(key, "/review/list/mine", params);
                JsonNode page = result.path("reviews");
                if (page.isArray()) for (JsonNode wrapper : page) {
                    JsonNode review = wrapper.has("review") ? wrapper.path("review") : wrapper;
                    String id = review.path("reviewId").asText("");
                    if (!id.isEmpty()) collected.add(review(userId, bookId, review, chapters));
                }
                if (result.path("hasMore").asInt(0) != 1 || page.size() == 0) break;
                long next = result.path("synckey").asLong(synckey);
                if (next == synckey) break;
                synckey = next;
                state.setCursorValue(String.valueOf(synckey));
                states.save(state);
            } while (++pages < 100);
            persistence.replaceNotes(userId, bookId, collected);
            success(state);
            return summary(userId, bookId);
        } catch (Exception e) {
            failed(state, "UPSTREAM_SYNC_FAILED");
            throw e;
        }
    }

    public Map<String, Object> summary(Long userId, String bookId) {
        validateBookId(bookId);
        WeReadNotebook notebook = notebooks.findByUserIdAndBookId(userId, bookId).orElse(null);
        List<WeReadNote> content = notes.findByUserIdAndBookIdOrderBySourceCreatedAtDesc(userId, bookId);
        int highlights = 0, thoughts = 0, reviews = 0;
        for (WeReadNote note : content)
            if ("HIGHLIGHT".equals(note.getNoteType())) highlights++;
            else if ("THOUGHT".equals(note.getNoteType())) thoughts++;
            else reviews++;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("bookId", bookId);
        result.put("reviewCount", notebook == null ? reviews : notebook.getReviewCount());
        result.put("highlightCount", notebook == null ? highlights : notebook.getNoteCount());
        result.put("bookmarkCount", notebook == null ? 0 : notebook.getBookmarkCount());
        result.put("readingProgress", notebook == null ? 0 : notebook.getReadingProgress());
        result.put("markedStatus", notebook == null ? 0 : notebook.getMarkedStatus());
        result.put("cachedContentCount", content.size());
        result.put("sync", syncView(states.findByUserIdAndScope(userId, "BOOK:" + bookId).orElse(null)));
        return result;
    }

    public Map<String, Object> list(Long userId, String bookId) {
        validateBookId(bookId);
        List<Map<String, Object>> items = new ArrayList<>();
        for (WeReadNote note : notes.findByUserIdAndBookIdOrderBySourceCreatedAtDesc(userId, bookId)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", note.getId());
            row.put("type", note.getNoteType());
            row.put("chapterUid", note.getChapterUid());
            row.put("chapterTitle", note.getChapterTitle());
            row.put("originalText", note.getOriginalText());
            row.put("content", note.getContent());
            row.put("createdAt", note.getSourceCreatedAt());
            items.add(row);
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        result.put("summary", summary(userId, bookId));
        return result;
    }

    /**
     * 返回书籍公开信息和当前用户阅读进度；deepLink 仅在上游确实返回时透传。
     */
    public Map<String, Object> reading(Long userId, String bookId) {
        validateBookId(bookId);
        String key = key(userId);
        JsonNode info = gateway.call(key, "/book/info", Collections.singletonMap("bookId", bookId));
        JsonNode progress = gateway.call(key, "/book/getprogress", Collections.singletonMap("bookId", bookId));
        JsonNode book = progress.path("book");
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("bookId", bookId);
        result.put("title", info.path("title").asText(""));
        result.put("author", info.path("author").asText(""));
        result.put("category", info.path("category").asText(""));
        result.put("cover", info.path("cover").asText(""));
        result.put("intro", info.path("intro").asText(""));
        result.put("deepLink", info.hasNonNull("deepLink") ? info.path("deepLink").asText() : null);
        result.put("progress", book.path("progress").asInt(0));
        result.put("readingTime", resolveReadingTime(book));
        result.put("ttsTime", book.path("ttsTime").asLong(0));
        result.put("updateTime", book.path("updateTime").asLong(0));
        return result;
    }

    /**
     * 实际回包以 readingTime 表示电子书累计阅读秒数；旧回包缺失时兼容 recordReadingTime。
     */
    long resolveReadingTime(JsonNode book) {
        long reading = book.path("readingTime").asLong(0);
        return reading > 0 ? reading : book.path("recordReadingTime").asLong(0);
    }

    private WeReadNotebook notebook(Long userId, JsonNode item) {
        JsonNode book = item.path("book");
        WeReadNotebook value = new WeReadNotebook();
        value.setUserId(userId);
        value.setBookId(item.path("bookId").asText(book.path("bookId").asText()));
        value.setTitle(book.path("title").asText("未命名"));
        value.setAuthor(book.path("author").asText(""));
        value.setCoverUrl(book.path("cover").asText(null));
        value.setReviewCount(item.path("reviewCount").asInt(0));
        value.setNoteCount(item.path("noteCount").asInt(0));
        value.setBookmarkCount(item.path("bookmarkCount").asInt(0));
        value.setReadingProgress(item.path("readingProgress").asInt(0));
        value.setMarkedStatus(item.path("markedStatus").asInt(0));
        if (item.hasNonNull("sort")) value.setSourceSort(item.path("sort").asLong());
        value.setSyncedAt(Instant.now());
        return value;
    }

    private WeReadNote highlight(Long userId, String bookId, JsonNode item, Map<String, String> chapters) {
        WeReadNote note = base(userId, bookId, item.path("bookmarkId").asText(), "HIGHLIGHT", item.path("chapterUid").asText(null), chapters);
        note.setOriginalText(item.path("markText").asText(null));
        note.setSourceRange(item.path("range").asText(null));
        note.setSourceCreatedAt(time(item.path("createTime").asLong(0)));
        return note;
    }

    private WeReadNote review(Long userId, String bookId, JsonNode item, Map<String, String> chapters) {
        String original = item.path("abstract").asText("");
        String chapter = item.path("chapterUid").asText(null);
        String type = !original.isEmpty() ? "THOUGHT" : (chapter != null || item.hasNonNull("chapterName")) ? "CHAPTER_REVIEW" : "BOOK_REVIEW";
        WeReadNote note = base(userId, bookId, item.path("reviewId").asText(), type, chapter, chapters);
        if (item.hasNonNull("chapterName")) note.setChapterTitle(item.path("chapterName").asText());
        note.setOriginalText(original.isEmpty() ? null : original);
        note.setContent(item.path("content").asText(null));
        note.setSourceRange(item.path("range").asText(null));
        note.setSourceCreatedAt(time(item.path("createTime").asLong(0)));
        return note;
    }

    private WeReadNote base(Long userId, String bookId, String sourceId, String type, String chapterUid, Map<String, String> chapters) {
        WeReadNote note = new WeReadNote();
        note.setUserId(userId);
        note.setBookId(bookId);
        note.setSourceId(sourceId);
        note.setNoteType(type);
        note.setChapterUid(chapterUid);
        note.setChapterTitle(chapters.get(chapterUid));
        note.setSyncedAt(Instant.now());
        return note;
    }

    private Map<String, String> chapters(JsonNode values) {
        Map<String, String> result = new HashMap<>();
        if (values.isArray()) for (JsonNode chapter : values)
            result.put(chapter.path("chapterUid").asText(), chapter.path("title").asText("未分章"));
        return result;
    }

    private String key(Long userId) {
        WeReadCredential credential = credentials.findById(userId).orElseThrow(() -> new IllegalArgumentException("请先绑定微信读书 API Key"));
        return crypto.decrypt(credential.getEncryptedApiKey());
    }

    private NoteSyncState state(Long userId, String scope) {
        Optional<NoteSyncState> existing = states.findByUserIdAndScope(userId, scope);
        if (existing.isPresent()) return existing.get();
        states.insertIfAbsent(userId, scope, Instant.now());
        return states.findByUserIdAndScope(userId, scope)
                .orElseThrow(() -> new IllegalStateException("同步状态初始化失败"));
    }

    private boolean begin(NoteSyncState state) {
        Instant attemptedAt = Instant.now();
        if (states.tryBegin(state.getId(), attemptedAt, attemptedAt.minus(Duration.ofMinutes(10))) == 0) return false;
        state.setStatus("SYNCING");
        state.setLastAttemptAt(attemptedAt);
        state.setErrorCode(null);
        state.setUpdatedAt(attemptedAt);
        return true;
    }

    private NoteSyncState currentState(Long userId, String scope, NoteSyncState fallback) {
        return states.findByUserIdAndScope(userId, scope).orElse(fallback);
    }

    private void success(NoteSyncState state) {
        state.setStatus("SUCCESS");
        state.setLastSuccessAt(Instant.now());
        state.setErrorCode(null);
        state.setUpdatedAt(Instant.now());
        states.save(state);
    }

    private void failed(NoteSyncState state, String code) {
        state.setStatus("FAILED");
        state.setErrorCode(code);
        state.setUpdatedAt(Instant.now());
        states.save(state);
    }

    private boolean fresh(NoteSyncState state, Duration duration) {
        return state.getLastSuccessAt() != null && state.getLastSuccessAt().isAfter(Instant.now().minus(duration));
    }

    private Map<String, Object> overviewResult(Long userId, NoteSyncState state, boolean refreshed) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("notebookCount", notebooks.findByUserIdOrderBySourceSortDesc(userId).size());
        result.put("refreshed", refreshed);
        result.put("sync", syncView(state));
        return result;
    }

    private Map<String, Object> syncView(NoteSyncState state) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", state == null ? "IDLE" : state.getStatus());
        result.put("lastSuccessAt", state == null ? null : state.getLastSuccessAt());
        result.put("errorCode", state == null ? null : state.getErrorCode());
        return result;
    }

    private Instant time(long value) {
        if (value <= 0) return null;
        if (value > 100000000000L) value /= 1000;
        return Instant.ofEpochSecond(value);
    }

    private void validateBookId(String bookId) {
        if (bookId == null || !bookId.matches("[A-Za-z0-9_-]{1,64}"))
            throw new IllegalArgumentException("书籍 ID 格式不正确");
    }
}
