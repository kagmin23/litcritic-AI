import type { Sender } from '@/types'

export interface AgentMeta {
  id: Exclude<Sender, 'Student'>
  name: string
  shortName: string
  /** Mô tả lăng kính phê bình */
  lens: string
  /** Màu badge (tailwind classes) */
  badgeClass: string
  /** Màu avatar nền */
  avatarClass: string
  /** Màu accent dùng cho node đồ thị / viền */
  accent: string
  emoji: string
}

/** Metadata cho 4 Critic Agents + 1 Moderator */
export const AGENTS: Record<Exclude<Sender, 'Student'>, AgentMeta> = {
  Structuralist: {
    id: 'Structuralist',
    name: 'Nhà Cấu trúc luận',
    shortName: 'Cấu trúc luận',
    lens: 'Nhịp điệu, cấu trúc, tu từ, ngôn từ nghệ thuật',
    badgeClass:
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
    avatarClass: 'bg-indigo-500 text-white',
    accent: '#6366f1',
    emoji: '🧩',
  },
  Psychoanalytic: {
    id: 'Psychoanalytic',
    name: 'Nhà Tâm lý học',
    shortName: 'Tâm lý học',
    lens: 'Dồn nén tâm lý, động cơ ẩn giấu, cái tôi trữ tình',
    badgeClass:
      'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
    avatarClass: 'bg-rose-500 text-white',
    accent: '#f43f5e',
    emoji: '🧠',
  },
  SocioHistorical: {
    id: 'SocioHistorical',
    name: 'Nhà Xã hội - Lịch sử',
    shortName: 'Xã hội học',
    lens: 'Bối cảnh lịch sử, xung đột giai cấp, rào cản xã hội',
    badgeClass:
      'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    avatarClass: 'bg-amber-500 text-white',
    accent: '#f59e0b',
    emoji: '🏛️',
  },
  Feminist: {
    id: 'Feminist',
    name: 'Nhà Phê bình Nữ quyền & Văn hóa',
    shortName: 'Nữ quyền/Văn hóa',
    lens: 'Vị thế giới, góc nhìn nữ quyền, giá trị văn hóa bản địa',
    badgeClass:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    avatarClass: 'bg-emerald-500 text-white',
    accent: '#10b981',
    emoji: '⚖️',
  },
  Moderator: {
    id: 'Moderator',
    name: 'Trọng tài điều phối',
    shortName: 'Trọng tài',
    lens: 'Điều phối, tổng hợp điểm bất đồng, nhận xét học sinh',
    badgeClass:
      'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
    avatarClass: 'bg-slate-700 text-white',
    accent: '#64748b',
    emoji: '🎓',
  },
}

export const STUDENT_META = {
  name: 'Học sinh',
  badgeClass:
    'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  avatarClass: 'bg-sky-500 text-white',
  accent: '#0ea5e9',
  emoji: '🙋',
}

/** Nhãn hiển thị cho mọi loại sender */
export function senderLabel(sender: string): string {
  if (sender === 'Student') return STUDENT_META.name
  return AGENTS[sender as Exclude<Sender, 'Student'>]?.name ?? sender
}

export function senderBadgeClass(sender: string): string {
  if (sender === 'Student') return STUDENT_META.badgeClass
  return AGENTS[sender as Exclude<Sender, 'Student'>]?.badgeClass ?? ''
}

export function senderAvatarClass(sender: string): string {
  if (sender === 'Student') return STUDENT_META.avatarClass
  return AGENTS[sender as Exclude<Sender, 'Student'>]?.avatarClass ?? 'bg-muted'
}

export function senderEmoji(sender: string): string {
  if (sender === 'Student') return STUDENT_META.emoji
  return AGENTS[sender as Exclude<Sender, 'Student'>]?.emoji ?? '💬'
}

/** Mẫu câu Scaffolding gợi ý phản biện cho học sinh */
export const SCAFFOLDING_TEMPLATES: { label: string; text: string }[] = [
  {
    label: 'Đồng ý có điều kiện',
    text: 'Tôi đồng ý với [Agent] về việc …, tuy nhiên ở góc nhìn …, tôi cho rằng …',
  },
  {
    label: 'Phản bác bằng dẫn chứng',
    text: 'Tôi chưa đồng tình với [Agent]. Dựa trên chi tiết "…" trong văn bản, tôi thấy rằng …',
  },
  {
    label: 'Bổ sung góc nhìn',
    text: 'Bổ sung cho ý của [Agent], tôi muốn chỉ ra thêm rằng …',
  },
  {
    label: 'Đặt câu hỏi phản tư',
    text: 'Nếu nhìn từ bối cảnh …, liệu nhận định "…" có còn đúng không?',
  },
  {
    label: 'So sánh - đối chiếu',
    text: 'Trong khi [Agent A] nhấn mạnh …, [Agent B] lại cho rằng …; theo tôi điểm mấu chốt là …',
  },
  {
    label: 'Khái quát - nâng vấn đề',
    text: 'Từ các ý kiến trên, tôi rút ra rằng chủ đề cốt lõi của tác phẩm là …',
  },
]

/** Trọng số công thức S_critical */
export const SCORE_WEIGHTS = {
  w1: 0.3, // D_perspective
  w2: 0.3, // E_validity
  w3: 0.3, // C_openness
  w4: 0.5, // F_fallacy (trừ điểm)
} as const

/** 5 tiêu chí đánh giá theo GDPT 2018 cho Radar Chart */
export const GDPT_CRITERIA = [
  'Đa dạng góc nhìn',
  'Tính thuyết phục của dẫn chứng',
  'Độ cởi mở phản biện',
  'Logic lập luận',
  'Sáng tạo đọc hiểu',
] as const
