package com.inkshelf.weread;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * 验证书籍元数据的缓存、补全和失败重试行为。
 */
class WeReadBookMetadataServiceTest {
    private final WeReadBookMetadataRepository repository = mock(WeReadBookMetadataRepository.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final WeReadCoverProxyService covers = new WeReadCoverProxyService("test-signing-key-at-least-32-bytes");
    private final WeReadBookMetadataService service = new WeReadBookMetadataService(
            repository, mock(WeReadCredentialRepository.class), mock(SecretCryptoService.class),
            mock(WeReadGatewayClient.class), jdbc, covers);
    private final ObjectMapper json = new ObjectMapper();

    @Test
    void parsesNumericWordCount() {
        assertEquals(326400L, service.parseWordCount(json.valueToTree(326400)));
    }

    @Test
    void parsesChineseTenThousandWordCount() {
        assertEquals(325000L, service.parseWordCount(json.valueToTree("32.5万字")));
    }

    @Test
    void returnsZeroForMissingWordCount() {
        assertEquals(0L, service.parseWordCount(json.nullNode()));
    }

    @Test
    void fillsOnlyMissingShelfCoverFromCache() {
        WeReadBookMetadata cached = new WeReadBookMetadata();
        cached.setBookId("book-1");
        cached.setWordCount(123L);
        cached.setCoverUrl("https://example.com/cached.jpg");
        cached.setCoverFetchedAt(Instant.now());
        when(repository.findAllById(any())).thenReturn(Collections.singletonList(cached));

        ObjectNode shelf = json.createObjectNode();
        ArrayNode books = shelf.putArray("books");
        books.addObject().put("bookId", "book-1");
        service.attachCached(1L, shelf);

        assertEquals(123L, books.get(0).path("wordCount").asLong());
        assertEquals("https://example.com/cached.jpg", books.get(0).path("cover").asText());
    }

    @Test
    void keepsShelfCoverWhenCacheIsOlder() {
        WeReadBookMetadata cached = new WeReadBookMetadata();
        cached.setBookId("book-1");
        cached.setCoverUrl("https://example.com/cached.jpg");
        when(repository.findAllById(any())).thenReturn(Collections.singletonList(cached));

        ObjectNode shelf = json.createObjectNode();
        ArrayNode books = shelf.putArray("books");
        books.addObject()
                .put("bookId", "book-1")
                .put("cover", "https://example.com/shelf.jpg");
        service.attachCached(1L, shelf);

        assertEquals("https://example.com/shelf.jpg", books.get(0).path("cover").asText());
    }
}
