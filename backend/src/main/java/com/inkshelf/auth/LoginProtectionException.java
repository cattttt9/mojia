package com.inkshelf.auth;

import org.springframework.http.HttpStatus;

/**
 * 可安全返回给前端的登录保护状态，不包含账号是否存在等敏感信息。
 */
public class LoginProtectionException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final long retryAfterSeconds;

    public LoginProtectionException(HttpStatus status, String code, String message, long retryAfterSeconds) {
        super(message);
        this.status = status;
        this.code = code;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
