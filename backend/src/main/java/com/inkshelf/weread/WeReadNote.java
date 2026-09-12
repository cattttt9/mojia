package com.inkshelf.weread;

import javax.persistence.*;
import java.time.Instant;

/**
 * 私密笔记内容；所有查询必须同时限定 userId 和 bookId。
 */
@Entity
@Table(name = "weread_note", uniqueConstraints = @UniqueConstraint(name = "uk_weread_note_user_source", columnNames = {"user_id", "source_id", "note_type"}))
public class WeReadNote {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(name = "book_id", nullable = false, length = 64)
    private String bookId;
    @Column(name = "source_id", nullable = false, length = 128)
    private String sourceId;
    @Column(name = "note_type", nullable = false, length = 24)
    private String noteType;
    @Column(name = "chapter_uid", length = 64)
    private String chapterUid;
    @Column(name = "chapter_title", length = 500)
    private String chapterTitle;
    @Column(name = "original_text", columnDefinition = "TEXT")
    private String originalText;
    @Column(columnDefinition = "TEXT")
    private String content;
    @Column(name = "source_range", length = 128)
    private String sourceRange;
    @Column(name = "source_created_at")
    private Instant sourceCreatedAt;
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

    public String getSourceId() {
        return sourceId;
    }

    public void setSourceId(String v) {
        sourceId = v;
    }

    public String getNoteType() {
        return noteType;
    }

    public void setNoteType(String v) {
        noteType = v;
    }

    public String getChapterUid() {
        return chapterUid;
    }

    public void setChapterUid(String v) {
        chapterUid = v;
    }

    public String getChapterTitle() {
        return chapterTitle;
    }

    public void setChapterTitle(String v) {
        chapterTitle = v;
    }

    public String getOriginalText() {
        return originalText;
    }

    public void setOriginalText(String v) {
        originalText = v;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String v) {
        content = v;
    }

    public String getSourceRange() {
        return sourceRange;
    }

    public void setSourceRange(String v) {
        sourceRange = v;
    }

    public Instant getSourceCreatedAt() {
        return sourceCreatedAt;
    }

    public void setSourceCreatedAt(Instant v) {
        sourceCreatedAt = v;
    }

    public Instant getSyncedAt() {
        return syncedAt;
    }

    public void setSyncedAt(Instant v) {
        syncedAt = v;
    }
}
