import {
  BookOpen,
  Bookmark,
  CalendarClock,
  CalendarPlus,
  CheckSquare,
  CircleDot,
  FileText,
  FolderKanban,
  GraduationCap,
  Hash,
  Layers,
  Link2,
  List,
  Star,
  Tags,
  Timer,
  Type,
  User,
  Video,
  Music,
  type LucideIcon,
} from 'lucide-react'
import { normalizeSearch, type Option } from '../tasks/taskFields'
import type { Resource, ResourceDraft, ResourceKind } from './useResources'

// ---------------------------------------------------------------------------
// Loại tài nguyên & đánh giá
// ---------------------------------------------------------------------------
export const kindOptions: Array<Option<ResourceKind> & { icon: LucideIcon; plural: string }> = [
  { value: 'video', label: 'Video', plural: 'Videos', icon: Video, className: 'bg-danger-soft text-danger' },
  { value: 'book', label: 'Book', plural: 'Books', icon: BookOpen, className: 'bg-yellow-soft text-yellow' },
  { value: 'article', label: 'Article/News/Post', plural: 'Article/News/Post', icon: FileText, className: 'bg-info-soft text-info' },
  { value: 'course', label: 'Course', plural: 'Course', icon: GraduationCap, className: 'bg-purple-soft text-purple' },
  { value: 'other', label: 'Khác', plural: 'Khác', icon: Bookmark, className: 'bg-surface-2 text-muted' },
  { value: 'music', label: 'Music/Audio', plural: 'Music', icon: Music, className: 'bg-emerald-soft text-emerald' },
]
export const kindOf = (k: ResourceKind) => kindOptions.find((o) => o.value === k) ?? kindOptions.find((o) => o.value === 'other') ?? kindOptions[0]

export type ReviewValue = '1' | '2' | '3' | '4' | '5'
export const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)
export const reviewOptions: Option<ReviewValue>[] = (['5', '4', '3', '2', '1'] as const).map((v) => ({
  value: v,
  label: stars(Number(v)),
  className: 'bg-yellow-soft text-yellow tracking-tight',
}))

/** "1 giờ 23 phút" gọn: 43.5 → 43,5 phút · 160 → 2g 40p */
export function formatMinutes(m: number | null) {
  if (m == null) return ''
  if (m < 60) return `${String(m).replace('.', ',')}`
  const h = Math.floor(m / 60)
  const rest = Math.round(m - h * 60)
  return rest ? `${h}g ${rest}p` : `${h}g`
}

// ---------------------------------------------------------------------------
// Cột
// ---------------------------------------------------------------------------
export type ColKey = 'kind' | 'creator' | 'project_id' | 'area_id' | 'topics' | 'url' | 'review' | 'minutes' | 'finished' | 'created_at' | 'updated_at'

export const columns: Array<{ key: ColKey; label: string; icon: LucideIcon; width: string }> = [
  { key: 'kind', label: 'Loại', icon: CircleDot, width: 'min-w-36' },
  { key: 'creator', label: 'Creator', icon: User, width: 'min-w-28' },
  { key: 'project_id', label: 'Projects', icon: FolderKanban, width: 'min-w-28' },
  { key: 'area_id', label: 'Areas', icon: Layers, width: 'min-w-28' },
  { key: 'topics', label: 'Topics', icon: Tags, width: 'min-w-36' },
  { key: 'url', label: 'URL', icon: Link2, width: 'min-w-40' },
  { key: 'review', label: 'Reviews', icon: Star, width: 'min-w-28' },
  { key: 'minutes', label: 'Minutes', icon: Timer, width: 'min-w-20' },
  { key: 'finished', label: 'Xong', icon: CheckSquare, width: 'min-w-20' },
  { key: 'created_at', label: 'Ngày tạo', icon: CalendarPlus, width: 'min-w-32' },
  { key: 'updated_at', label: 'Sửa lần cuối', icon: CalendarClock, width: 'min-w-32' },
]
export const colDef = (k: ColKey) => columns.find((c) => c.key === k)!

