import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient'
import type {
    DebateSession,
    InteractionLog,
    Student,
    TextItem,
} from '@/types'

// ============================================================================
// Supabase service — CRUD cho students / texts / debate_sessions /
// interaction_logs. Có fallback localStorage để chạy demo khi chưa cấu hình
// Supabase (giúp hệ thống luôn vận hành được end-to-end).
// ============================================================================

const LS_KEYS = {
  students: 'visef_students',
  texts: 'visef_texts',
  sessions: 'visef_sessions',
  logs: 'visef_logs',
} as const

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function lsRead<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : []
  } catch {
    return []
  }
}

function lsWrite<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data))
}

// --------------------------------------------------------------------------
// STUDENTS
// --------------------------------------------------------------------------
export async function upsertStudent(
  full_name: string,
  class_name: string
): Promise<Student> {
  const record: Student = {
    id: uuid(),
    full_name,
    class_name,
    created_at: new Date().toISOString(),
  }

  if (!isSupabaseConfigured) {
    const list = lsRead<Student>(LS_KEYS.students)
    const existing = list.find(
      (s) => s.full_name === full_name && s.class_name === class_name
    )
    if (existing) return existing
    list.push(record)
    lsWrite(LS_KEYS.students, list)
    return record
  }

  const { data, error } = await supabase
    .from('students')
    .insert({ full_name, class_name })
    .select()
    .single()
  if (error) throw error
  return data as Student
}

export async function listStudents(): Promise<Student[]> {
  if (!isSupabaseConfigured) return lsRead<Student>(LS_KEYS.students)
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Student[]
}

// --------------------------------------------------------------------------
// TEXTS
// --------------------------------------------------------------------------
export async function createText(
  input: Omit<TextItem, 'id' | 'created_at'>
): Promise<TextItem> {
  const record: TextItem = {
    ...input,
    id: uuid(),
    created_at: new Date().toISOString(),
  }

  if (!isSupabaseConfigured) {
    const list = lsRead<TextItem>(LS_KEYS.texts)
    list.unshift(record)
    lsWrite(LS_KEYS.texts, list)
    return record
  }

  const { data, error } = await supabase
    .from('texts')
    .insert({
      title: input.title,
      content: input.content,
      genre: input.genre,
      keywords: input.keywords,
      background: input.background,
      initial_questions: input.initial_questions,
    })
    .select()
    .single()
  if (error) throw error
  return data as TextItem
}

/**
 * Chuẩn hóa một bản ghi text đọc từ DB: đảm bảo keywords / initial_questions
 * luôn là mảng (DB có thể trả null hoặc chuỗi JSON) để UI không bị lỗi .length.
 */
