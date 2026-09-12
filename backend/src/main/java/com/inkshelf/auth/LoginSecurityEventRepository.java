package com.inkshelf.auth;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 保存登录安全事件，供风控判断、审计和后台查询使用。
 */
public interface LoginSecurityEventRepository extends JpaRepository<LoginSecurityEvent, Long> {
    void deleteByUsernameHash(String usernameHash);
}
