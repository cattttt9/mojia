package com.inkshelf.weread;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * 按用户与同步范围保存进度。
 */
public interface NoteSyncStateRepository extends JpaRepository<NoteSyncState, Long> {
    Optional<NoteSyncState> findByUserIdAndScope(Long userId, String scope);

    /**
     * 首次同步可能被浏览器并发触发。依赖数据库唯一键幂等初始化，避免先查后插的竞态。
     */
    @Modifying
    @Transactional
    @Query(value = "INSERT INTO note_sync_state (user_id, scope, status, updated_at) " +
            "VALUES (:userId, :scope, 'IDLE', :updatedAt) " +
            "ON CONFLICT (user_id, scope) DO NOTHING", nativeQuery = true)
    int insertIfAbsent(@Param("userId") Long userId,
                       @Param("scope") String scope,
                       @Param("updatedAt") Instant updatedAt);

    /**
     * 同一用户、同一范围同时只允许一个同步任务运行；超时任务可在十分钟后被接管。
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("UPDATE NoteSyncState s SET s.status = 'SYNCING', s.lastAttemptAt = :attemptedAt, " +
            "s.errorCode = NULL, s.updatedAt = :attemptedAt " +
            "WHERE s.id = :id AND (s.status <> 'SYNCING' OR s.lastAttemptAt IS NULL OR s.lastAttemptAt < :staleBefore)")
    int tryBegin(@Param("id") Long id,
                 @Param("attemptedAt") Instant attemptedAt,
                 @Param("staleBefore") Instant staleBefore);
}
