-- Hibernate 5.6 将 Java String 按 VARCHAR 校验；将 V8 的定长 CHAR 安全转换为 VARCHAR。
-- SHA-256 摘要本身仍严格为 64 位，不改变唯一索引或已有数据含义。
ALTER TABLE invitation_code
    ALTER COLUMN code_hash TYPE VARCHAR(64)
    USING RTRIM(code_hash);

COMMENT ON COLUMN invitation_code.code_hash IS
    '64-character SHA-256 digest of the normalized invitation; plaintext is never persisted.';
