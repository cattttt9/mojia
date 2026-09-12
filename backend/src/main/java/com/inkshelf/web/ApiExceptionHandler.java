package com.inkshelf.web;

import com.inkshelf.auth.LoginProtectionException;
import org.slf4j.*;
import org.springframework.http.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestControllerAdvice
/** 将服务端异常转换为稳定、无敏感细节的 JSON 错误响应。 */
public class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(LoginProtectionException.class)
    ResponseEntity<Map<String, Object>> loginProtection(LoginProtectionException e) {
        Map<String, Object> response = bodyValue(e.getStatus(), e.getMessage());
        response.put("code", e.getCode());
        if (e.getRetryAfterSeconds() > 0) response.put("retryAfter", e.getRetryAfterSeconds());
        ResponseEntity.BodyBuilder builder = ResponseEntity.status(e.getStatus());
        if (e.getRetryAfterSeconds() > 0) builder.header("Retry-After", String.valueOf(e.getRetryAfterSeconds()));
        return builder.body(response);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, Object>> bad(IllegalArgumentException e) {
        return body(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<Map<String, Object>> denied() {
        return body(HttpStatus.FORBIDDEN, "没有权限执行此操作");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> validation() {
        return body(HttpStatus.BAD_REQUEST, "提交的内容格式不正确");
    }

    // 未知异常只在服务端记录堆栈；响应不回传异常消息、密钥或实现细节。
    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, Object>> unknown(Exception e) {
        log.error("Unhandled request error", e);
        return body(HttpStatus.INTERNAL_SERVER_ERROR, "服务暂时不可用");
    }

    private ResponseEntity<Map<String, Object>> body(HttpStatus s, String m) {
        return ResponseEntity.status(s).body(bodyValue(s, m));
    }

    private Map<String, Object> bodyValue(HttpStatus s, String m) {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("message", m);
        b.put("requestId", MDC.get("requestId"));
        return b;
    }
}
