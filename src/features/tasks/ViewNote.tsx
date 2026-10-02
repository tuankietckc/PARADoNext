import { useState } from 'react'
import { Info, Pencil } from 'lucide-react'
import type { GroupBy, SavedView, TaskFilter, TaskSort } from '../../lib/taskViewTypes'
import { groupLabel } from './grouping'
import { useParaList } from '../para/usePara'
import { dateChoiceKey, dateChoices, fieldDef, selectedValues, sortDef } from './filterConfig'
import { isEmptyFilter } from '../../lib/taskViewQuery'
import { useUpdateViewDescription } from './useSavedViewMutations'
import { cx } from '../../components/ui'

/**
 * Câu mô tả tự sinh từ bộ lọc + sắp xếp, vd:
 * "Task chưa xong · hạn hôm nay · quan trọng: Cao — sắp theo quan trọng (cao → thấp)."
 * Luôn khớp với dữ liệu đang hiện, kể cả khi đang chỉnh chưa lưu.
 */
export function useViewSummary(filters: TaskFilter[], sorts: TaskSort[], groupBy: GroupBy | null = null): string {
  const { data: projects = [] } = useParaList('projects')
  const { data: areas = [] } = useParaList('areas')

  const parts: string[] = []
  for (const f of filters) {
    if (isEmptyFilter(f)) continue
    const def = fieldDef(f.field)
    if (!def) continue
    const label = def.label.toLowerCase()
    switch (def.kind) {
      case 'boolean':
        parts.push(f.value === true ? 'đã xong' : 'chưa xong')
        break
      case 'date': {
        const key = dateChoiceKey(f)
        if (key === 'is_null') parts.push(`chưa có ${label}`)
        else if (key === 'not_null') parts.push(`có ${label}`)
        else parts.push(`${label} ${(dateChoices.find((c) => c.key === key)?.label ?? '').toLowerCase()}`)
        break
      }
      case 'number':
        parts.push(`${label} ${f.operator === 'gte' ? '≥' : '≤'} ${f.value} phút`)
        break
      case 'select': {
        const values = selectedValues(f).map((v) => def.options?.find((o) => o.value === v)?.label ?? v)
        parts.push(`${label}: ${values.join(', ')}`)
        break
      }
      case 'relation': {
        if (f.operator === 'is_null') {
          parts.push(`chưa gán ${label}`)
          break
        }
        const items = def.relation === 'projects' ? projects : areas
        const names = selectedValues(f).map((id) => items.find((i) => i.id === id)?.name ?? '…')
        parts.push(`${label}: ${names.join(', ')}`)
        break
      }
    }
  }

  const subject = parts.length ? `Task ${parts.join(' · ')}` : 'Tất cả task'
  const order = sorts.length
    ? 'sắp theo ' +
      sorts
        .map((s) => {
          const d = sortDef(s.field)
          if (!d) return s.field
          return `${d.label.toLowerCase()} (${(s.direction === 'asc' ? d.asc : d.desc).toLowerCase()})`
        })
        .join(', rồi ')
    : 'theo thứ tự kéo thả'
  const group = groupBy ? `nhóm theo ${groupLabel(groupBy).toLowerCase()}, ` : ''
  return `${subject} — ${group}${order}.`
}

/** Dòng ghi chú dưới tab: cho biết view đang hiện dữ liệu gì. Bấm bút để sửa. */
export function ViewNote({
  view,
  filters,
  sorts,
  groupBy = null,
  isDirty,
}: {
  view: SavedView
  filters: TaskFilter[]
  sorts: TaskSort[]
  groupBy?: GroupBy | null
  /** Đang chỉnh bộ lọc/sắp xếp chưa lưu → ghi chú có thể không còn đúng, hiện thêm mô tả thực tế */
  isDirty: boolean
}) {
  const summary = useViewSummary(filters, sorts, groupBy)
  const updateNote = useUpdateViewDescription()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const note = view.description?.trim()

  async function save() {
    try {
      await updateNote.mutateAsync({ id: view.id, description: value })
      setEditing(false)
    } catch {
      /* lỗi hiện bên dưới */
    }
  }

  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg bg-surface-2/60 px-3 py-2 text-sm">
      <Info size={15} className="mt-0.5 shrink-0 text-subtle" />
      {editing ? (
        <form
          className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <input
            autoFocus
            value={value}
            maxLength={200}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation()
                setEditing(false)
              }
            }}
            placeholder="View này dùng để làm gì? Để trống = dùng mô tả tự động."
            aria-label="Ghi chú của view"
            className="h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-sm text-fg outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={updateNote.isPending}
            className="h-8 rounded-md bg-accent px-3 text-xs font-medium text-accent-fg hover:bg-accent-hover disabled:opacity-50"
          >
            {updateNote.isPending ? 'Đang lưu…' : 'Lưu'}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="h-8 rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg"
          >
            Huỷ
          </button>
          {updateNote.error && <p className="w-full text-xs text-danger">{updateNote.error.message}</p>}
        </form>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className={cx(note ? 'text-fg' : 'text-muted')}>{note || summary}</p>
            {note && isDirty && <p className="mt-0.5 text-xs text-subtle">Đang chỉnh (chưa lưu): {summary}</p>}
          </div>
          <button
            type="button"
            onClick={() => {
              setValue(note ?? '')
              updateNote.reset()
              setEditing(true)
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-subtle transition-colors hover:bg-surface hover:text-fg"
            title={note ? 'Sửa ghi chú' : 'Thêm ghi chú'}
          >
            <Pencil size={12} /> {note ? 'Sửa' : 'Thêm ghi chú'}
          </button>
        </>
      )}
    </div>
  )
}
