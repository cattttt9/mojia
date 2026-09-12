package com.inkshelf.weread;

import com.fasterxml.jackson.databind.JsonNode;
import com.inkshelf.user.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.*;
import java.util.*;

@RestController
@RequestMapping("/api/weread")
/** 登录用户的微信读书绑定、同步、元数据查询和解绑接口。 */
public class WeReadController {
    private final WeReadService service;
    private final WeReadBookMetadataService metadata;
    private final UserRepository users;

    public WeReadController(WeReadService s, WeReadBookMetadataService m, UserRepository u) {
        service = s;
        metadata = m;
        users = u;
    }

    public static class ConnectRequest {
        @NotBlank
        public String apiKey;
    }

    public static class MetadataRequest {
        @NotNull
        @Size(max = 120)
        public List<@NotBlank String> bookIds;
    }

    @PostMapping("/connect")
    public Map<String, JsonNode> connect(Authentication a, @Valid @RequestBody ConnectRequest r) {
        return service.connect(user(a), r.apiKey);
    }

    @GetMapping("/dashboard")
    public Map<String, JsonNode> dashboard(Authentication a) {
        return service.dashboardFor(user(a));
    }

    @GetMapping("/status")
    public Map<String, Object> status(Authentication a) {
        Optional<String> hint = service.hint(user(a).getId());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("connected", hint.isPresent());
        m.put("keyHint", hint.orElse(null));
        return m;
    }

    /**
     * 返回已缓存字数，并将尚未补全的书籍放入限速后台队列。
     */
    @PostMapping("/book-metadata/lookup")
    public Map<String, Object> metadata(Authentication a, @Valid @RequestBody MetadataRequest r) {
        AppUser u = user(a);
        metadata.enqueue(u.getId(), r.bookIds);
        return metadata.lookup(r.bookIds);
    }

    @DeleteMapping("/connection")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disconnect(Authentication a) {
        service.disconnect(user(a).getId());
    }

    private AppUser user(Authentication a) {
        return users.findByUsernameIgnoreCase(a.getName()).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
    }
}
