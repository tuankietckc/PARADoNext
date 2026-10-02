import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { fetchTasksForView } from '../../lib/taskViewQuery'
import type { SavedView } from '../../lib/taskViewTypes'

/**
 * Lấy task theo 1 view. `view` có thể mang filter/sort đang chỉnh (chưa lưu),
 * nên queryKey gồm cả filter + sort để mỗi thay đổi tự chạy lại query.
 */
export function useTasksView(view: SavedView | undefined) {
  return useQuery({
    queryKey: ['tasks', 'view', view?.id, JSON.stringify(view?.filters), JSON.stringify(view?.sorts)],
    queryFn: async () => {
      const client = getSupabaseClient()
      if (!client) throw new Error('Chưa kết nối Supabase.')
      if (!view) return []

      const { data, error } = await fetchTasksForView(client, view.filters, view.sorts)
      if (error) throw new Error(error)
      return data
    },
    enabled: Boolean(view),
    placeholderData: (previous) => previous, // giữ danh sách cũ trong lúc lọc lại, tránh nháy
  })
}
