package com.inkshelf.weread;

import com.inkshelf.user.AppUser;

import javax.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "weread_credential")
/** 用户微信读书凭据；API Key 在写入该实体前已经完成加密。 */
public class WeReadCredential {
    @Id
    @Column(name = "user_id")
    private Long userId;
    @MapsId
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private AppUser user;
    @Column(name = "encrypted_api_key", nullable = false)
    private String encryptedApiKey;
    @Column(name = "key_hint", nullable = false, length = 12)
    private String keyHint;
    @Column(name = "api_key_last4", length = 8)
    private String apiKeyLast4;
    @Column(name = "connected_at")
    private Instant connectedAt;
    @Column(name = "last_verified_at")
    private Instant lastVerifiedAt;
    @Column(name = "last_sync_at")
    private Instant lastSyncAt;
    @Column(name = "last_sync_status", nullable = false, length = 16)
    private String lastSyncStatus = "UNKNOWN";
    @Column(name = "last_sync_error", length = 80)
    private String lastSyncError;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getUserId() {
        return userId;
    }

    public AppUser getUser() {
        return user;
    }

    public void setUser(AppUser v) {
        user = v;
    }

    public String getEncryptedApiKey() {
        return encryptedApiKey;
    }

    public void setEncryptedApiKey(String v) {
        encryptedApiKey = v;
    }

    public String getKeyHint() {
        return keyHint;
    }

    public void setKeyHint(String v) {
        keyHint = v;
    }

    public String getApiKeyLast4() {
        return apiKeyLast4;
    }

    public void setApiKeyLast4(String v) {
        apiKeyLast4 = v;
    }

    public Instant getConnectedAt() {
        return connectedAt;
    }

    public void setConnectedAt(Instant v) {
        connectedAt = v;
    }

    public Instant getLastVerifiedAt() {
        return lastVerifiedAt;
    }

    public void setLastVerifiedAt(Instant v) {
        lastVerifiedAt = v;
    }

    public Instant getLastSyncAt() {
        return lastSyncAt;
    }

    public void setLastSyncAt(Instant v) {
        lastSyncAt = v;
    }

    public String getLastSyncStatus() {
        return lastSyncStatus;
    }

    public void setLastSyncStatus(String v) {
        lastSyncStatus = v;
    }

    public String getLastSyncError() {
        return lastSyncError;
    }

    public void setLastSyncError(String v) {
        lastSyncError = v;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant v) {
        updatedAt = v;
    }
}
