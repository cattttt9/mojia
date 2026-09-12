package com.inkshelf.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * 用户持久化与登录、注册所需的唯一性查询。
 */
public interface UserRepository extends JpaRepository<AppUser, Long> {
    Optional<AppUser> findByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCase(String username);

    boolean existsByEmailIgnoreCase(String email);
}
