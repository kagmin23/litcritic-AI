import type {
  AnalyzedText,
  Attitude,
  InteractionLog,
  MultiAgentTurn,
} from '@/types'
import Groq from 'groq-sdk'

/**
 * AI Engine — Groq (SDK groq-sdk).
 * Cấu hình API key qua biến môi trường: VITE_GROQ_API_KEY
 *
 * Bản sao của geminiService.ts, giữ NGUYÊN toàn bộ tên exported functions,
 * tham số và kiểu dữ liệu TypeScript để tương thích 100% với UI hiện tại.
 */
const API_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined

/**
 * Model mặc định dùng cho mọi lời gọi: 'qwen/qwen3.8-27b'.
 * Có thể ghi đè qua biến môi trường VITE_GROQ_MODEL.
 */
const DEFAULT_MODEL = 'qwen/qwen3.8-27b'
const MODEL =
  (import.meta.env.VITE_GROQ_MODEL as string | undefined)?.trim() ||
  DEFAULT_MODEL

/**
 * AI Groq luôn được coi là "đã cấu hình" ở phía CLIENT vì API key thật nằm ở
 * proxy server (dev: Vite proxy; prod: Vercel function đọc GROQ_API_KEY). Nếu
 * server thiếu key, proxy sẽ trả lỗi và UI hiển thị thông báo tương ứng.
 */
export const isGroqConfigured = true

// ---------------------------------------------------------------------------
// Theo dõi HẠN NGẠCH (rate limit) từ header phản hồi của Groq.
// Groq trả về các header x-ratelimit-* trên MỖI phản hồi. Ta đọc chúng rồi
// phát (publish) cho UI qua một store nhỏ gọn (observable) để hiển thị badge
// "số lượt API còn lại" mà không cần thư viện state ngoài.
// ---------------------------------------------------------------------------
export interface RateLimitInfo {
  /** Số request còn lại trong cửa sổ hiện tại (header x-ratelimit-remaining-requests). */
  remainingRequests: number | null
  /** Hạn mức request tối đa của cửa sổ (header x-ratelimit-limit-requests). */
  limitRequests: number | null
  /** Số token còn lại (header x-ratelimit-remaining-tokens) — tham khảo. */
  remainingTokens: number | null
  /** Thời điểm cập nhật gần nhất (ms). */
  updatedAt: number
}

/** Khóa lưu snapshot hạn ngạch gần nhất vào localStorage. */
const RATE_LIMIT_KEY = 'visef_groq_ratelimit'
/**
 * Ngưỡng "quá cũ": bỏ qua snapshot đã lưu nếu quá 1 giờ. Cửa sổ rate limit của
 * Groq reset theo phút/giờ nên số liệu cũ hơn mốc này dễ sai lệch → không khôi phục.
 */
const RATE_LIMIT_MAX_AGE_MS = 60 * 60 * 1000

const rateLimitListeners = new Set<(info: RateLimitInfo | null) => void>()

/** Nạp snapshot đã lưu khi khởi động (bỏ qua nếu thiếu/hỏng/quá cũ). */
function loadPersistedRateLimit(): RateLimitInfo | null {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as RateLimitInfo
    if (
      typeof parsed?.remainingRequests !== 'number' ||
      typeof parsed?.updatedAt !== 'number'
    ) {
      return null
    }
    // Bỏ qua số liệu quá cũ.
    if (Date.now() - parsed.updatedAt > RATE_LIMIT_MAX_AGE_MS) return null
    return parsed
  } catch {
    return null
  }
}

// Khởi tạo bằng giá trị gần nhất đã lưu để badge hiện ngay khi mở lại app.
let rateLimit: RateLimitInfo | null = loadPersistedRateLimit()

/** Lấy nhanh snapshot hạn ngạch hiện tại (hoặc null nếu chưa gọi API lần nào). */
export function getRateLimit(): RateLimitInfo | null {
  return rateLimit
}

/**
 * Đăng ký lắng nghe thay đổi hạn ngạch. Trả về hàm hủy đăng ký.
 * Gọi listener ngay một lần với giá trị hiện tại để UI khởi tạo đúng trạng thái.
 */
