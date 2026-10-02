import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '../../lib/supabaseClient'
import type {
  CalendarField,
  GroupBy,
  SavedView,
  TaskFilter,
  TaskSort,
  ViewLayout,
  ViewSection,
} from '../../lib/taskViewTypes'

const VIEWS_KEY = ['saved_views'] as const

function requireClient() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Chưa kết nối Supabase.')
  return client
}

/** Lưu filter/sort đang chỉnh vào view hiện tại. */
export function useUpdateSavedView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string
      filters: TaskFilter[]
      sorts: TaskSort[]
      view_type?: ViewLayout
      calendar_field?: CalendarField
      group_by?: GroupBy | null
    }) => {
      const { error } = await requireClient().from('saved_views').update(patch).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: VIEWS_KEY }),
  })
}

/** Lưu thành view mới (giống "+ Add view" của Notion). */
export function useCreateSavedView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      filters: TaskFilter[]
      sorts: TaskSort[]
      sort_order: number
      section: ViewSection
      view_type: ViewLayout
      calendar_field: CalendarField
      group_by: GroupBy | null
    }): Promise<SavedView> => {
      const client = requireClient()
      const { data: sessionData } = await client.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) throw new Error('Phiên đăng nhập đã hết — hãy đăng nhập lại.')
      const { data, error } = await client
        .from('saved_views')
        .insert({ ...input, user_id: userId, is_system: false, visible_columns: [] })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data as SavedView
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: VIEWS_KEY }),
  })
}

/** Xoá view tự tạo (view hệ thống không cho xoá). */
export function useDeleteSavedView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireClient().from('saved_views').delete().eq('id', id).eq('is_system', false)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: VIEWS_KEY }),
  })
}

/** Sửa ghi chú của view. Chuỗi rỗng → null (quay về câu mô tả tự sinh). */
export function useUpdateViewDescription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, description }: { id: string; description: string }) => {
      const value = description.trim() || null
      const { error } = await requireClient().from('saved_views').update({ description: value }).eq('id', id)
      if (error) {
        if (/description/.test(error.message)) {
          throw new Error('Database chưa có cột ghi chú — hãy chạy migration 0005_view_descriptions.sql.')
        }
        throw new Error(error.message)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: VIEWS_KEY }),
  })
}

/**
 * Đổi phần "bố cục hiển thị" của view: thứ tự / ẩn hiện cột, thứ tự tab.
 * Lưu ngay (không cần bấm Lưu) và cập nhật giao diện trước khi server trả lời.
 * Chỉ ghi vào bảng saved_views — dữ liệu task không bị động tới.
 */
export function usePatchSavedViews() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (changes: Array<{ id: string; patch: Partial<Pick<SavedView, 'visible_columns' | 'sort_order'>> }>) => {
      const client = requireClient()
      const results = await Promise.all(changes.map((c) => client.from('saved_views').update(c.patch).eq('id', c.id)))
      const failed = results.find((r) => r.error)
      if (failed?.error) throw new Error(failed.error.message)
    },
    onMutate: async (changes) => {
      await qc.cancelQueries({ queryKey: VIEWS_KEY })
      const previous = qc.getQueryData<SavedView[]>(VIEWS_KEY)
      if (previous) {
        const byId = new Map(changes.map((c) => [c.id, c.patch]))
        const next = previous
          .map((v) => (byId.has(v.id) ? { ...v, ...byId.get(v.id) } : v))
          .sort((a, b) => a.sort_order - b.sort_order)
        qc.setQueryData(VIEWS_KEY, next)
      }
      return { previous }
    },
    onError: (_err, _changes, ctx) => {
      if (ctx?.previous) qc.setQueryData(VIEWS_KEY, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: VIEWS_KEY }),
  })
}
