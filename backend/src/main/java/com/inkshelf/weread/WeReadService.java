package com.inkshelf.weread;

import com.fasterxml.jackson.databind.JsonNode;
import com.inkshelf.user.AppUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import javax.persistence.EntityManager;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 负责微信读书凭据连接、仪表盘聚合、同步状态更新和断开连接等核心流程。
 * API Key 只在调用网关前解密，数据库中始终保存加密后的密文。
 */
@Service
public class WeReadService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private final WeReadCredentialRepository credentials;
    private final SecretCryptoService crypto;
    private final EntityManager entityManager;
    private final WeReadGatewayClient gateway;
    private final WeReadBookMetadataService metadata;
    private final ExecutorService dashboardExecutor = Executors.newFixedThreadPool(3, runnable -> {
        Thread thread = new Thread(runnable, "weread-dashboard");
        thread.setDaemon(true);
        return thread;
    });

    public WeReadService(WeReadCredentialRepository credentials, SecretCryptoService crypto, EntityManager entityManager, WeReadGatewayClient gateway, WeReadBookMetadataService metadata) {
        this.credentials = credentials;
        this.crypto = crypto;
        this.entityManager = entityManager;
        this.gateway = gateway;
        this.metadata = metadata;
    }

    @Transactional
    public Map<String, JsonNode> connect(AppUser user, String apiKey) {
        if (apiKey == null || !apiKey.matches("^wrk-[A-Za-z0-9_-]{8,}$")) throw new IllegalArgumentException("API Key 格式不正确");
        Map<String, JsonNode> data = dashboard(apiKey, user.getId());
        Instant now = Instant.now();
        String last4 = apiKey.substring(Math.max(0, apiKey.length() - 4));
        WeReadCredential credential = credentials.findById(user.getId()).orElse(null);
        if (credential == null) {
            credential = new WeReadCredential();
            credential.setUser(entityManager.getReference(AppUser.class, user.getId()));
            credential.setConnectedAt(now);
        }
        credential.setEncryptedApiKey(crypto.encrypt(apiKey));
        credential.setKeyHint("****" + last4);
        credential.setApiKeyLast4(last4);
        credential.setLastVerifiedAt(now);
        credential.setLastSyncAt(now);
        credential.setLastSyncStatus("SUCCESS");
        credential.setLastSyncError(null);
        credential.setUpdatedAt(now);
        credentials.save(credential);
        List<String> ids = bookIds(data.get("shelf"));
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { metadata.enqueue(user.getId(), ids); }
        });
        return data;
    }

    @Transactional
    public Map<String, JsonNode> dashboardFor(AppUser user) {
        WeReadCredential credential = credentials.findById(user.getId()).orElseThrow(() -> new IllegalArgumentException("请先绑定微信读书 API Key"));
        Map<String, JsonNode> data = dashboard(crypto.decrypt(credential.getEncryptedApiKey()), user.getId());
        Instant now = Instant.now();
        credential.setLastSyncAt(now);
        credential.setLastSyncStatus("SUCCESS");
        credential.setLastSyncError(null);
        credential.setUpdatedAt(now);
        credentials.save(credential);
        metadata.enqueue(user.getId(), bookIds(data.get("shelf")));
        return data;
    }

    @Transactional
    public void markSyncFailed(Long userId, String code) {
        credentials.findById(userId).ifPresent(credential -> {
            credential.setLastSyncStatus("FAILED");
            credential.setLastSyncError(code);
            credential.setUpdatedAt(Instant.now());
            credentials.save(credential);
        });
    }

    @Transactional
    public void disconnect(Long userId) {
        credentials.findById(userId).ifPresent(credentials::delete);
    }

    public Optional<String> hint(Long userId) {
        return credentials.findById(userId).map(WeReadCredential::getKeyHint);
    }

    private Map<String, JsonNode> dashboard(String key, Long userId) {
        Map<String, JsonNode> r = new LinkedHashMap<>();
        int currentYear = LocalDate.now(ZONE).getYear();
        long currentYearStart = LocalDate.of(currentYear, 1, 1).atStartOfDay(ZONE).toEpochSecond();
        long previousYearStart = LocalDate.of(currentYear - 1, 1, 1).atStartOfDay(ZONE).toEpochSecond();
        CompletableFuture<JsonNode> overall = gatewayAsync(key, "/readdata/detail", params("mode", "overall", "baseTime", 0));
        CompletableFuture<JsonNode> annual = gatewayAsync(key, "/readdata/detail", params("mode", "annually", "baseTime", currentYearStart));
        CompletableFuture<JsonNode> annualPrevious = gatewayAsync(key, "/readdata/detail", params("mode", "annually", "baseTime", previousYearStart));
        JsonNode shelf = gateway.call(key, "/shelf/sync", Collections.emptyMap());
        metadata.attachCached(userId, shelf);
        r.put("shelf", shelf);
        r.put("overall", join(overall));
        r.put("annual", join(annual));
        r.put("annualPrevious", join(annualPrevious));
        return r;
    }

    private CompletableFuture<JsonNode> gatewayAsync(String key, String api, Map<String, Object> params) {
        return CompletableFuture.supplyAsync(() -> gateway.call(key, api, params), dashboardExecutor);
    }

    private JsonNode join(CompletableFuture<JsonNode> request) {
        try {
            return request.join();
        } catch (CompletionException error) {
            Throwable cause = error.getCause();
            if (cause instanceof RuntimeException) throw (RuntimeException) cause;
            throw new IllegalStateException("微信读书仪表盘加载失败", cause);
        }
    }

    private List<String> bookIds(JsonNode shelf) {
        List<String> ids = new ArrayList<>();
        if (shelf != null && shelf.path("books").isArray()) shelf.path("books").forEach(book -> {
            String id = book.path("bookId").asText("");
            if (!id.isEmpty()) ids.add(id);
        });
        return ids;
    }

    private Map<String, Object> params(Object... values) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < values.length; i += 2) m.put((String) values[i], values[i + 1]);
        return m;
    }
}
