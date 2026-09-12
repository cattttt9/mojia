package com.inkshelf.starmap;

import com.inkshelf.user.AppUser;
import com.inkshelf.user.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import javax.validation.constraints.Min;
import javax.validation.constraints.Max;
import java.util.List;
import java.util.Map;

/** 用户私密阅读星图接口；所有读写都从认证信息取得 user_id。 */
@RestController
@RequestMapping("/api/star-map")
public class ReadingStarMapController {
    private final ReadingStarMapService starMap;
    private final UserRepository users;

    public ReadingStarMapController(ReadingStarMapService starMap, UserRepository users) {
        this.starMap = starMap;
        this.users = users;
    }

    @GetMapping
    public Map<String, Object> graph(Authentication authentication,
                                     @RequestParam(value = "q", required = false) @Size(max = 80) String query) {
        return starMap.graph(user(authentication).getId(), null, query);
    }

    @PostMapping("/sync")
    public Map<String, Object> sync(Authentication authentication, @Valid @RequestBody SyncRequest request) {
        Long userId = user(authentication).getId();
        starMap.sync(userId, request.books);
        return starMap.graph(userId, null, null);
    }

    @PostMapping("/analyze-themes")
    public Map<String, Object> analyze(Authentication authentication) {
        return starMap.analyzeThemes(user(authentication).getId());
    }

    @PostMapping("/relations/hide")
    public Map<String, Object> hide(Authentication authentication, @Valid @RequestBody RelationRequest request) {
        Long userId = user(authentication).getId();
        starMap.hide(userId, request.sourceBookId, request.targetBookId);
        return starMap.graph(userId, "关联已隐藏，可在后续纠错版本中统一恢复", null);
    }

    public static class SyncRequest {
        @NotNull @Size(max = 120)
        public List<@Valid BookInput> books;
    }

    public static class BookInput {
        @NotBlank @Size(max = 64) public String id;
        @NotBlank @Size(max = 300) public String title;
        @Size(max = 300) public String author;
        @Size(max = 300) public String category;
        @Size(max = 2000) public String cover;
        public boolean finished;
        public Long lastRead;
        @Min(0) @Max(100) public Integer progress;
        public boolean top;
    }

    public static class RelationRequest {
        @NotBlank @Size(max = 64) public String sourceBookId;
        @NotBlank @Size(max = 64) public String targetBookId;
    }

    private AppUser user(Authentication authentication) {
        return users.findByUsernameIgnoreCase(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
    }
}
