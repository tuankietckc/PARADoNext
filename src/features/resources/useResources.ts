import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '../../lib/supabaseClient'

/** Tài nguyên (Resources) — giống bảng "All Resources" trong Notion (migration 0015). */
export type ResourceKind = 'video' | 'book' | 'article' | 'course' | 'music' | 'other'

export type Resource = {
  id: string
  user_id: string
  title: string
  kind: ResourceKind
  creator: string | null
  url: string | null
  content: string | null
  area_id: string | null
  project_id: string | null
  /** Topics = tag tự do, dùng chung danh sách với Notes */
  topics: string[]
  /** Đánh giá 1–5 sao */
  review: number | null
  /** Độ dài (phút) — video/khoá học; sách/bài viết có thể để thời gian đọc */
  minutes: number | null
  finished: boolean
  archived: boolean
  created_at: string
  updated_at: string
}

export type ResourceDraft = Partial<
  Pick<Resource, 'title' | 'kind' | 'creator' | 'url' | 'content' | 'area_id' | 'project_id' | 'topics' | 'review' | 'minutes' | 'finished' | 'archived'>
>

export const RESOURCES_KEY = ['resources'] as const

function requireClient() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Chưa kết nối Supabase.')
  return client
}

function friendly(message: string) {
  if (/column .* does not exist|Could not find the '\w+' column|resources_\w+_check/i.test(message)) {
    return 'Database chưa có đủ cột cho Resources — hãy chạy migration 0015_resources.sql trong Supabase SQL Editor.'
  }
  if (/relation .*resources.* does not exist|Could not find the table/i.test(message)) {
    return 'Database chưa có bảng Resources — hãy chạy migration 0001 và 0015_resources.sql trong Supabase SQL Editor.'
  }
  return message
}

/** Chuẩn hoá dòng từ server (DB cũ chưa chạy 0015 vẫn hiển thị được) */
function normalize(r: Record<string, unknown>): Resource {
  return {
    ...(r as Resource),
    kind: ((r.kind as ResourceKind) ?? 'article') as ResourceKind,
    topics: (r.topics as string[] | null) ?? [],
    creator: (r.creator as string | null) ?? null,
    review: r.review == null ? null : Number(r.review),
    minutes: r.minutes == null ? null : Number(r.minutes),
    finished: !!r.finished,
    archived: !!r.archived,
  }
}

/** Tất cả tài nguyên (kể cả đã lưu trữ — trang tự lọc), mới nhất trước. */
export function useResources() {
  return useQuery({
    queryKey: RESOURCES_KEY,
    queryFn: async (): Promise<Resource[]> => {
      const { data, error } = await requireClient().from('resources').select('*').order('created_at', { ascending: false })
      if (error) throw new Error(friendly(error.message))
      return (data ?? []).map((r) => normalize(r as Record<string, unknown>))
    },
    refetchOnMount: 'always',
  })
}

export function useCreateResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (draft: ResourceDraft & { title: string }): Promise<Resource> => {
      const client = requireClient()
      const { data: sessionData } = await client.auth.getSession()
      const userId = sessionData.session?.user.id
      if (!userId) throw new Error('Phiên đăng nhập đã hết — hãy đăng nhập lại.')
      const { data, error } = await client
        .from('resources')
        .insert({ ...draft, user_id: userId })
        .select()
        .single()
      if (error) throw new Error(friendly(error.message))
      return normalize(data as Record<string, unknown>)
    },
    onSuccess: (row) => {
      // Hiện ngay trong bảng, rồi tải lại cho chắc
      qc.setQueryData<Resource[]>(RESOURCES_KEY, (old) => (old && !old.some((r) => r.id === row.id) ? [row, ...old] : old))
      void qc.invalidateQueries({ queryKey: RESOURCES_KEY })
      void qc.invalidateQueries({ queryKey: ['notes', 'topics'] })
    },
  })
}

export function useUpdateResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: ResourceDraft }): Promise<Resource> => {
      const { data, error } = await requireClient().from('resources').update(patch).eq('id', id).select().single()
      if (error) throw new Error(friendly(error.message))
      return normalize(data as Record<string, unknown>)
    },
    // Cập nhật giao diện ngay (sửa trong bảng không bị giật)
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: RESOURCES_KEY })
      const previous = qc.getQueryData<Resource[]>(RESOURCES_KEY)
      qc.setQueryData<Resource[]>(RESOURCES_KEY, (old) => old?.map((r) => (r.id === id ? { ...r, ...patch } : r)))
      return { previous }
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(RESOURCES_KEY, ctx.previous),
    onSettled: (_d, _e, v) => {
      void qc.invalidateQueries({ queryKey: RESOURCES_KEY })
      if (v.patch.topics) void qc.invalidateQueries({ queryKey: ['notes', 'topics'] })
    },
  })
}

export function useDeleteResource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await requireClient().from('resources').delete().eq('id', id)
      if (error) throw new Error(friendly(error.message))
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: RESOURCES_KEY })
      const previous = qc.getQueryData<Resource[]>(RESOURCES_KEY)
      qc.setQueryData<Resource[]>(RESOURCES_KEY, (old) => old?.filter((r) => r.id !== id))
      return { previous }
    },
    onError: (_e, _v, ctx) => ctx?.previous && qc.setQueryData(RESOURCES_KEY, ctx.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: RESOURCES_KEY }),
  })
}

/** Đoán loại tài nguyên từ link (dán link YouTube → Video…) */
export function guessKind(url: string): ResourceKind | null {
  let host = ''
  let path = ''
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
    host = u.hostname.replace(/^www\.|^m\./, '')
    path = u.pathname
  } catch {
    return null
  }
  if (/(^|\.)youtube\.com$|^youtu\.be$|vimeo\.com$|tiktok\.com$/.test(host)) return 'video'
  if (/facebook\.com$|fb\.watch$/.test(host) && /\/(share\/v|reel|watch|videos)/.test(path + '/')) return 'video'
  if (/udemy\.com$|coursera\.org$|edx\.org$|skillshare\.com$|khanacademy\.org$|teachable\.com$|domestika\.org$/.test(host)) return 'course'
  if (/goodreads\.com$|books\.google\.|tiki\.vn$|fahasa\.com$|amazon\./.test(host) || /\.(pdf|epub)$/i.test(path)) return 'book'
  if (/spotify\.com$|soundcloud\.com$|music\.apple\.com$|zingmp3\.vn$/.test(host) || /\.(mp3|wav|flac|m4a)$/i.test(path)) return 'music'
  return 'article'
}

export const looksLikeUrl = (text: string) => /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(text.trim())

/** Hiển thị link gọn: youtube.com/wat…DsZq */
export function shortUrl(url: string) {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
    const host = u.hostname.replace(/^www\./, '')
    const rest = (u.pathname + u.search).replace(/^\/$/, '')
    return rest.length > 14 ? `${host}${rest.slice(0, 5)}…${rest.slice(-5)}` : host + rest
  } catch {
    return url
  }
}

export const hrefOf = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`)

/** Ảnh xem trước cho link YouTube */
export function youtubeThumb(url: string | null) {
  if (!url) return null
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/)
  return m ? `https://i.ytimg.com/vi/${m[1]}/mqdefault.jpg` : null
}
