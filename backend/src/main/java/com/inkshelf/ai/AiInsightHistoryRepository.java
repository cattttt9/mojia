package com.inkshelf.ai;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/**
 * 持久化用户的 AI 阅读洞察历史，并按用户、类型和生成时间提供查询能力。
 */
public interface AiInsightHistoryRepository extends JpaRepository<AiInsightHistory, Long> {
    List<AiInsightHistory> findTop10ByUserIdAndInsightTypeOrderByCreatedAtDesc(Long userId, String insightType);

    Optional<AiInsightHistory> findByIdAndUserId(Long id, Long userId);
}
