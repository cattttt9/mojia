package com.inkshelf.weread;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class WeReadCoverController {
    private final WeReadCoverProxyService covers;

    public WeReadCoverController(WeReadCoverProxyService covers) {
        this.covers = covers;
    }

    @GetMapping("/api/public/weread-cover")
    public ResponseEntity<byte[]> cover(@RequestParam String url, @RequestParam("sig") String signature) {
        return covers.fetch(url, signature);
    }
}
