import type { ParaItem } from '../para/usePara'
import { kindOptions, stars, type GroupKey } from './resourceFields'
import type { Resource, ResourceDraft } from './useResources'

export type ResGroup = {
  key: string
  label: string
  /** relation → icon Project/Area · tag → nhãn màu · topic → màu Topic · none → "Chưa có …" */
  kind: 'relation-projects' | 'relation-areas' | 'tag' | 'topic' | 'none' | 'text'
  className?: string
  icon?: string | null
  /** Giá trị gán khi thêm tài nguyên trong nhóm */
  patch: ResourceDraft
  rows: Resource[]
}

const NONE = '__none'

/** Chia tài nguyên thành nhóm (giống Group by của Notion). Topics: 1 tài nguyên có thể nằm ở nhiều nhóm. */
export function buildGroups(rows: Resource[], by: GroupKey, lists: { areas: ParaItem[]; projects: ParaItem[] }): ResGroup[] {
  let groups: ResGroup[] = []
  switch (by) {
    case 'kind':
      groups = kindOptions.map((o) => ({ key: o.value, label: o.plural, kind: 'tag', className: o.className, patch: { kind: o.value }, rows: rows.filter((r) => r.kind === o.value) }))
      break
    case 'topics': {
      const all = [...new Set(rows.flatMap((r) => r.topics))].sort((a, b) => a.localeCompare(b, 'vi'))
      groups = all.map((t) => ({ key: t, label: t, kind: 'topic', patch: { topics: [t] }, rows: rows.filter((r) => r.topics.includes(t)) }))
      groups.push({ key: NONE, label: 'Chưa có Topic', kind: 'none', patch: { topics: [] }, rows: rows.filter((r) => r.topics.length === 0) })
      break
    }
    case 'area_id':
    case 'project_id': {
      const items = by === 'area_id' ? lists.areas : lists.projects
      const known = new Set(items.map((i) => i.id))
      const orphans = [...new Set(rows.map((r) => r[by]).filter((id): id is string => !!id && !known.has(id)))]
      const label = by === 'area_id' ? 'Area' : 'Project'
      groups = [...items, ...orphans.map((id) => ({ id, name: `(${label} đã lưu trữ)`, icon: null }))].map((i) => ({
        key: i.id,
        label: i.name,
        icon: i.icon,
        kind: by === 'area_id' ? 'relation-areas' : 'relation-projects',
        patch: { [by]: i.id },
        rows: rows.filter((r) => r[by] === i.id),
      }))
      groups.push({ key: NONE, label: `Chưa có ${label}`, kind: 'none', patch: { [by]: null }, rows: rows.filter((r) => !r[by]) })
      break
    }
    case 'review':
      groups = [5, 4, 3, 2, 1].map((n) => ({ key: String(n), label: stars(n), kind: 'tag', className: 'bg-yellow-soft text-yellow', patch: { review: n }, rows: rows.filter((r) => r.review === n) }))
      groups.push({ key: NONE, label: 'Chưa đánh giá', kind: 'none', patch: { review: null }, rows: rows.filter((r) => r.review == null) })
      break
    case 'finished':
      groups = [
        { key: 'no', label: 'Chưa xong', kind: 'tag', className: 'bg-surface-2 text-muted', patch: { finished: false }, rows: rows.filter((r) => !r.finished) },
        { key: 'yes', label: 'Đã xong', kind: 'tag', className: 'bg-success-soft text-success', patch: { finished: true }, rows: rows.filter((r) => r.finished) },
      ]
      break
    case 'creator': {
      const names = [...new Set(rows.map((r) => r.creator?.trim()).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'vi'))
      groups = names.map((n) => ({ key: n, label: n, kind: 'text', patch: { creator: n }, rows: rows.filter((r) => r.creator?.trim() === n) }))
      groups.push({ key: NONE, label: 'Chưa có Creator', kind: 'none', patch: { creator: null }, rows: rows.filter((r) => !r.creator?.trim()) })
      break
    }
  }
  // Ẩn nhóm trống cho gọn
  return groups.filter((g) => g.rows.length > 0)
}
