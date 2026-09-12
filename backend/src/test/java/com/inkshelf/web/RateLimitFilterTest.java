package com.inkshelf.web;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import javax.servlet.FilterChain;
import java.util.Collections;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RateLimitFilterTest {
    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void readingInsightsShareOnePerUserMinuteQuota() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(3, 1);
        authenticate("alice");
        AtomicInteger allowed = new AtomicInteger();

        for (int i = 0; i < 3; i++) {
            MockHttpServletResponse response = invoke(
                    filter,
                    "/api/ai/reading-insights",
                    (request, result) -> allowed.incrementAndGet());
            assertEquals(200, response.getStatus());
        }

        MockHttpServletResponse rejected = invoke(
                filter,
                "/api/ai/reading-insights",
                (request, response) -> allowed.incrementAndGet());

        assertEquals(3, allowed.get());
        assertEquals(429, rejected.getStatus());
        assertTrue(rejected.getContentAsString().contains("AI_RATE_LIMITED"));
        assertTrue(Integer.parseInt(rejected.getHeader("Retry-After")) > 0);
    }

    @Test
    void readingInsightRejectsAnotherTaskUntilCurrentTaskFinishes() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(3, 1);
        authenticate("alice");
        MockHttpServletResponse nestedResponse = new MockHttpServletResponse();

        MockHttpServletResponse outerResponse = invoke(
                filter,
                "/api/ai/reading-insights",
                (request, response) -> filter.doFilterInternal(
                        insightRequest(),
                        nestedResponse,
                        (nestedRequest, nestedResult) -> {
                            throw new AssertionError("A concurrent AI task must not reach the controller");
                        }));

        assertEquals(200, outerResponse.getStatus());
        assertEquals(429, nestedResponse.getStatus());
        assertTrue(nestedResponse.getContentAsString().contains("AI_TASK_IN_PROGRESS"));

        MockHttpServletResponse afterCompletion = invoke(
                filter,
                "/api/ai/reading-insights",
                (request, response) -> {
                });
        assertEquals(200, afterCompletion.getStatus());
    }

    @Test
    void starMapAiHasItsOwnPerUserMinuteQuota() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(3, 1);
        authenticate("alice");

        MockHttpServletResponse first = invoke(
                filter,
                "/api/star-map/analyze-themes",
                (request, response) -> {
                });
        MockHttpServletResponse second = invoke(
                filter,
                "/api/star-map/analyze-themes",
                (request, response) -> {
                    throw new AssertionError("A rate-limited request must not reach the controller");
                });

        assertEquals(200, first.getStatus());
        assertEquals(429, second.getStatus());
        assertTrue(second.getContentAsString().contains("AI_RATE_LIMITED"));
    }

    @Test
    void quotasAreSeparatedByAuthenticatedUser() throws Exception {
        RateLimitFilter filter = new RateLimitFilter(1, 1);
        authenticate("alice");
        invoke(filter, "/api/ai/reading-insights", (request, response) -> {
        });

        authenticate("bob");
        MockHttpServletResponse bobResponse = invoke(
                filter,
                "/api/ai/reading-insights",
                (request, response) -> {
                });

        assertEquals(200, bobResponse.getStatus());
    }

    private MockHttpServletResponse invoke(
            RateLimitFilter filter,
            String path,
            FilterChain chain) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setRemoteAddr("192.168.31.20");
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilterInternal(request, response, chain);
        return response;
    }

    private MockHttpServletRequest insightRequest() {
        MockHttpServletRequest request =
                new MockHttpServletRequest("POST", "/api/ai/reading-insights");
        request.setRemoteAddr("192.168.31.20");
        return request;
    }

    private void authenticate(String username) {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(
                        username,
                        null,
                        Collections.singletonList(new SimpleGrantedAuthority("ROLE_USER"))));
    }
}
