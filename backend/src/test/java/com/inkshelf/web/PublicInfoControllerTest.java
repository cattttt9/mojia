package com.inkshelf.web;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PublicInfoControllerTest {
    @Test
    void dailyQuoteExcludesPreviousQuote() {
        PublicInfoController controller = new PublicInfoController();
        Map<String, Object> first = controller.dailyQuote(null);
        Map<String, Object> second = controller.dailyQuote(String.valueOf(first.get("id")));
        assertNotEquals(first.get("id"), second.get("id"));
        assertFalse(String.valueOf(second.get("text")).trim().isEmpty());
        assertFalse(String.valueOf(second.get("author")).trim().isEmpty());
    }
}
