package com.inkshelf.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.inkshelf.user.AppUser;
import com.inkshelf.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.List;
import java.util.Map;

/**
 * AI 阅读洞察入口。
 * <p>
 * 客户端只提交裁剪后的阅读摘要；智谱 API Key 只在服务端通过环境变量读取。
 * 日志里只记录用户 id 与洞察类型，不记录 Authorization、API Key、划线正文或个人想法。
 */
@RestController
@RequestMapping("/api/ai")
public class AiInsightController {
    private static final Logger log = LoggerFactory.getLogger(AiInsightController.class);
    private final AiInsightService ai;
    private final UserRepository users;

    public AiInsightController(AiInsightService ai, UserRepository users) {
        this.ai = ai;
        this.users = users;
    }

    public static class InsightRequest {
        @NotBlank
        public String type;
        @NotNull
        public JsonNode payload;
    }

    @PostMapping("/reading-insights")
    public ResponseEntity<Map<String, Object>> insight(Authentication authentication, @Valid @RequestBody InsightRequest request) {
        AppUser user = currentUser(authentication);
        try {
            log.info("AI insight request accepted, userId={}, type={}", user.getId(), request.type);
            return ResponseEntity.ok(ai.generate(user.getId(), request.type, request.payload));
        } catch (AiInsightService.AiNotConfiguredException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(ai.error(request.type, "AI 服务未配置，请在后端环境变量中设置 ZHIPU_API_KEY。"));
        } catch (AiInsightService.AiUpstreamException e) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(ai.error(request.type, e.getMessage()));
        }
    }

    @GetMapping("/reading-insights/{type}/history")
    public ResponseEntity<List<Map<String, Object>>> history(Authentication authentication, @PathVariable String type) {
        AppUser user = currentUser(authentication);
        return ResponseEntity.ok(ai.history(user.getId(), type));
    }

    private AppUser currentUser(Authentication authentication) {
        return users.findByUsernameIgnoreCase(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
    }
}
