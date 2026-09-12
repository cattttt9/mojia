package com.inkshelf.memory;

import com.inkshelf.user.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * 阅读记忆认证接口；用户身份只取自 JWT，不接受客户端传入 userId。
 */
@RestController
@RequestMapping("/api")
public class ReadingMemoryController {
    private final ReadingMemoryService memory;
    private final UserRepository users;

    public ReadingMemoryController(ReadingMemoryService m, UserRepository u) {
        memory = m;
        users = u;
    }

    @GetMapping("/reports/weekly")
    public Map<String, Object> weekly(Authentication a) {
        return memory.latestReport(user(a).getId(), "WEEKLY");
    }

    @GetMapping("/reports/monthly")
    public Map<String, Object> monthly(Authentication a) {
        return memory.latestReport(user(a).getId(), "MONTHLY");
    }

    @GetMapping("/reports/{type}/history")
    public List<Map<String, Object>> history(Authentication a, @PathVariable String type) {
        return memory.history(user(a).getId(), type);
    }

    @PostMapping("/reports/{id}/regenerate")
    public Map<String, Object> regenerate(Authentication a, @PathVariable Long id) {
        return memory.regenerate(user(a).getId(), id);
    }

    @GetMapping("/capsules/current")
    public Map<String, Object> capsule(Authentication a) {
        return memory.currentCapsule(user(a).getId());
    }

    public static class ReflectionRequest {
        public String content;
    }

    @PostMapping("/capsules/{id}/reflection")
    public Map<String, Object> reflection(Authentication a, @PathVariable Long id, @RequestBody ReflectionRequest body) {
        return memory.reflect(user(a).getId(), id, body == null ? null : body.content);
    }

    @PostMapping("/capsules/{id}/dismiss")
    public ResponseEntity<Void> dismiss(Authentication a, @PathVariable Long id) {
        memory.dismiss(user(a).getId(), id);
        return ResponseEntity.noContent().build();
    }

    private AppUser user(Authentication a) {
        return users.findByUsernameIgnoreCase(a.getName()).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
    }
}
