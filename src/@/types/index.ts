// ============================================================================
// ViSEF Multi-Agent — TypeScript definitions
// Đề tài: Đánh giá & Phát triển Tư duy Phản biện trong Đọc hiểu Ngữ văn
// ============================================================================

/** Vai trò gửi tin trong phiên tranh luận bàn tròn */
export type Sender =
  | 'Student'
  | 'Structuralist'
  | 'Psychoanalytic'
  | 'SocioHistorical'
  | 'Feminist'
  | 'Moderator'

/** Thái độ phản biện của học sinh với một luận điểm */
export type Attitude = 'Agree' | 'Disagree' | 'Supplement'

/** Thể loại ngữ liệu văn học */
export type Genre =
  | 'Thơ'
  | 'Truyện ngắn'
  | 'Tản văn'
  | 'Văn bản nghị luận'
  | 'Kịch'
  | 'Khác'

export interface Student {
  id: string
  full_name: string
  class_name: string
  created_at?: string
}

/** Một từ khó / Hán-Việt kèm chú thích hiển thị trong Tooltip */
export interface Keyword {
  term: string
  meaning: string
}

export interface TextItem {
  id: string
  title: string
  content: string
  genre: Genre | string
  /** Danh sách từ khó (dạng chuỗi hoặc đối tượng có chú thích) */
  keywords: Keyword[]
  background: string
  initial_questions: string[]
  created_at?: string
}

/** Kết quả bóc tách ngữ liệu trả về từ Gemini (chưa lưu DB) */
export interface AnalyzedText {
  title: string
  content: string
  genre: string
  keywords: Keyword[]
  background: string
  initial_questions: string[]
}

export interface DebateSession {
  id: string
  student_id: string
  text_id: string
  status: 'active' | 'completed'
  created_at: string
  // Dữ liệu kết hợp (join) tiện cho trang quản trị
  student?: Student
  text?: TextItem
}

/** Một nút trong sơ đồ cây lập luận động */
export interface ArgumentNodeData {
  id: string
  label: string
  sender: Sender
  /** 'consensus' = đồng thuận (xanh), 'divergence' = bất đồng (đỏ), 'student' = học sinh */
  kind: 'consensus' | 'divergence' | 'student' | 'neutral'
}

/** Một cạnh nối trong sơ đồ cây lập luận */
export interface ArgumentEdgeData {
  id: string
  source: string
  target: string
  label?: string
}

/** Toàn bộ dữ liệu đồ thị lưu kèm mỗi lượt tương tác */
export interface GraphData {
  nodes: ArgumentNodeData[]
  edges: ArgumentEdgeData[]
}

export interface InteractionLog {
  id: string
  session_id: string
  sender: Sender | string
  message: string
  attitude?: Attitude
  s_critical_score?: number
  fallacies?: string[]
  graph_data?: GraphData
  timestamp: string
}

/** Phản hồi của một Critic Agent trong 1 lượt */
export interface AgentReply {
  sender: Exclude<Sender, 'Student'>
  message: string
  /** Lập trường của agent với ý kiến học sinh */
  attitude: Attitude
}

/** Toàn bộ output 1 lượt từ generateMultiAgentResponse */
export interface MultiAgentTurn {
  agent_replies: AgentReply[]
  /** Đánh giá tư duy của học sinh ở lượt này */
  student_assessment: {
    perspective_diversity: number
    evidence_validity: number
    openness: number
    reasoning_logic: number
    creativity: number
    s_critical_turn: number
    fallacies: string[]
    feedback: string
  }
  /** Các điểm bất đồng (divergence) được Moderator tổng hợp */
  divergence_points: string[]
  /** Cập nhật đồ thị lập luận cho lượt này */
  graph_data: GraphData
}

/** Chỉ số Tư duy Phản biện Mở tổng hợp cho cả phiên */
export interface CriticalAssessment {
  perspective_diversity: number // D_perspective (0-10)
  evidence_validity: number // E_validity (0-10)
  openness: number // C_openness (0-10)
  reasoning_logic: number // Logic lập luận (0-10)
  creativity: number // Sáng tạo đọc hiểu (0-10)
  fallacy_count: number // F_fallacy (số lỗi ngụy biện)
  s_critical: number // Chuẩn hóa thang 100
}
