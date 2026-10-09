import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Proxy phía SERVER (Vercel Serverless Function) chuyển tiếp mọi request tới
 * Groq API.
 *
 * Vì sao cần proxy?
 * - Groq trả các header hạn ngạch `x-ratelimit-*` nhưng KHÔNG kèm
 *   `Access-Control-Expose-Headers`, nên trình duyệt chặn JavaScript đọc chúng
 *   (badge "số lượt khả dụng" vì thế không hiện).
 * - Proxy đọc lại các header này rồi expose cho client qua
 *   `Access-Control-Expose-Headers`.
 * - Đồng thời GIẤU API key ở phía server (không lộ ra bundle client như khi gọi
 *   trực tiếp với dangerouslyAllowBrowser).
 *
 * Ánh xạ đường dẫn:
 *   /api/groq/<rest>  →  https://api.groq.com/<rest>
 * (Groq SDK gọi `${baseURL}/openai/v1/...`, với baseURL = "<origin>/api/groq".)
 *
 * Cấu hình trên Vercel: đặt biến môi trường GROQ_API_KEY (KHÔNG có tiền tố VITE_
 * để không bị nhúng vào bundle client).
 */

const GROQ_ORIGIN = 'https://api.groq.com'

/** Các header hạn ngạch cần expose để client (badge) đọc được. */
const RATE_LIMIT_HEADERS = [
  'x-ratelimit-limit-requests',
  'x-ratelimit-limit-tokens',
  'x-ratelimit-remaining-requests',
  'x-ratelimit-remaining-tokens',
  'x-ratelimit-reset-requests',
  'x-ratelimit-reset-tokens',
  'retry-after',
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Ghép lại phần path phía sau /api/groq (catch-all [...path]).
  const rest = Array.isArray(req.query.path)
    ? req.query.path.join('/')
    : (req.query.path ?? '')
  const search = req.url?.includes('?') ? `?${req.url.split('?')[1]}` : ''
  const targetUrl = `${GROQ_ORIGIN}/${rest}${search}`

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    res.status(500).json({
      error:
        'Thiếu GROQ_API_KEY ở phía server. Hãy đặt biến môi trường GROQ_API_KEY trên Vercel.',
    })
    return
  }

  // Chuẩn hóa body: Vercel đã parse JSON sẵn với content-type application/json.
  const method = req.method ?? 'GET'
  const hasBody = method !== 'GET' && method !== 'HEAD'
  const body = hasBody
    ? typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body)
    : undefined

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
    })

    // Chuyển các header hạn ngạch về cho client và cho phép đọc chúng.
    const exposed: string[] = []
    for (const name of RATE_LIMIT_HEADERS) {
      const value = upstream.headers.get(name)
      if (value != null) {
        res.setHeader(name, value)
        exposed.push(name)
      }
    }
    if (exposed.length > 0) {
      res.setHeader('Access-Control-Expose-Headers', exposed.join(', '))
    }

    const text = await upstream.text()
    res.status(upstream.status)
    const contentType = upstream.headers.get('content-type')
    if (contentType) res.setHeader('Content-Type', contentType)
    res.send(text)
  } catch (err) {
    res.status(502).json({
      error:
        'Không kết nối được tới Groq qua proxy: ' +
        (err instanceof Error ? err.message : String(err)),
    })
  }
}
