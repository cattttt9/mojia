package com.inkshelf.user;

import com.inkshelf.auth.LoginProtectionService;
import com.inkshelf.weread.WeReadCredential;
import com.inkshelf.weread.WeReadCredentialRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {
    private final UserRepository users;
    private final WeReadCredentialRepository credentials;
    private final PasswordEncoder passwords;
    private final LoginProtectionService loginProtection;
    private final SecureRandom random = new SecureRandom();

    public AdminUserController(UserRepository users, WeReadCredentialRepository credentials, PasswordEncoder passwords, LoginProtectionService loginProtection) {
        this.users = users;
        this.credentials = credentials;
        this.passwords = passwords;
        this.loginProtection = loginProtection;
    }

    @GetMapping
    public Map<String, Object> list() {
        List<Map<String, Object>> items = new ArrayList<>();
        for (AppUser user : users.findAll()) items.add(view(user));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("items", items);
        return result;
    }

    @GetMapping("/{id}")
    public Map<String, Object> detail(@PathVariable Long id) {
        return view(user(id));
    }

    @PostMapping("/{id}/reset-password")
    public Map<String, Object> resetPassword(Authentication authentication, @PathVariable Long id) {
        AppUser user = user(id);
        if (authentication != null && authentication.getName().equalsIgnoreCase(user.getUsername())) {
            throw new IllegalArgumentException("管理员不能重置自己的密码，请使用修改密码");
        }
        String temporaryPassword = temporaryPassword();
        // 先清除 Redis 中该账号的失败次数和冷却状态；失败时不修改数据库密码。
        loginProtection.resetForUsername(user.getUsername());
        user.setPasswordHash(passwords.encode(temporaryPassword));
        user.setUpdatedAt(Instant.now());
        users.save(user);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("temporaryPassword", temporaryPassword);
        result.put("message", "已生成临时密码，请提醒用户登录后立即修改");
        return result;
    }

    @PostMapping("/{id}/disable")
    public Map<String, Object> disable(@PathVariable Long id) {
        AppUser user = user(id);
        user.setStatus("DISABLED");
        user.setUpdatedAt(Instant.now());
        users.save(user);
        return view(user);
    }

    @PostMapping("/{id}/enable")
    public Map<String, Object> enable(@PathVariable Long id) {
        AppUser user = user(id);
        user.setStatus("NORMAL");
        user.setUpdatedAt(Instant.now());
        users.save(user);
        return view(user);
    }

    private AppUser user(Long id) {
        return users.findById(id).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
    }

    private Map<String, Object> view(AppUser user) {
        WeReadCredential credential = credentials.findById(user.getId()).orElse(null);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", user.getId());
        result.put("username", user.getUsername());
        result.put("email", user.getEmail());
        result.put("displayName", user.getDisplayName());
        result.put("role", user.getRole());
        result.put("status", user.getStatus());
        result.put("online", user.getLastSeenAt() != null && user.getLastSeenAt().isAfter(Instant.now().minus(Duration.ofMinutes(5))));
        result.put("lastLoginAt", user.getLastLoginAt());
        result.put("lastSeenAt", user.getLastSeenAt());
        result.put("createdAt", user.getCreatedAt());
        result.put("updatedAt", user.getUpdatedAt());
        result.put("wereadConnected", credential != null);
        result.put("wereadLastSyncAt", credential == null ? null : credential.getLastSyncAt());
        result.put("wereadLastSyncStatus", credential == null ? null : credential.getLastSyncStatus());
        return result;
    }

    private String temporaryPassword() {
        String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        StringBuilder value = new StringBuilder("Tmp-");
        for (int i = 0; i < 12; i++) value.append(alphabet.charAt(random.nextInt(alphabet.length())));
        return value.toString();
    }
}
