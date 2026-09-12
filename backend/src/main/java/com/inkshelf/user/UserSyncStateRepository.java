package com.inkshelf.user;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 按用户主键读写各类微信读书数据的同步状态。
 */
public interface UserSyncStateRepository extends JpaRepository<UserSyncState, Long> {
}
