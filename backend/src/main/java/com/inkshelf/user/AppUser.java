package com.inkshelf.user;

import javax.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "app_user")
/** 平台用户实体；密码字段只保存 BCrypt 摘要。 */
public class AppUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, unique = true, length = 32)
    private String username;
    @Column(nullable = false, unique = true, length = 254)
    private String email;
    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;
    @Column(name = "display_name", nullable = false, length = 40)
    private String displayName;
    @Column(nullable = false, length = 20)
    private String role = "USER";
    @Column(nullable = false, length = 16)
    private String status = "NORMAL";
    @Column(name = "last_login_at")
    private Instant lastLoginAt;
    @Column(name = "last_seen_at")
    private Instant lastSeenAt;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    public Long getId() {
        return id;
    }

    public void setId(Long v) {
        id = v;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String v) {
        username = v;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String v) {
        email = v;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String v) {
        passwordHash = v;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String v) {
        displayName = v;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String v) {
        role = v;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String v) {
        status = v;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }

    public void setLastLoginAt(Instant v) {
        lastLoginAt = v;
    }

    public Instant getLastSeenAt() {
        return lastSeenAt;
    }

    public void setLastSeenAt(Instant v) {
        lastSeenAt = v;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant v) {
        updatedAt = v;
    }
}
