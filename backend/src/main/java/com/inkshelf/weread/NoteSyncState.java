package com.inkshelf.weread;

import javax.persistence.*;
import java.time.Instant;

/**
 * 笔记同步状态；只保存游标和脱敏错误码，不保存笔记正文或 API Key。
 */
@Entity
@Table(name = "note_sync_state", uniqueConstraints = @UniqueConstraint(name = "uk_note_sync_state_user_scope", columnNames = {"user_id", "scope"}))
public class NoteSyncState {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(nullable = false, length = 96)
    private String scope;
    @Column(name = "cursor_value", length = 128)
    private String cursorValue;
    @Column(nullable = false, length = 16)
    private String status = "IDLE";
    @Column(name = "last_attempt_at")
    private Instant lastAttemptAt;
    @Column(name = "last_success_at")
    private Instant lastSuccessAt;
    @Column(name = "error_code", length = 64)
    private String errorCode;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long v) {
        userId = v;
    }

    public String getScope() {
        return scope;
    }

    public void setScope(String v) {
        scope = v;
    }

    public String getCursorValue() {
        return cursorValue;
    }

    public void setCursorValue(String v) {
        cursorValue = v;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String v) {
        status = v;
    }

    public Instant getLastAttemptAt() {
        return lastAttemptAt;
    }

    public void setLastAttemptAt(Instant v) {
        lastAttemptAt = v;
    }

    public Instant getLastSuccessAt() {
        return lastSuccessAt;
    }

    public void setLastSuccessAt(Instant v) {
        lastSuccessAt = v;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public void setErrorCode(String v) {
        errorCode = v;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant v) {
        updatedAt = v;
    }
}
