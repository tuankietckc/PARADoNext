import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { isBefore, startOfDay } from 'date-fns'
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CircleDot,
  FolderKanban,
  LayoutGrid,
  Layers,
  List,
  LoaderCircle,
  Plus,
  Search,
  Siren,
  Star,
} from 'lucide-react'
import { Button, Card, Notice, cx } from '../../components/ui'
import { RelationCell, RelationValue } from '../tasks/cells'
import { formatDay, formatDuration, normalizeSearch } from '../tasks/taskFields'
import { StatusCell, StatusTag, projectStatus, setStatusPatch, toggleStatusPatch } from './projectStatus'
import { ParaIcon } from './ParaIcon'
import { useUiPref } from '../../lib/useUiPref'
import { useParaList } from './usePara'
import {
  useCreatePara,
  useParaRecords,
  useParaStats,
  useUpdatePara,
  type ParaStats,
  type Project,
} from './useParaAdmin'

// Các view giống bảng Projects trong Notion
type ViewKey = 'uncompleted' | 'overdue' | 'by_area' | 'fav' | 'finished' | 'archive' | 'all'
type Layout = 'gallery' | 'table'

const isOverdue = (p: Project) => !!p.due_at && !p.completed && isBefore(new Date(p.due_at), startOfDay(new Date()))

const views: Array<{ key: ViewKey; label: string; icon: typeof Star; match: (p: Project) => boolean; hint: string }> = [
  { key: 'uncompleted', label: 'Uncompleted Projects', icon: CircleDashed, match: (p) => !p.archived && !p.completed, hint: 'Project chưa xong.' },
  { key: 'overdue', label: 'OVERDUE', icon: Siren, match: (p) => !p.archived && isOverdue(p), hint: 'Project chưa xong đã qua hạn.' },
  { key: 'by_area', label: 'Project by Areas', icon: Layers, match: (p) => !p.archived && !p.completed, hint: 'Project chưa xong, nhóm theo Area.' },
  { key: 'fav', label: 'Fav', icon: Star, match: (p) => !p.archived && p.is_favorite, hint: 'Project yêu thích.' },
  { key: 'finished', label: 'Finished', icon: CheckCircle2, match: (p) => !p.archived && p.completed, hint: 'Project đã hoàn thành.' },
  { key: 'archive', label: 'Archive', icon: Archive, match: (p) => p.archived, hint: 'Project đã lưu trữ.' },
  { key: 'all', label: 'All Projects', icon: FolderKanban, match: () => true, hint: 'Tất cả Project, kể cả đã lưu trữ.' },
]

const empty: ParaStats = { open: 0, done: 0, minutes: 0, notes: 0 }

const defaultPref: { view: ViewKey; layout: Layout } = { view: 'uncompleted', layout: 'gallery' }