export function subscribeRateLimit(
  listener: (info: RateLimitInfo | null) => void
): () => void {
  rateLimitListeners.add(listener)
  listener(rateLimit)
  return () => rateLimitListeners.delete(listener)
}

/** Parse một header dạng số (bỏ qua nếu thiếu / không hợp lệ). */
function parseIntHeader(value: string | null): number | null {
  if (value == null) return null
  const n = Number.parseInt(value, 10)
  return Number.isNaN(n) ? null : n
}

/** Đọc các header x-ratelimit-* từ Response rồi phát cho UI. */
function updateRateLimitFromResponse(response: Response): void {
  const h = response.headers
  const remainingRequests = parseIntHeader(
    h.get('x-ratelimit-remaining-requests')
  )
  // Nếu header chính (remaining-requests) không có thì không cập nhật.
  if (remainingRequests == null) return

  rateLimit = {
    remainingRequests,
    limitRequests: parseIntHeader(h.get('x-ratelimit-limit-requests')),
    remainingTokens: parseIntHeader(h.get('x-ratelimit-remaining-tokens')),
    updatedAt: Date.now(),
  }
  // Lưu lại để khôi phục khi mở lại app (số liệu "gần nhất đã biết").
  try {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(rateLimit))
  } catch {
    /* bỏ qua lỗi quota/private mode */
  }
  rateLimitListeners.forEach((fn) => fn(rateLimit))
}

/**
 * baseURL trỏ về PROXY nội bộ `/api/groq` (dev: Vite proxy, prod: Vercel
 * function). Proxy sẽ:
 *  - gắn API key ở phía server (không lộ ra client),
 *  - expose các header `x-ratelimit-*` để badge hạn ngạch đọc được.
 *
 * Groq SDK tự ghép `${baseURL}/openai/v1/...`, nên baseURL = "<origin>/api/groq"
 * sẽ gọi "/api/groq/openai/v1/...". API key client (nếu có) chỉ là placeholder
 * vì proxy mới là nơi gắn Authorization thật.
 */
/**
 * Groq SDK dựng request bằng `new URL(baseURL + path)`, nên baseURL BẮT BUỘC là
 * URL tuyệt đối (có origin). Dùng origin hiện tại của trình duyệt để trỏ về
 * proxy cùng domain:
 *   - Dev:  http://localhost:5173/api/groq
 *   - Prod: https://<app>.vercel.app/api/groq
 */
function resolveBaseUrl(): string {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost:5173'
  return `${origin}/api/groq`
}

let client: Groq | null = null
function getClient(): Groq {
  if (!client)
    client = new Groq({
      // Proxy gắn Authorization thật; truyền placeholder để SDK không chặn.
      apiKey: API_KEY || 'proxy',
      baseURL: resolveBaseUrl(),
      dangerouslyAllowBrowser: true,
    })
  return client
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Lỗi tạm thời đáng để thử lại (quá tải / rate limit / mạng chập chờn). */
function isRetryable(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes('503') ||
    msg.includes('unavailable') ||
    msg.includes('overloaded') ||
    msg.includes('high demand') ||
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('500') ||
    msg.includes('deadline') ||
    msg.includes('timeout') ||
    msg.includes('fetch')
  )
}

/** Nhận biết lỗi do hết/giới hạn hạn ngạch (429) để chờ lâu hơn, tránh dồn request. */
function isQuotaError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes('429') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota')
  )
}

/** Một tin nhắn trong hội thoại chat theo chuẩn OpenAI/Groq. */
type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Tùy chọn cho mỗi lời gọi: bật JSON mode và chỉnh temperature. */
type GenerateOptions = {
  json?: boolean
  temperature?: number
}

/**
 * Gọi Groq chat.completions.create với cơ chế TỰ ĐỘNG THỬ LẠI
 * (Exponential Backoff) khi gặp lỗi tạm thời (503 / 429 / timeout…).
 *
 * - Chỉ dùng DUY NHẤT một model ổn định (MODEL). KHÔNG fallback sang model khác.
 * - Tối đa `retries` lần thử lại. Thời gian chờ tăng theo cấp số nhân:
 *   base * 2^attempt, cộng jitter ngẫu nhiên, bị chặn trần bởi `maxDelayMs`.
 * - Lỗi 429 (hạn ngạch) chờ gấp đôi so với lỗi khác.
 * - Hết lượt thử → ném thông báo thân thiện cho UI.
 */
