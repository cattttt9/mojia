package com.inkshelf.weread;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 按微信读书 bookId 读写公共书籍元数据缓存。
 */
public interface WeReadBookMetadataRepository extends JpaRepository<WeReadBookMetadata, String> {
}
