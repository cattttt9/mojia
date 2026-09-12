package com.inkshelf.user;

import javax.persistence.*;
import java.time.Instant;

/**
 * 记录单个用户的书架、笔记和书签同步进度以及最近一次失败信息。
 */
@Entity
@Table(name = "user_sync_state")
public class UserSyncState {
    @Id
    @Column(name = "user_id")
    private Long userId;
    @Column(name = "shelf_status", nullable = false, length = 16)
    private String shelfStatus = "IDLE";
    @Column(name = "shelf_last_sync_at")
    private Instant shelfLastSyncAt;
    @Column(name = "shelf_count", nullable = false)
    private int shelfCount;
    @Column(name = "note_status", nullable = false, length = 16)
    private String noteStatus = "IDLE";
    @Column(name = "note_last_sync_at")
    private Instant noteLastSyncAt;
    @Column(name = "note_count", nullable = false)
    private int noteCount;
    @Column(name = "bookmark_status", nullable = false, length = 16)
    private String bookmarkStatus = "IDLE";
    @Column(name = "bookmark_last_sync_at")
    private Instant bookmarkLastSyncAt;
    @Column(name = "bookmark_count", nullable = false)
    private int bookmarkCount;
    @Column(name = "last_error_code", length = 80)
    private String lastErrorCode;
    @Column(name = "last_error_message", length = 255)
    private String lastErrorMessage;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getUserId() { return userId; }
    public void setUserId(Long v) { userId = v; }
    public String getShelfStatus() { return shelfStatus; }
    public void setShelfStatus(String v) { shelfStatus = v; }
    public Instant getShelfLastSyncAt() { return shelfLastSyncAt; }
    public void setShelfLastSyncAt(Instant v) { shelfLastSyncAt = v; }
    public int getShelfCount() { return shelfCount; }
    public void setShelfCount(int v) { shelfCount = v; }
    public String getNoteStatus() { return noteStatus; }
    public void setNoteStatus(String v) { noteStatus = v; }
    public Instant getNoteLastSyncAt() { return noteLastSyncAt; }
    public void setNoteLastSyncAt(Instant v) { noteLastSyncAt = v; }
    public int getNoteCount() { return noteCount; }
    public void setNoteCount(int v) { noteCount = v; }
    public String getBookmarkStatus() { return bookmarkStatus; }
    public void setBookmarkStatus(String v) { bookmarkStatus = v; }
    public Instant getBookmarkLastSyncAt() { return bookmarkLastSyncAt; }
    public void setBookmarkLastSyncAt(Instant v) { bookmarkLastSyncAt = v; }
    public int getBookmarkCount() { return bookmarkCount; }
    public void setBookmarkCount(int v) { bookmarkCount = v; }
    public String getLastErrorCode() { return lastErrorCode; }
    public void setLastErrorCode(String v) { lastErrorCode = v; }
    public String getLastErrorMessage() { return lastErrorMessage; }
    public void setLastErrorMessage(String v) { lastErrorMessage = v; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant v) { updatedAt = v; }
}
