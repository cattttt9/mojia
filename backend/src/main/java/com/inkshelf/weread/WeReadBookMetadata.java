package com.inkshelf.weread;

import javax.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "weread_book_metadata")
/** 公共书籍元数据缓存；不保存某位用户是否收藏或阅读过该书。 */
public class WeReadBookMetadata {
    @Id
    @Column(name = "book_id", length = 64)
    private String bookId;
    @Column(name = "word_count")
    private Long wordCount;
    @Column(name = "cover_url", columnDefinition = "TEXT")
    private String coverUrl;
    @Column(name = "cover_fetched_at")
    private Instant coverFetchedAt;
    @Column(name = "status", nullable = false, length = 16)
    private String status = "PENDING";
    @Column(name = "fetched_at")
    private Instant fetchedAt;
    @Column(name = "last_attempt_at")
    private Instant lastAttemptAt;
    @Column(name = "next_retry_at")
    private Instant nextRetryAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public String getBookId() {
        return bookId;
    }

    public void setBookId(String v) {
        bookId = v;
    }

    public Long getWordCount() {
        return wordCount;
    }

    public void setWordCount(Long v) {
        wordCount = v;
    }

    public String getCoverUrl() {
        return coverUrl;
    }

    public void setCoverUrl(String v) {
        coverUrl = v;
    }

    public Instant getCoverFetchedAt() {
        return coverFetchedAt;
    }

    public void setCoverFetchedAt(Instant v) {
        coverFetchedAt = v;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String v) {
        status = v;
    }

    public Instant getFetchedAt() {
        return fetchedAt;
    }

    public void setFetchedAt(Instant v) {
        fetchedAt = v;
    }

    public Instant getLastAttemptAt() {
        return lastAttemptAt;
    }

    public void setLastAttemptAt(Instant v) {
        lastAttemptAt = v;
    }

    public Instant getNextRetryAt() {
        return nextRetryAt;
    }

    public void setNextRetryAt(Instant v) {
        nextRetryAt = v;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant v) {
        updatedAt = v;
    }
}
