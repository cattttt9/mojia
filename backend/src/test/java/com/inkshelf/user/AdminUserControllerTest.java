package com.inkshelf.user;

import com.inkshelf.auth.LoginProtectionService;
import com.inkshelf.weread.WeReadCredentialRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
/**
 * 验证管理员用户接口的权限控制和返回数据脱敏规则。
 */
class AdminUserControllerTest {
    @Mock UserRepository users;
    @Mock WeReadCredentialRepository credentials;
    @Mock PasswordEncoder passwords;
    @Mock LoginProtectionService protection;
    @Mock Authentication authentication;

    @Test
    void passwordResetClearsLoginFailuresBeforeSavingNewPassword() {
        AppUser user = new AppUser();
        user.setId(9L);
        user.setUsername("reader_01");
        when(users.findById(9L)).thenReturn(Optional.of(user));
        when(authentication.getName()).thenReturn("admin");
        when(passwords.encode(anyString())).thenReturn("encoded");
        AdminUserController controller = new AdminUserController(users, credentials, passwords, protection);

        String temporaryPassword = String.valueOf(controller.resetPassword(authentication, 9L).get("temporaryPassword"));

        assertNotNull(temporaryPassword);
        InOrder order = inOrder(protection, passwords, users);
        order.verify(protection).resetForUsername("reader_01");
        order.verify(passwords).encode(temporaryPassword);
        order.verify(users).save(user);
    }
}
