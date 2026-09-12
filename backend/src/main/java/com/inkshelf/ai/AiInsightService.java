package com.inkshelf.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.time.Instant;
import java.util.*;

/**
 * 调用智谱 GLM 生成阅读洞察。
 * <p>
 * 设计边界：
 * 1. API Key 仅从环境变量读取，不从请求体读取。
 * 2. 不记录请求体，避免划线、想法或 Authorization 泄露到日志。
 * 3. 所有提示词都要求模型区分“用户原文依据”和“AI 整理内容”。
 */
@Service
public class AiInsightService {
    private static final Logger log = LoggerFactory.getLogger(AiInsightService.class);
    private final String apiKey;
    private final String baseUrl;
    private final String model;
    private final ObjectMapper json;
    private final RestTemplate http;
    private final AiInsightHistoryRepository history;

    public AiInsightService(@Value("${inkshelf.ai.zhipu-api-key:}") String apiKey,
                            @Value("${inkshelf.ai.zhipu-base-url:https://open.bigmodel.cn/api/paas/v4}") String baseUrl,
                            @Value("${inkshelf.ai.model:glm-4.7}") String model,
                            ObjectMapper json,
                            AiInsightHistoryRepository history) {
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.baseUrl = trimSlash(baseUrl);
        this.model = model;
        this.json = json;
        this.history = history;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(8000);
        factory.setReadTimeout(180000);
        this.http = new RestTemplate(factory);
    }

