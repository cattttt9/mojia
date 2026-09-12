package com.inkshelf.memory;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.inkshelf.weread.*;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

/**
 * 验证阅读报告和时间胶囊统计逻辑的关键边界。
 */
class ReadingMemoryServiceTest {
    private final ReadingReportRepository reports = mock(ReadingReportRepository.class);
    private final ReadingCapsuleRepository capsules = mock(ReadingCapsuleRepository.class);
    private final CapsuleReflectionRepository reflections = mock(CapsuleReflectionRepository.class);
    private final ReadingMemoryService service = new ReadingMemoryService(reports, capsules, reflections, mock(WeReadNoteRepository.class), mock(WeReadNotebookRepository.class), mock(WeReadCredentialRepository.class), mock(SecretCryptoService.class), mock(WeReadGatewayClient.class), mock(WeReadNoteService.class), new ObjectMapper());

    @Test
    void usesPreviousCompleteWeekAndMonth() {
        assertEquals(LocalDate.of(2026, 6, 29), service.latestCompletedStart("WEEKLY", LocalDate.of(2026, 7, 9)));
        assertEquals(LocalDate.of(2026, 6, 1), service.latestCompletedStart("MONTHLY", LocalDate.of(2026, 7, 9)));
    }

    @Test
    void reflectionCannotReadAnotherUsersCapsule() {
        assertThrows(IllegalArgumentException.class, () -> service.reflect(7L, 88L, "现在的感受"));
        verify(capsules).findByIdAndUserId(88L, 7L);
        verify(capsules, never()).findById(88L);
    }
}