async function generateWithRetry(
  messages: ChatMessage[],
  options: GenerateOptions = {},
  { retries = 4, baseDelayMs = 1000, maxDelayMs = 16000 } = {}
): Promise<string> {
  const groq = getClient()
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Dùng .withResponse() để lấy đồng thời dữ liệu đã parse VÀ Response thô
      // (chứa header x-ratelimit-*). Nhờ đó cập nhật được badge hạn ngạch.
      const { data, response } = await groq.chat.completions
        .create({
          messages,
          model: MODEL,
          temperature: options.temperature ?? 0.7,
          ...(options.json
            ? { response_format: { type: 'json_object' as const } }
            : {}),
        })
        .withResponse()
      updateRateLimitFromResponse(response)
      return data.choices[0]?.message?.content ?? ''
    } catch (err) {
      lastErr = err

      // Hết lượt hoặc lỗi không thể thử lại (400 sai request, 401/403 sai key,
      // 404 sai model) → dừng ngay, không backoff vô ích.
      if (attempt === retries || !isRetryable(err)) break

      // Exponential backoff: base * 2^attempt (có jitter), chặn trần maxDelayMs.
      // Lỗi 429 (quota/rate limit) nhân đôi để giãn request mạnh hơn.
      const exp = baseDelayMs * 2 ** attempt
      const quotaFactor = isQuotaError(err) ? 2 : 1
      const jitter = Math.floor(Math.random() * baseDelayMs)
      const delay = Math.min(exp * quotaFactor + jitter, maxDelayMs)

      console.warn(
        `[Groq] Lỗi tạm thời (thử lại ${attempt + 1}/${retries} sau ${delay}ms):`,
        err instanceof Error ? err.message : err
      )
      await sleep(delay)
    }
  }
  // Hết lượt thử → ném lỗi thân thiện (UI hiển thị, không crash).
  if (isRetryable(lastErr)) {
    throw new Error(
      'Máy chủ AI (Groq) đang quá tải tạm thời. Vui lòng thử gửi lại sau giây lát.'
    )
  }
  throw new Error(lastErr instanceof Error ? lastErr.message : String(lastErr))
}

/** Bóc tách phần JSON ra khỏi output của model (loại bỏ ```json fences, text thừa). */
function extractJson(raw: string): string {
  let s = raw.trim()
  // bỏ fenced code block
  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch) s = fenceMatch[1].trim()
  // cắt từ dấu { hoặc [ đầu tiên tới } hoặc ] cuối cùng
  const firstObj = s.indexOf('{')
  const firstArr = s.indexOf('[')
  const candidates = [firstObj, firstArr].filter((i) => i !== -1)
  const start = candidates.length ? Math.min(...candidates) : -1
  const lastObj = s.lastIndexOf('}')
  const lastArr = s.lastIndexOf(']')
  const end = Math.max(lastObj, lastArr)
  if (start !== -1 && end !== -1 && end > start) {
    s = s.slice(start, end + 1)
  }
  return s
}

function safeParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(extractJson(raw)) as T
  } catch (err) {
    console.error('[Groq] Không parse được JSON:', err, raw)
    return fallback
  }
}

function clamp(n: unknown, min = 0, max = 10): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (Number.isNaN(v)) return 0
  return Math.min(max, Math.max(min, v))
}

