package com.inkshelf.weread;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;

/**
 * 私密笔记查询；方法签名始终包含 userId，防止跨用户读取。
 */
public interface WeReadNoteRepository extends JpaRepository<WeReadNote, Long> {
    List<WeReadNote> findByUserIdAndBookIdOrderBySourceCreatedAtDesc(Long userId, String bookId);

    List<WeReadNote> findByUserIdAndSourceCreatedAtBetweenOrderBySourceCreatedAtDesc(Long userId, Instant from, Instant to);

    long countByUserId(Long userId);

    long countByUserIdAndNoteType(Long userId, String noteType);

    void deleteByUserIdAndBookId(Long userId, String bookId);
}
