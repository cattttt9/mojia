package com.inkshelf.weread;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.*;

/**
 * 为不允许跨域读取的微信读书封面生成受控的同源地址。
 * 签名和域名白名单共同防止该接口被用作任意 URL 代理。
 */
@Service
public class WeReadCoverProxyService {
    private static final String PROXY_PATH = "/api/public/weread-cover";
    private static final String HMAC = "HmacSHA256";
    private static final int MAX_BYTES = 5 * 1024 * 1024;
    private static final Set<String> ALLOWED_HOSTS = Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
            "cdn.weread.qq.com",
            "wfqqreader-1252317822.image.myqcloud.com"
    )));
    private final byte[] signingKey;

    public WeReadCoverProxyService(@Value("${inkshelf.jwt-secret}") String secret) {
        signingKey = secret.getBytes(StandardCharsets.UTF_8);
    }

    /** 目前只代理已确认缺少 CORS 响应头的 cdn.weread.qq.com。 */
    public String proxiedUrl(String raw) {
        if (raw == null || raw.trim().isEmpty()) return null;
        String url = raw.trim();
        if (url.startsWith(PROXY_PATH)) return url;
        URI uri = parseAllowed(url);
        if (uri == null || !"cdn.weread.qq.com".equalsIgnoreCase(uri.getHost())) return url;
        try {
            return PROXY_PATH + "?url=" + URLEncoder.encode(url, "UTF-8") + "&sig=" + signature(url);
        } catch (UnsupportedEncodingException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    public ResponseEntity<byte[]> fetch(String rawUrl, String providedSignature) {
        if (!validSignature(rawUrl, providedSignature))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "封面地址无效");
        URI current = parseAllowed(rawUrl);
        if (current == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "封面地址无效");
        try {
            for (int redirect = 0; redirect < 3; redirect++) {
                HttpURLConnection connection = (HttpURLConnection) current.toURL().openConnection();
                connection.setInstanceFollowRedirects(false);
                connection.setConnectTimeout(5000);
                connection.setReadTimeout(8000);
                connection.setRequestProperty("User-Agent", "InkShelf-Cover-Proxy/1.0");
                int status = connection.getResponseCode();
                if (status >= 300 && status < 400) {
                    String location = connection.getHeaderField("Location");
                    connection.disconnect();
                    URI next = location == null ? null : current.resolve(location);
                    current = next == null ? null : parseAllowed(next.toString());
                    if (current == null) throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "封面重定向无效");
                    continue;
                }
                if (status != HttpURLConnection.HTTP_OK) {
                    connection.disconnect();
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "封面暂时不可用");
                }
                String contentType = connection.getContentType();
                int contentLength = connection.getContentLength();
                if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")
                        || contentLength > MAX_BYTES) {
                    connection.disconnect();
                    throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "封面响应无效");
                }
                byte[] bytes;
                try (InputStream input = connection.getInputStream()) {
                    bytes = readLimited(input);
                } finally {
                    connection.disconnect();
                }
                HttpHeaders headers = new HttpHeaders();
                try {
                    headers.setContentType(MediaType.parseMediaType(contentType));
                } catch (InvalidMediaTypeException ignored) {
                    headers.setContentType(MediaType.IMAGE_JPEG);
                }
                headers.setCacheControl(CacheControl.maxAge(Duration.ofDays(7)).cachePublic().getHeaderValue());
                return new ResponseEntity<>(bytes, headers, HttpStatus.OK);
            }
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "封面重定向过多");
        } catch (ResponseStatusException error) {
            throw error;
        } catch (IOException error) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "封面暂时不可用");
        }
    }

    private byte[] readLimited(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int total = 0, read;
        while ((read = input.read(buffer)) != -1) {
            total += read;
            if (total > MAX_BYTES) throw new IOException("cover too large");
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private boolean validSignature(String url, String provided) {
        if (url == null || provided == null) return false;
        try {
            byte[] expected = Base64.getUrlDecoder().decode(signature(url));
            byte[] actual = Base64.getUrlDecoder().decode(provided);
            return MessageDigest.isEqual(expected, actual);
        } catch (IllegalArgumentException error) {
            return false;
        }
    }

    private String signature(String value) {
        try {
            Mac mac = Mac.getInstance(HMAC);
            mac.init(new SecretKeySpec(signingKey, HMAC));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new IllegalStateException("cover signature unavailable", error);
        }
    }

    private URI parseAllowed(String value) {
        try {
            URI uri = new URI(value);
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme()) || host == null
                    || !ALLOWED_HOSTS.contains(host.toLowerCase(Locale.ROOT))
                    || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) return null;
            return uri;
        } catch (URISyntaxException error) {
            return null;
        }
    }
}
