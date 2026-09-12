package com.inkshelf.weread;

import com.inkshelf.user.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.Map;

/**
 * 第一阶段阅读记忆 API：同步概览或单书详情，并按登录用户隔离查询。
 */
@RestController
public class BookNoteController {
    private final WeReadNoteService notes;
    private final UserRepository users;

    public BookNoteController(WeReadNoteService n, UserRepository u) {
        notes = n;
        users = u;
    }

    public static class SyncRequest {
        public String bookId;
        public boolean force;
    }

    @PostMapping("/api/weread/notes/sync")
    public Map<String, Object> sync(Authentication authentication, @Valid @RequestBody(required = false) SyncRequest request) {
        AppUser user = user(authentication);
        SyncRequest body = request == null ? new SyncRequest() : request;
        return body.bookId == null || body.bookId.trim().isEmpty() ? notes.syncOverview(user.getId(), body.force) : notes.syncBook(user.getId(), body.bookId.trim(), body.force);
    }

    @GetMapping("/api/books/{bookId}/notes")
    public Map<String, Object> list(Authentication authentication, @PathVariable String bookId) {
        return notes.list(user(authentication).getId(), bookId);
    }

    @GetMapping("/api/books/{bookId}/note-summary")
    public Map<String, Object> summary(Authentication authentication, @PathVariable String bookId) {
        return notes.summary(user(authentication).getId(), bookId);
    }

    @GetMapping("/api/books/{bookId}/reading")
    public Map<String, Object> reading(Authentication authentication, @PathVariable String bookId) {
        return notes.reading(user(authentication).getId(), bookId);
    }

    private AppUser user(Authentication authentication) {
        return users.findByUsernameIgnoreCase(authentication.getName()).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
    }
}
