package com.inkshelf.auth;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.Collection;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
/**
 * 验证登录失败计数、封禁窗口和成功登录后的状态恢复。
 */
class LoginProtectionServiceTest {
    @Mock StringRedisTemplate redis;
    @Mock LoginSecurityEventRepository events;
    LoginProtectionService service;

    @BeforeEach
    void setUp() {
        service = new LoginProtectionService(redis, events);
    }

    @Test
    void usernameHashIsCaseAndWhitespaceInsensitive() {
        assertEquals(service.usernameHash(" Reader_01 "), service.usernameHash("reader_01"));
        assertEquals(64, service.usernameHash("reader_01").length());
    }

    @Test
    void passwordResetClearsFailureCooldownAndEscalationKeys() {
        service.resetForUsername("reader_01");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<String>> keys = ArgumentCaptor.forClass(Collection.class);
        verify(redis).delete(keys.capture());
        assertEquals(3, keys.getValue().size());
        assertTrue(keys.getValue().stream().anyMatch(key -> key.contains("fail:account")));
        assertTrue(keys.getValue().stream().anyMatch(key -> key.contains("cooldown:")));
        assertTrue(keys.getValue().stream().anyMatch(key -> key.contains("cooldown-level")));
    }
}