// ---------------------------------------------------------------------------
// Sắp xếp
// ---------------------------------------------------------------------------
export type SortField = 'title' | 'kind' | 'creator' | 'review' | 'minutes' | 'finished' | 'created_at' | 'updated_at'
export type Sort = { field: SortField; direction: 'asc' | 'desc' }
export const sortFields: Array<{ field: SortField; label: string; asc: string; desc: string }> = [
  { field: 'title', label: 'Tên', asc: 'A → Z', desc: 'Z → A' },
  { field: 'kind', label: 'Loại', asc: 'A → Z', desc: 'Z → A' },
  { field: 'creator', label: 'Creator', asc: 'A → Z', desc: 'Z → A' },
  { field: 'review', label: 'Reviews', asc: 'Thấp → cao', desc: 'Cao → thấp' },
  { field: 'minutes', label: 'Minutes', asc: 'Ngắn → dài', desc: 'Dài → ngắn' },
  { field: 'finished', label: 'Xong', asc: 'Chưa xong trước', desc: 'Xong trước' },
  { field: 'created_at', label: 'Ngày tạo', asc: 'Cũ → mới', desc: 'Mới → cũ' },
  { field: 'updated_at', label: 'Sửa lần cuối', asc: 'Cũ → mới', desc: 'Mới → cũ' },
]
export const colSortField: Partial<Record<ColKey, SortField>> = {
  kind: 'kind',
  creator: 'creator',
  review: 'review',
  minutes: 'minutes',
  finished: 'finished',
  created_at: 'created_at',
  updated_at: 'updated_at',
}

// ---------------------------------------------------------------------------
// Bộ lọc
// ---------------------------------------------------------------------------
export type Filter =
  | { field: 'title' | 'creator' | 'url'; op: 'contains' | 'empty' | 'not_empty'; value: string }
  | { field: 'kind'; op: 'is' | 'is_not'; value: ResourceKind[] }
  | { field: 'area_id' | 'project_id'; op: 'is' | 'empty' | 'not_empty'; value: string[] }
  | { field: 'topics'; op: 'has' | 'empty' | 'not_empty'; value: string[] }
  | { field: 'review'; op: 'gte' | 'eq' | 'empty'; value: number }
  | { field: 'minutes'; op: 'gt' | 'lt' | 'empty'; value: number }
  | { field: 'finished'; op: 'is'; value: boolean }

export type FilterField = Filter['field']
export const filterFields: Array<{ field: FilterField; label: string; icon: LucideIcon; initial: Filter }> = [
  { field: 'kind', label: 'Loại', icon: CircleDot, initial: { field: 'kind', op: 'is', value: [] } },
  { field: 'finished', label: 'Xong', icon: CheckSquare, initial: { field: 'finished', op: 'is', value: false } },
  { field: 'topics', label: 'Topics', icon: Tags, initial: { field: 'topics', op: 'has', value: [] } },
  { field: 'project_id', label: 'Projects', icon: FolderKanban, initial: { field: 'project_id', op: 'is', value: [] } },
  { field: 'area_id', label: 'Areas', icon: Layers, initial: { field: 'area_id', op: 'is', value: [] } },
  { field: 'review', label: 'Reviews', icon: Star, initial: { field: 'review', op: 'gte', value: 4 } },
  { field: 'minutes', label: 'Minutes', icon: Timer, initial: { field: 'minutes', op: 'lt', value: 15 } },
  { field: 'title', label: 'Tên', icon: Type, initial: { field: 'title', op: 'contains', value: '' } },
  { field: 'creator', label: 'Creator', icon: User, initial: { field: 'creator', op: 'contains', value: '' } },
  { field: 'url', label: 'URL', icon: Link2, initial: { field: 'url', op: 'contains', value: '' } },
]
export const filterFieldDef = (f: FilterField) => filterFields.find((x) => x.field === f)!

export function matchFilter(r: Resource, f: Filter): boolean {
  switch (f.field) {
    case 'title':
    case 'creator':
    case 'url': {
      const v = r[f.field] ?? ''
      if (f.op === 'empty') return !v.trim()
      if (f.op === 'not_empty') return !!v.trim()
      return !f.value.trim() || normalizeSearch(v).includes(normalizeSearch(f.value.trim()))
    }
    case 'kind':
      if (!f.value.length) return true
      return f.op === 'is' ? f.value.includes(r.kind) : !f.value.includes(r.kind)
    case 'area_id':
    case 'project_id': {
      const v = r[f.field]
      if (f.op === 'empty') return !v
      if (f.op === 'not_empty') return !!v
      return !f.value.length || (!!v && f.value.includes(v))
    }
    case 'topics':
      if (f.op === 'empty') return r.topics.length === 0
      if (f.op === 'not_empty') return r.topics.length > 0
      return !f.value.length || f.value.some((t) => r.topics.includes(t))
    case 'review':
      if (f.op === 'empty') return r.review == null
      return r.review != null && (f.op === 'gte' ? r.review >= f.value : r.review === f.value)
    case 'minutes':
      if (f.op === 'empty') return r.minutes == null
      return r.minutes != null && (f.op === 'gt' ? r.minutes > f.value : r.minutes < f.value)
    case 'finished':
      return r.finished === f.value
  }
}

