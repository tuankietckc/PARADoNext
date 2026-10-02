import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from './supabaseClient'

/**
 * Cấu hình hiển thị đồng bộ giữa các máy (bảng ui_prefs — migration 0014).
 *
 * - Hiện ngay bằng bản lưu trên trình duyệt (localStorage) để không bị "nháy".
 * - Tải bản trên Supabase về; có thì dùng bản đó (máy khác vừa chỉnh).
 * - Đổi cấu hình → lưu trình duyệt ngay, gửi lên Supabase sau 0,4 giây (gộp các lần đổi liên tiếp).
 * - Chưa chạy migration 0014 / mất mạng → vẫn chạy, chỉ nhớ trên trình duyệt.
 */
const LOCAL = (key: string) => `paradonext-pref-${key}`

function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(LOCAL(key))
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(LOCAL(key), JSON.stringify(value))
  } catch {
    /* trình duyệt chặn lưu trữ — bỏ qua */
  }
}

export function useUiPref<T extends object>(key: string, initial: T): [T, (next: T) => void] {
  const qc = useQueryClient()
  const merge = useCallback((v: Partial<T> | null | undefined): T => ({ ...initial, ...(v ?? {}) }), [initial])
  const [value, setValue] = useState<T>(() => merge(readLocal<Partial<T>>(key)))
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: remote } = useQuery({
    queryKey: ['ui_prefs', key],
    queryFn: async (): Promise<Partial<T> | null> => {
      const client = getSupabaseClient()
      if (!client) return null
      const { data, error } = await client.from('ui_prefs').select('value').eq('key', key).maybeSingle()
      if (error) return null // chưa có bảng → chỉ dùng trình duyệt
      return (data?.value as Partial<T> | undefined) ?? null
    },
    staleTime: 60_000,
  })

  // Có bản trên Supabase → dùng (trừ khi người dùng đang chỉnh dở trên máy này)
  useEffect(() => {
    if (!remote || dirty.current) return
    const next = merge(remote)
    setValue(next)
    writeLocal(key, next)
  }, [remote, key, merge])

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])

  const save = useCallback(
    (next: T) => {
      dirty.current = true
      setValue(next)
      writeLocal(key, next)
      qc.setQueryData(['ui_prefs', key], next)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(async () => {
        const client = getSupabaseClient()
        if (!client) return
        const { data: s } = await client.auth.getSession()
        const userId = s.session?.user.id
        if (!userId) return
        await client
          .from('ui_prefs')
          .upsert({ user_id: userId, key, value: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' })
        dirty.current = false
      }, 400)
    },
    [key, qc],
  )

  return [value, save]
}
