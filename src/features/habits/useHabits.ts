import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addDays, format, isAfter, parseISO, startOfDay, subDays } from 'date-fns'
import { getSupabaseClient } from '../../lib/supabaseClient'

/** Thói quen (migration 0019) */
export type Habit = {
  id: string
  user_id: string
  name: string
  icon: string | null
  area_id: string | null
  /** Ngày cần làm: 1 = Thứ Hai … 7 = Chủ Nhật */
  days: number[]
  archived: boolean
  sort_order: number
  created_at: string
  updated_at: string
}
export type HabitDraft = Partial<Pick<Habit, 'name' | 'icon' | 'area_id' | 'days' | 'archived' | 'sort_order'>>
export type HabitLog = { habit_id: string; day: string }

const HABITS = ['habits'] as const
const LOGS = ['habit-logs'] as const
/** Tải nhật ký 1 năm gần nhất (đủ tính chuỗi dài nhất + bản đồ nhiệt) */
export const LOG_DAYS = 371

function requireClient() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Chưa kết nối Supabase.')
  return client
}
const friendly = (m: string) =>
  /habits|habit_logs|Could not find the table|does not exist/i.test(m)
    ? 'Database chưa có phần Thói quen — hãy chạy migration 0019_habits_review.sql trong Supabase SQL Editor.'
    : m

async function userId() {
  const { data } = await requireClient().auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('Phiên đăng nhập đã hết — hãy đăng nhập lại.')
  return id
}

export const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')
/** Thứ trong tuần kiểu ISO: 1 = Thứ Hai … 7 = Chủ Nhật */
export const isoDow = (d: Date) => ((d.getDay() + 6) % 7) + 1

export function useHabits() {
  return useQuery({
    queryKey: HABITS,
    queryFn: async (): Promise<Habit[]> => {
      const { data, error } = await requireClient().from('habits').select('*').order('sort_order').order('created_at')
      if (error) throw new Error(friendly(error.message))
      return (data ?? []) as Habit[]
    },
  })
}

export function useHabitLogs() {
  return useQuery({
    queryKey: LOGS,
    queryFn: async (): Promise<HabitLog[]> => {
      const from = dayKey(subDays(new Date(), LOG_DAYS))
      const { data, error } = await requireClient().from('habit_logs').select('habit_id, day').gte('day', from)
      if (error) throw new Error(friendly(error.message))
      return (data ?? []) as HabitLog[]
    },
  })
}

export function useCreateHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (draft: HabitDraft & { name: string }) => {
      const { data, error } = await requireClient()
        .from('habits')
        .insert({ ...draft, user_id: await userId() })
        .select()
        .single()
      if (error) throw new Error(friendly(error.message))
      return data as Habit
    },
    onSuccess: (row) => {
      qc.setQueryData<Habit[]>(HABITS, (old) => (old ? [...old, row] : [row]))
      void qc.invalidateQueries({ queryKey: HABITS })
    },
  })
}

export function useUpdateHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: HabitDraft }) => {
      const { error } = await requireClient().from('habits').update(patch).eq('id', id)
      if (error) throw new Error(friendly(error.message))
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: HABITS })
      const previous = qc.getQueryData<Habit[]>(HABITS)
      qc.setQueryData<Habit[]>(HABITS, (old) => old?.map((h) => (h.id === id ? { ...h, ...patch } : h)))
      return { previous }
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(HABITS, ctx.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: HABITS }),
  })
}

export function useDeleteHabit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireClient().from('habits').delete().eq('id', id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: (_d, id) => {
      qc.setQueryData<Habit[]>(HABITS, (old) => old?.filter((h) => h.id !== id))
      void qc.invalidateQueries({ queryKey: HABITS })
    },
  })
}

/** Tick / bỏ tick 1 ngày (hiện ngay trên màn hình, lưu sau) */
export function useToggleHabitDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ habitId, day, done }: { habitId: string; day: string; done: boolean }) => {
      const client = requireClient()
      const { error } = done
        ? await client.from('habit_logs').upsert({ habit_id: habitId, day, user_id: await userId() }, { onConflict: 'habit_id,day', ignoreDuplicates: true })
        : await client.from('habit_logs').delete().eq('habit_id', habitId).eq('day', day)
      if (error) throw new Error(friendly(error.message))
    },
    onMutate: async ({ habitId, day, done }) => {
      await qc.cancelQueries({ queryKey: LOGS })
      const previous = qc.getQueryData<HabitLog[]>(LOGS)
      qc.setQueryData<HabitLog[]>(LOGS, (old = []) =>
        done ? [...old.filter((l) => !(l.habit_id === habitId && l.day === day)), { habit_id: habitId, day }] : old.filter((l) => !(l.habit_id === habitId && l.day === day)),
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(LOGS, ctx.previous),
  })
}

// ---------------------------------------------------------------------------
// Tính chuỗi ngày & tỉ lệ
// ---------------------------------------------------------------------------
export type HabitStats = { streak: number; best: number; rate30: number | null; doneToday: boolean; dueToday: boolean }

/**
 * Chuỗi hiện tại: đếm lùi các ngày CẦN LÀM liên tiếp đã tick (hôm nay chưa tick thì chưa tính là đứt).
 * Ngày không cần làm được bỏ qua (không làm đứt chuỗi).
 */
export function habitStats(h: Habit, done: Set<string>, today = new Date()): HabitStats {
  const t0 = startOfDay(today)
  const created = startOfDay(parseISO(h.created_at))
  const scheduled = (d: Date) => h.days.includes(isoDow(d))
  const isDone = (d: Date) => done.has(dayKey(d))

  let streak = 0
  let d = isDone(t0) ? t0 : subDays(t0, 1) // hôm nay chưa tick → xét từ hôm qua
  for (let i = 0; i < LOG_DAYS && !isAfter(created, d); i++, d = subDays(d, 1)) {
    if (!scheduled(d)) continue
    if (isDone(d)) streak++
    else break
  }

  // Chuỗi dài nhất trong 1 năm (đi từ cũ tới mới)
  let best = 0
  let run = 0
  for (let i = LOG_DAYS; i >= 0; i--) {
    const day = subDays(t0, i)
    if (isAfter(created, day) || !scheduled(day)) continue
    if (isDone(day)) run++
    else if (i > 0) run = 0
    best = Math.max(best, run)
  }

  // Tỉ lệ 30 ngày (tính từ lúc tạo thói quen), không tính hôm nay nếu chưa tick
  let need = 0
  let got = 0
  for (let i = 0; i < 30; i++) {
    const day = subDays(t0, i)
    if (isAfter(created, day)) break
    if (!scheduled(day)) continue
    if (i === 0 && !isDone(day)) continue
    need++
    if (isDone(day)) got++
  }
  return { streak, best: Math.max(best, streak), rate30: need ? got / need : null, doneToday: isDone(t0), dueToday: scheduled(t0) }
}

/** Các ngày của tuần chứa `anchor` (Thứ Hai → Chủ Nhật) */
export function weekDays(anchor: Date) {
  const monday = subDays(startOfDay(anchor), isoDow(anchor) - 1)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}
