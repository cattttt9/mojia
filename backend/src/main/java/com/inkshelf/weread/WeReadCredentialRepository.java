package com.inkshelf.weread;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 以用户 ID 为主键保存一对一的微信读书凭据。
 */
public interface WeReadCredentialRepository extends JpaRepository<WeReadCredential, Long> {
}
