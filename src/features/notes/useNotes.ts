import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '../../lib/supabaseClient'

/** Ghi chú — giống bảng Quick Notes trong Notion (migration 0009). */
export type Note = {
  id: string
  user_id: string
  title: string
  content: string | null
  area_id: string | null
  project_id: string | null
  /** Topics = tag tự do, 1 ghi chú có nhiều tag */
  topics: string[]
  archived: boolean
  created_at: string
  updated_at: string
}

export type NoteDraft = Partial<Pick<Note, 'title' | 'content' | 'area_id' | 'project_id' | 'topics' | 'archived'>>

const NOTES_KEY = ['notes'] as const

function requireClient() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Chưa kết nối Supabase.')
  return client
}

function friendly(message: string) {
  if (/relation .*notes.* does not exist|Could not find the table/i.test(message)) {
    return 'Database chưa có bảng ghi chú — hãy chạy migration 0009_notes.sql trong Supabase SQL Editor.'
  }
  return message
}

/** Ghi chú đang dùng (New notes) hoặc đã lưu trữ (Archive), mới nhất trước. */
export function useNotes(archived: boolean) {
  return useQuery({
    queryKey: [...NOTES_KEY, archived ? 'archived' : 'active'],
    queryFn: async (): Promise<Note[]> => {
      const { data, error } = await requireClient()
        .from('notes')
        .select('*')
        .eq('archived', archived)
        .order('created_at', { ascending: false })
      if (error) throw new Error(friendly(error.message))
      return (data ?? []) as Note[]
    },
  })
}

/** Tất cả Topics đã từng dùng — để gợi ý khi gắn tag. */
export function useTopicSuggestions() {
  return useQuery({
    queryKey: [...NOTES_KEY, 'topics'],
    queryFn: async (): Promise<string[]> => {
      const client = requireClient()
      // Topics dùng chung giữa Notes và Resources
      const [notes, resources] = await Promise.all([client.from('notes').select('topics'), client.from('resources').select('topics')])
      if (notes.error && resources.error) throw new Error(friendly(notes.error.message))
      const rows = [...(notes.error ? [] : (notes.data ?? [])), ...(resources.error ? [] : (resources.data ?? []))]
      const all = rows.flatMap((r: { topics: string[] | null }) => r.topics ?? [])
      return [...new Set(all)].sort((a, b) => a.localeCompare(b, 'vi'))
    },
    staleTime: 30_000,
  })
}

export function useCreateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (draft: NoteDraft & { title: string }): Promise<Note> => {
      const client = requireClient()
      const { data: sessionData } = await client.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) throw new Error('Phiên đăng nhập đã hết — hãy đăng nhập lại.')
      const { data, error } = await client
        .from('notes')
        .insert({ ...draft, user_id: userId })
        .select()
        .single()
      if (error) throw new Error(friendly(error.message))
      return data as Note
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTES_KEY }),
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: NoteDraft }): Promise<Note> => {
      const { data, error } = await requireClient().from('notes').update(patch).eq('id', id).select().single()
      if (error) throw new Error(friendly(error.message))
      return data as Note
    },
    // Cập nhật giao diện ngay (sửa trong bảng không bị giật)
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: NOTES_KEY })
      const previous = qc.getQueriesData<Note[]>({ queryKey: NOTES_KEY })
      qc.setQueriesData<Note[] | string[]>({ queryKey: NOTES_KEY }, (old) =>
        Array.isArray(old) && typeof old[0] === 'object'
          ? (old as Note[]).map((n) => (n.id === id ? { ...n, ...patch } : n))
          : old,
      )
      return { previous }
    },
    onError: (_e, _v, ctx) => ctx?.previous.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: () => qc.invalidateQueries({ queryKey: NOTES_KEY }),
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireClient().from('notes').delete().eq('id', id)
      if (error) throw new Error(friendly(error.message))
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: NOTES_KEY }),
  })
}
