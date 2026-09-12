package com.inkshelf.auth;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import javax.servlet.http.HttpServletRequest;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.*;
import java.util.List;

/**
 * 生成一次性滑块验证码并通过 Redis 控制有效期、消费状态和请求频率。
 */
@Service
public class SliderCaptchaService {
    private static final int WIDTH = 320, HEIGHT = 150, PIECE = 42;
    private static final DefaultRedisScript<Long> INCREMENT = new DefaultRedisScript<>(
            "local v=redis.call('INCR',KEYS[1]); if v==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return v", Long.class);
    private static final DefaultRedisScript<String> CONSUME = new DefaultRedisScript<>(
            "local v=redis.call('GET',KEYS[1]); if not v then return nil end; redis.call('DEL',KEYS[1]); return v", String.class);

    private final StringRedisTemplate redis;
    private final LoginProtectionService protection;
    private final SecureRandom random = new SecureRandom();

    public SliderCaptchaService(StringRedisTemplate redis, LoginProtectionService protection) {
        this.redis = redis;
        this.protection = protection;
    }

    public Challenge create(String username, HttpServletRequest request) {
        String ipHash = protection.ipHash(request);
        long minute = System.currentTimeMillis() / 60000L;
        Long count = redis.execute(INCREMENT, Collections.singletonList("auth:captcha:minute:" + ipHash + ":" + minute), "120");
        if (count != null && count > 10) {
            throw new LoginProtectionException(org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,
                    "CAPTCHA_RATE_LIMITED", "验证请求过于频繁，请稍后再试", 60);
        }

        int targetX = 90 + random.nextInt(170);
        int targetY = 28 + random.nextInt(65);
        BufferedImage original = artwork();
        BufferedImage piece = new BufferedImage(PIECE, PIECE, BufferedImage.TYPE_INT_ARGB);
        Graphics2D pg = piece.createGraphics();
        pg.drawImage(original, 0, 0, PIECE, PIECE, targetX, targetY, targetX + PIECE, targetY + PIECE, null);
        pg.setColor(new Color(35, 67, 57, 185));
        pg.drawRect(0, 0, PIECE - 1, PIECE - 1);
        pg.dispose();

        Graphics2D bg = original.createGraphics();
        bg.setColor(new Color(247, 241, 225, 205));
        bg.fillRoundRect(targetX, targetY, PIECE, PIECE, 8, 8);
        bg.setColor(new Color(38, 75, 63, 210));
        bg.setStroke(new BasicStroke(2f));
        bg.drawRoundRect(targetX, targetY, PIECE, PIECE, 8, 8);
        bg.dispose();

        String id = token(18);
        String binding = targetX + "|" + protection.usernameHash(username) + "|" + ipHash;
        redis.opsForValue().set("auth:captcha:challenge:" + id, binding, Duration.ofMinutes(3));
        return new Challenge(id, image(original), image(piece), targetY, WIDTH, HEIGHT, PIECE);
    }

    public String verify(String id, String username, int offset, long durationMs, int movementCount, HttpServletRequest request) {
        if (id == null || !id.matches("[A-Za-z0-9_-]{20,60}")) throw invalid();
        String stored = redis.execute(CONSUME, Collections.singletonList("auth:captcha:challenge:" + id));
        if (stored == null) throw invalid();
        String[] parts = stored.split("\\|", -1);
        if (parts.length != 3) throw invalid();
        int target;
        try {
            target = Integer.parseInt(parts[0]);
        } catch (NumberFormatException e) {
            throw invalid();
        }
        boolean binding = parts[1].equals(protection.usernameHash(username)) && parts[2].equals(protection.ipHash(request));
        boolean humanTrace = durationMs >= 300 && durationMs <= 20000 && movementCount >= 4;
        if (!binding || !humanTrace || Math.abs(target - offset) > 6) throw invalid();
        String verificationToken = token(32);
        redis.opsForValue().set(protection.verifiedCaptchaKey(verificationToken), parts[1] + "|" + parts[2], Duration.ofMinutes(2));
        return verificationToken;
    }

    private BufferedImage artwork() {
        BufferedImage image = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        GradientPaint gradient = new GradientPaint(0, 0, new Color(221, 230, 214), WIDTH, HEIGHT, new Color(217, 196, 159));
        g.setPaint(gradient);
        g.fillRect(0, 0, WIDTH, HEIGHT);
        for (int i = 0; i < 18; i++) {
            int size = 8 + random.nextInt(38), x = random.nextInt(WIDTH), y = random.nextInt(HEIGHT);
            g.setColor(new Color(40 + random.nextInt(80), 70 + random.nextInt(90), 55 + random.nextInt(70), 35 + random.nextInt(55)));
            g.fillOval(x, y, size, size);
        }
        g.setColor(new Color(30, 66, 55, 80));
        g.setStroke(new BasicStroke(3f));
        for (int i = 0; i < 5; i++) {
            int y = 25 + i * 25 + random.nextInt(8);
            g.drawArc(-20, y, WIDTH + 40, 45, 8 + random.nextInt(20), 150 + random.nextInt(30));
        }
        g.dispose();
        return image;
    }

    private String image(BufferedImage image) {
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            ImageIO.write(image, "png", output);
            return "data:image/png;base64," + Base64.getEncoder().encodeToString(output.toByteArray());
        } catch (Exception e) {
            throw new IllegalStateException("滑块图片生成失败", e);
        }
    }

    private String token(int bytes) {
        byte[] value = new byte[bytes];
        random.nextBytes(value);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
    }

    private IllegalArgumentException invalid() {
        return new IllegalArgumentException("滑块验证失败，请重新验证");
    }

    public static class Challenge {
        public final String challengeId, background, piece;
        public final int pieceY, trackWidth, imageHeight, pieceSize;

        Challenge(String challengeId, String background, String piece, int pieceY, int trackWidth, int imageHeight, int pieceSize) {
            this.challengeId = challengeId;
            this.background = background;
            this.piece = piece;
            this.pieceY = pieceY;
            this.trackWidth = trackWidth;
            this.imageHeight = imageHeight;
            this.pieceSize = pieceSize;
        }
    }
}
