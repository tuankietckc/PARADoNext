import { useState, type ReactNode } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronRight, EyeOff, Plus, Type, type LucideIcon } from 'lucide-react'
import { AnchoredPopover, usePopoverAnchor } from '../../components/Popover'
import { SelectBox, Tag, cx } from '../../components/ui'
import { ParaIcon } from '../para/ParaIcon'
import { topicClass } from '../notes/topics'
import { ResourceCell, TitleCell } from './ResourceCells'
import { colDef, colSortField, formatMinutes, type ColKey, type Sort, type SortField } from './resourceFields'
import { menuItem } from './ResourceToolbar'
import type { ResGroup } from './grouping'
import type { Resource, ResourceDraft } from './useResources'

export type TableProps = {
  rows: Resource[]
  groups: ResGroup[] | null
  collapsed: string[]
  onToggleGroup: (key: string) => void
  cols: ColKey[]
  sorts: Sort[]
  onCols: (c: ColKey[]) => void
  onSort: (f: SortField, d: 'asc' | 'desc') => void
  onPatch: (r: Resource, patch: ResourceDraft) => void
  onOpen: (r: Resource) => void
  onCreate: (text: string, patch: ResourceDraft) => Promise<unknown>
  selected: Set<string>
  onSelect: (id: string, shift: boolean) => void
  onSelectAll: () => void
}

/** Tiêu đề nhóm (dùng cho cả bảng và thẻ) */
export function GroupLabel({ g }: { g: ResGroup }) {
  if (g.kind === 'relation-areas' || g.kind === 'relation-projects')
    return (
      <span className="inline-flex min-w-0 items-center gap-1.5 font-medium text-fg">
        <ParaIcon icon={g.icon} kind={g.kind === 'relation-areas' ? 'areas' : 'projects'} size={15} /> <span className="truncate">{g.label}</span>
      </span>
    )
  if (g.kind === 'tag') return <Tag className={g.className}>{g.label}</Tag>
  if (g.kind === 'topic') return <Tag className={topicClass(g.label)}>{g.label}</Tag>
  if (g.kind === 'none') return <span className="text-muted">{g.label}</span>
  return <span className="font-medium text-fg">{g.label}</span>
}

export function GroupHeaderButton({ g, open, onToggle }: { g: ResGroup; open: boolean; onToggle: () => void }) {
  const total = g.rows.reduce((s, r) => s + (r.minutes ?? 0), 0)
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`Nhóm ${g.label}`} className="flex items-center gap-2 rounded-md py-1 pr-2 text-sm hover:bg-surface-2">
      <ChevronRight size={15} className={cx('shrink-0 text-subtle transition-transform', open && 'rotate-90')} />
      <GroupLabel g={g} />
      <span className="text-xs text-subtle">{g.rows.length}</span>
      {total > 0 && <span className="text-xs text-subtle">· {formatMinutes(total)}{total < 60 ? ' phút' : ''}</span>}
    </button>
  )
}

export function ResourceTable(p: TableProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const titleSort = p.sorts[0]?.field === 'title' ? p.sorts[0].direction : undefined
  const span = p.cols.length + 2
  const allSelected = p.rows.length > 0 && p.rows.every((r) => p.selected.has(r.id))

  const body = (rows: Resource[], patch: ResourceDraft, key: string) => (
    <>
      {rows.map((r) => (
        <tr key={`${key}-${r.id}`} className={cx('group/row border-b border-line', p.selected.has(r.id) ? 'bg-accent-soft/40' : 'hover:bg-surface-2/40')}>
          <td className="w-8 border-r border-line px-0 text-center">
            <span className={cx('grid place-items-center', !p.selected.size && 'opacity-0 focus-within:opacity-100 group-hover/row:opacity-100')}>
              <SelectBox checked={p.selected.has(r.id)} onChange={(e) => p.onSelect(r.id, e.shiftKey)} label={`Chọn ${r.title}`} />
            </span>
          </td>
          <td className="max-w-[300px] border-r border-line p-0">
            <TitleCell r={r} onSave={(title) => p.onPatch(r, { title })} onOpen={() => p.onOpen(r)} />
          </td>
          {p.cols.map((k) => (
            <td key={k} className={cx('max-w-[260px] border-r border-line p-0 last:border-r-0', k === 'minutes' && 'text-right')}>
              <ResourceCell r={r} col={k} onPatch={(patch) => p.onPatch(r, patch)} />
            </td>
          ))}
        </tr>
      ))}
      <tr>
        <td colSpan={span} className="border-b border-line p-0">
          <AddRow patch={patch} onCreate={p.onCreate} />
        </td>
      </tr>
    </>
  )

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="w-8 border-r border-line px-0">
              <span className="grid place-items-center">
                <SelectBox checked={allSelected} indeterminate={!allSelected && p.selected.size > 0} onChange={p.onSelectAll} label="Chọn tất cả" />
              </span>
            </th>
            <th className="min-w-[220px] border-r border-line p-0 text-left text-xs font-normal text-subtle">
              <HeaderMenuButton label="Name" icon={Type} sortDir={titleSort} onSort={(d) => p.onSort('title', d)} />
            </th>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              accessibility={{ container: document.body }}
              onDragEnd={({ active, over }) => {
                if (over && active.id !== over.id) p.onCols(arrayMove(p.cols, p.cols.indexOf(active.id as ColKey), p.cols.indexOf(over.id as ColKey)))
              }}
            >
              <SortableContext items={p.cols} strategy={horizontalListSortingStrategy}>
                {p.cols.map((k, i) => {
                  const sf = colSortField[k]
                  return (
                    <SortableTh
                      key={k}
                      col={k}
                      sortDir={sf ? p.sorts.find((s) => s.field === sf)?.direction : undefined}
                      onSort={sf ? (d) => p.onSort(sf, d) : undefined}
                      onMove={(delta) => p.onCols(arrayMove(p.cols, i, i + delta))}
                      canLeft={i > 0}
                      canRight={i < p.cols.length - 1}
                      onHide={() => p.onCols(p.cols.filter((c) => c !== k))}
                    />
                  )
                })}
              </SortableContext>
            </DndContext>
          </tr>
        </thead>
        {p.groups ? (
          p.groups.map((g) => {
            const open = !p.collapsed.includes(g.key)
            return (
              <tbody key={g.key}>
                <tr className="border-b border-line bg-surface-2/40">
                  <td colSpan={span} className="px-2 py-1">
                    <GroupHeaderButton g={g} open={open} onToggle={() => p.onToggleGroup(g.key)} />
                  </td>
                </tr>
                {open && body(g.rows, g.patch, g.key)}
              </tbody>
            )
          })
        ) : (
          <tbody>{body(p.rows, {}, 'all')}</tbody>
        )}
      </table>
    </div>
  )
}

