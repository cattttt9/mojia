package com.inkshelf.weread;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class WeReadCoverProxyServiceTest {
    private final WeReadCoverProxyService covers = new WeReadCoverProxyService("test-signing-key-at-least-32-bytes");

    @Test
    void proxiesWereadCdnCoverWithSignature() {
        String result = covers.proxiedUrl("https://cdn.weread.qq.com/example.jpg");
        assertTrue(result.startsWith("/api/public/weread-cover?url="));
        assertTrue(result.contains("&sig="));
    }

    @Test
    void keepsCorsEnabledCloudCoverDirect() {
        String source = "https://wfqqreader-1252317822.image.myqcloud.com/example.jpg";
        assertEquals(source, covers.proxiedUrl(source));
    }

    @Test
    void neverTurnsUnknownHostIntoProxyRequest() {
        String source = "https://example.com/not-allowed.jpg";
        assertEquals(source, covers.proxiedUrl(source));
    }
}
