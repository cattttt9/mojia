package com.inkshelf.invitation;

import com.inkshelf.user.AppUser;

import javax.persistence.*;
import java.time.Instant;

/**
 * 一次性注册邀请码；完整邀请码不落库，只保存不可逆摘要与脱敏值。
 */
@Entity
@Table(name = "invitation_code")
public class InvitationCode {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    // SHA-256 十六进制摘要始终为 64 位；V9 使用 VARCHAR(64) 兼容 Hibernate 5.6 的 String 映射。
    @Column(name = "code_hash", nullable = false, unique = true, length = 64)
    private String codeHash;
    @Column(name = "code_masked", nullable = false, length = 20)
    private String codeMasked;
    @Column(nullable = false, length = 16)
    private String status = "UNUSED";
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by_user_id")
    private AppUser createdBy;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
    @Column(name = "expires_at")
    private Instant expiresAt;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "used_by_user_id")
    private AppUser usedBy;
    @Column(name = "used_at")
    private Instant usedAt;
    @Column(name = "used_registration_ip", length = 64)
    private String usedRegistrationIp;
    @Column(name = "used_request_id", length = 64)
    private String usedRequestId;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "disabled_by_user_id")
    private AppUser disabledBy;
    @Column(name = "disabled_at")
    private Instant disabledAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getId() {
        return id;
    }

    public String getCodeHash() {
        return codeHash;
    }

    public void setCodeHash(String value) {
        codeHash = value;
    }

    public String getCodeMasked() {
        return codeMasked;
    }

    public void setCodeMasked(String value) {
        codeMasked = value;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String value) {
        status = value;
    }

    public AppUser getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(AppUser value) {
        createdBy = value;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant value) {
        expiresAt = value;
    }

    public AppUser getUsedBy() {
        return usedBy;
    }

    public void setUsedBy(AppUser value) {
        usedBy = value;
    }

    public Instant getUsedAt() {
        return usedAt;
    }

    public void setUsedAt(Instant value) {
        usedAt = value;
    }

    public String getUsedRegistrationIp() {
        return usedRegistrationIp;
    }

    public void setUsedRegistrationIp(String value) {
        usedRegistrationIp = value;
    }

    public String getUsedRequestId() {
        return usedRequestId;
    }

    public void setUsedRequestId(String value) {
        usedRequestId = value;
    }

    public AppUser getDisabledBy() {
        return disabledBy;
    }

    public void setDisabledBy(AppUser value) {
        disabledBy = value;
    }

    public Instant getDisabledAt() {
        return disabledAt;
    }

    public void setDisabledAt(Instant value) {
        disabledAt = value;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant value) {
        updatedAt = value;
    }
}
