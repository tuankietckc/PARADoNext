import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Columns3,
  Eye,
  EyeOff,
  FolderKanban,
  GripVertical,
  Hash,
  LayoutGrid,
  Layers,
  List,
  ListFilter,
  LoaderCircle,
  NotebookText,
  Plus,
  RotateCcw,
  Search,
  Sigma,
  Trash2,
  Type,
  X,
  type LucideIcon,
} from 'lucide-react'
import { AnchoredPopover, usePopoverAnchor } from '../../components/Popover'
import { Card, Notice, cx } from '../../components/ui'
import { formatDuration, normalizeSearch } from '../tasks/taskFields'
import { ParaIcon } from './ParaIcon'
import { useUiPref } from '../../lib/useUiPref'
import {
  useCreatePara,
  useParaRecords,
  useParaStats,
  useUpdatePara,
  type Area,
  type ParaStats,
  type Project,
} from './useParaAdmin'

// ---------------------------------------------------------------------------
// Dữ liệu 1 dòng = Area + số liệu tính sẵn
// ---------------------------------------------------------------------------
type Row = Area & { projects: number; open: number; done: number; minutes: number; notes: number }

type ColKey = 'projects' | 'open' | 'done' | 'progress' | 'minutes' | 'notes' | 'created_at'
type NumField = 'projects' | 'open' | 'done' | 'minutes' | 'notes'
type SortField = 'name' | NumField | 'created_at'

const columns: Array<{ key: ColKey; label: string; icon: LucideIcon; width: string; sort?: SortField }> = [
  { key: 'projects', label: 'Projects', icon: FolderKanban, width: 'w-28', sort: 'projects' },
  { key: 'open', label: 'Việc đang mở', icon: CircleDashed, width: 'w-32', sort: 'open' },
  { key: 'done', label: 'Đã xong', icon: CheckCircle2, width: 'w-28', sort: 'done' },
  { key: 'progress', label: 'Tiến độ', icon: CheckCircle2, width: 'w-44' },
  { key: 'minutes', label: 'Thời gian', icon: Sigma, width: 'w-28', sort: 'minutes' },
  { key: 'notes', label: 'Ghi chú', icon: NotebookText, width: 'w-28', sort: 'notes' },
  { key: 'created_at', label: 'Ngày tạo', icon: CalendarPlus, width: 'w-32', sort: 'created_at' },
]
const colDef = (k: ColKey) => columns.find((c) => c.key === k)!
const defaultCols: ColKey[] = ['projects', 'open', 'done', 'minutes', 'notes']

const sortFields: Array<{ field: SortField; label: string; asc: string; desc: string }> = [
  { field: 'name', label: 'Tên', asc: 'A → Z', desc: 'Z → A' },
  { field: 'open', label: 'Việc đang mở', asc: 'Ít → nhiều', desc: 'Nhiều → ít' },
  { field: 'done', label: 'Đã xong', asc: 'Ít → nhiều', desc: 'Nhiều → ít' },
  { field: 'minutes', label: 'Thời gian', asc: 'Ít → nhiều', desc: 'Nhiều → ít' },
  { field: 'notes', label: 'Ghi chú', asc: 'Ít → nhiều', desc: 'Nhiều → ít' },
  { field: 'projects', label: 'Projects', asc: 'Ít → nhiều', desc: 'Nhiều → ít' },
  { field: 'created_at', label: 'Ngày tạo', asc: 'Cũ → mới', desc: 'Mới → cũ' },
]
type Sort = { field: SortField; direction: 'asc' | 'desc' }

type Filter =
  | { field: 'name'; value: string }
  | { field: NumField; op: 'gt' | 'eq' | 'lt'; value: number }