// ---------------------------------------------------------------------------
// 1) Phân tích ngữ liệu mới
// ---------------------------------------------------------------------------
// Lưu ý: model 'llama-3.1-8b-instant' là model VĂN BẢN (không hỗ trợ ảnh).
// Giữ nguyên tham số imageBase64 để tương thích UI, nhưng chỉ phân tích phần
// văn bản người dùng nhập.
export async function analyzeUnseenText(
  text: string,
  imageBase64?: string
): Promise<AnalyzedText> {
  void imageBase64 // model văn bản không xử lý ảnh — bỏ qua an toàn

  const instruction = `Bạn là chuyên gia Ngữ văn bám sát Chương trình GDPT 2018.
Nhiệm vụ: tiếp nhận một ngữ liệu văn học MỚI (unseen text) và bóc tách thông tin phục vụ dạy đọc hiểu.
Hãy trả về DUY NHẤT một đối tượng JSON hợp lệ theo schema sau, KHÔNG kèm giải thích:
{
  "title": "nhan đề (tự đặt nếu thiếu)",
  "content": "toàn văn ngữ liệu",
  "genre": "một trong: Thơ | Truyện ngắn | Tản văn | Văn bản nghị luận | Kịch | Khác",
  "keywords": [{ "term": "từ khó / Hán-Việt / điển tích", "meaning": "giải nghĩa ngắn gọn" }],
  "background": "bối cảnh lịch sử - văn hóa liên quan (2-4 câu)",
  "initial_questions": ["3 câu hỏi định hướng đọc hiểu kích thích tư duy phản biện"]
}
Yêu cầu: keywords tối đa 8 mục; initial_questions đúng 3 câu.`

  const userPrompt = `NGỮ LIỆU (văn bản người dùng nhập):\n${
    text || '(trống)'
  }`

  const raw = await generateWithRetry(
    [
      { role: 'system', content: instruction },
      { role: 'user', content: userPrompt },
    ],
    { json: true, temperature: 0.3 }
  )

  const parsed = safeParse<Partial<AnalyzedText>>(raw, {})

  // Chuẩn hóa keywords (chấp nhận cả string[] lẫn object[])
  const rawKeywords = (parsed.keywords ?? []) as unknown[]
  const keywords = rawKeywords
    .map((k) => {
      if (typeof k === 'string') return { term: k, meaning: '' }
      const obj = k as { term?: string; meaning?: string }
      return { term: obj.term ?? '', meaning: obj.meaning ?? '' }
    })
    .filter((k) => k.term)

  return {
    title: parsed.title?.trim() || 'Ngữ liệu chưa đặt tên',
    content: parsed.content?.trim() || text,
    genre: parsed.genre?.trim() || 'Khác',
    keywords,
    background: parsed.background?.trim() || '',
    initial_questions: (parsed.initial_questions ?? []).slice(0, 3),
  }
}

// ---------------------------------------------------------------------------
// 1b) OCR một ảnh thành văn bản tiếng Việt.
// ---------------------------------------------------------------------------
// Lưu ý: model 'llama-3.1-8b-instant' KHÔNG hỗ trợ thị giác (vision), nên
// không thể OCR ảnh. Giữ nguyên chữ ký hàm để tương thích UI; nếu được gọi sẽ
// báo lỗi thân thiện cho người dùng.
export async function ocrImage(imageBase64: string): Promise<string> {
  void imageBase64
  throw new Error(
    'Model Groq hiện tại (llama-3.1-8b-instant) không hỗ trợ OCR ảnh. ' +
      'Vui lòng nhập văn bản trực tiếp.'
  )
}

