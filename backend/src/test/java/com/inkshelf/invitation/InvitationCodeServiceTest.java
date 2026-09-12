package com.inkshelf.invitation;

import com.inkshelf.user.AppUser;
import com.inkshelf.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
/**
 * 验证邀请码生成、使用、过期和并发占用等业务约束。
 */
class InvitationCodeServiceTest {
    @Mock InvitationCodeRepository invitations;
    @Mock UserRepository users;
    InvitationCodeService service;

    @BeforeEach
    void setUp() {
        service = new InvitationCodeService(invitations, users);
    }

    @Test
    void createsRandomCodeAndPersistsOnlyHashAndMask() {
        AppUser admin = user("admin");
        when(users.findByUsernameIgnoreCase("admin")).thenReturn(Optional.of(admin));
        when(invitations.saveAndFlush(any(InvitationCode.class))).thenAnswer(call -> call.getArgument(0));

        InvitationCodeService.GeneratedInvitation generated = service.create("admin", 30);

        assertTrue(generated.rawCode.matches("[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}"));
        assertNotEquals(generated.rawCode, generated.invitation.getCodeHash());
        assertEquals(64, generated.invitation.getCodeHash().length());
        assertTrue(generated.invitation.getCodeMasked().matches("[A-Z2-9]{4}-\\*{4}-[A-Z2-9]{4}"));
        assertNotNull(generated.invitation.getExpiresAt());
    }

    @Test
    void claimsUnusedCodeAndRecordsAuditFields() {
        InvitationCode code = new InvitationCode();
        code.setStatus("UNUSED");
        code.setExpiresAt(Instant.now().plusSeconds(3600));
        when(invitations.findByHashForUpdate(anyString())).thenReturn(Optional.of(code));
        AppUser registrant = user("reader");

        service.claim("ABCD-EFGH-JKLM", registrant, "127.0.0.1", "request-123");

        assertEquals("USED", code.getStatus());
        assertSame(registrant, code.getUsedBy());
        assertEquals("127.0.0.1", code.getUsedRegistrationIp());
        assertEquals("request-123", code.getUsedRequestId());
        assertNotNull(code.getUsedAt());
        verify(invitations).save(code);
    }

    @Test
    void rejectsAlreadyUsedCode() {
        InvitationCode code = new InvitationCode();
        code.setStatus("USED");
        when(invitations.findByHashForUpdate(anyString())).thenReturn(Optional.of(code));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.claim("ABCD-EFGH-JKLM", user("reader"), "127.0.0.1", "request-123"));

        assertEquals("邀请码已使用", error.getMessage());
        verify(invitations, never()).save(any());
    }

    @Test
    void rejectsExpiredCode() {
        InvitationCode code = new InvitationCode();
        code.setStatus("UNUSED");
        code.setExpiresAt(Instant.now().minusSeconds(1));
        when(invitations.findByHashForUpdate(anyString())).thenReturn(Optional.of(code));

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> service.claim("ABCD-EFGH-JKLM", user("reader"), "127.0.0.1", "request-123"));

        assertEquals("邀请码已过期", error.getMessage());
        verify(invitations, never()).save(any());
    }

    private AppUser user(String username) {
        AppUser user = new AppUser();
        user.setUsername(username);
        return user;
    }
}
