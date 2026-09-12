package com.inkshelf.auth;

import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import javax.validation.constraints.*;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 提供滑块验证码的创建与校验接口，将 HTTP 参数约束和验证码业务逻辑分离。
 */
@RestController
@RequestMapping("/api/auth/captcha")
public class SliderCaptchaController {
    private final SliderCaptchaService captchas;

    public SliderCaptchaController(SliderCaptchaService captchas) {
        this.captchas = captchas;
    }

    public static class ChallengeRequest {
        @Size(max = 64)
        public String username;
    }

    public static class VerifyRequest {
        @NotBlank
        public String challengeId;
        @Size(max = 64)
        public String username;
        @Min(0)
        @Max(320)
        public int offset;
        @Min(0)
        @Max(30000)
        public long durationMs;
        @Min(0)
        @Max(1000)
        public int movementCount;
    }

    @PostMapping("/challenge")
    public SliderCaptchaService.Challenge challenge(@Valid @RequestBody ChallengeRequest body, HttpServletRequest request) {
        return captchas.create(body.username, request);
    }

    @PostMapping("/verify")
    public Map<String, Object> verify(@Valid @RequestBody VerifyRequest body, HttpServletRequest request) {
        String token = captchas.verify(body.challengeId, body.username, body.offset, body.durationMs, body.movementCount, request);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("verificationToken", token);
        result.put("expiresIn", 120);
        return result;
    }
}
