export default {
  server: {
    headers: { 'Cache-Control': 'no-store' },
    proxy: {
      '/api': {
        target: 'http://localhost:8066',
        changeOrigin: true,
        // 手机通过局域网 IP 打开 Vite 时，浏览器会把该 IP 作为 Origin。
        // 后端本地环境只信任 localhost:5173，因此在开发代理层统一来源；
        // 浏览器侧仍然请求同源 /api，生产环境也不会使用这段代理配置。
        headers: {
          Origin: 'http://localhost:5173',
        },
        timeout: 300000,
        proxyTimeout: 300000,
      },
    },
  },
  build: {
    // Windows 上预览进程或安全软件可能短暂占用旧产物；哈希文件名可安全并存。
    emptyOutDir: false,
  },
}
