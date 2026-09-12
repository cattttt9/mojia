package com.inkshelf.auth;

import com.inkshelf.invitation.InvitationCodeService;
import com.inkshelf.security.JwtService;
import com.inkshelf.user.AppUser;
import com.inkshelf.user.UserRepository;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;
import javax.validation.constraints.*;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JwtService jwt;
    private final InvitationCodeService invitationCodes;
    private final LoginProtectionService loginProtection;
    private final String dummyPasswordHash;

    public AuthController(UserRepository users, PasswordEncoder passwords, JwtService jwt, InvitationCodeService invitationCodes, LoginProtectionService loginProtection) {
        this.users = users;
        this.passwords = passwords;
        this.jwt = jwt;
        this.invitationCodes = invitationCodes;
        this.loginProtection = loginProtection;
        // 不存在的用户名也执行相同 BCrypt 工作量，降低通过响应时长枚举账号的风险。
        this.dummyPasswordHash = passwords.encode("inkshelf-dummy-password-not-used-for-login");
    }

    public static class RegisterRequest {
        @NotBlank
        @Pattern(regexp = "^[A-Za-z0-9_]{3,32}$")
        public String username;
        @Email
        @NotBlank
        public String email;
        @Size(min = 8, max = 72)
        public String password;
        @NotBlank
        @Size(max = 40)
        public String displayName;
        @NotBlank
        @Pattern(regexp = "^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$")
        public String invitationCode;
    }

    public static class LoginRequest {
        @NotBlank
        public String username;
        @NotBlank
        public String password;
        public String captchaToken;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, Object> register(@Valid @RequestBody RegisterRequest r, HttpServletRequest request) {
        if (users.existsByUsernameIgnoreCase(r.username)) throw new IllegalArgumentException("用户名已被使用");
        if (users.existsByEmailIgnoreCase(r.email)) throw new IllegalArgumentException("邮箱已被注册");
        Instant now = Instant.now();
        AppUser u = new AppUser();
        u.setUsername(r.username.trim());
        u.setEmail(r.email.trim().toLowerCase());
        u.setDisplayName(r.displayName.trim());
        u.setPasswordHash(passwords.encode(r.password));
        u.setRole("USER");
        u.setStatus("NORMAL");
        u.setLastLoginAt(now);
        u.setLastSeenAt(now);
        u.setUpdatedAt(now);
        users.saveAndFlush(u);
        invitationCodes.claim(r.invitationCode, u, request.getRemoteAddr(), MDC.get("requestId"));
        return token(u);
    }

    @PostMapping("/login")
    @Transactional
    public Map<String, Object> login(@Valid @RequestBody LoginRequest r, HttpServletRequest request) {
        loginProtection.check(r.username, r.captchaToken, request);
        Optional<AppUser> found = users.findByUsernameIgnoreCase(r.username);
        AppUser u = found.orElse(null);
        String expectedHash = u == null ? dummyPasswordHash : u.getPasswordHash();
        boolean passwordMatches = passwords.matches(r.password, expectedHash);
        if (u == null || !passwordMatches) {
            loginProtection.recordFailure(r.username, u, request, "BAD_CREDENTIALS");
            throw new IllegalArgumentException("用户名或密码错误");
        }
        if ("DISABLED".equalsIgnoreCase(u.getStatus())) {
            loginProtection.recordFailure(r.username, u, request, "ACCOUNT_DISABLED");
            throw new IllegalArgumentException("账号已被禁用，请联系管理员");
        }
        Instant now = Instant.now();
        u.setLastLoginAt(now);
        u.setLastSeenAt(now);
        u.setUpdatedAt(now);
        // u 已处于当前事务的持久化上下文中；登录时间与审计事件合并为一次提交。
        loginProtection.recordSuccess(r.username, u, request);
        return token(u);
    }

    @GetMapping("/me")
    public Map<String, Object> me(Authentication a) {
        return profile(current(a));
    }

    private AppUser current(Authentication a) {
        return users.findByUsernameIgnoreCase(a.getName()).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
    }

    private Map<String, Object> token(AppUser u) {
        Map<String, Object> m = profile(u);
        m.put("token", jwt.issue(u.getUsername(), u.getRole()));
        return m;
    }

    private Map<String, Object> profile(AppUser u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("username", u.getUsername());
        m.put("displayName", u.getDisplayName());
        m.put("email", u.getEmail());
        m.put("role", u.getRole());
        m.put("status", u.getStatus());
        return m;
    }
}