/** Tài nguyên tạo trong view này nhận luôn giá trị của bộ lọc (vd đang ở Videos → Loại = Video) */
export function defaultsFromFilters(filters: Filter[]): ResourceDraft {
  const d: ResourceDraft = {}
  for (const f of filters) {
    if (f.field === 'kind' && f.op === 'is' && f.value.length === 1) d.kind = f.value[0]
    if (f.field === 'finished') d.finished = f.value
    if ((f.field === 'area_id' || f.field === 'project_id') && f.op === 'is' && f.value.length === 1) d[f.field] = f.value[0]
    if (f.field === 'topics' && f.op === 'has' && f.value.length === 1) d.topics = [f.value[0]]
  }
  return d
}

// ---------------------------------------------------------------------------
// Nhóm
// ---------------------------------------------------------------------------
export type GroupKey = 'kind' | 'topics' | 'area_id' | 'project_id' | 'review' | 'finished' | 'creator'
export const groupFields: Array<{ value: GroupKey; label: string; icon: LucideIcon }> = [
  { value: 'kind', label: 'Loại', icon: CircleDot },
  { value: 'topics', label: 'Topics', icon: Tags },
  { value: 'project_id', label: 'Projects', icon: FolderKanban },
  { value: 'area_id', label: 'Areas', icon: Layers },
  { value: 'review', label: 'Reviews', icon: Star },
  { value: 'finished', label: 'Xong', icon: CheckSquare },
  { value: 'creator', label: 'Creator', icon: User },
]

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------
export type Layout = 'table' | 'gallery'
export type ViewIcon = 'video' | 'book' | 'article' | 'course' | 'music' | 'topics' | 'unfinished' | 'all' | 'star' | 'hash'
export const viewIcons: Record<ViewIcon, LucideIcon> = {
  video: Video,
  book: BookOpen,
  article: FileText,
  course: GraduationCap,
  music: Music,
  topics: Tags,
  unfinished: CheckSquare,
  all: List,
  star: Star,
  hash: Hash,
}

export type ViewCfg = {
  name: string
  icon: ViewIcon
  layout: Layout
  cols: ColKey[]
  sorts: Sort[]
  filters: Filter[]
  group: GroupKey | null
  /** Nhóm đang thu gọn */
  collapsed?: string[]
}

const baseCols: ColKey[] = ['creator', 'project_id', 'area_id', 'topics', 'url', 'review', 'minutes']
const newest: Sort[] = [{ field: 'created_at', direction: 'desc' }]
const kindView = (kind: ResourceKind, icon: ViewIcon, name: string, sorts: Sort[] = newest): ViewCfg => ({
  name,
  icon,
  layout: 'table',
  cols: baseCols,
  sorts,
  filters: [{ field: 'kind', op: 'is', value: [kind] }],
  group: null,
})

/** 8 view giống bảng Notion "All Resources" */
export const builtinViews: Record<string, ViewCfg> = {
  videos: kindView('video', 'video', 'Videos', [{ field: 'minutes', direction: 'asc' }]),
  books: kindView('book', 'book', 'Books'),
  articles: kindView('article', 'article', 'Article/News/Post'),
  courses: kindView('course', 'course', 'Course'),
  music: kindView('music', 'music', 'Music'),
  topics: { name: 'Topics', icon: 'topics', layout: 'table', cols: ['kind', 'creator', 'url', 'review', 'minutes'], sorts: newest, filters: [], group: 'topics' },
  unfinished: {
    name: 'not yet finished',
    icon: 'unfinished',
    layout: 'table',
    cols: ['kind', 'creator', 'topics', 'url', 'minutes'],
    sorts: [{ field: 'minutes', direction: 'asc' }],
    filters: [{ field: 'finished', op: 'is', value: false }],
    group: null,
  },
  all: { name: 'All Resources', icon: 'all', layout: 'table', cols: ['kind', ...baseCols, 'finished'], sorts: newest, filters: [], group: null },
}
export const builtinOrder = ['videos', 'books', 'articles', 'courses', 'music', 'topics', 'unfinished', 'all']

export type ResourcesPref = { active: string; order: string[]; views: Record<string, ViewCfg> }
export const defaultPref: ResourcesPref = { active: 'videos', order: builtinOrder, views: {} }

/** Cấu hình view: bản đã lưu, không có thì mặc định */
export function viewCfg(pref: ResourcesPref, id: string): ViewCfg {
  return pref.views[id] ?? builtinViews[id] ?? builtinViews.all
}

/** View mặc định đã bị chỉnh chưa (bỏ qua việc thu gọn nhóm) */
export function isCustomized(pref: ResourcesPref, id: string) {
  const saved = pref.views[id]
  const base = builtinViews[id]
  if (!saved || !base) return false
  const strip = (v: ViewCfg) => JSON.stringify({ ...v, collapsed: undefined })
  return strip(saved) !== strip(base)
}
