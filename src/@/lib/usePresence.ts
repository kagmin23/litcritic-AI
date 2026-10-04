import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient'

export interface PresenceMember {
  user_id: string
  username: string
  full_name: string
  role: string
  online_at: string
}

interface UsePresenceOptions {
  /** Tên kênh, vd: 'presence:global' hoặc `presence:session:<id>` */
  channelName: string
  /** Thông tin của chính mình để track. Nếu null, chỉ quan sát (không join). */
  self: Omit<PresenceMember, 'online_at'> | null
  /** Có tham gia (track) hay chỉ lắng nghe. Mặc định true. */
  track?: boolean
}

/**
 * Theo dõi Presence realtime của một kênh Supabase.
 * Trả về danh sách thành viên đang online (dedupe theo user_id) và tổng số.
 * Nếu chưa cấu hình Supabase/Realtime, trả về rỗng (app vẫn chạy).
 */
export function usePresence({
  channelName,
  self,
  track = true,
}: UsePresenceOptions): { members: PresenceMember[]; count: number } {
  const [members, setMembers] = useState<PresenceMember[]>([])

  const selfKey = self?.user_id ?? ''
  const selfName = self?.username ?? ''

  useEffect(() => {
    if (!isSupabaseConfigured || !channelName) return
    if (track && !self) return

    const channel = supabase.channel(channelName, {
      config: { presence: { key: self?.user_id ?? crypto.randomUUID() } },
    })

    const syncMembers = () => {
      const state = channel.presenceState<PresenceMember>()
      // Gộp mọi presence, dedupe theo user_id (một user có thể mở nhiều tab).
      const byUser = new Map<string, PresenceMember>()
      Object.values(state).forEach((entries) => {
        entries.forEach((m) => {
          if (m?.user_id) byUser.set(m.user_id, m)
        })
      })
      setMembers([...byUser.values()])
    }

    channel
      .on('presence', { event: 'sync' }, syncMembers)
      .on('presence', { event: 'join' }, syncMembers)
      .on('presence', { event: 'leave' }, syncMembers)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && track && self) {
          await channel.track({
            ...self,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      void channel.unsubscribe()
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, selfKey, selfName, track])

  return { members, count: members.length }
}
