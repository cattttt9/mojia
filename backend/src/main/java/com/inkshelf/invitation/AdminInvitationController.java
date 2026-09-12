package com.inkshelf.invitation;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import java.util.*;

@RestController
@RequestMapping("/api/admin/invitations")
public class AdminInvitationController {
    private final InvitationCodeService invitationCodes;

    public AdminInvitationController(InvitationCodeService invitationCodes) {
        this.invitationCodes = invitationCodes;
    }

    public static class CreateRequest {
        /**
         * 留空表示永久有效。
         */
        @Min(1)
        @Max(3650)
        public Integer validDays;
    }

    @GetMapping
    public Map<String, Object> list() {
        List<Map<String, Object>> items = new ArrayList<>();
        for (InvitationCode code : invitationCodes.list()) items.add(view(code, null));
        return Collections.<String, Object>singletonMap("items", items);
    }

    @PostMapping
    public Map<String, Object> create(Authentication authentication, @Valid @RequestBody CreateRequest request) {
        InvitationCodeService.GeneratedInvitation generated = invitationCodes.create(authentication.getName(), request.validDays);
        return view(generated.invitation, generated.rawCode);
    }

    @PostMapping("/{id}/disable")
    public Map<String, Object> disable(Authentication authentication, @PathVariable Long id) {
        return view(invitationCodes.disable(id, authentication.getName()), null);
    }

    private Map<String, Object> view(InvitationCode code, String rawCode) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", code.getId());
        result.put("code", rawCode);
        result.put("codeMasked", code.getCodeMasked());
        result.put("status", code.getStatus());
        result.put("createdAt", code.getCreatedAt());
        result.put("expiresAt", code.getExpiresAt());
        result.put("createdBy", code.getCreatedBy() == null ? null : code.getCreatedBy().getUsername());
        result.put("usedAt", code.getUsedAt());
        result.put("usedBy", code.getUsedBy() == null ? null : code.getUsedBy().getUsername());
        result.put("registrationIp", code.getUsedRegistrationIp());
        result.put("requestId", code.getUsedRequestId());
        result.put("disabledBy", code.getDisabledBy() == null ? null : code.getDisabledBy().getUsername());
        return result;
    }
}
