// 已停用：微信读书请求现统一经过需要登录的 Java 后端，避免绕过认证和审计策略。
export default async () => Response.json(
  { message: '该接口已迁移，请登录后使用 Java API /api/weread/connect' },
  { status: 410, headers: { 'Cache-Control': 'no-store' } },
)
