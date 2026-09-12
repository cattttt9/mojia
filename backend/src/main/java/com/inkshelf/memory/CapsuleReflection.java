package com.inkshelf.memory;

import javax.persistence.*;
import java.time.Instant;

/**
 * 用户针对旧记忆写下的现在感受，只保存在墨架。
 */
@Entity
@Table(name = "capsule_reflection", uniqueConstraints = @UniqueConstraint(name = "uk_capsule_reflection_user_capsule", columnNames = {"user_id", "capsule_id"}))
public class CapsuleReflection {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(name = "capsule_id", nullable = false)
    private Long capsuleId;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
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

    public Long getCapsuleId() {
        return capsuleId;
    }

    public void setCapsuleId(Long v) {
        capsuleId = v;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String v) {
        content = v;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant v) {
        createdAt = v;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant v) {
        updatedAt = v;
    }
}
