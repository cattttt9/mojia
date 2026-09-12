package com.inkshelf.weread;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.*;

/**
 * 用户笔记本概览查询。
 */
public interface WeReadNotebookRepository extends JpaRepository<WeReadNotebook, Long> {
    Optional<WeReadNotebook> findByUserIdAndBookId(Long userId, String bookId);

    List<WeReadNotebook> findByUserIdOrderBySourceSortDesc(Long userId);

    long countByUserId(Long userId);

    @Query("select coalesce(sum(n.bookmarkCount),0) from WeReadNotebook n where n.userId = ?1")
    long sumBookmarkCountByUserId(Long userId);
}