    public Map<String, Object> generate(Long userId, String type, JsonNode payload) {
        if (apiKey.isEmpty()) throw new AiNotConfiguredException();
        String normalized = normalizeType(type);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("temperature", temperature(normalized));
        body.put("max_tokens", maxTokens(normalized));
        body.put("stream", false);
        body.put("messages", Arrays.asList(
                message("system", systemPrompt(normalized)),
                message("user", userPrompt(normalized, payload))
        ));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey);
        try {
            ResponseEntity<JsonNode> response = http.exchange(baseUrl + "/chat/completions", HttpMethod.POST, new HttpEntity<Map<String, Object>>(body, headers), JsonNode.class);
            JsonNode content = response.getBody() == null ? null : response.getBody().at("/choices/0/message/content");
            if (content == null || content.isMissingNode())
                throw new AiUpstreamException("智谱返回格式异常，请稍后再试。");
            return success(userId, normalized, payload, content.asText());
        } catch (AiNotConfiguredException e) {
            throw e;
        } catch (AiUpstreamException e) {
            log.warn("Zhipu AI returned unexpected response, type={}, model={}, reason={}", normalized, model, e.getMessage());
            throw e;
        } catch (HttpStatusCodeException e) {
            log.warn("Zhipu AI rejected request, type={}, model={}, status={}", normalized, model, e.getStatusCode().value());
            throw new AiUpstreamException(upstreamMessage(e.getStatusCode()));
        } catch (ResourceAccessException e) {
            log.warn("Zhipu AI request timed out or network failed, type={}, model={}, error={}", normalized, model, e.getClass().getSimpleName());
            throw new AiUpstreamException("AI 响应超时：智谱已收到请求但本地没有等到结果，请稍后再试。");
        } catch (Exception e) {
            log.warn("Zhipu AI request failed, type={}, model={}, error={}", normalized, model, e.getClass().getSimpleName());
            throw new AiUpstreamException("AI 服务暂时不可用，请稍后再试。");
        }
    }

    private String upstreamMessage(HttpStatus status) {
        int code = status.value();
        if (code == 401 || code == 403) return "智谱 Key 无效、未生效或没有模型权限，请检查 ZHIPU_API_KEY。";
        if (code == 404) return "智谱接口地址或模型名不可用，请检查 ZHIPU_API_BASE_URL 和 ZHIPU_MODEL。";
        if (code == 429) return "智谱上游请求过于频繁，请稍后再试。";
        if (code >= 500) return "智谱上游服务暂时异常，请稍后再试。";
        return "AI 请求被智谱拒绝，请检查模型名、Key 权限或账户状态。";
    }

    public Map<String, Object> error(String type, String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("type", normalizeType(type));
        m.put("generatedAt", Instant.now().toString());
        m.put("message", message);
        return m;
    }

    public List<Map<String, Object>> history(Long userId, String type) {
        String normalized = normalizeType(type);
        List<Map<String, Object>> items = new ArrayList<>();
        for (AiInsightHistory item : history.findTop10ByUserIdAndInsightTypeOrderByCreatedAtDesc(userId, normalized)) {
            items.add(view(item));
        }
        return items;
    }

    private Map<String, Object> success(Long userId, String type, JsonNode payload, String content) throws Exception {
        JsonNode result = parseJsonContent(content);
        Instant now = Instant.now();
        AiInsightHistory item = new AiInsightHistory();
        item.setUserId(userId);
        item.setInsightType(type);
        item.setTitle(title(type, result));
        item.setModel(model);
        item.setInputSummary(inputSummary(type, payload));
        item.setResultJson(result.toString());
        item.setCreatedAt(now);
        item = history.save(item);

        Map<String, Object> m = view(item);
        m.put("generatedAt", now.toString());
        return m;
    }

    private Map<String, Object> view(AiInsightHistory item) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", item.getId());
        m.put("type", item.getInsightType());
        m.put("title", item.getTitle());
        m.put("model", item.getModel());
        m.put("generatedAt", item.getCreatedAt().toString());
        try {
            m.put("result", json.readTree(item.getResultJson()));
        } catch (Exception ignored) {
            ObjectNode node = json.createObjectNode();
            node.put("text", item.getResultJson());
            m.put("result", node);
        }
        return m;
    }

    private String title(String type, JsonNode result) {
        String explicit = text(result, "title");
        if (explicit != null && !explicit.trim().isEmpty()) return truncate(explicit.trim(), 120);
        if ("weekly_themes".equals(type)) {
            String summary = text(result, "summary");
            return truncate(summary == null || summary.trim().isEmpty() ? "上周阅读主题报告" : summary.trim(), 120);
        }
        if ("abandonment_diagnosis".equals(type)) return "弃读诊断";
        return "阅读处方";
    }

    private String inputSummary(String type, JsonNode payload) {
        ObjectNode node = json.createObjectNode();
        node.put("type", type);
        if (payload == null || payload.isNull()) return node.toString();
        copyText(payload, node, "periodStart");
        copyText(payload, node, "periodEnd");
        copyText(payload, node, "mood");
        copyText(payload, node, "freeTime");
        copyText(payload, node, "intensity");
        if (payload.has("continueReading")) node.put("continueReading", payload.path("continueReading").asBoolean());
        if (payload.has("books")) node.put("bookCount", payload.path("books").size());
        if (payload.has("candidates")) node.put("candidateCount", payload.path("candidates").size());
        if (payload.has("highlights")) node.put("highlightCount", payload.path("highlights").size());
        if (payload.has("notes")) node.put("noteCount", payload.path("notes").size());
        return node.toString();
    }

    private void copyText(JsonNode source, ObjectNode target, String field) {
        JsonNode value = source.path(field);
        if (!value.isMissingNode() && !value.isNull()) target.put(field, truncate(value.asText(), 120));
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node == null ? null : node.path(field);
        return value == null || value.isMissingNode() || value.isNull() ? null : value.asText();
    }

    private String truncate(String value, int max) {
        if (value == null || value.length() <= max) return value;
        return value.substring(0, max);
    }

    private JsonNode parseJsonContent(String content) throws Exception {
        String clean = stripFence(content);
        try {
            return json.readTree(clean);
        } catch (Exception ignored) {
            ObjectNode node = json.createObjectNode();
            node.put("text", clean);
            return node;
        }
    }

    private String systemPrompt(String type) {
        String common = "你是墨架 InkShelf 的阅读洞察助手。只依据用户提供的 JSON 数据回答，不要编造书名、作者、时长、划线或想法。"
                + "必须用中文。不要评价用户人格，不要使用医疗、治疗、疗效承诺。"
                + "如果涉及用户原文，必须放在 evidence/original 字段；AI 的整理、推断、建议必须放在 analysis/reason/suggestion 字段，二者不能混写。"
                + "返回严格 JSON，不要 Markdown，不要代码块。";
        if ("weekly_themes".equals(type)) {
            return common + "任务：整理上周阅读主题，明确列出原文依据和 AI 整理。";
        }
        if ("abandonment_diagnosis".equals(type)) {
            return common + "任务：从用户自己的书架中分析哪些书可能长期读不下去，并给出温和、可解释的可能原因。";
        }
        return common + "任务：只从用户自己的书架候选中推荐一本当前可读的书，并解释为什么适合当前心情和空闲时间。";
    }

    private String userPrompt(String type, JsonNode payload) {
        if ("weekly_themes".equals(type)) {
            return "请返回 JSON：{\"summary\":\"不超过80字\",\"themes\":[{\"title\":\"主题名\",\"analysis\":\"AI整理，不超过90字\",\"evidence\":[\"用户原文或书籍依据\"]}],\"boundary\":\"一句话说明原文与AI整理已区分\"}。\n数据：\n" + compact(payload);
        }
        if ("abandonment_diagnosis".equals(type)) {
            return "请返回 JSON：{\"summary\":\"不超过80字\",\"items\":[{\"bookId\":\"候选ID\",\"title\":\"书名\",\"reason\":\"可能读不下去的原因，不超过80字\",\"suggestion\":\"一个低压力处理方式\"}],\"boundary\":\"只依据停留时间、未读完状态、分类和字数推断\"}。最多 5 本。\n数据：\n" + compact(payload);
        }
        return "请返回 JSON：{\"bookId\":\"候选ID\",\"title\":\"书名\",\"reason\":\"为什么推荐，不超过90字\",\"howToRead\":\"如何开始读，不超过70字\",\"avoidClaim\":\"说明这只是阅读建议，不是心理或医疗建议\"}。只能选择 candidates 中的一本。\n数据：\n" + compact(payload);
    }

    private String compact(JsonNode payload) {
        String raw = payload == null ? "{}" : payload.toString();
        return raw.length() > 18000 ? raw.substring(0, 18000) : raw;
    }

    private Map<String, String> message(String role, String content) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("role", role);
        m.put("content", content);
        return m;
    }

    private String normalizeType(String type) {
        if ("weekly_themes".equals(type) || "abandonment_diagnosis".equals(type) || "prescription".equals(type))
            return type;
        throw new IllegalArgumentException("未知的 AI 洞察类型");
    }

    private double temperature(String type) {
        return "prescription".equals(type) ? 0.55 : 0.35;
    }

    private int maxTokens(String type) {
        if ("weekly_themes".equals(type)) return 900;
        if ("abandonment_diagnosis".equals(type)) return 800;
        return 500;
    }

    private String stripFence(String value) {
        String text = value == null ? "" : value.trim();
        if (text.startsWith("```")) {
            text = text.replaceFirst("^```[a-zA-Z]*\\s*", "");
            text = text.replaceFirst("\\s*```$", "");
        }
        return text.trim();
    }

    private static String trimSlash(String value) {
        if (value == null || value.trim().isEmpty()) return "https://open.bigmodel.cn/api/paas/v4";
        String s = value.trim();
        return s.endsWith("/") ? s.substring(0, s.length() - 1) : s;
    }

    public static class AiNotConfiguredException extends RuntimeException {
    }

    public static class AiUpstreamException extends RuntimeException {
        public AiUpstreamException(String message) {
            super(message);
        }
    }
}
