import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '../../lib/supabaseClient'
import type { Task } from '../../lib/taskViewTypes'
import type { Note } from '../notes/useNotes'
import { rememberNewPara, type ParaKind } from './usePara'

export type Area = { id: string; name: string; archived: boolean; created_at: string; icon?: string | null }
export type Project = {
  id: string
  name: string
  area_id: string | null
  is_favorite: boolean
  completed: boolean
  archived: boolean
  /** Hạn chót (migration 0010) */
  due_at?: string | null
  /** Emoji hoặc link ảnh (migration 0012) */
  icon?: string | null
  /** Nhãn Status: ongoing | deadline | moved_the_needle (migration 0011) */
  labels?: string[]
  /** Lúc đánh dấu Completed (migration 0020, tự điền) */
  completed_at?: string | null
  created_at: string
}
export type ParaRecord = Area | Project

function requireClient() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Chưa kết nối Supabase.')
  return client
}

/** Tất cả Areas / Projects (kể cả đã lưu trữ) — dùng cho trang quản lý. */
export function useParaRecords<K extends ParaKind>(kind: K) {
  return useQuery({
    queryKey: [kind, 'all'],
    // Luôn tải lại khi mở trang: Project/Area có thể vừa được tạo ở trang khác
    refetchOnMount: 'always',
    queryFn: async (): Promise<K extends 'areas' ? Area[] : Project[]> => {
      const { data, error } = await requireClient().from(kind).select('*').order('name', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as K extends 'areas' ? Area[] : Project[]
    },
  })
}

export function useUpdatePara(kind: ParaKind) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Area> | Partial<Project> }) => {
      const { error } = await requireClient().from(kind).update(patch).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: [kind] })
      const previous = qc.getQueryData<ParaRecord[]>([kind, 'all'])
      if (previous) qc.setQueryData([kind, 'all'], previous.map((r) => (r.id === id ? { ...r, ...patch } : r)))
      return { previous }
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData([kind, 'all'], ctx.previous),
    // Làm mới cả danh sách chọn nhanh (useParaList) dùng trong bảng task / ghi chú
    onSettled: () => qc.invalidateQueries({ queryKey: [kind] }),
  })
}

export function useCreatePara(kind: ParaKind) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { name: string; area_id?: string | null }): Promise<ParaRecord> => {
      const client = requireClient()
      const { data: s } = await client.auth.getSession()
      const userId = s.session?.user.id
      if (!userId) throw new Error('Phiên đăng nhập đã hết — hãy đăng nhập lại.')
      const { data, error } = await client
        .from(kind)
        .insert({ ...input, user_id: userId })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data as ParaRecord
    },
    onSuccess: (row) => rememberNewPara(qc, kind, row as ParaRecord & Record<string, unknown>),
  })
}

/** Xoá hẳn. Task / ghi chú gắn với nó không bị xoá — chỉ bỏ liên kết (database: on delete set null). */
export function useDeletePara(kind: ParaKind) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireClient().from(kind).delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [kind] })
      void qc.invalidateQueries({ queryKey: ['tasks'] })
      void qc.invalidateQueries({ queryKey: ['notes'] })
      void qc.invalidateQueries({ queryKey: ['para-stats'] })
    },
  })
}

/** Số liệu gọn cho trang danh sách: đếm task mở/xong, tổng phút, số ghi chú theo từng Area/Project. */
export type ParaStats = { open: number; done: number; minutes: number; notes: number }

export function useParaStats(kind: ParaKind) {
  const field = kind === 'areas' ? 'area_id' : 'project_id'
  return useQuery({
    // Không đặt dưới key 'tasks': cache này là Map, các cập nhật lạc quan của task chỉ xử lý mảng task
    queryKey: ['para-stats', kind],
    queryFn: async (): Promise<Map<string, ParaStats>> => {
      const client = requireClient()
      const [tasksRes, notesRes] = await Promise.all([
        client.from('tasks').select(`${field}, complete, actual_minutes`).not(field, 'is', null),
        client.from('notes').select(`${field}`).not(field, 'is', null).eq('archived', false),
      ])
      if (tasksRes.error) throw new Error(tasksRes.error.message)
      const map = new Map<string, ParaStats>()
      const get = (id: string) => {
        if (!map.has(id)) map.set(id, { open: 0, done: 0, minutes: 0, notes: 0 })
        return map.get(id)!
      }
      for (const t of (tasksRes.data ?? []) as Array<Record<string, unknown>>) {
        const s = get(String(t[field]))
        if (t.complete) s.done++
        else s.open++
        s.minutes += Number(t.actual_minutes ?? 0)
      }
      // Chưa chạy migration notes → bỏ qua phần ghi chú, không báo lỗi cả trang
      if (!notesRes.error) for (const n of (notesRes.data ?? []) as Array<Record<string, unknown>>) get(String(n[field])).notes++
      return map
    },
  })
}

/** Task của 1 Area / Project (cả việc đã xong). Key bắt đầu bằng 'tasks' → tự làm mới khi task đổi. */
export function useParaTasks(kind: ParaKind, id: string | undefined) {
  const field = kind === 'areas' ? 'area_id' : 'project_id'
  return useQuery({
    queryKey: ['tasks', 'para', kind, id],
    enabled: !!id,
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await requireClient()
        .from('tasks')
        .select('*')
        .eq(field, id!)
        .order('complete', { ascending: true })
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as Task[]
    },
  })
}

/** Ghi chú (chưa lưu trữ) của 1 Area / Project. */
export function useParaNotes(kind: ParaKind, id: string | undefined) {
  const field = kind === 'areas' ? 'area_id' : 'project_id'
  return useQuery({
    queryKey: ['notes', 'para', kind, id],
    enabled: !!id,
    queryFn: async (): Promise<Note[]> => {
      const { data, error } = await requireClient()
        .from('notes')
        .select('*')
        .eq(field, id!)
        .order('created_at', { ascending: false })
      if (error) return [] // chưa có bảng notes
      return (data ?? []) as Note[]
    },
  })
}
