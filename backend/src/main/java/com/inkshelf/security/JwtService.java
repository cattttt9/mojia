package com.inkshelf.security;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;

@Service
/** JWT 的签发和验签入口；令牌当前有效期为两小时。 */
public class JwtService {
    private final SecretKey key;

    public JwtService(@Value("${inkshelf.jwt-secret}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String issue(String username, String role) {
        Instant now = Instant.now();
        return Jwts.builder().setSubject(username).claim("role", role).setIssuedAt(Date.from(now)).setExpiration(Date.from(now.plusSeconds(7200))).signWith(key).compact();
    }

    /**
     * 验证签名和过期时间，并返回 subject 中的用户名。
     */
    public String parseUsername(String token) {
        return Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody().getSubject();
    }

    public String parseRole(String token) {
        Object role = Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(token).getBody().get("role");
        return role == null ? "USER" : String.valueOf(role);
    }
}
