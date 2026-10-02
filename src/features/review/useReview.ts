import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, format, parseISO, startOfDay, subDays } from 'date-fns'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { isoDow } from '../habits/useHabits'

/** Sổ Weekly Review (migration 0019) — 1 bài review cho mỗi tuần */
export type WeekStats = { tasks: number; minutes: number; habit_rate: number | null }
export type WeeklyReview = {
  id: string
  user_id: string
  /** Thứ Hai của tuần (yyyy-MM-dd) */
  week_start: string
  rating: number | null
  wins: string | null
  improve: string | null
  next_focus: string | null
  notes: string | null
  /** Số liệu tuần đó, lưu lúc viết review */
  stats: WeekStats | null
  completed_at: string | null
  created_at: string
  updated_at: string
}
export type ReviewDraft = Partial<Pick<WeeklyReview, 'rating' | 'wins' | 'improve' | 'next_focus' | 'notes' | 'stats' | 'completed_at'>>

const KEY = ['weekly-reviews'] as const

function requireClient() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Chưa kết nối Supabase.')
  return client
}
const friendly = (m: string) =>
  /weekly_reviews|Could not find the table|does not exist|column .* (rating|notes|stats)/i.test(m)
    ? 'Database chưa có (đủ) phần Weekly Review — hãy chạy migration 0019_habits_review.sql trong Supabase SQL Editor.'
    : m

/** Thứ Hai của tuần chứa ngày d */
export const weekStartOf = (d = new Date()) => startOfDay(subDays(d, isoDow(d) - 1))
export const weekKey = (d = new Date()) => format(weekStartOf(d), 'yyyy-MM-dd')
export const weekRangeText = (weekStart: string) => {
  const s = parseISO(weekStart)
  return `${format(s, 'dd/MM')} – ${format(addDays(s, 6), 'dd/MM/yyyy')}`
}

export function useWeeklyReviews() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<WeeklyReview[]> => {
      const { data, error } = await requireClient().from('weekly_reviews').select('*').order('week_start', { ascending: false })
      if (error) throw new Error(friendly(error.message))
      return (data ?? []) as WeeklyReview[]
    },
  })
}

export function useSaveReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ week, patch }: { week: string; patch: ReviewDraft }) => {
      const client = requireClient()
      const { data: s } = await client.auth.getSession()
      const userId = s.session?.user.id
      if (!userId) throw new Error('Phiên đăng nhập đã hết — hãy đăng nhập lại.')
      const { data, error } = await client
        .from('weekly_reviews')
        .upsert({ user_id: userId, week_start: week, ...patch }, { onConflict: 'user_id,week_start' })
        .select()
        .single()
      if (error) throw new Error(friendly(error.message))
      return data as WeeklyReview
    },
    onSuccess: (row) => {
      qc.setQueryData<WeeklyReview[]>(KEY, (old = []) =>
        [row, ...old.filter((r) => r.week_start !== row.week_start)].sort((a, b) => b.week_start.localeCompare(a.week_start)),
      )
      void qc.invalidateQueries({ queryKey: KEY })
    },
  })
}

export function useDeleteReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireClient().from('weekly_reviews').delete().eq('id', id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, id) => {
      qc.setQueryData<WeeklyReview[]>(KEY, (old) => old?.filter((r) => r.id !== id))
      void qc.invalidateQueries({ queryKey: KEY })
    },
  })
}

export type WeekTask = { id: string; task_name: string; end_at: string; actual_minutes: number | null }

/** Số liệu của 1 tuần (task xong, thời gian, % thói quen) — tính trực tiếp từ dữ liệu */
export function useWeekStats(week: string) {
  return useQuery({
    queryKey: ['review-week', week],
    queryFn: async (): Promise<{ stats: WeekStats; tasks: WeekTask[] }> => {
      const client = requireClient()
      const start = parseISO(week)
      const end = addDays(start, 7)
      const [tasksRes, habitsRes, logsRes] = await Promise.all([
        client
          .from('tasks')
          .select('id, task_name, end_at, actual_minutes')
          .eq('complete', true)
          .gte('end_at', start.toISOString())
          .lt('end_at', end.toISOString())
          .order('end_at'),
        client.from('habits').select('id, days, created_at, archived'),
        client.from('habit_logs').select('habit_id, day').gte('day', week).lt('day', format(end, 'yyyy-MM-dd')),
      ])
      if (tasksRes.error) throw new Error(tasksRes.error.message)
      const tasks = (tasksRes.data ?? []) as WeekTask[]

      // % thói quen: ngày cần làm đã tick / ngày cần làm (tới hôm nay, từ lúc tạo thói quen)
      let habit_rate: number | null = null
      if (!habitsRes.error && !logsRes.error) {
        const done = new Set((logsRes.data ?? []).map((l: { habit_id: string; day: string }) => `${l.habit_id}|${l.day}`))
        const today = startOfDay(new Date())
        let need = 0
        let got = 0
        for (const h of (habitsRes.data ?? []) as Array<{ id: string; days: number[]; created_at: string; archived: boolean }>) {
          if (h.archived) continue
          for (let i = 0; i < 7; i++) {
            const d = addDays(start, i)
            if (d > today || d < startOfDay(parseISO(h.created_at)) || !h.days.includes(isoDow(d))) continue
            need++
            if (done.has(`${h.id}|${format(d, 'yyyy-MM-dd')}`)) got++
          }
        }
        habit_rate = need ? Math.round((got / need) * 100) / 100 : null
      }
      return {
        stats: { tasks: tasks.length, minutes: tasks.reduce((s, t) => s + (t.actual_minutes ?? 0), 0), habit_rate },
        tasks,
      }
    },
  })
}
