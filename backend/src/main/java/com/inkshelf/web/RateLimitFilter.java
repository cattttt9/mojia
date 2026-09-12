package com.inkshelf.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.*;
import javax.servlet.http.*;
import java.io.IOException;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

@Component
@Order(2)
/** 单实例固定窗口限流器；AI 消耗接口按登录用户计数，其余接口按来源 IP 计数。 */
public class RateLimitFilter extends OncePerRequestFilter {
    private static class Window {
        long start;
        int count;

        Window(long s) {
            start = s;
        }
    }

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, String> activeAiTasks = new ConcurrentHashMap<>();
    private final AtomicLong requests = new AtomicLong();
    private final int insightRequestsPerMinute;
    private final int starMapRequestsPerMinute;

    public RateLimitFilter(
            @Value("${inkshelf.ai.insight-requests-per-minute:3}") int insightRequestsPerMinute,
            @Value("${inkshelf.ai.star-map-requests-per-minute:1}") int starMapRequestsPerMinute) {
        this.insightRequestsPerMinute = Math.max(1, insightRequestsPerMinute);
        this.starMapRequestsPerMinute = Math.max(1, starMapRequestsPerMinute);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        // 认证、发留言和微信读书接口使用更严格的每分钟限额。
        long now = System.currentTimeMillis();
        String path = req.getRequestURI();
        boolean memory = path.startsWith("/api/reports/") || path.startsWith("/api/capsules/"), memoryWrite = memory && !"GET".equals(req.getMethod());
        boolean ai = path.startsWith("/api/ai/");
        boolean aiWrite = ai && "POST".equals(req.getMethod());
        boolean insightGenerate = path.equals("/api/ai/reading-insights") && "POST".equals(req.getMethod());
        boolean starAnalyze = path.equals("/api/star-map/analyze-themes") && "POST".equals(req.getMethod());
        boolean meConnect = path.equals("/api/me/weread/connect");
        boolean meSync = path.startsWith("/api/me/sync/") && "POST".equals(req.getMethod());
        boolean login = path.equals("/api/auth/login");
        boolean register = path.equals("/api/auth/register");
        boolean captchaChallenge = path.equals("/api/auth/captcha/challenge");
        boolean captchaVerify = path.equals("/api/auth/captcha/verify");
        int limit = login ? 5 : register ? 3 : captchaChallenge ? 10 : captchaVerify ? 15 : path.startsWith("/api/auth/") ? 10 : meConnect ? 3 : meSync ? 4 : starAnalyze ? starMapRequestsPerMinute : insightGenerate ? insightRequestsPerMinute : path.equals("/api/messages") && "POST".equals(req.getMethod()) ? 12 : path.startsWith("/api/weread/") ? 30 : aiWrite ? 8 : ai ? 60 : memoryWrite ? 12 : memory ? 60 : 120;
        String category = login ? "login" : register ? "register" : captchaChallenge ? "captcha-challenge" : captchaVerify ? "captcha-verify" : path.startsWith("/api/auth/") ? "auth" : meConnect ? "me-connect" : meSync ? "me-sync" : starAnalyze ? "star-map-ai" : insightGenerate ? "reading-insight-ai" : path.startsWith("/api/weread/") ? "weread" : ai ? (aiWrite ? "ai-write" : "ai-read") : memory ? (memoryWrite ? "memory-write" : "memory-read") : path;
        boolean guardedAiTask = insightGenerate || starAnalyze;
        String identity = guardedAiTask ? authenticatedIdentity(req) : req.getRemoteAddr();
        String key = identity + ":" + category;
        String taskToken = null;
        if (guardedAiTask) {
            taskToken = UUID.randomUUID().toString();
            if (activeAiTasks.putIfAbsent(key, taskToken) != null) {
                reject(res, "AI_TASK_IN_PROGRESS", "已有 AI 任务正在执行，请等待完成后再试。", 5);
                return;
            }
        }
        Window w = windows.compute(key, (k, v) -> {
            if (v == null || now - v.start >= 60000) v = new Window(now);
            v.count++;
            return v;
        });
        if (requests.incrementAndGet() % 1000 == 0) windows.entrySet().removeIf(e -> now - e.getValue().start > 120000);
        res.setHeader("X-RateLimit-Limit", String.valueOf(limit));
        res.setHeader("X-RateLimit-Remaining", String.valueOf(Math.max(0, limit - w.count)));
        if (w.count > limit) {
            if (taskToken != null) activeAiTasks.remove(key, taskToken);
            int retryAfter = Math.max(1, (int) Math.ceil((60000 - (now - w.start)) / 1000.0));
            reject(res, "AI_RATE_LIMITED", "AI 使用次数已达本分钟上限，请稍等后再试。", retryAfter);
            return;
        }
        try {
            chain.doFilter(req, res);
        } finally {
            if (taskToken != null) activeAiTasks.remove(key, taskToken);
        }
    }

    private String authenticatedIdentity(HttpServletRequest req) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated() && authentication.getName() != null) {
            return "user:" + authentication.getName().trim().toLowerCase(Locale.ROOT);
        }
        return "ip:" + req.getRemoteAddr();
    }

    private void reject(HttpServletResponse res, String code, String message, int retryAfter) throws IOException {
        res.setStatus(429);
        res.setCharacterEncoding("UTF-8");
        res.setContentType("application/json;charset=UTF-8");
        res.setHeader("Retry-After", String.valueOf(retryAfter));
        res.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message
                + "\",\"retryAfter\":" + retryAfter + "}");
    }
}
