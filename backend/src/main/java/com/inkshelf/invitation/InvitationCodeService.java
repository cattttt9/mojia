package com.inkshelf.invitation;

import com.inkshelf.user.AppUser;
import com.inkshelf.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class InvitationCodeService {
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private final InvitationCodeRepository invitations;
    private final UserRepository users;
    private final SecureRandom random = new SecureRandom();

    public InvitationCodeService(InvitationCodeRepository invitations, UserRepository users) {
        this.invitations = invitations;
        this.users = users;
    }

    /**
     * 创建邀请码并返回仅本次可见的完整值。
     */
    @Transactional
    public GeneratedInvitation create(String administratorUsername, Integer validDays) {
        if (validDays != null && (validDays < 1 || validDays > 3650)) {
            throw new IllegalArgumentException("有效期必须在 1 到 3650 天之间，留空表示永久有效");
        }
        AppUser administrator = users.findByUsernameIgnoreCase(administratorUsername)
                .orElseThrow(() -> new IllegalArgumentException("管理员不存在"));
        Instant now = Instant.now();
        String raw = randomCode();
        InvitationCode code = new InvitationCode();
        code.setCodeHash(hash(normalize(raw)));
        code.setCodeMasked(mask(raw));
        code.setCreatedBy(administrator);
        code.setExpiresAt(validDays == null ? null : now.plus(validDays, ChronoUnit.DAYS));
        code.setUpdatedAt(now);
        return new GeneratedInvitation(invitations.saveAndFlush(code), raw);
    }

    /**
     * 在注册事务中锁定并消费邀请码。
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void claim(String rawCode, AppUser user, String registrationIp, String requestId) {
        InvitationCode code = invitations.findByHashForUpdate(hash(normalize(rawCode)))
                .orElseThrow(() -> new IllegalArgumentException("邀请码无效"));
        Instant now = Instant.now();
        if ("USED".equals(code.getStatus())) throw new IllegalArgumentException("邀请码已使用");
        if ("DISABLED".equals(code.getStatus())) throw new IllegalArgumentException("邀请码已禁用");
        if ("EXPIRED".equals(code.getStatus()) || code.getExpiresAt() != null && !code.getExpiresAt().isAfter(now)) {
            throw new IllegalArgumentException("邀请码已过期");
        }
        if (!"UNUSED".equals(code.getStatus())) throw new IllegalArgumentException("邀请码当前不可用");
        code.setStatus("USED");
        code.setUsedBy(user);
        code.setUsedAt(now);
        code.setUsedRegistrationIp(trimIp(registrationIp));
        code.setUsedRequestId(trimAuditValue(requestId));
        code.setUpdatedAt(now);
        invitations.save(code);
    }

    @Transactional
    public List<InvitationCode> list() {
        List<InvitationCode> items = invitations.findAllByOrderByCreatedAtDesc();
        Instant now = Instant.now();
        List<InvitationCode> expired = new ArrayList<>();
        for (InvitationCode code : items) {
            if ("UNUSED".equals(code.getStatus()) && code.getExpiresAt() != null && !code.getExpiresAt().isAfter(now)) {
                code.setStatus("EXPIRED");
                code.setUpdatedAt(now);
                expired.add(code);
            }
        }
        if (!expired.isEmpty()) invitations.saveAll(expired);
        return items;
    }

    @Transactional
    public InvitationCode disable(Long id, String administratorUsername) {
        InvitationCode code = invitations.findById(id).orElseThrow(() -> new IllegalArgumentException("邀请码不存在"));
        if ("USED".equals(code.getStatus())) throw new IllegalArgumentException("已使用的邀请码不能禁用");
        if ("DISABLED".equals(code.getStatus())) return code;
        Instant now = Instant.now();
        AppUser administrator = users.findByUsernameIgnoreCase(administratorUsername)
                .orElseThrow(() -> new IllegalArgumentException("管理员不存在"));
        code.setStatus("DISABLED");
        code.setDisabledBy(administrator);
        code.setDisabledAt(now);
        code.setUpdatedAt(now);
        return invitations.save(code);
    }

    private String randomCode() {
        StringBuilder value = new StringBuilder(14);
        for (int group = 0; group < 3; group++) {
            if (group > 0) value.append('-');
            for (int i = 0; i < 4; i++) value.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return value.toString();
    }

    private String normalize(String value) {
        if (value == null) return "";
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(64);
            for (byte item : digest) hex.append(String.format("%02x", item & 0xff));
            return hex.toString();
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 不可用", impossible);
        }
    }

    private String mask(String raw) {
        return raw.substring(0, 4) + "-****-" + raw.substring(raw.length() - 4);
    }

    private String trimIp(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.length() <= 64 ? trimmed : trimmed.substring(0, 64);
    }

    private String trimAuditValue(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.length() <= 64 ? trimmed : trimmed.substring(0, 64);
    }

    public static class GeneratedInvitation {
        public final InvitationCode invitation;
        public final String rawCode;

        GeneratedInvitation(InvitationCode invitation, String rawCode) {
            this.invitation = invitation;
            this.rawCode = rawCode;
        }
    }
}
