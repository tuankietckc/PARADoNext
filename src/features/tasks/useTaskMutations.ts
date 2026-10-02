import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '../../lib/supabaseClient'
import type { Task } from '../../lib/taskViewTypes'

/**
 * Các field người dùng được phép sửa. Không gồm id, user_id, timestamps và các cột
 * database tự tính (actual_minutes, actual_hours — ghi vào sẽ bị Postgres từ chối).
 */
export type TaskDraft = Partial<
  Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'actual_minutes' | 'actual_hours'>
>

const TASKS_KEY = ['tasks'] as const

function requireClient() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Chưa kết nối Supabase.')
  return client
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (draft: TaskDraft & { task_name: string }): Promise<Task> => {
      const client = requireClient()
      const { data: sessionData } = await client.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) throw new Error('Phiên đăng nhập đã hết — hãy đăng nhập lại.')

      // user_id bắt buộc phải khớp auth.uid() — RLS sẽ chặn nếu sai
      const { data, error } = await client
        .from('tasks')
        .insert({ ...draft, user_id: userId })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data as Task
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  })
}

type UpdateVars = {
  id: string
  patch: TaskDraft
  /** Trì hoãn tải lại danh sách (ms) — để người dùng kịp thấy dấu tick trước khi task rời view. */
  refetchDelayMs?: number
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: UpdateVars): Promise<Task> => {
      const client = requireClient()
      const { data, error } = await client.from('tasks').update(patch).eq('id', id).select().single()
      if (error) throw new Error(error.message)
      return data as Task
    },
    // Cập nhật giao diện ngay, không chờ server (optimistic update)
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY })
      const previous = qc.getQueriesData<Task[]>({ queryKey: TASKS_KEY })
      qc.setQueriesData<Task[]>({ queryKey: TASKS_KEY }, (old) =>
        old?.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: (_data, _err, vars) => {
      setTimeout(() => qc.invalidateQueries({ queryKey: TASKS_KEY }), vars.refetchDelayMs ?? 0)
    },
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const client = requireClient()
      const { error } = await client.from('tasks').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY })
      const previous = qc.getQueriesData<Task[]>({ queryKey: TASKS_KEY })
      qc.setQueriesData<Task[]>({ queryKey: TASKS_KEY }, (old) => old?.filter((t) => t.id !== id))
      return { previous }
    },
    onError: (_err, _id, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  })
}

// ---------------------------------------------------------------------------
// Thao tác nhiều task cùng lúc
// ---------------------------------------------------------------------------

/** Các cột database tự quản lý — không bao giờ gửi lên khi insert. */
const SERVER_MANAGED = ['actual_minutes', 'actual_hours', 'updated_at'] as const

/**
 * Nhân bản task (giống Duplicate của Notion). Bản sao giữ nội dung & phân loại,
 * nhưng là task MỚI: chưa làm, chưa hoàn thành, chưa có giờ bắt đầu/kết thúc.
 */
export function useDuplicateTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tasks: Task[]): Promise<Task[]> => {
      if (tasks.length === 0) return []
      const client = requireClient()
      const { data: sessionData } = await client.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) throw new Error('Phiên đăng nhập đã hết — hãy đăng nhập lại.')

      const rows = tasks.map((t) => ({
        user_id: userId,
        task_name: t.task_name,
        notes: t.notes,
        project_id: t.project_id,
        area_id: t.area_id,
        due_at: t.due_at,
        importance: t.importance,
        urgency: t.urgency,
        energy_level: t.energy_level,
        task_type: t.task_type,
        state: 'not_started' as const,
        complete: false,
      }))
      const { data, error } = await client.from('tasks').insert(rows).select()
      if (error) throw new Error(error.message)
      return (data ?? []) as Task[]
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  })
}

/** Xoá nhiều task một lần. Giao diện bỏ các dòng ngay, lỗi thì trả lại. */
export function useDeleteTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return
      const { error } = await requireClient().from('tasks').delete().in('id', ids)
      if (error) throw new Error(error.message)
    },
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY })
      const previous = qc.getQueriesData<Task[]>({ queryKey: TASKS_KEY })
      qc.setQueriesData<Task[]>({ queryKey: TASKS_KEY }, (old) => old?.filter((t) => !ids.includes(t.id)))
      return { previous }
    },
    onError: (_err, _ids, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  })
}

/** Hoàn tác xoá: chèn lại đúng các dòng cũ (giữ id, ngày tạo, giờ bắt đầu/kết thúc). */
export function useRestoreTasks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tasks: Task[]) => {
      if (tasks.length === 0) return
      const rows = tasks.map((t) => {
        const row: Record<string, unknown> = { ...t }
        for (const key of SERVER_MANAGED) delete row[key]
        return row
      })
      const { error } = await requireClient().from('tasks').insert(rows)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  })
}

/** Lưu thứ tự kéo thả: cập nhật position của các task thay đổi (song song). */
export function useReorderTasks() {
  return useMutation({
    mutationFn: async (changes: Array<{ id: string; position: number }>) => {
      const client = requireClient()
      const results = await Promise.all(
        changes.map((c) => client.from('tasks').update({ position: c.position }).eq('id', c.id)),
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) throw new Error(failed.error.message)
    },
  })
}
