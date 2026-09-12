package com.inkshelf.weread;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * 验证微信读书笔记同步、内容归类和用户数据隔离。
 */
class WeReadNoteServiceTest {
    private final WeReadNotebookRepository notebooks = mock(WeReadNotebookRepository.class);
    private final WeReadNoteRepository notes = mock(WeReadNoteRepository.class);
    private final NoteSyncStateRepository states = mock(NoteSyncStateRepository.class);
    private final WeReadGatewayClient gateway = mock(WeReadGatewayClient.class);
    private final WeReadNoteService service = new WeReadNoteService(
            mock(WeReadCredentialRepository.class), mock(SecretCryptoService.class), gateway,
            notebooks, notes, states, mock(WeReadNotePersistenceService.class));

    @Test
    void listAlwaysScopesNotesByAuthenticatedUser() {
        when(notebooks.findByUserIdAndBookId(42L, "book_1")).thenReturn(Optional.empty());
        when(notes.findByUserIdAndBookIdOrderBySourceCreatedAtDesc(42L, "book_1")).thenReturn(Collections.emptyList());
        when(states.findByUserIdAndScope(42L, "BOOK:book_1")).thenReturn(Optional.empty());

        service.list(42L, "book_1");

        verify(notes, atLeastOnce()).findByUserIdAndBookIdOrderBySourceCreatedAtDesc(42L, "book_1");
        verify(notes, never()).findByUserIdAndBookIdOrderBySourceCreatedAtDesc(43L, "book_1");
    }

    @Test
    void rejectsUnsafeBookIdBeforeQueryingRepositories() {
        assertThrows(IllegalArgumentException.class, () -> service.list(42L, "../other-user"));
        verifyNoInteractions(notebooks, notes, states);
    }

    @Test
    void prefersActualReadingTimeFromCurrentProgressResponse() throws Exception {
        assertEquals(15409L, service.resolveReadingTime(new ObjectMapper().readTree("{\"readingTime\":15409,\"recordReadingTime\":0}")));
    }

    @Test
    void fallsBackToLegacyRecordReadingTime() throws Exception {
        assertEquals(7200L, service.resolveReadingTime(new ObjectMapper().readTree("{\"recordReadingTime\":7200}")));
    }

    @Test
    void initializesMissingSyncStateWithDatabaseUpsert() {
        NoteSyncState state = mock(NoteSyncState.class);
        when(state.getId()).thenReturn(9L);
        when(states.findByUserIdAndScope(42L, "BOOK:book_1"))
                .thenReturn(Optional.empty(), Optional.of(state), Optional.of(state));
        when(states.tryBegin(eq(9L), any(), any())).thenReturn(0);
        when(notebooks.findByUserIdAndBookId(42L, "book_1")).thenReturn(Optional.empty());
        when(notes.findByUserIdAndBookIdOrderBySourceCreatedAtDesc(42L, "book_1")).thenReturn(Collections.emptyList());

        service.syncBook(42L, "book_1", false);

        verify(states).insertIfAbsent(eq(42L), eq("BOOK:book_1"), any());
    }

    @Test
    void skipsDuplicateBookSyncWhenAnotherRequestAlreadyClaimedIt() {
        NoteSyncState state = mock(NoteSyncState.class);
        when(state.getId()).thenReturn(9L);
        when(states.findByUserIdAndScope(42L, "BOOK:book_1")).thenReturn(Optional.of(state));
        when(states.tryBegin(eq(9L), any(), any())).thenReturn(0);
        when(notebooks.findByUserIdAndBookId(42L, "book_1")).thenReturn(Optional.empty());
        when(notes.findByUserIdAndBookIdOrderBySourceCreatedAtDesc(42L, "book_1")).thenReturn(Collections.emptyList());

        service.syncBook(42L, "book_1", false);

        verifyNoInteractions(gateway);
    }
}
