package com.inkshelf.web;

import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.servlet.*;
import javax.servlet.http.*;
import java.io.IOException;
import java.util.UUID;

@Component
@Order(1)
/** 为每个请求生成或沿用安全格式的 requestId，并写入 MDC 便于追踪。 */
public class RequestIdFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain) throws ServletException, IOException {
        String id = req.getHeader("X-Request-Id");
        if (id == null || !id.matches("[A-Za-z0-9_-]{8,64}")) id = UUID.randomUUID().toString();
        MDC.put("requestId", id);
        res.setHeader("X-Request-Id", id);
        // finally 清理线程变量，避免 servlet 线程复用时串到下一次请求。
        try {
            chain.doFilter(req, res);
        } finally {
            MDC.remove("requestId");
        }
    }
}
