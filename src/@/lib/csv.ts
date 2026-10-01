import Papa from 'papaparse'
import type { DebateSession, InteractionLog } from '@/types'
import { computeAssessment } from '@/lib/scoring'

/**
 * Xuất dữ liệu nghiên cứu ViSEF ra CSV chuẩn hóa phục vụ SPSS / Python
 * (t-test, p-value). Có 2 cấp độ:
 *  - buildInteractionCsv: dữ liệu THÔ theo từng lượt tương tác (long format).
 *  - buildSessionSummaryCsv: dữ liệu TỔNG HỢP theo phiên (wide format),
 *    tiện cho kiểm định so sánh nhóm.
 */

function triggerDownload(csv: string, filename: string): void {
  // Thêm BOM để Excel đọc đúng tiếng Việt UTF-8.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportInteractionCsv(
  logs: InteractionLog[],
  sessions: DebateSession[]
): void {
  const sessionMap = new Map(sessions.map((s) => [s.id, s]))

  const rows = logs.map((l) => {
    const s = sessionMap.get(l.session_id)
    return {
      log_id: l.id,
      session_id: l.session_id,
      student_name: s?.student?.full_name ?? '',
      class_name: s?.student?.class_name ?? '',
      text_title: s?.text?.title ?? '',
      genre: s?.text?.genre ?? '',
      sender: l.sender,
      attitude: l.attitude ?? '',
      message: l.message,
      s_critical_score: l.s_critical_score ?? '',
      fallacy_count: l.fallacies?.length ?? 0,
      fallacies: (l.fallacies ?? []).join(' | '),
      timestamp: l.timestamp,
    }
  })

  const csv = Papa.unparse(rows)
  triggerDownload(csv, `visef_interaction_logs_${dateTag()}.csv`)
}

export function exportSessionSummaryCsv(
  logs: InteractionLog[],
  sessions: DebateSession[]
): void {
  const rows = sessions.map((s) => {
    const sessionLogs = logs.filter((l) => l.session_id === s.id)
    const a = computeAssessment(sessionLogs)
    const studentTurns = sessionLogs.filter(
      (l) => l.sender === 'Student'
    ).length
    return {
      session_id: s.id,
      student_name: s.student?.full_name ?? '',
      class_name: s.student?.class_name ?? '',
      text_title: s.text?.title ?? '',
      genre: s.text?.genre ?? '',
      status: s.status,
      student_turns: studentTurns,
      D_perspective: a.perspective_diversity,
      E_validity: a.evidence_validity,
      C_openness: a.openness,
      reasoning_logic: a.reasoning_logic,
      creativity: a.creativity,
      F_fallacy: a.fallacy_count,
      S_critical: a.s_critical,
      created_at: s.created_at,
    }
  })

  const csv = Papa.unparse(rows)
  triggerDownload(csv, `visef_session_summary_${dateTag()}.csv`)
}

function dateTag(): string {
  return new Date().toISOString().slice(0, 10)
}