export function ProjectsPage() {
  const { data: records, isLoading, error } = useParaRecords('projects')
  const { data: stats } = useParaStats('projects')
  const { data: areas = [] } = useParaList('areas')
  const update = useUpdatePara('projects')
  const create = useCreatePara('projects')
  const navigate = useNavigate()
  // View + bố cục đang chọn — đồng bộ giữa các máy (Supabase ui_prefs, migration 0014)
  const [pref, savePref] = useUiPref('projects-view', defaultPref)
  const viewKey = pref.view
  const layout = pref.layout
  const setViewKey = (view: ViewKey) => savePref({ ...pref, view })
  const setLayout = (l: Layout) => savePref({ ...pref, layout: l })
  const [query, setQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [createError, setCreateError] = useState<string | null>(null)
  const view = views.find((v) => v.key === viewKey) ?? views[0]
  const projects = (records ?? []) as Project[]

  const shown = useMemo(() => {
    const q = normalizeSearch(query.trim())
    return projects
      .filter(view.match)
      .filter((p) => !q || normalizeSearch(p.name).includes(q))
      .sort((a, b) =>
        viewKey === 'overdue'
          ? (a.due_at ?? '').localeCompare(b.due_at ?? '')
          : Number(b.is_favorite) - Number(a.is_favorite) || a.name.localeCompare(b.name, 'vi'),
      )
  }, [projects, view, viewKey, query])

  // Nhóm theo Area (view "Project by Areas"): đủ mọi Area, "Chưa có Area" cuối
  const groups = useMemo(() => {
    if (viewKey !== 'by_area') return [{ key: 'all', label: '', areaId: null as string | null, items: shown }]
    const g = areas.map((a) => ({ key: a.id, label: a.name, areaId: a.id as string | null, items: shown.filter((p) => p.area_id === a.id) }))
    const known = new Set(areas.map((a) => a.id))
    g.push({ key: '__none', label: 'Chưa có Area', areaId: null, items: shown.filter((p) => !p.area_id || !known.has(p.area_id)) })
    return g
  }, [viewKey, areas, shown])

  async function createProject(name: string, areaId: string | null) {
    setCreateError(null)
    try {
      const created = await create.mutateAsync({ name, area_id: areaId })
      // Tạo từ view Fav / Finished → mang luôn thuộc tính của view để thẻ hiện ngay tại đó
      if (viewKey === 'fav') update.mutate({ id: created.id, patch: setStatusPatch('fav') })
      if (viewKey === 'finished') update.mutate({ id: created.id, patch: setStatusPatch('completed') })
      return created
    } catch (err) {
      setCreateError((err as Error).message)
      return null
    }
  }

  const count = (k: ViewKey) => projects.filter(views.find((v) => v.key === k)!.match).length
  const patch = (p: Project, next: Partial<Project>) => update.mutate({ id: p.id, patch: next })

  return (
    <div className="mx-auto max-w-[1760px] px-4 py-8 sm:px-6">
      <header className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-fg">
            <FolderKanban size={22} className="text-accent" /> Projects
          </h1>
          <p className="mt-1.5 text-sm text-muted">Việc có đích đến và hạn chót. Bấm vào 1 Project để xem task, ghi chú, thời gian đã làm.</p>
        </div>
        <Button
          className="shrink-0 px-3"
          onClick={async () => {
            const p = await createProject('Project mới', null)
            if (p) navigate(`/projects/${p.id}?new=1`)
          }}
        >
          <Plus size={16} /> Mới
        </Button>
      </header>

      {/* Tab view */}
      <div className="mb-3 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--border)]">
        <div className="flex w-max gap-1" role="tablist" aria-label="View Projects">
          {views.map((v) => {
            const Icon = v.icon
            const active = v.key === viewKey
            return (
              <button
                key={v.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setViewKey(v.key)}
                className={cx(
                  'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors',
                  active ? 'border-accent font-medium text-fg' : 'border-transparent text-muted hover:text-fg',
                  v.key === 'overdue' && count('overdue') > 0 && !active && 'text-danger',
                )}
              >
                <Icon size={14} className={v.key === 'overdue' && count('overdue') > 0 ? 'text-danger' : undefined} />
                {v.label}
                <span className="text-xs text-subtle">{count(v.key)}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted">{view.hint}</p>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex h-8 w-44 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-sm focus-within:border-accent sm:w-56">
            <Search size={14} className="shrink-0 text-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm Project…"
              aria-label="Tìm Project"
              className="w-full bg-transparent text-fg outline-none placeholder:text-subtle"
            />
          </label>
          <div className="flex rounded-lg bg-surface-2 p-0.5" role="radiogroup" aria-label="Bố cục">
            {(
              [
                ['gallery', 'Thẻ', LayoutGrid],
                ['table', 'Bảng', List],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={layout === key}
                aria-label={label}
                title={label}
                onClick={() => setLayout(key)}
                className={cx(
                  'grid h-7 w-8 place-items-center rounded-md transition-colors',
                  layout === key ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
                )}
              >
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <Notice tone="danger">{(error as Error).message}</Notice>}
      {createError && <div className="mb-3"><Notice tone="danger">{createError}</Notice></div>}
      {isLoading && (
        <div className="grid place-items-center py-14">
          <LoaderCircle size={20} className="animate-spin text-subtle" />
        </div>
      )}

      {records &&
        groups.map((g) => {
          const isCollapsed = collapsed.has(g.key)
          return (
            <section key={g.key} className={viewKey === 'by_area' ? 'mb-6' : undefined} aria-label={g.label || view.label}>
              {viewKey === 'by_area' && (
                <button
                  type="button"
                  aria-expanded={!isCollapsed}
                  onClick={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev)
                      if (next.has(g.key)) next.delete(g.key)
                      else next.add(g.key)
                      return next
                    })
                  }
                  className="mb-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm hover:bg-surface-2"
                >
                  {isCollapsed ? <ChevronRight size={15} className="text-subtle" /> : <ChevronDown size={15} className="text-subtle" />}
                  <span className={cx('inline-flex items-center gap-1.5 font-semibold', g.areaId ? 'text-fg' : 'text-muted')}>
                    {g.areaId && <Layers size={14} className="text-accent" />} {g.label}
                  </span>
                  <span className="text-xs text-subtle">{g.items.length}</span>
                </button>
              )}
              {!isCollapsed &&
                (layout === 'gallery' ? (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
                    {g.items.map((p) => (
                      <ProjectCard key={p.id} p={p} s={stats?.get(p.id) ?? empty} onPatch={(n) => patch(p, n)} />
                    ))}
                    {viewKey !== 'archive' && <NewCard onCreate={(name) => createProject(name, g.areaId)} />}
                  </div>
                ) : (
                  <ProjectTable
                    items={g.items}
                    stats={stats}
                    onPatch={patch}
                    footer={viewKey !== 'archive' && <NewRow onCreate={(name) => createProject(name, g.areaId)} />}
                  />
                ))}
              {!isCollapsed && g.items.length === 0 && viewKey !== 'by_area' && (
                <p className="px-1 py-6 text-sm text-subtle">{query ? 'Không có Project nào khớp.' : 'Không có Project nào trong view này.'}</p>
              )}
            </section>
          )
        })}
    </div>
  )
}

/** Thẻ Project (dạng Gallery của Notion) */
function ProjectCard({ p, s, onPatch }: { p: Project; s: ParaStats; onPatch: (next: Partial<Project>) => void }) {
  const total = s.open + s.done
  const due = formatDay(p.due_at ?? null)
  const overdue = isOverdue(p)
  const status = projectStatus(p)
  return (
    <div className="group/card relative flex flex-col rounded-xl border border-line bg-surface p-3 shadow-sm transition-colors hover:border-line-strong">
      <Link to={`/projects/${p.id}`} className="flex items-start gap-2 pr-14">
        <ParaIcon icon={p.icon} kind="projects" size={18} className="mt-px" />
        <span className={cx('font-medium leading-snug', p.completed ? 'text-muted line-through' : 'text-fg')}>{p.name}</span>
      </Link>
      <span className="absolute right-2 top-2 flex gap-0.5">
        <IconButton label={status === 'fav' ? `Bỏ yêu thích ${p.name}` : `Yêu thích ${p.name}`} onClick={() => onPatch(toggleStatusPatch(p, 'fav'))} show={status === 'fav'}>
          <Star size={14} className={status === 'fav' ? 'fill-current text-yellow' : undefined} />
        </IconButton>
        {status === 'archive' ? (
          <IconButton label={`Khôi phục ${p.name}`} onClick={() => onPatch(setStatusPatch(null))} show>
            <ArchiveRestore size={14} />
          </IconButton>
        ) : (
          <IconButton label={status === 'completed' ? `Mở lại ${p.name}` : `Hoàn thành ${p.name}`} onClick={() => onPatch(toggleStatusPatch(p, 'completed'))}>
            <CheckCircle2 size={14} className={status === 'completed' ? 'text-success' : undefined} />
          </IconButton>
        )}
      </span>
      {/* Thuộc tính như thẻ Gallery của Notion: Area · Deadline · Status */}
      <dl className="mt-2.5 grid grid-cols-[18px_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1.5 text-xs">
        <dt title="Area" className="text-subtle"><Layers size={12} /></dt>
        <dd className="min-w-0">{p.area_id ? <RelationValue kind="areas" valueId={p.area_id} /> : <span className="text-subtle">Chưa có Area</span>}</dd>
        <dt title="Deadline" className={overdue ? 'text-danger' : 'text-subtle'}><CalendarClock size={12} /></dt>
        <dd className={cx(overdue ? 'font-medium text-danger' : due.text ? 'text-muted' : 'text-subtle')}>
          {due.text ? <>{due.text}{overdue && ' · quá hạn'}</> : 'Chưa có deadline'}
        </dd>
        <dt title="Status" className="text-subtle"><CircleDot size={12} /></dt>
        <dd>{status ? <StatusTag status={status} /> : <span className="text-subtle">Chưa có status</span>}</dd>
      </dl>
      {total > 0 && (
        <div className="mt-3 flex items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-success" style={{ width: `${(s.done / total) * 100}%` }} />
          </span>
          <span className="text-[11px] tabular-nums text-muted">
            {s.done}/{total}
            {s.minutes > 0 && <> · {formatDuration(s.minutes, true)}</>}
          </span>
        </div>
      )}
    </div>
  )
}

function IconButton({ label, onClick, show = false, children }: { label: string; onClick: () => void; show?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(
        'grid size-7 place-items-center rounded-md text-subtle transition hover:bg-surface-2 hover:text-fg focus-visible:opacity-100',
        !show && 'opacity-0 group-hover/card:opacity-100 group-hover/row:opacity-100',
      )}
    >
      {children}
    </button>
  )
}

/** Thẻ "+ New page": bấm → gõ tên → Enter */
function NewCard({ onCreate }: { onCreate: (name: string) => Promise<unknown> }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-xl border border-dashed border-line text-sm text-subtle transition-colors hover:border-line-strong hover:text-muted"
      >
        <Plus size={15} /> New page
      </button>
    )
  }
  return (
    <form
      className="rounded-xl border border-accent bg-surface p-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        await onCreate(name.trim())
        setName('')
      }}
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => !name.trim() && setEditing(false)}
        onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
        placeholder="Tên Project… (Enter)"
        aria-label="Tên Project mới"
        className="w-full bg-transparent text-sm font-medium text-fg outline-none placeholder:text-subtle"
      />
    </form>
  )
}

