import type {
  AnalyzedText,
  Attitude,
  InteractionLog,
  MultiAgentTurn,
} from '@/types'
import { GoogleGenAI } from '@google/genai'

/**
 * AI Engine — Google Gemini 1.5 Flash (SDK @google/genai).
 * Cấu hình API key FREE qua biến môi trường: VITE_GEMINI_API_KEY
 */
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
const MODEL = 'gemini-1.5-flash'

export const isGeminiConfigured = Boolean(API_KEY)

let client: GoogleGenAI | null = null
function getClient(): GoogleGenAI {
  if (!API_KEY) {
    throw new Error(
      'Thiếu VITE_GEMINI_API_KEY. Vui lòng cấu hình API key Gemini (FREE) trong file .env'
    )
  }
  if (!client) client = new GoogleGenAI({ apiKey: API_KEY })
  return client
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
    console.error('[Gemini] Không parse được JSON:', err, raw)
    return fallback
  }
}

function clamp(n: unknown, min = 0, max = 10): number {
  const v = typeof n === 'number' ? n : Number(n)
  if (Number.isNaN(v)) return 0
  return Math.min(max, Math.max(min, v))
}

// ---------------------------------------------------------------------------
// 1) Phân tích ngữ liệu mới (có thể kèm OCR ảnh)
// ---------------------------------------------------------------------------
export async function analyzeUnseenText(
  text: string,
  imageBase64?: string
): Promise<AnalyzedText> {
  const ai = getClient()

  const instruction = `Bạn là chuyên gia Ngữ văn bám sát Chương trình GDPT 2018.
Nhiệm vụ: tiếp nhận một ngữ liệu văn học MỚI (unseen text) và bóc tách thông tin phục vụ dạy đọc hiểu.
${
  imageBase64
    ? 'Ảnh đính kèm là trang sách/tư liệu. Hãy đóng vai OCR, trích xuất CHÍNH XÁC toàn bộ chữ TIẾNG VIỆT (giữ đúng dấu thanh, xuống dòng theo khổ thơ/đoạn).'
    : ''
}
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

  const parts: Array<Record<string, unknown>> = [
    { text: instruction },
    { text: `NGỮ LIỆU (văn bản người dùng nhập):\n${text || '(trống — hãy lấy từ ảnh)'}` },
  ]
  if (imageBase64) {
    const data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64
    const mimeMatch = imageBase64.match(/^data:(.*?);base64,/)
    parts.push({
      inlineData: {
        mimeType: mimeMatch?.[1] ?? 'image/png',
        data,
      },
    })
  }

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: 'user', parts }],
    config: { responseMimeType: 'application/json', temperature: 0.3 },
  })

  const raw = res.text ?? ''
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
// 2) Sinh phản hồi Multi-Agent (4 Critic Agents + Moderator)
// ---------------------------------------------------------------------------
export async function generateMultiAgentResponse(
  textContext: string,
  chatHistory: InteractionLog[],
  studentInput: string,
  attitude: Attitude
): Promise<MultiAgentTurn> {
  const ai = getClient()

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

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [
      { role: 'user', parts: [{ text: systemPrompt }, { text: userPrompt }] },
    ],
    config: { responseMimeType: 'application/json', temperature: 0.8 },
  })

  const raw = res.text ?? ''
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
