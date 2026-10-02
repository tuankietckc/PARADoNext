import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { addDays, addMonths, differenceInCalendarDays, isWeekend, startOfDay } from 'date-fns'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { useSession } from '../../lib/useSession'
import type { RepeatRule, Task } from '../../lib/taskViewTypes'

/** Chu kỳ lặp — giống menu "Duplicate every…" của Notion */
export const repeatOptions: Array<{ value: RepeatRule; label: string; short: string }> = [
  { value: 'day', label: 'Mỗi ngày', short: 'Hằng ngày' },
  { value: 'weekday', label: 'Ngày thường (T2–T6)', short: 'T2–T6' },
  { value: 'week', label: 'Mỗi tuần', short: 'Hằng tuần' },
  { value: '2weeks', label: '2 tuần 1 lần', short: '2 tuần' },
  { value: 'month', label: 'Mỗi tháng', short: 'Hằng tháng' },
  { value: '3months', label: '3 tháng 1 lần', short: '3 tháng' },
  { value: '6months', label: '6 tháng 1 lần', short: '6 tháng' },
  { value: 'year', label: 'Mỗi năm', short: 'Hằng năm' },
]
export const repeatLabel = (r: RepeatRule | null | undefined) => repeatOptions.find((o) => o.value === r)?.short ?? ''

/** Ngày thứ k của chuỗi lặp (k = 0 là ngày gốc) — cùng cách tính với hàm SQL generate_recurring_tasks */
function occurrence(anchor: Date, rule: RepeatRule, k: number): Date {
  switch (rule) {
    case 'day':
      return addDays(anchor, k)
    case 'week':
      return addDays(anchor, 7 * k)
    case '2weeks':
      return addDays(anchor, 14 * k)
    case 'month':
      return addMonths(anchor, k)
    case '3months':
      return addMonths(anchor, 3 * k)
    case '6months':
      return addMonths(anchor, 6 * k)
    case 'year':
      return addMonths(anchor, 12 * k)
    case 'weekday':
      return addDays(anchor, k) // chỉ dùng bên dưới, có bỏ T7/CN riêng
  }
}

/** Lần tạo bản sao tiếp theo (sau hôm nay) — để hiện "Lần tới: …" */
export function nextOccurrence(
  rule: RepeatRule,
  anchorIso: string | null | undefined,
  now = new Date(),
): Date {
  const anchor = startOfDay(anchorIso ? new Date(anchorIso) : now)
  const today = startOfDay(now)
  if (rule === 'weekday') {
    let d = addDays(today > anchor ? today : anchor, 1)
    while (isWeekend(d)) d = addDays(d, 1)
    return d
  }
  // Nhảy gần tới hôm nay rồi dò tiếp (tránh vòng lặp dài với chuỗi đã chạy lâu)
  const days = Math.max(0, differenceInCalendarDays(today, anchor))
  const step = rule === 'day' ? 1 : rule === 'week' ? 7 : rule === '2weeks' ? 14 : rule === 'month' ? 30 : rule === '3months' ? 91 : rule === '6months' ? 182 : 365
  let k = Math.max(1, Math.floor(days / step) - 1)
  while (occurrence(anchor, rule, k) <= today) k++
  return occurrence(anchor, rule, k)
}

/** Mốc bắt đầu lặp của task (giống trigger trong database) */
export const repeatAnchorOf = (t: Pick<Task, 'repeat_anchor' | 'start_at' | 'due_at'> | undefined) =>
  t?.repeat_anchor ?? t?.start_at ?? t?.due_at ?? null

// ---------------------------------------------------------------------------
// Tự tạo bản sao đến hạn: gọi hàm generate_recurring_tasks (migration 0016)
// lúc mở app, khi quay lại tab (tối đa 5 phút/lần) và mỗi 30 phút.
// Chưa chạy migration → lỗi được bỏ qua, app vẫn chạy bình thường.
// ---------------------------------------------------------------------------
let lastRun = 0
let running = false

export async function runRecurringGenerator(): Promise<number> {
  const client = getSupabaseClient()
  if (!client || running) return 0
  running = true
  try {
    const { data, error } = await client.rpc('generate_recurring_tasks', {
      p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      p_offset_min: -new Date().getTimezoneOffset(),
    })
    lastRun = Date.now()
    if (error) return 0
    return Number(data) || 0
  } catch {
    return 0
  } finally {
    running = false
  }
}

export function useRecurringTasks() {
  const { session } = useSession()
  const qc = useQueryClient()
  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    const run = async (minGapMs: number) => {
      if (Date.now() - lastRun < minGapMs) return
      const created = await runRecurringGenerator()
      if (created > 0) {
        void qc.invalidateQueries({ queryKey: ['tasks'] })
        void qc.invalidateQueries({ queryKey: ['para-stats'] })
      }
    }
    void run(0)
    const onVisible = () => document.visibilityState === 'visible' && void run(5 * 60_000)
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(() => void run(25 * 60_000), 30 * 60_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [userId, qc])
}
