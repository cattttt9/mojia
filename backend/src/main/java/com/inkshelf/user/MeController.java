package com.inkshelf.user;

import com.fasterxml.jackson.databind.JsonNode;
import com.inkshelf.auth.LoginProtectionService;
import com.inkshelf.auth.LoginSecurityEventRepository;
import com.inkshelf.weread.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 聚合当前用户的资料、微信读书连接、同步状态、密码修改和数据删除操作。
 * 所有查询都以认证用户名重新定位用户，避免客户端提交任意用户编号。
 */
@RestController
@RequestMapping("/api/me")
public class MeController {
    private final UserRepository users;
    private final UserSyncStateRepository syncStates;
    private final WeReadCredentialRepository credentials;
    private final WeReadService weread;
    private final WeReadNoteService noteService;
    private final WeReadNotebookRepository notebooks;
    private final WeReadNoteRepository notes;
    private final PasswordEncoder passwords;
    private final LoginProtectionService loginProtection;
    private final LoginSecurityEventRepository loginEvents;

    public MeController(UserRepository users, UserSyncStateRepository syncStates, WeReadCredentialRepository credentials, WeReadService weread, WeReadNoteService noteService, WeReadNotebookRepository notebooks, WeReadNoteRepository notes, PasswordEncoder passwords, LoginProtectionService loginProtection, LoginSecurityEventRepository loginEvents) {
        this.users = users;
        this.syncStates = syncStates;
        this.credentials = credentials;
        this.weread = weread;
        this.noteService = noteService;
        this.notebooks = notebooks;
        this.notes = notes;
        this.passwords = passwords;
        this.loginProtection = loginProtection;
        this.loginEvents = loginEvents;
    }

    public static class ConnectRequest {
        @NotBlank
        public String apiKey;
    }

    public static class PasswordChangeRequest {
        @NotBlank
        public String currentPassword;
        @Size(min = 8, max = 72)
        public String newPassword;
    }

    public static class PasswordConfirmRequest {
        @NotBlank
        public String password;
    }

    @GetMapping
    public Map<String, Object> profile(Authentication auth) {
        return profile(current(auth));
    }

    @GetMapping("/weread/status")
    public Map<String, Object> wereadStatus(Authentication auth) {
        AppUser user = current(auth);
        Map<String, Object> result = new LinkedHashMap<>();
        WeReadCredential credential = credentials.findById(user.getId()).orElse(null);
        result.put("connected", credential != null);
        result.put("apiKeyMasked", credential == null ? null : "****" + safeLast4(credential));
        result.put("connectedAt", credential == null ? null : credential.getConnectedAt());
        result.put("lastVerifiedAt", credential == null ? null : credential.getLastVerifiedAt());
        result.put("lastSyncAt", credential == null ? null : credential.getLastSyncAt());
        result.put("lastSyncStatus", credential == null ? "IDLE" : credential.getLastSyncStatus());
        result.put("lastSyncError", credential == null ? null : readableError(credential.getLastSyncError()));
        return result;
    }

    @PostMapping("/weread/connect")
    public Map<String, Object> connect(Authentication auth, @Valid @RequestBody ConnectRequest request) {
        AppUser user = current(auth);
        try {
            Map<String, JsonNode> data = weread.connect(user, request.apiKey);
            updateShelfSuccess(user.getId(), countShelf(data.get("shelf")));
            return wereadStatus(auth);
        } catch (RuntimeException e) {
            weread.markSyncFailed(user.getId(), "UPSTREAM_UNAVAILABLE");
            throw e;
        }
    }

    @DeleteMapping("/weread/connection")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disconnect(Authentication auth) {
        weread.disconnect(current(auth).getId());
    }

    @GetMapping("/sync/status")
    public Map<String, Object> syncStatus(Authentication auth) {
        AppUser user = current(auth);
        UserSyncState state = state(user.getId());
        state.setNoteCount((int) notes.countByUserId(user.getId()));
        state.setBookmarkCount((int) notebooks.sumBookmarkCountByUserId(user.getId()));
        state.setUpdatedAt(Instant.now());
        syncStates.save(state);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("shelf", syncItem(state.getShelfStatus(), state.getShelfLastSyncAt(), state.getShelfCount(), state));
        result.put("note", syncItem(state.getNoteStatus(), state.getNoteLastSyncAt(), state.getNoteCount(), state));
        result.put("bookmark", syncItem(state.getBookmarkStatus(), state.getBookmarkLastSyncAt(), state.getBookmarkCount(), state));
        return result;
    }

    @PostMapping("/sync/shelf")
    public Map<String, Object> syncShelf(Authentication auth) {
        AppUser user = current(auth);
        UserSyncState state = state(user.getId());
        mark(state, "SHELF", "SYNCING", null);
        try {
            Map<String, JsonNode> data = weread.dashboardFor(user);
            updateShelfSuccess(user.getId(), countShelf(data.get("shelf")));
            return syncStatus(auth);
        } catch (RuntimeException e) {
            mark(state, "SHELF", "FAILED", "UPSTREAM_UNAVAILABLE");
            weread.markSyncFailed(user.getId(), "UPSTREAM_UNAVAILABLE");
            throw e;
        }
    }

