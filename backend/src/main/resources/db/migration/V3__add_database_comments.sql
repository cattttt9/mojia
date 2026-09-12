-- PostgreSQL 元数据注释：只补充说明，不改变任何字段或约束。
COMMENT ON TABLE app_user IS '墨架平台注册用户';
COMMENT ON COLUMN app_user.id IS '用户主键';
COMMENT ON COLUMN app_user.username IS '登录用户名，忽略大小写判重';
COMMENT ON COLUMN app_user.email IS '用户邮箱，忽略大小写判重';
COMMENT ON COLUMN app_user.password_hash IS 'BCrypt 密码摘要，禁止存储明文密码';
COMMENT ON COLUMN app_user.display_name IS '页面和留言板展示的昵称';
COMMENT ON COLUMN app_user.role IS '平台角色，例如 USER 或 ADMIN';
COMMENT ON COLUMN app_user.created_at IS '账户创建时间（UTC）';

COMMENT ON TABLE weread_credential IS '用户绑定的微信读书访问凭据，一名用户最多一条';
COMMENT ON COLUMN weread_credential.user_id IS '关联 app_user.id，同时作为主键';
COMMENT ON COLUMN weread_credential.encrypted_api_key IS '使用 AES-256-GCM 加密后的 API Key';
COMMENT ON COLUMN weread_credential.key_hint IS '仅供页面识别的脱敏 Key 尾号';
COMMENT ON COLUMN weread_credential.updated_at IS '最近绑定或更新凭据的时间（UTC）';

COMMENT ON TABLE board_message IS '读者留言板内容，删除时采用状态标记';
COMMENT ON COLUMN board_message.id IS '留言主键';
COMMENT ON COLUMN board_message.user_id IS '留言作者，对应 app_user.id';
COMMENT ON COLUMN board_message.content IS '留言正文，最长 1000 字符';
COMMENT ON COLUMN board_message.status IS '留言状态，例如 VISIBLE 或 DELETED';
COMMENT ON COLUMN board_message.created_at IS '留言创建时间（UTC）';
COMMENT ON COLUMN board_message.updated_at IS '留言最近更新时间（UTC）';

COMMENT ON TABLE weread_book_metadata IS '跨用户复用的微信读书公共书籍元数据缓存，不记录用户书架关系';
COMMENT ON COLUMN weread_book_metadata.book_id IS '微信读书书籍唯一标识';
COMMENT ON COLUMN weread_book_metadata.word_count IS '微信读书详情接口返回的总字数，用于计算书脊厚度';
COMMENT ON COLUMN weread_book_metadata.status IS '补全状态：PENDING、COMPLETE 或 FAILED';
COMMENT ON COLUMN weread_book_metadata.fetched_at IS '最近一次成功获取元数据的时间（UTC）';
COMMENT ON COLUMN weread_book_metadata.last_attempt_at IS '最近一次尝试请求微信读书的时间（UTC）';
COMMENT ON COLUMN weread_book_metadata.next_retry_at IS '失败后允许再次请求的最早时间（UTC）';
COMMENT ON COLUMN weread_book_metadata.updated_at IS '缓存记录最近更新时间（UTC）';
