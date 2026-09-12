package com.inkshelf.auth;

import com.inkshelf.user.AppUser;
import org.slf4j.MDC;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import javax.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.*;

@Service
public class LoginProtectionService {
    private static final DefaultRedisScript<Long> INCREMENT = new DefaultRedisScript<>(
            "local v=redis.call('INCR',KEYS[1]); if v==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return v", Long.class);
    private static final DefaultRedisScript<String> CONSUME = new DefaultRedisScript<>(
            "local v=redis.call('GET',KEYS[1]); if not v then return nil end; redis.call('DEL',KEYS[1]); return v", String.class);

    private final StringRedisTemplate redis;
    private final LoginSecurityEventRepository events;

    public LoginProtectionService(StringRedisTemplate redis, LoginSecurityEventRepository events) {
        this.redis = redis;
        this.events = events;
    }

    /**
     * 在密码校验前执行分布式限流、冷却和一次性滑块凭证校验。
     */
    public void check(String username, String captchaToken, HttpServletRequest request) {
        String accountHash = usernameHash(username);
        String ipHash = sha256(ip(request));
        long minute = System.currentTimeMillis() / 60000L;
        long attempts = increment("auth:login:minute:" + ipHash + ":" + minute, 120);
        if (attempts > 5) {
            audit(username, null, "RATE_LIMITED", false, request, "IP_MINUTE_LIMIT");
            throw blocked("LOGIN_RATE_LIMITED", "登录尝试过于频繁，请稍后再试", 60);
        }

        long ipFailures = number("auth:login:fail:ip:" + ipHash);
        if (ipFailures >= 50) {
            long retry = ttl("auth:login:fail:ip:" + ipHash, 3600);
            audit(username, null, "RATE_LIMITED", false, request, "IP_HOURLY_LIMIT");
            throw blocked("LOGIN_RATE_LIMITED", "登录尝试过于频繁，请稍后再试", retry);
        }

        String cooldownKey = "auth:login:cooldown:" + accountHash;
        long cooldown = ttl(cooldownKey, 0);
        if (cooldown > 0) {
            audit(username, null, "ACCOUNT_COOLDOWN", false, request, "PROGRESSIVE_COOLDOWN");
            throw blocked("ACCOUNT_COOLDOWN", "登录失败次数过多，请稍后再试", cooldown);
        }

        long accountFailures = number("auth:login:fail:account:" + accountHash);
        if (accountFailures >= 3 || ipFailures >= 10) {
            if (!consumeCaptcha(captchaToken, accountHash, ipHash)) {
                audit(username, null, captchaToken == null ? "CAPTCHA_REQUIRED" : "CAPTCHA_FAILED", false, request, "RISK_CHALLENGE");
                throw new LoginProtectionException(HttpStatus.PRECONDITION_REQUIRED, "CAPTCHA_REQUIRED", "请先完成滑块验证", 0);
            }
        }
    }

    public void recordFailure(String username, AppUser user, HttpServletRequest request, String reason) {
        String accountHash = usernameHash(username);
        String ipHash = sha256(ip(request));
        long accountFailures = increment("auth:login:fail:account:" + accountHash, 900);
        increment("auth:login:fail:ip:" + ipHash, 3600);
        if (accountFailures >= 5) {
            long level = increment("auth:login:cooldown-level:" + accountHash, 86400);
            long seconds = level <= 1 ? 300 : level == 2 ? 900 : 3600;
            redis.opsForValue().set("auth:login:cooldown:" + accountHash, "1", Duration.ofSeconds(seconds));
        }
        audit(username, user, "LOGIN_FAILED", false, request, reason);
    }

    public void recordSuccess(String username, AppUser user, HttpServletRequest request) {
        resetForUsername(username);
        audit(username, user, "LOGIN_SUCCESS", true, request, null);
    }

    /**
     * 管理员重置密码前清除账号失败、冷却和升级等级，不影响全局 IP 风险计数。
     */
    public void resetForUsername(String username) {
        String hash = usernameHash(username);
        redis.delete(Arrays.asList(
                "auth:login:fail:account:" + hash,
                "auth:login:cooldown:" + hash,
                "auth:login:cooldown-level:" + hash));
    }

    public String usernameHash(String username) {
        return sha256(username == null ? "" : username.trim().toLowerCase(Locale.ROOT));
    }

    public String ipHash(HttpServletRequest request) {
        return sha256(ip(request));
    }

    public String verifiedCaptchaKey(String token) {
        return "auth:captcha:verified:" + token;
    }

    private boolean consumeCaptcha(String token, String accountHash, String ipHash) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{32,80}")) return false;
        String value = redis.execute(CONSUME, Collections.singletonList(verifiedCaptchaKey(token)));
        return (accountHash + "|" + ipHash).equals(value);
    }

    private long increment(String key, long ttlSeconds) {
        Long value = redis.execute(INCREMENT, Collections.singletonList(key), String.valueOf(ttlSeconds));
        return value == null ? 0 : value;
    }

    private long number(String key) {
        String value = redis.opsForValue().get(key);
        if (value == null) return 0;
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private long ttl(String key, long fallback) {
        Long value = redis.getExpire(key);
        return value == null || value < 0 ? fallback : value;
    }

    private LoginProtectionException blocked(String code, String message, long retry) {
        return new LoginProtectionException(HttpStatus.TOO_MANY_REQUESTS, code, message, Math.max(1, retry));
    }

    private void audit(String username, AppUser user, String type, boolean success, HttpServletRequest request, String reason) {
        LoginSecurityEvent event = new LoginSecurityEvent();
        event.setUsernameHash(usernameHash(username));
        event.setUser(user);
        event.setEventType(type);
        event.setSuccess(success);
        event.setIpAddress(trim(ip(request), 64));
        event.setUserAgentSummary(trim(request.getHeader("User-Agent"), 255));
        event.setRequestId(trim(MDC.get("requestId"), 64));
        event.setFailureReason(trim(reason, 48));
        events.save(event);
    }

    private String ip(HttpServletRequest request) {
        return request == null || request.getRemoteAddr() == null ? "unknown" : request.getRemoteAddr();
    }

    private String trim(String value, int max) {
        if (value == null) return null;
        String sanitized = value.replaceAll("[\\r\\n\\t]", " ").trim();
        return sanitized.length() <= max ? sanitized : sanitized.substring(0, max);
    }

    private String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(64);
            for (byte item : digest) hex.append(String.format("%02x", item & 0xff));
            return hex.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 不可用", impossible);
        }
    }
}
