import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '../../lib/supabaseClient'

export type ParaKind = 'projects' | 'areas'
export type ParaItem = { id: string; name: string; icon?: string | null }

function requireClient() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Chưa kết nối Supabase.')
  return client
}

/** Danh sách Projects hoặc Areas đang hoạt động (chưa archive). */
export function useParaList(kind: ParaKind) {
  return useQuery({
    queryKey: [kind],
    queryFn: async (): Promise<ParaItem[]> => {
      const { data, error } = await requireClient()
        .from(kind)
        // select * để vẫn chạy khi chưa có cột icon (migration 0012)
        .select('*')
        .eq('archived', false)
        .order('name', { ascending: true })
      if (error) throw new Error(error.message)
      return (data ?? []) as ParaItem[]
    },
  })
}

/** Tạo nhanh 1 Project/Area chỉ với tên (giống tạo relation mới trong Notion). */
/**
 * Vừa tạo 1 Project/Area ở bất kỳ đâu (bảng Task, trang Area…) → thêm ngay vào mọi danh sách đang nhớ
 * (trang Projects / Areas, danh sách chọn nhanh) rồi tải lại từ server cho chắc.
 */
export function rememberNewPara(qc: QueryClient, kind: ParaKind, row: ParaItem & Record<string, unknown>) {
  const add = <T extends { id: string; name: string }>(list: T[] | undefined) =>
    list && !list.some((x) => x.id === row.id)
      ? [...list, row as unknown as T].sort((a, b) => a.name.localeCompare(b.name, 'vi'))
      : list
  qc.setQueryData([kind], add)
  qc.setQueryData([kind, 'all'], add)
  void qc.invalidateQueries({ queryKey: [kind] })
  void qc.invalidateQueries({ queryKey: ['para-stats'] })
}

export function useCreateParaItem(kind: ParaKind) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string): Promise<ParaItem> => {
      const client = requireClient()
      const { data: sessionData } = await client.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) throw new Error('Phiên đăng nhập đã hết — hãy đăng nhập lại.')
      const { data, error } = await client.from(kind).insert({ name, user_id: userId }).select('*').single()
      if (error) throw new Error(error.message)
      return data as ParaItem
    },
    onSuccess: (row) => rememberNewPara(qc, kind, row),
  })
}
