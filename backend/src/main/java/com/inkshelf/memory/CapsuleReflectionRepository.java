package com.inkshelf.memory;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * 管理用户对阅读时间胶囊的回顾内容。
 */
public interface CapsuleReflectionRepository extends JpaRepository<CapsuleReflection, Long> {
    Optional<CapsuleReflection> findByUserIdAndCapsuleId(Long userId, Long capsuleId);
}
