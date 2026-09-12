package com.inkshelf.security;

import com.inkshelf.web.RateLimitFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.*;

import java.util.Arrays;
import java.util.stream.Collectors;

@Configuration
/** 统一配置无状态鉴权、CORS、密码哈希和公开接口边界。 */
public class SecurityConfig {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(@Value("${inkshelf.allowed-origin}") String origin) {
        CorsConfiguration c = new CorsConfiguration();
        c.setAllowedOrigins(Arrays.stream(origin.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toList()));
        c.setAllowedMethods(Arrays.asList("GET", "POST", "DELETE", "OPTIONS"));
        c.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Request-Id"));
        c.setAllowCredentials(true);
        c.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource s = new UrlBasedCorsConfigurationSource();
        s.registerCorsConfiguration("/**", c);
        return s;
    }

    /**
     * 留言读取和公共说明开放访问，其余业务接口默认要求登录。
     */
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtAuthenticationFilter jwt, RateLimitFilter rate) throws Exception {
        http.csrf().disable().cors().and().sessionManagement().sessionCreationPolicy(SessionCreationPolicy.STATELESS).and()
                .authorizeRequests().antMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/login", "/api/auth/captcha/challenge", "/api/auth/captcha/verify").permitAll().antMatchers("/api/public/**", "/actuator/health").permitAll()
                .antMatchers(HttpMethod.GET, "/api/messages/**").permitAll().antMatchers("/api/admin/**").hasRole("ADMIN").anyRequest().authenticated().and()
                .exceptionHandling().authenticationEntryPoint((req, res, e) -> {
                    res.setStatus(401);
                    res.setContentType("application/json;charset=UTF-8");
                    res.getWriter().write("{\"message\":\"请先登录\"}");
                });
        http.addFilterBefore(jwt, UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(rate, JwtAuthenticationFilter.class);
        return http.build();
    }
}
