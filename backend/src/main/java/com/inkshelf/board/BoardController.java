package com.inkshelf.board;

import com.inkshelf.user.*;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.*;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/messages")
/** 留言板 API：游客可读，登录用户可发布，作者或管理员可删除。 */
public class BoardController {
    private final BoardMessageRepository messages;
    private final UserRepository users;

    public BoardController(BoardMessageRepository m, UserRepository u) {
        messages = m;
        users = u;
    }

    public static class CreateRequest {
        @NotBlank
        @Size(max = 1000)
        public String content;
    }

    public static class Item {
        public Long id;
        public String content;
        public String author;
        public String username;
        public Instant createdAt;

        Item(BoardMessage m) {
            id = m.getId();
            content = m.getContent();
            author = m.getUser().getDisplayName();
            username = m.getUser().getUsername();
            createdAt = m.getCreatedAt();
        }
    }

    @GetMapping
    public Page<Item> list(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        size = Math.max(1, Math.min(size, 50));
        return messages.findByStatus("VISIBLE", PageRequest.of(Math.max(0, page), size, Sort.by(Sort.Direction.DESC, "createdAt"))).map(Item::new);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Item create(Authentication a, @Valid @RequestBody CreateRequest r) {
        AppUser u = user(a);
        BoardMessage m = new BoardMessage();
        m.setUser(u);
        m.setContent(r.content.trim());
        return new Item(messages.save(m));
    }

    /**
     * 使用软删除保留记录；越权删除统一交给全局异常处理返回 403。
     */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Authentication a, @PathVariable Long id) {
        BoardMessage m = messages.findById(id).orElseThrow(() -> new IllegalArgumentException("留言不存在"));
        AppUser u = user(a);
        if (!m.getUser().getId().equals(u.getId()) && !"ADMIN".equals(u.getRole()))
            throw new AccessDeniedException("forbidden");
        m.setStatus("DELETED");
        m.setUpdatedAt(Instant.now());
        messages.save(m);
    }

    private AppUser user(Authentication a) {
        return users.findByUsernameIgnoreCase(a.getName()).orElseThrow(() -> new IllegalArgumentException("用户不存在"));
    }
}