function NewRow({ onCreate }: { onCreate: (name: string) => Promise<unknown> }) {
  const [name, setName] = useState('')
  return (
    <form
      className="flex items-center gap-2 px-3 py-1.5"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        await onCreate(name.trim())
        setName('')
      }}
    >
      <Plus size={14} className="text-subtle" />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New page… (Enter)"
        aria-label="Tên Project mới"
        className="h-8 w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
      />
    </form>
  )
}

const th = 'whitespace-nowrap border-r border-line px-3 py-2 text-left text-xs font-normal text-subtle last:border-r-0'
const td = 'border-r border-line p-0 align-middle last:border-r-0'

function ProjectTable({
  items,
  stats,
  onPatch,
  footer,
}: {
  items: Project[]
  stats?: Map<string, ParaStats>
  onPatch: (p: Project, next: Partial<Project>) => void
  footer?: ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className={cx(th, 'min-w-[220px]')}>Tên</th>
              <th className={cx(th, 'w-44')}>Area</th>
              <th className={cx(th, 'w-32')}>Deadline</th>
              <th className={cx(th, 'w-40')}>Status</th>
              <th className={cx(th, 'w-44')}>Tiến độ</th>
              <th className={cx(th, 'w-24')}>Thời gian</th>
              <th className="w-24" aria-label="Thao tác" />
            </tr>
          </thead>
          <tbody>
            {items.map((p) => {
              const s = stats?.get(p.id) ?? empty
              const total = s.open + s.done
              const due = formatDay(p.due_at ?? null)
              return (
                <tr key={p.id} className="group/row border-b border-line hover:bg-surface-2/40">
                  <td className={td}>
                    <Link to={`/projects/${p.id}`} className="flex min-h-10 items-center gap-2 px-3 font-medium text-fg hover:text-accent">
                      <ParaIcon icon={p.icon} kind="projects" size={16} />
                      <span className={p.completed ? 'text-muted line-through' : undefined}>{p.name}</span>

                    </Link>
                  </td>
                  <td className={td}>
                    <RelationCell kind="areas" valueId={p.area_id} onChange={(area_id) => onPatch(p, { area_id })} />
                  </td>
                  <td className={cx(td, 'px-3', isOverdue(p) ? 'font-medium text-danger' : 'text-muted')}>{due.text}</td>
                  <td className={td}>
                    <StatusCell compact project={p} onPatch={(next) => onPatch(p, next)} />
                  </td>
                  <td className={cx(td, 'px-3')}>
                    {total > 0 ? (
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <span className="block h-full rounded-full bg-success" style={{ width: `${(s.done / total) * 100}%` }} />
                        </span>
                        <span className="text-xs tabular-nums text-muted">{s.done}/{total}</span>
                      </span>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </td>
                  <td className={cx(td, 'px-3 tabular-nums text-muted')}>{s.minutes ? formatDuration(s.minutes, true) : '—'}</td>
                  <td className="px-2">
                    <span className="flex justify-end gap-0.5">
                      <IconButton label={p.is_favorite ? `Bỏ yêu thích ${p.name}` : `Yêu thích ${p.name}`} onClick={() => onPatch(p, toggleStatusPatch(p, 'fav'))}>
                        <Star size={14} className={p.is_favorite ? 'fill-current text-yellow' : undefined} />
                      </IconButton>
                      <IconButton label={p.completed ? `Mở lại ${p.name}` : `Hoàn thành ${p.name}`} onClick={() => onPatch(p, toggleStatusPatch(p, 'completed'))}>
                        <CheckCircle2 size={14} className={p.completed ? 'text-success' : undefined} />
                      </IconButton>
                      <IconButton
                        label={p.archived ? `Khôi phục ${p.name}` : `Lưu trữ ${p.name}`}
                        onClick={() => onPatch(p, toggleStatusPatch(p, 'archive'))}
                        show={p.archived}
                      >
                        {p.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                      </IconButton>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {footer}
    </Card>
  )
}
