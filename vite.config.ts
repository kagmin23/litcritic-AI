import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig, loadEnv } from 'vite'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/** Header hạn ngạch Groq cần expose cho trình duyệt (để badge đọc được). */
const RATE_LIMIT_HEADERS = [
  'x-ratelimit-limit-requests',
  'x-ratelimit-limit-tokens',
  'x-ratelimit-remaining-requests',
  'x-ratelimit-remaining-tokens',
  'x-ratelimit-reset-requests',
  'x-ratelimit-reset-tokens',
  'retry-after',
].join(', ')

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, dirname, '')
  // Dev dùng VITE_GROQ_API_KEY (từ .env) để gắn Authorization ở phía proxy,
  // khớp hành vi với serverless function dùng GROQ_API_KEY trên Vercel.
  const groqKey = env.GROQ_API_KEY || env.VITE_GROQ_API_KEY || ''

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(dirname, './src/@'),
      },
    },
    server: {
      proxy: {
        // /api/groq/<rest>  →  https://api.groq.com/<rest>
        '/api/groq': {
          target: 'https://api.groq.com',
          changeOrigin: true,
          secure: true,
          rewrite: (p) => p.replace(/^\/api\/groq/, ''),
          configure: (proxy) => {
            // Gắn API key ở phía proxy (không lộ ra client).
            proxy.on('proxyReq', (proxyReq) => {
              if (groqKey) {
                proxyReq.setHeader('Authorization', `Bearer ${groqKey}`)
              }
            })
            // Expose header hạn ngạch để trình duyệt đọc được.
            proxy.on('proxyRes', (proxyRes) => {
              proxyRes.headers['access-control-expose-headers'] =
                RATE_LIMIT_HEADERS
            })
          },
        },
      },
    },
  }
})