const numFilterFields: Array<{ field: NumField; label: string; unit?: string }> = [
  { field: 'open', label: 'Việc đang mở' },
  { field: 'done', label: 'Đã xong' },
  { field: 'minutes', label: 'Thời gian', unit: 'phút' },
  { field: 'notes', label: 'Ghi chú' },
  { field: 'projects', label: 'Projects' },
]
const opLabel = { gt: '>', eq: '=', lt: '<' } as const

type ViewKey = 'active' | 'archived' | 'all'
type Layout = 'table' | 'gallery'
type Config = { view: ViewKey; layout: Layout; cols: ColKey[]; sorts: Sort[]; filters: Filter[] }
const defaultConfig: Config = { view: 'active', layout: 'table', cols: defaultCols, sorts: [{ field: 'name', direction: 'asc' }], filters: [] }

const chip = 'inline-flex h-7 max-w-[260px] items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors'
const chipActive = 'border-transparent bg-accent-soft text-accent hover:brightness-95'
const chipIdle = 'border-line text-muted hover:bg-surface-2 hover:text-fg'
const menuItem = 'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg transition-colors hover:bg-surface-2'
const MenuLabel = ({ children }: { children: ReactNode }) => <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-subtle">{children}</p>

export function AreasPage() {
  const { data: areas, isLoading, error } = useParaRecords('areas')
  const { data: projects = [] } = useParaRecords('projects')
  const { data: stats } = useParaStats('areas')
  const update = useUpdatePara('areas')
  const create = useCreatePara('areas')
  // Cấu hình view đồng bộ giữa các máy (Supabase ui_prefs — migration 0014), có bản sao trên trình duyệt
  const [config, saveConfig] = useUiPref<Config>('areas-view', defaultConfig)
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const setConfig = (patch: Partial<Config>) => saveConfig({ ...config, ...patch })

  const rows: Row[] = useMemo(() => {
    const empty: ParaStats = { open: 0, done: 0, minutes: 0, notes: 0 }
    return ((areas ?? []) as Area[]).map((a) => ({
      ...a,
      ...(stats?.get(a.id) ?? empty),
      projects: (projects as Project[]).filter((p) => p.area_id === a.id && !p.archived).length,
    }))
  }, [areas, stats, projects])

  const shown = useMemo(() => {
    const q = normalizeSearch(query.trim())
    const list = rows
      .filter((r) => (config.view === 'all' ? true : config.view === 'archived' ? r.archived : !r.archived))
      .filter((r) => !q || normalizeSearch(r.name).includes(q))
      .filter((r) =>
        config.filters.every((f) => {
          if (f.field === 'name') return !f.value.trim() || normalizeSearch(r.name).includes(normalizeSearch(f.value))
          const v = r[f.field]
          return f.op === 'gt' ? v > f.value : f.op === 'lt' ? v < f.value : v === f.value
        }),
      )
    return [...list].sort((a, b) => {
      for (const s of config.sorts) {
        const av = a[s.field]
        const bv = b[s.field]
        const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'vi')
        if (c) return s.direction === 'asc' ? c : -c
      }
      return 0
    })
  }, [rows, query, config])

  async function add() {
    const n = name.trim()
    if (!n) return
    setCreateError(null)
    try {
      await create.mutateAsync({ name: n })
      setName('')
    } catch (err) {
      setCreateError((err as Error).message)
    }
  }

  const count = (v: ViewKey) => rows.filter((r) => (v === 'all' ? true : v === 'archived' ? r.archived : !r.archived)).length
  const isDefault = JSON.stringify({ ...config, view: 'active', layout: 'table' }) === JSON.stringify(defaultConfig)

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-fg">
          <Layers size={22} className="text-accent" /> Areas
        </h1>
        <p className="mt-1.5 text-sm text-muted">Lĩnh vực trách nhiệm lâu dài (Career, Health, Finance…). Bấm tên để xem mọi thứ thuộc về nó.</p>
      </header>

      {/* Tab view */}
      <div className="mb-3 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--border)]">
        <div className="flex w-max gap-1" role="tablist" aria-label="View Areas">
          {(
            [
              ['active', 'Đang dùng', Layers],
              ['archived', 'Lưu trữ', Archive],
              ['all', 'Tất cả', List],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={config.view === key}
              onClick={() => setConfig({ view: key })}
              className={cx(
                'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors',
                config.view === key ? 'border-accent font-medium text-fg' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              <Icon size={14} /> {label} <span className="text-xs text-subtle">{count(key)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Thanh công cụ */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <LayoutChip value={config.layout} onChange={(layout) => setConfig({ layout })} />
        {config.layout === 'table' && <ColumnsChip value={config.cols} onChange={(cols) => setConfig({ cols })} />}
        <SortChip value={config.sorts} onChange={(sorts) => setConfig({ sorts })} />
        <span className="mx-1 h-4 w-px bg-line" aria-hidden />
        {config.filters.length === 0 && (
          <span className="inline-flex items-center gap-1.5 px-1 text-xs text-subtle">
            <ListFilter size={13} /> Không lọc
          </span>
        )}
        {config.filters.map((f, i) => (
          <FilterChip
            key={i}
            filter={f}
            onChange={(next) => setConfig({ filters: config.filters.map((x, j) => (j === i ? next : x)) })}
            onRemove={() => setConfig({ filters: config.filters.filter((_, j) => j !== i) })}
          />
        ))}
        <AddFilter onAdd={(f) => setConfig({ filters: [...config.filters, f] })} />
        {!isDefault && (
          <button type="button" onClick={() => setConfig({ ...defaultConfig, view: config.view, layout: config.layout })} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg">
            <RotateCcw size={12} /> Đặt lại
          </button>
        )}
        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="flex h-8 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-sm focus-within:border-accent sm:w-52 sm:flex-none">
            <Search size={14} className="shrink-0 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm Area…" aria-label="Tìm Area" className="w-full bg-transparent text-fg outline-none placeholder:text-subtle" />
          </label>
          <form
            className="flex h-8 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 focus-within:border-accent sm:w-56 sm:flex-none"
            onSubmit={(e) => {
              e.preventDefault()
              void add()
            }}
          >
            <Plus size={14} className="shrink-0 text-accent" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Area mới… (Enter)" aria-label="Tên Area mới" className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle" />
          </form>
        </div>
      </div>

      {createError && <div className="mb-3"><Notice tone="danger">{createError}</Notice></div>}
      {error && <Notice tone="danger">{(error as Error).message}</Notice>}
      {isLoading && (
        <div className="grid place-items-center py-14">
          <LoaderCircle size={20} className="animate-spin text-subtle" />
        </div>
      )}

      {areas && shown.length === 0 && (
        <Card className="px-4 py-10 text-center text-sm text-subtle">
          {query || config.filters.length ? 'Không có Area nào khớp.' : config.view === 'archived' ? 'Chưa có Area nào được lưu trữ.' : 'Chưa có Area nào — gõ tên ở ô "Area mới" rồi Enter.'}
        </Card>
      )}

      {shown.length > 0 &&
        (config.layout === 'gallery' ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
            {shown.map((r) => (
              <AreaCard key={r.id} r={r} onArchive={() => update.mutate({ id: r.id, patch: { archived: !r.archived } })} />
            ))}
          </div>
        ) : (
          <AreaTable
            rows={shown}
            cols={config.cols}
            sorts={config.sorts}
            onCols={(cols) => setConfig({ cols })}
            onSort={(field, direction) => setConfig({ sorts: [{ field, direction }, ...config.sorts.filter((s) => s.field !== field)] })}
            onArchive={(r) => update.mutate({ id: r.id, patch: { archived: !r.archived } })}
          />
        ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bảng: kéo tiêu đề cột để đổi chỗ, bấm tiêu đề để sắp xếp / dời / ẩn
// ---------------------------------------------------------------------------
function AreaTable({
  rows,
  cols,
  sorts,
  onCols,
  onSort,
  onArchive,
}: {
  rows: Row[]
  cols: ColKey[]
  sorts: Sort[]
  onCols: (c: ColKey[]) => void
  onSort: (f: SortField, d: 'asc' | 'desc') => void
  onArchive: (r: Row) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const nameSort = sorts[0]?.field === 'name' ? sorts[0].direction : undefined
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="min-w-[240px] border-r border-line p-0 text-left text-xs font-normal text-subtle">
                <HeaderMenuButton label="Tên" icon={Type} sortDir={nameSort} onSort={(d) => onSort('name', d)} />
              </th>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                accessibility={{ container: document.body }}
                onDragEnd={({ active, over }) => {
                  if (over && active.id !== over.id) onCols(arrayMove(cols, cols.indexOf(active.id as ColKey), cols.indexOf(over.id as ColKey)))
                }}
              >
                <SortableContext items={cols} strategy={horizontalListSortingStrategy}>
                  {cols.map((k, i) => (
                    <SortableTh
                      key={k}
                      col={k}
                      sortDir={sorts.find((s) => s.field === colDef(k).sort)?.direction}
                      onSort={colDef(k).sort ? (d) => onSort(colDef(k).sort!, d) : undefined}
                      onMove={i > 0 || i < cols.length - 1 ? (delta) => onCols(arrayMove(cols, i, i + delta)) : undefined}
                      canLeft={i > 0}
                      canRight={i < cols.length - 1}
                      onHide={() => onCols(cols.filter((c) => c !== k))}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              <th className="w-12" aria-label="Thao tác" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="group/row border-b border-line last:border-b-0 hover:bg-surface-2/40">
                <td className="border-r border-line p-0">
                  <Link to={`/areas/${r.id}`} className={cx('flex min-h-11 items-center gap-2 px-3 font-medium hover:text-accent', r.archived ? 'text-muted' : 'text-fg')}>
                    <ParaIcon icon={r.icon} kind="areas" size={16} /> {r.name}
                  </Link>
                </td>
                {cols.map((k) => (
                  <td key={k} className="border-r border-line px-3 tabular-nums last:border-r-0">
                    <Cell r={r} col={k} />
                  </td>
                ))}
                <td className="px-2 text-right">
                  <button
                    type="button"
                    onClick={() => onArchive(r)}
                    aria-label={r.archived ? `Khôi phục ${r.name}` : `Lưu trữ ${r.name}`}
                    title={r.archived ? 'Khôi phục' : 'Lưu trữ'}
                    className="inline-grid size-7 place-items-center rounded-md text-subtle opacity-60 hover:bg-surface-2 hover:text-fg group-hover/row:opacity-100"
                  >
                    {r.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Cell({ r, col }: { r: Row; col: ColKey }) {
  const muted = 'text-subtle'
  switch (col) {
    case 'projects':
      return <span className={r.projects ? 'text-fg' : muted}>{r.projects}</span>
    case 'open':
      return <span className={r.open ? 'font-medium text-fg' : muted}>{r.open}</span>
    case 'done':
      return <span className={r.done ? 'text-muted' : muted}>{r.done}</span>
    case 'progress': {
      const total = r.open + r.done
      return total ? (
        <span className="flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-success" style={{ width: `${(r.done / total) * 100}%` }} />
          </span>
          <span className="text-xs text-muted">{Math.round((r.done / total) * 100)}%</span>
        </span>
      ) : (
        <span className={muted}>—</span>
      )
    }
    case 'minutes':
      return <span className={r.minutes ? 'text-muted' : muted}>{r.minutes ? formatDuration(r.minutes, true) : '—'}</span>
    case 'notes':
      return <span className={r.notes ? 'text-muted' : muted}>{r.notes || '—'}</span>
    case 'created_at':
      return <span className="text-muted">{r.created_at && !isNaN(Date.parse(r.created_at)) ? format(new Date(r.created_at), 'dd/MM/yyyy') : '—'}</span>
  }
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
        className={cx(
          'flex w-full items-center gap-1.5 px-2 py-2 hover:bg-surface-2 hover:text-muted',
          dragProps && 'cursor-grab touch-none active:cursor-grabbing',
        )}
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
  onMove?: (delta: -1 | 1) => void
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
      className={cx('whitespace-nowrap border-r border-line p-0 text-left text-xs font-normal text-subtle', def.width, isDragging && 'relative z-10 bg-surface-2 shadow-lg')}
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
            {canLeft && onMove && (
              <button type="button" className={menuItem} onClick={() => { onMove(-1); close() }}>
                <span className="inline-flex items-center gap-2"><ArrowLeft size={14} className="text-muted" /> Dời sang trái</span>
              </button>
            )}
            {canRight && onMove && (
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

// ---------------------------------------------------------------------------
// Thẻ (gallery)
// ---------------------------------------------------------------------------
function AreaCard({ r, onArchive }: { r: Row; onArchive: () => void }) {
  const total = r.open + r.done
  return (
    <div className="group/card relative rounded-xl border border-line bg-surface p-4 shadow-sm transition-colors hover:border-line-strong">
      <Link to={`/areas/${r.id}`} className="flex items-center gap-2 pr-8">
        <ParaIcon icon={r.icon} kind="areas" size={20} />
        <span className={cx('font-semibold', r.archived ? 'text-muted' : 'text-fg')}>{r.name}</span>
      </Link>
      <button
        type="button"
        onClick={onArchive}
        aria-label={r.archived ? `Khôi phục ${r.name}` : `Lưu trữ ${r.name}`}
        className="absolute right-2 top-2 grid size-7 place-items-center rounded-md text-subtle opacity-0 hover:bg-surface-2 hover:text-fg group-hover/card:opacity-100"
      >
        {r.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
      </button>
      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span><b className="font-semibold text-fg">{r.open}</b> việc mở</span>
        <span><b className="font-semibold text-fg">{r.projects}</b> project</span>
        <span><b className="font-semibold text-fg">{r.notes}</b> ghi chú</span>
        {r.minutes > 0 && <span>{formatDuration(r.minutes, true)}</span>}
      </p>
      {total > 0 && (
        <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-2">
          <span className="block h-full rounded-full bg-success" style={{ width: `${(r.done / total) * 100}%` }} />
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chip thanh công cụ
// ---------------------------------------------------------------------------
function LayoutChip({ value, onChange }: { value: Layout; onChange: (v: Layout) => void }) {
  const pop = usePopoverAnchor()
  const Icon = value === 'table' ? List : LayoutGrid
  return (
    <>
      <button type="button" onClick={pop.toggle} aria-label="Bố cục" className={cx(chip, chipIdle)}>
        <Icon size={13} /> {value === 'table' ? 'Bảng' : 'Thẻ'} <ChevronDown size={12} />
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={180}>
          <MenuLabel>Bố cục</MenuLabel>
          {(
            [
              ['table', 'Bảng', List],
              ['gallery', 'Thẻ', LayoutGrid],
            ] as const
          ).map(([k, label, I]) => (
            <button key={k} type="button" className={menuItem} onClick={() => { onChange(k); pop.close() }}>
              <span className="inline-flex items-center gap-2"><I size={14} className="text-muted" /> {label}</span>
              {value === k && <CheckCircle2 size={14} className="text-muted" />}
            </button>
          ))}
        </AnchoredPopover>
      )}
    </>
  )
}

function ColumnsChip({ value, onChange }: { value: ColKey[]; onChange: (v: ColKey[]) => void }) {
  const pop = usePopoverAnchor()
  const hidden = columns.filter((c) => !value.includes(c.key))
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const isDefault = value.join() === defaultCols.join()
  return (
    <>
      <button type="button" onClick={pop.toggle} aria-label="Cột" className={cx(chip, chipIdle)}>
        <Columns3 size={13} /> {isDefault ? 'Cột' : `Cột · ${value.length + 1} hiện`} <ChevronDown size={12} />
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={240}>
          <MenuLabel>Đang hiện · kéo để đổi thứ tự</MenuLabel>
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-subtle">
            <span className="w-3.5" /> <span className="flex-1">Tên</span> <span className="text-[11px]">luôn hiện</span>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={({ active, over }) => {
              if (over && active.id !== over.id) onChange(arrayMove(value, value.indexOf(active.id as ColKey), value.indexOf(over.id as ColKey)))
            }}
          >
            <SortableContext items={value} strategy={verticalListSortingStrategy}>
              {value.map((k) => (
                <ColumnRow key={k} col={k} onHide={() => onChange(value.filter((c) => c !== k))} />
              ))}
            </SortableContext>
          </DndContext>
          {hidden.length > 0 && (
            <>
              <div className="my-1 border-t border-line" />
              <MenuLabel>Đang ẩn</MenuLabel>
              {hidden.map((c) => (
                <button key={c.key} type="button" className={cx(menuItem, 'text-muted')} onClick={() => onChange([...value, c.key])} aria-label={`Hiện cột ${c.label}`}>
                  <span className="inline-flex items-center gap-2"><c.icon size={14} /> {c.label}</span>
                  <EyeOff size={14} className="text-subtle" />
                </button>
              ))}
            </>
          )}
          {!isDefault && (
            <>
              <div className="my-1 border-t border-line" />
              <button type="button" className={cx(menuItem, 'text-muted')} onClick={() => onChange(defaultCols)}>
                <span className="inline-flex items-center gap-2"><RotateCcw size={13} /> Về mặc định</span>
              </button>
            </>
          )}
        </AnchoredPopover>
      )}
    </>
  )
}

function ColumnRow({ col, onHide }: { col: ColKey; onHide: () => void }) {
  const def = colDef(col)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: col })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cx('flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg', isDragging ? 'relative z-10 bg-surface-2 shadow-md' : 'hover:bg-surface-2')}>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Kéo cột ${def.label}`} className="cursor-grab touch-none text-subtle hover:text-fg">
        <GripVertical size={14} />
      </button>
      <def.icon size={14} className="text-muted" />
      <span className="flex-1">{def.label}</span>
      <button type="button" onClick={onHide} aria-label={`Ẩn cột ${def.label}`} className="rounded p-0.5 text-muted hover:text-fg">
        <Eye size={14} />
      </button>
    </div>
  )
}

function SortChip({ value, onChange }: { value: Sort[]; onChange: (v: Sort[]) => void }) {
  const pop = usePopoverAnchor()
  const first = value[0]
  const def = first && sortFields.find((s) => s.field === first.field)
  const label = def ? `${def.label}: ${first.direction === 'asc' ? def.asc : def.desc}${value.length > 1 ? ` +${value.length - 1}` : ''}` : 'Sắp xếp'
  return (
    <>
      <button type="button" onClick={pop.toggle} aria-label="Sắp xếp" className={cx(chip, value.length ? chipActive : chipIdle)}>
        <ArrowDownUp size={13} /> <span className="truncate">{label}</span> <ChevronDown size={12} />
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={300}>
          <MenuLabel>Sắp xếp (ưu tiên từ trên xuống)</MenuLabel>
          {value.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 px-1 py-1">
              <select
                value={s.field}
                aria-label="Trường sắp xếp"
                onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, field: e.target.value as SortField } : x)))}
                className="h-8 flex-1 rounded-md border border-line bg-surface px-1.5 text-sm text-fg"
              >
                {sortFields.map((f) => (
                  <option key={f.field} value={f.field}>{f.label}</option>
                ))}
              </select>
              <select
                value={s.direction}
                aria-label="Chiều sắp xếp"
                onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, direction: e.target.value as 'asc' | 'desc' } : x)))}
                className="h-8 w-28 rounded-md border border-line bg-surface px-1.5 text-sm text-fg"
              >
                <option value="asc">{sortFields.find((f) => f.field === s.field)?.asc}</option>
                <option value="desc">{sortFields.find((f) => f.field === s.field)?.desc}</option>
              </select>
              <button type="button" aria-label="Bỏ sắp xếp này" onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-danger">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button type="button" className={cx(menuItem, 'justify-start text-muted')} onClick={() => onChange([...value, { field: sortFields.find((f) => !value.some((v) => v.field === f.field))?.field ?? 'name', direction: 'desc' }])}>
            <Plus size={14} /> Thêm mức sắp xếp
          </button>
        </AnchoredPopover>
      )}
    </>
  )
}

function filterText(f: Filter) {
  if (f.field === 'name') return `Tên chứa: ${f.value || '…'}`
  const def = numFilterFields.find((x) => x.field === f.field)!
  return `${def.label} ${opLabel[f.op]} ${f.value}${def.unit ? ' ' + def.unit : ''}`
}

function FilterChip({ filter, onChange, onRemove }: { filter: Filter; onChange: (f: Filter) => void; onRemove: () => void }) {
  const pop = usePopoverAnchor()
  return (
    <>
      <span className={cx(chip, chipActive, 'pr-1')}>
        <button type="button" onClick={pop.toggle} className="truncate">{filterText(filter)}</button>
        <button type="button" aria-label="Bỏ bộ lọc" onClick={onRemove} className="grid size-5 place-items-center rounded-full hover:bg-accent/15">
          <X size={11} />
        </button>
      </span>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={250}>
          <div className="space-y-2 p-1.5">
            {filter.field === 'name' ? (
              <input autoFocus value={filter.value} onChange={(e) => onChange({ ...filter, value: e.target.value })} placeholder="Tên chứa…" aria-label="Giá trị lọc" className="h-8 w-full rounded-md border border-line bg-surface px-2 text-sm text-fg outline-none focus:border-accent" />
            ) : (
              <div className="flex gap-1.5">
                <select value={filter.op} aria-label="Điều kiện" onChange={(e) => onChange({ ...filter, op: e.target.value as 'gt' | 'eq' | 'lt' })} className="h-8 w-16 rounded-md border border-line bg-surface px-1 text-sm text-fg">
                  <option value="gt">&gt;</option>
                  <option value="eq">=</option>
                  <option value="lt">&lt;</option>
                </select>
                <input autoFocus type="number" min={0} value={filter.value} onChange={(e) => onChange({ ...filter, value: Number(e.target.value) || 0 })} aria-label="Giá trị lọc" className="h-8 flex-1 rounded-md border border-line bg-surface px-2 text-sm text-fg outline-none focus:border-accent" />
              </div>
            )}
          </div>
        </AnchoredPopover>
      )}
    </>
  )
}

function AddFilter({ onAdd }: { onAdd: (f: Filter) => void }) {
  const pop = usePopoverAnchor()
  const pick = (f: Filter) => {
    onAdd(f)
    pop.close()
  }
  return (
    <>
      <button type="button" onClick={pop.toggle} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg">
        <Plus size={13} /> Bộ lọc
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={230}>
          <MenuLabel>Lọc theo</MenuLabel>
          <button type="button" className={menuItem} onClick={() => pick({ field: 'name', value: '' })}>
            <span className="inline-flex items-center gap-2"><Hash size={14} className="text-muted" /> Tên</span>
          </button>
          {numFilterFields.map((f) => (
            <button key={f.field} type="button" className={menuItem} onClick={() => pick({ field: f.field, op: 'gt', value: 0 })}>
              <span className="inline-flex items-center gap-2"><ListFilter size={14} className="text-muted" /> {f.label}</span>
            </button>
          ))}
        </AnchoredPopover>
      )}
    </>
  )
}
