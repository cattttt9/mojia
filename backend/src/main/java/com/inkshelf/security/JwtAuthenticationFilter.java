package com.inkshelf.security;

import com.inkshelf.user.AppUser;
import com.inkshelf.user.UserRepository;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.Collections;

/**
 * 从 Bearer Token 恢复当前用户身份，并在请求进入控制器前写入 Spring Security 上下文。
 * 无效或已停用用户不会获得认证信息，但仍交由后续安全规则决定响应结果。
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private final JwtService jwtService;
    private final UserRepository users;

    public JwtAuthenticationFilter(JwtService jwtService, UserRepository users) {
        this.jwtService = jwtService;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String header = req.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            try {
                String username = jwtService.parseUsername(header.substring(7));
                AppUser user = users.findByUsernameIgnoreCase(username).orElseThrow(() -> new IllegalArgumentException("user not found"));
                if (!"DISABLED".equalsIgnoreCase(user.getStatus())) {
                    user.setLastSeenAt(Instant.now());
                    users.save(user);
                    String role = "ADMIN".equalsIgnoreCase(user.getRole()) ? "ADMIN" : "USER";
                    SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(username, null, Collections.singleton(new SimpleGrantedAuthority("ROLE_" + role))));
                }
            } catch (Exception ignored) {
                SecurityContextHolder.clearContext();
            }
        }
        chain.doFilter(req, res);
    }
}
