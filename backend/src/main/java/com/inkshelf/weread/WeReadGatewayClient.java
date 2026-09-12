package com.inkshelf.weread;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.*;

import java.util.Map;

@Component
/** 微信读书 Agent Gateway 客户端，统一封装版本号、鉴权和安全错误映射。 */
public class WeReadGatewayClient {
    private final ObjectMapper json;
    private final RestTemplate http = new RestTemplate();
    private final String gateway, version;
    private long lastCallAt;

    public WeReadGatewayClient(ObjectMapper j, @Value("${inkshelf.weread-gateway}") String g, @Value("${inkshelf.weread-skill-version}") String v) {
        json = j;
        gateway = g;
        version = v;
    }

    /**
     * 调用白名单业务接口。key 只进入 Authorization Header，禁止在日志中输出。
     */
    public JsonNode call(String key, String api, Map<String, Object> params) {
        reserveCallSlot();
        ObjectNode body = json.createObjectNode();
        body.put("api_name", api);
        body.put("skill_version", version);
        params.forEach((k, v) -> body.set(k, json.valueToTree(v)));
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(key);
        try {
            JsonNode result = http.postForObject(gateway, new HttpEntity<>(body, headers), JsonNode.class);
            if (result == null) throw new IllegalArgumentException("微信读书没有返回数据");
            if (result.has("upgrade_info"))
                throw new IllegalStateException(result.path("upgrade_info").path("message").asText("微信读书 Skill 需要升级"));
            if (result.path("errcode").asInt(0) != 0)
                throw new IllegalArgumentException("微信读书授权失败，请检查 API Key");
            return result;
        } catch (HttpStatusCodeException e) {
            throw new IllegalArgumentException("微信读书授权失败，请检查 API Key");
        } catch (ResourceAccessException e) {
            throw new IllegalStateException("暂时无法连接微信读书服务");
        }
    }

    /**
     * 只串行化调用的起始时间，不再持有锁等待整个网络响应。
     * 这样仍保持 250ms 的上游请求间隔，同时允许仪表盘的独立读请求重叠等待网络。
     */
    private void reserveCallSlot() {
        synchronized (this) {
            long wait = 250 - (System.currentTimeMillis() - lastCallAt);
            if (wait > 0) try {
                Thread.sleep(wait);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("微信读书同步已取消");
            }
            lastCallAt = System.currentTimeMillis();
        }
    }
}