    @PostMapping("/sync/notes")
    public Map<String, Object> syncNotes(Authentication auth) {
        AppUser user = current(auth);
        UserSyncState state = state(user.getId());
        mark(state, "NOTE", "SYNCING", null);
        try {
            noteService.syncOverview(user.getId(), true);
            state = state(user.getId());
            state.setNoteStatus("SUCCESS");
            state.setNoteLastSyncAt(Instant.now());
            state.setNoteCount((int) notes.countByUserId(user.getId()));
            state.setUpdatedAt(Instant.now());
            syncStates.save(state);
            return syncStatus(auth);
        } catch (RuntimeException e) {
            mark(state, "NOTE", "FAILED", "UPSTREAM_UNAVAILABLE");
            throw e;
        }
    }

    @PostMapping("/sync/bookmarks")
    public Map<String, Object> syncBookmarks(Authentication auth) {
        AppUser user = current(auth);
        UserSyncState state = state(user.getId());
        mark(state, "BOOKMARK", "SYNCING", null);
        try {
            noteService.syncOverview(user.getId(), true);
            state = state(user.getId());
            state.setBookmarkStatus("SUCCESS");
            state.setBookmarkLastSyncAt(Instant.now());
            state.setBookmarkCount((int) notebooks.sumBookmarkCountByUserId(user.getId()));
            state.setUpdatedAt(Instant.now());
            syncStates.save(state);
            return syncStatus(auth);
        } catch (RuntimeException e) {
            mark(state, "BOOKMARK", "FAILED", "UPSTREAM_UNAVAILABLE");
            throw e;
        }
    }

    @PostMapping("/password")
    public Map<String, Object> changePassword(Authentication auth, @Valid @RequestBody PasswordChangeRequest request) {
        AppUser user = current(auth);
        if (!passwords.matches(request.currentPassword, user.getPasswordHash()))
            throw new IllegalArgumentException("当前密码不正确");
        user.setPasswordHash(passwords.encode(request.newPassword));
        user.setUpdatedAt(Instant.now());
        users.save(user);
        loginProtection.resetForUsername(user.getUsername());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "密码已更新");
        return result;
    }

    @DeleteMapping("/data")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteMyData(Authentication auth, @Valid @RequestBody PasswordConfirmRequest request) {
        AppUser user = current(auth);
        if (!passwords.matches(request.password, user.getPasswordHash()))
            throw new IllegalArgumentException("密码不正确，未删除数据");
        loginProtection.resetForUsername(user.getUsername());
        loginEvents.deleteByUsernameHash(loginProtection.usernameHash(user.getUsername()));
        users.delete(user);
    }

    private AppUser current(Authentication auth) {
        return users.findByUsernameIgnoreCase(auth.getName()).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
    }

    private Map<String, Object> profile(AppUser user) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", user.getId());
        result.put("username", user.getUsername());
        result.put("email", user.getEmail());
        result.put("displayName", user.getDisplayName());
        result.put("role", user.getRole());
        result.put("status", user.getStatus());
        result.put("lastLoginAt", user.getLastLoginAt());
        result.put("lastSeenAt", user.getLastSeenAt());
        result.put("createdAt", user.getCreatedAt());
        return result;
    }

    private UserSyncState state(Long userId) {
        return syncStates.findById(userId).orElseGet(() -> {
            UserSyncState value = new UserSyncState();
            value.setUserId(userId);
            return syncStates.save(value);
        });
    }

    private Map<String, Object> syncItem(String status, Instant lastSyncAt, int count, UserSyncState state) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("status", status);
        result.put("lastSyncAt", lastSyncAt);
        result.put("count", count);
        result.put("error", readableError(state.getLastErrorCode()));
        return result;
    }

    private void updateShelfSuccess(Long userId, int count) {
        UserSyncState state = state(userId);
        state.setShelfStatus("SUCCESS");
        state.setShelfLastSyncAt(Instant.now());
        state.setShelfCount(count);
        state.setLastErrorCode(null);
        state.setLastErrorMessage(null);
        state.setUpdatedAt(Instant.now());
        syncStates.save(state);
    }

    private void mark(UserSyncState state, String type, String status, String error) {
        if ("SHELF".equals(type)) state.setShelfStatus(status);
        else if ("NOTE".equals(type)) state.setNoteStatus(status);
        else state.setBookmarkStatus(status);
        state.setLastErrorCode(error);
        state.setLastErrorMessage(readableError(error));
        state.setUpdatedAt(Instant.now());
        syncStates.save(state);
    }

    private int countShelf(JsonNode shelf) {
        if (shelf == null) return 0;
        return shelf.path("books").size() + shelf.path("albums").size();
    }

    private String safeLast4(WeReadCredential credential) {
        if (credential.getApiKeyLast4() != null) return credential.getApiKeyLast4();
        String hint = credential.getKeyHint();
        return hint == null ? "" : hint.substring(Math.max(0, hint.length() - 4));
    }

    private String readableError(String code) {
        if (code == null) return null;
        if (code.contains("AUTH")) return "授权失效，请重新导入 API Key";
        if (code.contains("RATE")) return "同步过于频繁，请稍后再试";
        if (code.contains("PARTIAL")) return "部分书籍同步失败，可稍后重试";
        return "微信读书服务暂时不可用，请稍后重试";
    }
}