/** Dòng "+ Mới": gõ tên hoặc dán link rồi Enter */
export function AddRow({ patch, onCreate, className }: { patch: ResourceDraft; onCreate: TableProps['onCreate']; className?: string }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className={cx('flex items-center gap-2 px-3', className)}
      onSubmit={async (e) => {
        e.preventDefault()
        const t = text.trim()
        if (!t || busy) return
        setBusy(true)
        try {
          await onCreate(t, patch)
          setText('')
        } finally {
          setBusy(false)
        }
      }}
    >
      <Plus size={15} className="shrink-0 text-subtle" />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Mới — gõ tên hoặc dán link rồi Enter"
        aria-label="Thêm tài nguyên"
        data-add-resource
        className="h-10 w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
      />
    </form>
  )
}

function HeaderMenuButton({
  label,
  icon: Icon,
  sortDir,
  onSort,
  extra,
  dragProps,
}: {
  label: string
  icon: LucideIcon
  sortDir?: 'asc' | 'desc'
  onSort?: (d: 'asc' | 'desc') => void
  extra?: (close: () => void) => ReactNode
  dragProps?: Record<string, unknown>
}) {
  const pop = usePopoverAnchor()
  return (
    <>
      <button
        type="button"
        {...dragProps}
        onClick={pop.toggle}
        aria-label={`Cột ${label}`}
        className={cx('flex w-full items-center gap-1.5 whitespace-nowrap px-2 py-2 hover:bg-surface-2 hover:text-muted', dragProps && 'cursor-grab touch-none active:cursor-grabbing')}
      >
        <Icon size={13} className="shrink-0" /> {label}
        {sortDir && (sortDir === 'asc' ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />)}
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={200}>
          {onSort && (
            <>
              <button type="button" className={menuItem} onClick={() => { onSort('asc'); pop.close() }}>
                <span className="inline-flex items-center gap-2"><ArrowUp size={14} className="text-muted" /> Sắp xếp tăng dần</span>
              </button>
              <button type="button" className={menuItem} onClick={() => { onSort('desc'); pop.close() }}>
                <span className="inline-flex items-center gap-2"><ArrowDown size={14} className="text-muted" /> Sắp xếp giảm dần</span>
              </button>
            </>
          )}
          {extra?.(pop.close)}
        </AnchoredPopover>
      )}
    </>
  )
}

function SortableTh({
  col,
  sortDir,
  onSort,
  onMove,
  canLeft,
  canRight,
  onHide,
}: {
  col: ColKey
  sortDir?: 'asc' | 'desc'
  onSort?: (d: 'asc' | 'desc') => void
  onMove: (delta: -1 | 1) => void
  canLeft: boolean
  canRight: boolean
  onHide: () => void
}) {
  const def = colDef(col)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col })
  return (
    <th
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform ? { ...transform, y: 0 } : null), transition }}
      className={cx('border-r border-line p-0 text-left text-xs font-normal text-subtle last:border-r-0', def.width, isDragging && 'relative z-10 bg-surface-2 shadow-lg')}
    >
      <HeaderMenuButton
        label={def.label}
        icon={def.icon}
        sortDir={sortDir}
        onSort={onSort}
        dragProps={{ ...attributes, ...listeners }}
        extra={(close) => (
          <>
            {onSort && <div className="my-1 border-t border-line" />}
            {canLeft && (
              <button type="button" className={menuItem} onClick={() => { onMove(-1); close() }}>
                <span className="inline-flex items-center gap-2"><ArrowLeft size={14} className="text-muted" /> Dời sang trái</span>
              </button>
            )}
            {canRight && (
              <button type="button" className={menuItem} onClick={() => { onMove(1); close() }}>
                <span className="inline-flex items-center gap-2"><ArrowRight size={14} className="text-muted" /> Dời sang phải</span>
              </button>
            )}
            <button type="button" className={menuItem} onClick={() => { onHide(); close() }}>
              <span className="inline-flex items-center gap-2"><EyeOff size={14} className="text-muted" /> Ẩn cột</span>
            </button>
          </>
        )}
      />
    </th>
  )
}
