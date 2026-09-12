package com.inkshelf.starmap;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

/** 批量提取书籍主题；不记录请求正文，AI 不可用时由调用方回退到规则图谱。 */
@Service
public class ReadingStarMapAiService {
    private final String apiKey;
    private final String baseUrl;
    private final String model;
    private final ObjectMapper json;
    private final RestTemplate http;

    public ReadingStarMapAiService(@Value("${inkshelf.ai.zhipu-api-key:}") String apiKey,
                                   @Value("${inkshelf.ai.zhipu-base-url:https://open.bigmodel.cn/api/paas/v4}") String baseUrl,
                                   @Value("${inkshelf.ai.model:glm-4.7}") String model,
                                   ObjectMapper json) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.model = model;
        this.json = json;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(8000);
        factory.setReadTimeout(180000);
        this.http = new RestTemplate(factory);
    }

    public Map<String, ThemeResult> analyze(List<Map<String, Object>> books) throws Exception {
        if (apiKey.isEmpty()) throw new IllegalStateException("AI_NOT_CONFIGURED");
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("model", model);
        request.put("temperature", 0.2);
        request.put("max_tokens", 2200);
        request.put("stream", false);
        request.put("messages", Arrays.asList(
                message("system", "你是墨架的书籍主题整理器。只依据输入数据，不编造用户笔记。返回严格JSON，不要Markdown。每本书最多4个简短中文主题，主题应可跨书复用。"),
                message("user", "返回 {\"books\":[{\"bookId\":\"原ID\",\"themes\":[\"主题\"],\"summary\":\"不超过60字\"}]}。数据：" + json.writeValueAsString(books))
        ));
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        JsonNode response = http.exchange(baseUrl + "/chat/completions", HttpMethod.POST,
                new HttpEntity<Map<String, Object>>(request, headers), JsonNode.class).getBody();
        String content = response == null ? "" : response.at("/choices/0/message/content").asText("");
        JsonNode root = json.readTree(stripFence(content));
        Map<String, ThemeResult> results = new LinkedHashMap<>();
        for (JsonNode item : root.path("books")) {
            String id = item.path("bookId").asText("");
            if (id.isEmpty()) continue;
            LinkedHashSet<String> themes = new LinkedHashSet<>();
            for (JsonNode theme : item.path("themes")) {
                String value = normalizeTheme(theme.asText(""));
                if (!value.isEmpty() && themes.size() < 4) themes.add(value);
            }
            if (!themes.isEmpty()) results.put(id, new ThemeResult(new ArrayList<>(themes), trim(item.path("summary").asText(""), 180)));
        }
        return results;
    }

    private Map<String, String> message(String role, String content) {
        Map<String, String> item = new LinkedHashMap<>(); item.put("role", role); item.put("content", content); return item;
    }
    private String stripFence(String value) {
        String clean = value == null ? "" : value.trim();
        if (clean.startsWith("```")) clean = clean.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
        return clean;
    }
    private String normalizeTheme(String value) { return trim(value.replaceAll("[\\s#，。,.、]+", ""), 12); }
    private String trim(String value, int max) { return value == null ? "" : value.substring(0, Math.min(max, value.length())); }

    public static class ThemeResult {
        public final List<String> themes; public final String summary;
        ThemeResult(List<String> themes, String summary) { this.themes = themes; this.summary = summary; }
    }
}
