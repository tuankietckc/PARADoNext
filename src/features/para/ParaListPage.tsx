import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, CheckCircle2, CircleDashed, FolderKanban, Layers, LoaderCircle, Plus, Star } from 'lucide-react'
import { Card, Notice, cx } from '../../components/ui'
import { RelationCell, RelationValue } from '../tasks/cells'
import { formatDuration } from '../tasks/taskFields'
import type { ParaKind } from './usePara'
import { ParaIcon } from './ParaIcon'
import {
  useCreatePara,
  useParaRecords,
  useParaStats,
  useUpdatePara,
  type ParaStats,
  type Project,
} from './useParaAdmin'

const th = 'whitespace-nowrap border-r border-line px-3 py-2 text-left text-xs font-normal text-subtle last:border-r-0'
const td = 'border-r border-line p-0 align-middle last:border-r-0'
const empty: ParaStats = { open: 0, done: 0, minutes: 0, notes: 0 }

type ProjectTab = 'active' | 'favorites' | 'completed'

/** Trang danh sách Areas hoặc Projects. */
export function ParaListPage({ kind }: { kind: ParaKind }) {
  const isProject = kind === 'projects'
  const label = isProject ? 'Project' : 'Area'
  const Icon = isProject ? FolderKanban : Layers
  const { data: records, isLoading, error } = useParaRecords(kind)
  const { data: stats } = useParaStats(kind)
  const update = useUpdatePara(kind)
  const create = useCreatePara(kind)
  const [tab, setTab] = useState<ProjectTab>('active')
  const [name, setName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const rows = useMemo(() => {
    const live = (records ?? []).filter((r) => !r.archived)
    if (!isProject) return live
    const ps = live as Project[]
    if (tab === 'favorites') return ps.filter((p) => p.is_favorite)
    if (tab === 'completed') return ps.filter((p) => p.completed)
    return ps.filter((p) => !p.completed)
  }, [records, isProject, tab])

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

  const count = (pred: (p: Project) => boolean) => ((records ?? []) as Project[]).filter((p) => !p.archived && pred(p)).length

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-fg">
          <Icon size={22} className="text-accent" /> {isProject ? 'Projects' : 'Areas'}
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {isProject
            ? 'Việc có đích đến và ngày xong. Bấm tên để xem task, ghi chú và thời gian đã làm.'
            : 'Lĩnh vực trách nhiệm lâu dài (Career, Health, Finance…). Bấm tên để xem mọi thứ thuộc về nó.'}
        </p>
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {isProject && (
          <div className="flex gap-1 rounded-lg bg-surface-2 p-0.5" role="tablist">
            {(
              [
                ['active', 'Đang làm', CircleDashed, count((p) => !p.completed)],
                ['favorites', 'Yêu thích', Star, count((p) => p.is_favorite)],
                ['completed', 'Hoàn thành', CheckCircle2, count((p) => p.completed)],
              ] as const
            ).map(([key, text, TabIcon, n]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={cx(
                  'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition-colors',
                  tab === key ? 'bg-surface font-medium text-fg shadow-sm' : 'text-muted hover:text-fg',
                )}
              >
                <TabIcon size={14} /> {text} <span className="text-xs text-subtle">{n}</span>
              </button>
            ))}
          </div>
        )}
        <form
          className="ml-auto flex h-8 w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 focus-within:border-accent sm:w-72"
          onSubmit={(e) => {
            e.preventDefault()
            void add()
          }}
        >
          <Plus size={14} className="shrink-0 text-accent" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`${label} mới… (Enter)`}
            aria-label={`Tên ${label} mới`}
            className="w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
          />
        </form>
      </div>
      {createError && <div className="mb-3"><Notice tone="danger">{createError}</Notice></div>}
      {error && <Notice tone="danger">{(error as Error).message}</Notice>}

      <Card className="overflow-hidden">
        {isLoading && (
          <div className="grid place-items-center py-14">
            <LoaderCircle size={20} className="animate-spin text-subtle" />
          </div>
        )}
        {records && rows.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-subtle">
            {isProject && tab !== 'active' ? 'Không có Project nào ở đây.' : `Chưa có ${label} nào — gõ tên ở ô phía trên rồi Enter.`}
          </p>
        )}
        {rows.length > 0 && (
          <>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={cx(th, 'min-w-[240px]')}>Tên</th>
                    {isProject && <th className={cx(th, 'w-44')}>Area</th>}
                    <th className={cx(th, 'w-28')}>Việc đang mở</th>
                    <th className={cx(th, isProject ? 'w-48' : 'w-28')}>{isProject ? 'Tiến độ' : 'Đã xong'}</th>
                    <th className={cx(th, 'w-28')}>Thời gian</th>
                    <th className={cx(th, 'w-24')}>Ghi chú</th>
                    <th className="w-28" aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const s = stats?.get(r.id) ?? empty
                    const p = r as Project
                    const total = s.open + s.done
                    return (
                      <tr key={r.id} className="group/row border-b border-line last:border-b-0 hover:bg-surface-2/40">
                        <td className={td}>
                          <Link to={`/${kind}/${r.id}`} className="flex min-h-11 items-center gap-2 px-3 font-medium text-fg hover:text-accent">
                            <ParaIcon icon={r.icon} kind={kind} size={16} />
                            {r.name}
                            {isProject && p.is_favorite && <Star size={13} className="fill-current text-yellow" />}
                          </Link>
                        </td>
                        {isProject && (
                          <td className={td}>
                            <RelationCell kind="areas" valueId={p.area_id} onChange={(area_id) => update.mutate({ id: r.id, patch: { area_id } })} />
                          </td>
                        )}
                        <td className={cx(td, 'px-3 tabular-nums', s.open ? 'text-fg' : 'text-subtle')}>{s.open}</td>
                        <td className={cx(td, 'px-3')}>
                          {isProject ? (
                            <span className="flex items-center gap-2">
                              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                                <span className="block h-full rounded-full bg-success" style={{ width: `${total ? (s.done / total) * 100 : 0}%` }} />
                              </span>
                              <span className="text-xs tabular-nums text-muted">{s.done}/{total}</span>
                            </span>
                          ) : (
                            <span className="tabular-nums text-muted">{s.done}</span>
                          )}
                        </td>
                        <td className={cx(td, 'px-3 tabular-nums text-muted')}>{s.minutes ? formatDuration(s.minutes, true) : '—'}</td>
                        <td className={cx(td, 'px-3 tabular-nums text-muted')}>{s.notes || '—'}</td>
                        <td className="px-2">
                          <span className="flex justify-end gap-0.5 opacity-60 group-hover/row:opacity-100">
                            {isProject && (
                              <>
                                <RowButton
                                  label={p.is_favorite ? `Bỏ yêu thích ${r.name}` : `Yêu thích ${r.name}`}
                                  onClick={() => update.mutate({ id: r.id, patch: { is_favorite: !p.is_favorite } })}
                                >
                                  <Star size={14} className={p.is_favorite ? 'fill-current text-yellow' : undefined} />
                                </RowButton>
                                <RowButton
                                  label={p.completed ? `Mở lại ${r.name}` : `Hoàn thành ${r.name}`}
                                  onClick={() => update.mutate({ id: r.id, patch: { completed: !p.completed } })}
                                >
                                  <CheckCircle2 size={14} className={p.completed ? 'text-success' : undefined} />
                                </RowButton>
                              </>
                            )}
                            <RowButton label={`Lưu trữ ${r.name}`} onClick={() => update.mutate({ id: r.id, patch: { archived: true } })}>
                              <Archive size={14} />
                            </RowButton>
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="sm:hidden">
              {rows.map((r) => {
                const s = stats?.get(r.id) ?? empty
                return (
                  <li key={r.id} className="border-b border-line last:border-b-0">
                    <Link to={`/${kind}/${r.id}`} className="block px-4 py-3">
                      <p className="flex items-center gap-2 text-sm font-medium text-fg">
                        <ParaIcon icon={r.icon} kind={kind} size={15} /> {r.name}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                        {isProject && <RelationValue kind="areas" valueId={(r as Project).area_id} />}
                        <span>{s.open} việc mở</span>
                        <span>{s.done} đã xong</span>
                        {s.minutes > 0 && <span>{formatDuration(s.minutes, true)}</span>}
                      </p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </Card>
    </div>
  )
}

function RowButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-7 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
    >
      {children}
    </button>
  )
}

