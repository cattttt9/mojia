package com.inkshelf.weread;

import javax.persistence.*;
import java.time.Instant;

/**
 * 用户维度的单本书笔记概览；只保存数量和阅读进度，不保存书签正文。
 */
@Entity
@Table(name = "weread_notebook", uniqueConstraints = @UniqueConstraint(name = "uk_weread_notebook_user_book", columnNames = {"user_id", "book_id"}))
public class WeReadNotebook {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(name = "book_id", nullable = false, length = 64)
    private String bookId;
    @Column(nullable = false, length = 300)
    private String title;
    @Column(length = 300)
    private String author;
    @Column(name = "cover_url")
    private String coverUrl;
    @Column(name = "review_count", nullable = false)
    private int reviewCount;
    @Column(name = "note_count", nullable = false)
    private int noteCount;
    @Column(name = "bookmark_count", nullable = false)
    private int bookmarkCount;
    @Column(name = "reading_progress", nullable = false)
    private int readingProgress;
    @Column(name = "marked_status", nullable = false)
    private int markedStatus;
    @Column(name = "source_sort")
    private Long sourceSort;
    @Column(name = "synced_at", nullable = false)
    private Instant syncedAt = Instant.now();

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long v) {
        userId = v;
    }

    public String getBookId() {
        return bookId;
    }

    public void setBookId(String v) {
        bookId = v;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String v) {
        title = v;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String v) {
        author = v;
    }

    public String getCoverUrl() {
        return coverUrl;
    }

    public void setCoverUrl(String v) {
        coverUrl = v;
    }

    public int getReviewCount() {
        return reviewCount;
    }

    public void setReviewCount(int v) {
        reviewCount = v;
    }

    public int getNoteCount() {
        return noteCount;
    }

    public void setNoteCount(int v) {
        noteCount = v;
    }

    public int getBookmarkCount() {
        return bookmarkCount;
    }

    public void setBookmarkCount(int v) {
        bookmarkCount = v;
    }

    public int getReadingProgress() {
        return readingProgress;
    }

    public void setReadingProgress(int v) {
        readingProgress = v;
    }

    public int getMarkedStatus() {
        return markedStatus;
    }

    public void setMarkedStatus(int v) {
        markedStatus = v;
    }

    public Long getSourceSort() {
        return sourceSort;
    }

    public void setSourceSort(Long v) {
        sourceSort = v;
    }

    public Instant getSyncedAt() {
        return syncedAt;
    }

    public void setSyncedAt(Instant v) {
        syncedAt = v;
    }
}
