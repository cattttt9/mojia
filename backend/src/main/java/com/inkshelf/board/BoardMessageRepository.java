package com.inkshelf.board;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 留言持久化接口，只向公开列表查询指定状态的数据。
 */
public interface BoardMessageRepository extends JpaRepository<BoardMessage, Long> {
    /**
     * 列表响应需要展示作者昵称和用户名，因此在分页查询阶段一并加载 user，
     * 避免离开持久化会话后访问 LAZY 关联导致 LazyInitializationException。
     */
    @EntityGraph(attributePaths = "user")
    Page<BoardMessage> findByStatus(String status, Pageable pageable);
}
