package com.inkshelf.memory;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.*;

/**
 * 保存周报、月报快照，并支持按用户和报告周期读取历史记录。
 */
public interface ReadingReportRepository extends JpaRepository<ReadingReport, Long> {
    Optional<ReadingReport> findByUserIdAndPeriodTypeAndPeriodStart(Long userId, String periodType, LocalDate periodStart);

    List<ReadingReport> findTop12ByUserIdAndPeriodTypeOrderByPeriodStartDesc(Long userId, String periodType);

    Optional<ReadingReport> findByIdAndUserId(Long id, Long userId);
}
