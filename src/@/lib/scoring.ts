import { SCORE_WEIGHTS } from '@/lib/agents'
import type { CriticalAssessment, InteractionLog } from '@/types'

/**
 * Tính Chỉ số Tư duy Phản biện Mở (S_critical) từ toàn bộ interaction logs
 * của một phiên tranh luận.
 *
 * Công thức gốc:
 *   S = w1*D_perspective + w2*E_validity + w3*C_openness - w4*F_fallacy
 * với w1=w2=w3=0.3, w4=0.5. Sau đó chuẩn hóa về thang 100.
 *
 * Các điểm thành phần (D, E, C, logic, creativity) lấy trung bình các lượt
 * của học sinh. s_critical_score lưu mỗi lượt là điểm thang 100 do AI chấm;
 * ta tái lập các tiêu chí từ graph & assessment đã lưu khi có.
 */
export function computeAssessment(
  logs: InteractionLog[]
): CriticalAssessment {
  // Chỉ xét các lượt do học sinh gửi (có kèm điểm/đánh giá).
  const studentLogs = logs.filter(
    (l) => l.sender === 'Student' && typeof l.s_critical_score === 'number'
  )

  const perspectives = new Set<string>()
  logs.forEach((l) => {
    if (l.sender !== 'Student' && l.sender !== 'Moderator') {
      perspectives.add(l.sender)
    }
  })

  const turnCount = Math.max(studentLogs.length, 1)

  // Trung bình điểm AI chấm mỗi lượt (thang 100) -> quy về 0-10.
  const avgTurnScore100 =
    studentLogs.reduce((sum, l) => sum + (l.s_critical_score ?? 0), 0) /
    turnCount
  const base10 = avgTurnScore100 / 10

  // Tổng số lỗi ngụy biện trong cả phiên.
  const fallacyCount = logs.reduce(
    (sum, l) => sum + (l.fallacies?.length ?? 0),
    0
  )

  // Ước lượng các tiêu chí thành phần quanh base, điều biến bởi dữ liệu phiên.
  const perspectiveDiversity = clamp10(
    base10 * 0.7 + perspectives.size * 0.9
  )
  const evidenceValidity = clamp10(base10)
  const openness = clamp10(
    base10 * 0.9 + (studentLogs.length >= 3 ? 1 : 0)
  )
  const reasoningLogic = clamp10(base10 - fallacyCount * 0.4)
  const creativity = clamp10(base10 * 0.85 + perspectives.size * 0.4)

  // S_critical theo công thức ViSEF (thô, trước chuẩn hóa).
  const { w1, w2, w3, w4 } = SCORE_WEIGHTS
  const rawS =
    w1 * perspectiveDiversity +
    w2 * evidenceValidity +
    w3 * openness -
    w4 * fallacyCount

  // Chuẩn hóa về thang 100.
  // Max lý thuyết của phần cộng = (w1+w2+w3)*10 = 9.
  const maxPositive = (w1 + w2 + w3) * 10
  const sCritical = clamp(((rawS < 0 ? 0 : rawS) / maxPositive) * 100, 0, 100)

  return {
    perspective_diversity: round1(perspectiveDiversity),
    evidence_validity: round1(evidenceValidity),
    openness: round1(openness),
    reasoning_logic: round1(reasoningLogic),
    creativity: round1(creativity),
    fallacy_count: fallacyCount,
    s_critical: round1(sCritical),
  }
}

/** Gom toàn bộ lỗi ngụy biện (kèm số lần mắc) trong phiên. */
export function collectFallacies(
  logs: InteractionLog[]
): { name: string; count: number }[] {
  const map = new Map<string, number>()
  logs.forEach((l) => {
    ;(l.fallacies ?? []).forEach((f) => {
      map.set(f, (map.get(f) ?? 0) + 1)
    })
  })
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
function clamp10(n: number): number {
  return clamp(n, 0, 10)
}
function round1(n: number): number {
  return Math.round(n * 10) / 10
}