export function normalizeText(raw: unknown): TextItem {
  const t = (raw ?? {}) as Record<string, unknown>

  const parseArray = (v: unknown): unknown[] => {
    if (Array.isArray(v)) return v
    if (typeof v === 'string') {
      try {
        const parsed = JSON.parse(v)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }

  const keywords = parseArray(t.keywords)
    .map((k) => {
      if (typeof k === 'string') return { term: k, meaning: '' }
      const obj = (k ?? {}) as { term?: string; meaning?: string }
      return { term: obj.term ?? '', meaning: obj.meaning ?? '' }
    })
    .filter((k) => k.term)

  const initial_questions = parseArray(t.initial_questions)
    .map((q) => (typeof q === 'string' ? q : String(q ?? '')))
    .filter(Boolean)

  return {
    id: String(t.id ?? ''),
    title: String(t.title ?? ''),
    content: String(t.content ?? ''),
    genre: String(t.genre ?? 'Khác'),
    keywords,
    background: String(t.background ?? ''),
    initial_questions,
    created_at: t.created_at ? String(t.created_at) : undefined,
  }
}

export async function listTexts(): Promise<TextItem[]> {
  if (!isSupabaseConfigured)
    return lsRead<TextItem>(LS_KEYS.texts).map(normalizeText)
  const { data, error } = await supabase
    .from('texts')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(normalizeText)
}

export async function getText(id: string): Promise<TextItem | null> {
  if (!isSupabaseConfigured) {
    const found = lsRead<TextItem>(LS_KEYS.texts).find((t) => t.id === id)
    return found ? normalizeText(found) : null
  }
  const { data, error } = await supabase
    .from('texts')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return normalizeText(data)
}

// --------------------------------------------------------------------------
// DEBATE SESSIONS
// --------------------------------------------------------------------------
export async function createSession(
  student_id: string,
  text_id: string
): Promise<DebateSession> {
  const record: DebateSession = {
    id: uuid(),
    student_id,
    text_id,
    status: 'active',
    created_at: new Date().toISOString(),
  }

  if (!isSupabaseConfigured) {
    const list = lsRead<DebateSession>(LS_KEYS.sessions)
    list.unshift(record)
    lsWrite(LS_KEYS.sessions, list)
    return record
  }

  const { data, error } = await supabase
    .from('debate_sessions')
    .insert({ student_id, text_id, status: 'active' })
    .select()
    .single()
  if (error) throw error
  return data as DebateSession
}

/**
 * Tìm phiên ĐANG DIỄN RA (status 'active') gần nhất của 1 học sinh với 1 ngữ liệu.
 * Dùng để "tiếp tục" phiên dang dở thay vì tạo mới (giữ lịch sử chat).
 */
export async function findActiveSession(
  student_id: string,
  text_id: string
): Promise<DebateSession | null> {
  if (!isSupabaseConfigured) {
    const list = lsRead<DebateSession>(LS_KEYS.sessions)
    return (
      list.find(
        (s) =>
          s.student_id === student_id &&
          s.text_id === text_id &&
          s.status === 'active'
      ) ?? null
    )
  }
  const { data, error } = await supabase
    .from('debate_sessions')
    .select('*')
    .eq('student_id', student_id)
    .eq('text_id', text_id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return (data as DebateSession) ?? null
}

/** Tạo mới nếu chưa có phiên đang diễn ra, ngược lại trả về phiên cũ. */
export async function getOrCreateSession(
  student_id: string,
  text_id: string
): Promise<DebateSession> {
  const existing = await findActiveSession(student_id, text_id)
  if (existing) return existing
  return createSession(student_id, text_id)
}

export async function updateSessionStatus(
  id: string,
  status: 'active' | 'completed'
): Promise<void> {
  if (!isSupabaseConfigured) {
    const list = lsRead<DebateSession>(LS_KEYS.sessions)
    const s = list.find((x) => x.id === id)
    if (s) s.status = status
    lsWrite(LS_KEYS.sessions, list)
    return
  }
  const { error } = await supabase
    .from('debate_sessions')
    .update({ status })
    .eq('id', id)
  if (error) throw error
}

export async function getSession(id: string): Promise<DebateSession | null> {
  if (!isSupabaseConfigured) {
    return lsRead<DebateSession>(LS_KEYS.sessions).find((s) => s.id === id) ?? null
  }
  const { data, error } = await supabase
    .from('debate_sessions')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data as DebateSession
}

/** Danh sách phiên kèm thông tin học sinh + bài đọc (phục vụ trang quản trị). */
export async function listSessionsWithDetails(): Promise<DebateSession[]> {
  if (!isSupabaseConfigured) {
    const sessions = lsRead<DebateSession>(LS_KEYS.sessions)
    const students = lsRead<Student>(LS_KEYS.students)
    const texts = lsRead<TextItem>(LS_KEYS.texts)
    return sessions.map((s) => ({
      ...s,
      student: students.find((x) => x.id === s.student_id),
      text: texts.find((x) => x.id === s.text_id),
    }))
  }

  const { data, error } = await supabase
    .from('debate_sessions')
    .select('*, student:students(*), text:texts(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => {
    const s = row as DebateSession
    return { ...s, text: s.text ? normalizeText(s.text) : undefined }
  })
}

// --------------------------------------------------------------------------
// INTERACTION LOGS
// --------------------------------------------------------------------------
export async function addLog(
  log: Omit<InteractionLog, 'id' | 'timestamp'>
): Promise<InteractionLog> {
  const record: InteractionLog = {
    ...log,
    id: uuid(),
    timestamp: new Date().toISOString(),
  }

  if (!isSupabaseConfigured) {
    const list = lsRead<InteractionLog>(LS_KEYS.logs)
    list.push(record)
    lsWrite(LS_KEYS.logs, list)
    return record
  }

  const { data, error } = await supabase
    .from('interaction_logs')
    .insert({
      session_id: log.session_id,
      sender: log.sender,
      message: log.message,
      attitude: log.attitude ?? null,
      s_critical_score: log.s_critical_score ?? null,
      fallacies: log.fallacies ?? [],
      graph_data: log.graph_data ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as InteractionLog
}

export async function listLogsBySession(
  session_id: string
): Promise<InteractionLog[]> {
  if (!isSupabaseConfigured) {
    return lsRead<InteractionLog>(LS_KEYS.logs)
      .filter((l) => l.session_id === session_id)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  }
  const { data, error } = await supabase
    .from('interaction_logs')
    .select('*')
    .eq('session_id', session_id)
    .order('timestamp', { ascending: true })
  if (error) throw error
  return (data ?? []) as InteractionLog[]
}

export async function listAllLogs(): Promise<InteractionLog[]> {
  if (!isSupabaseConfigured) {
    return lsRead<InteractionLog>(LS_KEYS.logs).sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp)
    )
  }
  const { data, error } = await supabase
    .from('interaction_logs')
    .select('*')
    .order('timestamp', { ascending: true })
  if (error) throw error
  return (data ?? []) as InteractionLog[]
}