// ---------------------------------------------------------------------------
// 2) Sinh phản hồi Multi-Agent (4 Critic Agents + Moderator)
// ---------------------------------------------------------------------------
export async function generateMultiAgentResponse(
  textContext: string,
  chatHistory: InteractionLog[],
  studentInput: string,
  attitude: Attitude
): Promise<MultiAgentTurn> {
  const attitudeVi =
    attitude === 'Agree'
      ? 'ĐỒNG Ý'
      : attitude === 'Disagree'
        ? 'PHẢN BÁC'
        : 'BỔ SUNG'

  const history = chatHistory
    .slice(-14)
    .map((m) => `[${m.sender}] ${m.message}`)
    .join('\n')

  const systemPrompt = `Bạn điều phối một ĐẤU TRƯỜNG TRANH LUẬN BÀN TRÒN gồm 5 tác tử phê bình văn học, cùng bàn về một ngữ liệu Ngữ văn (bám sát GDPT 2018). Bạn đóng vai ĐỒNG THỜI cả 5 tác tử:

1. Structuralist (Cấu trúc luận): soi nhịp điệu, kết cấu, biện pháp tu từ, ngôn từ nghệ thuật.
2. Psychoanalytic (Tâm lý học): giải mã dồn nén tâm lý, động cơ ẩn giấu, cái tôi trữ tình.
3. SocioHistorical (Xã hội - Lịch sử): bối cảnh lịch sử, xung đột giai cấp, rào cản xã hội thời sáng tác.
4. Feminist (Nữ quyền & Văn hóa): vị thế giới, góc nhìn nữ quyền, giá trị văn hóa bản địa.
5. Moderator (Trọng tài): điều phối, tổng hợp điểm bất đồng (divergence), nhận xét tư duy học sinh.

NGUYÊN TẮC:
- Mỗi Critic Agent phản hồi ý kiến học sinh TỪ ĐÚNG lăng kính của mình, 2-4 câu, có dẫn chứng từ văn bản.
- Các agent có thể bất đồng nhau — làm nổi bật "divergence points".
- Moderator KHÔNG nêu quan điểm phê bình riêng; chỉ tổng hợp, nhận xét và khích lệ tư duy phản biện của học sinh.
- Chấm điểm tư duy học sinh ở lượt này trên thang 0-10 cho từng tiêu chí GDPT 2018.
- Phát hiện lỗi NGỤY BIỆN (nếu có): ví dụ "Khái quát hóa vội vàng", "Công kích cá nhân", "Lập luận vòng tròn", "Ngụy biện bù nhìn", "Dựa vào uy quyền"...

Trả về DUY NHẤT JSON hợp lệ theo schema:
{
  "agent_replies": [
    { "sender": "Structuralist", "message": "...", "attitude": "Agree|Disagree|Supplement" },
    { "sender": "Psychoanalytic", "message": "...", "attitude": "..." },
    { "sender": "SocioHistorical", "message": "...", "attitude": "..." },
    { "sender": "Feminist", "message": "...", "attitude": "..." },
    { "sender": "Moderator", "message": "...", "attitude": "Supplement" }
  ],
  "student_assessment": {
    "perspective_diversity": 0-10,
    "evidence_validity": 0-10,
    "openness": 0-10,
    "reasoning_logic": 0-10,
    "creativity": 0-10,
    "s_critical_turn": 0-100,
    "fallacies": ["tên lỗi ngụy biện nếu có"],
    "feedback": "nhận xét ngắn + gợi ý cải thiện"
  },
  "divergence_points": ["điểm bất đồng chính giữa các agent"],
  "graph_data": {
    "nodes": [{ "id": "n1", "label": "luận điểm ngắn", "sender": "Structuralist", "kind": "consensus|divergence|student|neutral" }],
    "edges": [{ "id": "e1", "source": "n1", "target": "n2", "label": "quan hệ" }]
  }
}
Trong graph_data: node của học sinh kind="student"; node là điểm bất đồng kind="divergence"; node đồng thuận kind="consensus".`

  const userPrompt = `NGỮ LIỆU ĐANG TRANH LUẬN:
"""
${textContext}
"""

LỊCH SỬ HỘI THOẠI GẦN NHẤT:
${history || '(chưa có — đây là lượt mở đầu)'}

LƯỢT MỚI CỦA HỌC SINH (thái độ: ${attitudeVi}):
"${studentInput}"

Hãy để 4 Critic Agents phản hồi rồi Moderator tổng hợp, kèm chấm điểm & phát hiện ngụy biện theo schema JSON ở trên.`

  const raw = await generateWithRetry(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { json: true, temperature: 0.8 }
  )

  const parsed = safeParse<Partial<MultiAgentTurn>>(raw, {})

  const a = parsed.student_assessment ?? ({} as MultiAgentTurn['student_assessment'])
  const assessment = {
    perspective_diversity: clamp(a.perspective_diversity),
    evidence_validity: clamp(a.evidence_validity),
    openness: clamp(a.openness),
    reasoning_logic: clamp(a.reasoning_logic),
    creativity: clamp(a.creativity),
    s_critical_turn: clamp(a.s_critical_turn, 0, 100),
    fallacies: Array.isArray(a.fallacies) ? a.fallacies : [],
    feedback: a.feedback ?? '',
  }

  return {
    agent_replies: Array.isArray(parsed.agent_replies)
      ? parsed.agent_replies
      : [],
    student_assessment: assessment,
    divergence_points: Array.isArray(parsed.divergence_points)
      ? parsed.divergence_points
      : [],
    graph_data: {
      nodes: parsed.graph_data?.nodes ?? [],
      edges: parsed.graph_data?.edges ?? [],
    },
  }
}
