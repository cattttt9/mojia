package com.inkshelf.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import javax.annotation.PostConstruct;

@Component
@Profile("prod")
/** 生产环境启动保护：发现默认密钥或弱数据库密码时拒绝启动。 */
public class ProductionSafetyGuard {
    private final String jwt, encryption, databasePassword;

    public ProductionSafetyGuard(@Value("${inkshelf.jwt-secret}") String j, @Value("${inkshelf.encryption-key}") String e, @Value("${spring.datasource.password}") String d) {
        jwt = j;
        encryption = e;
        databasePassword = d;
    }

    @PostConstruct
    public void verify() {
        if (jwt.startsWith("change-this") || jwt.length() < 32)
            throw new IllegalStateException("Production JWT_SECRET is unsafe");
        if ("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=".equals(encryption))
            throw new IllegalStateException("Production ENCRYPTION_KEY is unsafe");
        if ("inkshelf_dev".equals(databasePassword) || "change-me".equals(databasePassword))
            throw new IllegalStateException("Production database password is unsafe");
    }
}
