package com.inkshelf.weread;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.*;
import javax.crypto.spec.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

@Service
/** 使用 AES-256-GCM 加密微信读书 API Key，并为每次加密生成独立随机 IV。 */
public class SecretCryptoService {
    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public SecretCryptoService(@Value("${inkshelf.encryption-key}") String encoded) {
        byte[] b = Base64.getDecoder().decode(encoded);
        if (b.length != 32) throw new IllegalStateException("ENCRYPTION_KEY must be a base64 encoded 32-byte key");
        key = new SecretKeySpec(b, "AES");
    }

    /**
     * 返回 Base64(12 字节 IV + 密文及认证标签)，不会保留明文。
     */
    public String encrypt(String value) {
        try {
            byte[] iv = new byte[12];
            random.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] encrypted = c.doFinal(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + encrypted.length).put(iv).put(encrypted).array());
        } catch (Exception e) {
            throw new IllegalStateException("无法保护 API Key", e);
        }
    }

    public String decrypt(String value) {
        try {
            byte[] all = Base64.getDecoder().decode(value);
            byte[] iv = new byte[12], encrypted = new byte[all.length - 12];
            System.arraycopy(all, 0, iv, 0, 12);
            System.arraycopy(all, 12, encrypted, 0, encrypted.length);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
            return new String(c.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("无法读取 API Key", e);
        }
    }
}
