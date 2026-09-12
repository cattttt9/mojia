package com.inkshelf.memory;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.*;

/**
 * 保存按周期生成的阅读时间胶囊及其展示状态。
 */
public interface ReadingCapsuleRepository extends JpaRepository<ReadingCapsule, Long> {
    Optional<ReadingCapsule> findByUserIdAndCapsuleDate(Long userId, LocalDate date);

    Optional<ReadingCapsule> findByIdAndUserId(Long id, Long userId);
}
