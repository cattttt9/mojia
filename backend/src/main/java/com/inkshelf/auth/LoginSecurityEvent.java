package com.inkshelf.auth;

import com.inkshelf.user.AppUser;

import javax.persistence.*;
import java.time.Instant;

/**
 * 登录安全审计；不保存用户名原文、密码、验证码答案或令牌。
 */
@Entity
@Table(name = "login_security_event")
public class LoginSecurityEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "username_hash", nullable = false, length = 64)
    private String usernameHash;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private AppUser user;
    @Column(name = "event_type", nullable = false, length = 32)
    private String eventType;
    @Column(nullable = false)
    private boolean success;
    @Column(name = "ip_address", length = 64)
    private String ipAddress;
    @Column(name = "user_agent_summary", length = 255)
    private String userAgentSummary;
    @Column(name = "request_id", length = 64)
    private String requestId;
    @Column(name = "failure_reason", length = 48)
    private String failureReason;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public void setUsernameHash(String value) {
        usernameHash = value;
    }

    public void setUser(AppUser value) {
        user = value;
    }

    public void setEventType(String value) {
        eventType = value;
    }

    public void setSuccess(boolean value) {
        success = value;
    }

    public void setIpAddress(String value) {
        ipAddress = value;
    }

    public void setUserAgentSummary(String value) {
        userAgentSummary = value;
    }

    public void setRequestId(String value) {
        requestId = value;
    }

    public void setFailureReason(String value) {
        failureReason = value;
    }
}
