import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '../../lib/supabaseClient'

/** Kênh Telegram (migration 0018) — bot chỉ đẩy thông báo task */
export type DigestScope = 'today' | 'tomorrow'
export type Digest = { time: string; scope: DigestScope }

export type TelegramChannel = {
  user_id: string
  bot_token: string
  bot_username: string | null
  chat_id: string | null
  chat_title: string | null
  enabled: boolean
  digests: Digest[]
  digest_days: number[]
  skip_empty: boolean
  remind_before_due_min: number | null
  remind_at_start: boolean
  /** 0019: kèm thói quen trong tóm tắt (chưa chạy 0019 → undefined) */
  include_habits?: boolean
  created_at: string
  updated_at: string
}

export type ChannelDraft = Partial<Omit<TelegramChannel, 'user_id' | 'created_at' | 'updated_at'>>

export type ServerStatus = { cron: boolean; net: boolean; push_job: boolean; recurring_job: boolean }
export type LogRow = { created_at: string; kind: 'digest' | 'due' | 'start' | 'remind' | 'test'; message: string | null; status_code: number | null; error: string | null }

const KEY = ['telegram'] as const

function requireClient() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Chưa kết nối Supabase.')
  return client
}

export const MIGRATION_HINT = 'Database chưa có phần Channel — hãy chạy migration 0017 và 0018 trong Supabase SQL Editor.'
const friendly = (m: string) => (/telegram_|notification_log|user_settings|Could not find the (table|function)|does not exist/i.test(m) ? MIGRATION_HINT : m)

export const browserTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
export const browserOffsetMin = () => -new Date().getTimezoneOffset()

export function useTelegramChannel() {
  return useQuery({
    queryKey: [...KEY, 'channel'],
    queryFn: async (): Promise<TelegramChannel | null> => {
      const { data, error } = await requireClient().from('telegram_channels').select('*').maybeSingle()
      if (error) throw new Error(friendly(error.message))
      return (data as TelegramChannel | null) ?? null
    },
    retry: false,
  })
}

export function useServerStatus() {
  return useQuery({
    queryKey: [...KEY, 'status'],
    queryFn: async (): Promise<ServerStatus | null> => {
      const { data, error } = await requireClient().rpc('telegram_status')
      if (error) return null
      return data as ServerStatus
    },
    staleTime: 60_000,
  })
}

export function useRecentLog(enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, 'log'],
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await requireClient().rpc('telegram_recent_log')
      if (error) throw new Error(friendly(error.message))
      return (data ?? []) as LogRow[]
    },
    enabled,
    refetchInterval: 20_000,
  })
}

/** Lưu kênh (tạo hoặc sửa) + lưu múi giờ để server gửi đúng giờ */
export function useSaveChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (draft: ChannelDraft): Promise<TelegramChannel> => {
      const client = requireClient()
      const { data: s } = await client.auth.getSession()
      const userId = s.session?.user.id
      if (!userId) throw new Error('Phiên đăng nhập đã hết — hãy đăng nhập lại.')
      await client
        .from('user_settings')
        .upsert({ user_id: userId, timezone: browserTimezone(), utc_offset_min: browserOffsetMin(), updated_at: new Date().toISOString() })
      const { data, error } = await client
        .from('telegram_channels')
        .upsert({ ...draft, user_id: userId }, { onConflict: 'user_id' })
        .select()
        .single()
      if (error) throw new Error(friendly(error.message))
      return data as TelegramChannel
    },
    onSuccess: (row) => qc.setQueryData([...KEY, 'channel'], row),
  })
}

export function useDeleteChannel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await requireClient().from('telegram_channels').delete().not('user_id', 'is', null)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: () => {
      qc.setQueryData([...KEY, 'channel'], null)
      void qc.invalidateQueries({ queryKey: KEY })
    },
  })
}

/** Gửi ngay bản tóm tắt qua đường server (pg_net) — để kiểm tra bot tự gửi được */
export function useSendDigestNow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (scope: DigestScope) => {
      const { error } = await requireClient().rpc('telegram_send_digest_now', { p_scope: scope })
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: () => setTimeout(() => void qc.invalidateQueries({ queryKey: [...KEY, 'log'] }), 2500),
  })
}

// ---------------------------------------------------------------------------
// Gọi thẳng Telegram Bot API từ trình duyệt (kiểm tra token, tìm chat, gửi thử)
// ---------------------------------------------------------------------------
export const isTokenLike = (t: string) => /^\d{5,}:[\w-]{30,}$/.test(t.trim())

async function tg<T>(token: string, method: string, body?: Record<string, unknown>): Promise<T> {
  let res: Response
  try {
    res = await fetch(`https://api.telegram.org/bot${token.trim()}/${method}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Không gọi được Telegram — kiểm tra mạng (hoặc Telegram bị chặn ở mạng này).')
  }
  const json = (await res.json().catch(() => null)) as { ok: boolean; result?: T; description?: string } | null
  if (!json?.ok) {
    const d = json?.description ?? `Lỗi ${res.status}`
    if (res.status === 401 || /Unauthorized/i.test(d)) throw new Error('Token không đúng (Telegram trả về Unauthorized).')
    if (res.status === 409) throw new Error('Bot đang dùng webhook nên không đọc được tin nhắn — nhập Chat ID bằng tay bên dưới.')
    throw new Error(d)
  }
  return json.result as T
}

export type BotInfo = { id: number; username: string; first_name: string }
export const getMe = (token: string) => tg<BotInfo>(token, 'getMe')

export type FoundChat = { id: string; title: string; type: string }
/** Các chat đã nhắn cho bot gần đây (sau khi bấm Start) */
export async function findChats(token: string): Promise<FoundChat[]> {
  type Chat = { id: number; type: string; title?: string; first_name?: string; last_name?: string; username?: string }
  type Update = { message?: { chat: Chat }; my_chat_member?: { chat: Chat }; channel_post?: { chat: Chat } }
  const updates = await tg<Update[]>(token, 'getUpdates', { limit: 50, allowed_updates: ['message', 'my_chat_member', 'channel_post'] })
  const map = new Map<string, FoundChat>()
  for (const u of updates.reverse()) {
    const c = u.message?.chat ?? u.my_chat_member?.chat ?? u.channel_post?.chat
    if (!c || map.has(String(c.id))) continue
    const name = c.title ?? ([c.first_name, c.last_name].filter(Boolean).join(' ') || c.username || String(c.id))
    map.set(String(c.id), { id: String(c.id), title: name, type: c.type })
  }
  return [...map.values()]
}

export const sendTestMessage = (token: string, chatId: string) =>
  tg(token, 'sendMessage', {
    chat_id: chatId,
    parse_mode: 'HTML',
    text: '✅ <b>PARADoNext</b> đã kết nối.\nBot sẽ gửi thông báo task cho bạn ở đây (tóm tắt theo giờ, nhắc trước hạn, tới giờ bắt đầu, nhắc riêng từng task).',
  })
