import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { addDays, format, isAfter, isSameDay, parseISO, startOfDay } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  AlarmClockOff,
  BookOpen,
  Check,
  CheckCircle2,
  CircleDashed,
  FolderKanban,
  ListChecks,
  LoaderCircle,
  NotebookText,
  PauseCircle,
  Repeat,
} from 'lucide-react'
import { Card, Notice, cx } from '../../components/ui'
import { getSupabaseClient } from '../../lib/supabaseClient'
import type { Task } from '../../lib/taskViewTypes'
import { useSavedViews } from '../tasks/useSavedViews'
import { TaskViewSection } from '../tasks/TaskViewSection'
import { TaskDetailDrawer } from '../tasks/TaskDetailDrawer'
import type { TaskDraft } from '../tasks/useTaskMutations'
import { RelationValue } from '../tasks/cells'
import { ParaIcon } from '../para/ParaIcon'
import { useParaRecords, useParaStats, useUpdatePara, type Project } from '../para/useParaAdmin'
import { StatusCell } from '../para/projectStatus'
import { dayKey, isoDow, useHabitLogs, useHabits } from '../habits/useHabits'
import { kindOf } from '../resources/resourceFields'
import { fmtMin } from '../stats/format'
import { useWeekStats, weekKey, weekStartOf } from './useReview'

type DrawerState = { mode: 'edit'; task: Task } | { mode: 'create'; defaults: TaskDraft } | null

/** Tab "Tổng quan tuần" của trang Review: mọi thứ cần nhìn lại trong 1 tuần */
export function ReviewOverview() {
  const week = weekKey()
  const weekStart = weekStartOf()
  const { data: views, error: viewsError } = useSavedViews()
  const reviewViews = (views ?? []).filter((v) => v.section === 'review')
  const [drawer, setDrawer] = useState<DrawerState>(null)
  const { data: weekData } = useWeekStats(week)
  const { data: projects = [] } = useParaRecords('projects')
  const { data: overdue = 0 } = useOverdueCount()
  const projectsDoneWeek = (projects as Project[]).filter((p) => p.completed && p.completed_at && parseISO(p.completed_at) >= weekStart).length

  return (
    <div className="space-y-8">
      {/* Số liệu tuần */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5" aria-label="Tuần này">
        <Tile label="Task đã xong" value={weekData ? String(weekData.stats.tasks) : '…'} />
        <Tile label="Thời gian ghi nhận" value={weekData?.stats.minutes ? fmtMin(weekData.stats.minutes) : '—'} />
        <Tile label="Đang quá hạn" value={String(overdue)} tone={overdue > 0 ? 'danger' : undefined} />
        <Tile label="Project hoàn thành" value={String(projectsDoneWeek)} />
        <Tile label="Thói quen đạt" value={weekData?.stats.habit_rate != null ? `${Math.round(weekData.stats.habit_rate * 100)}%` : '—'} />
      </div>

      {/* Task: đủ bộ view như trang Tasks */}
      {viewsError && <Notice tone="danger">{(viewsError as Error).message}</Notice>}
      <TaskViewSection
        section="review"
        title="Task"
        icon={ListChecks}
        views={reviewViews}
        allViews={views ?? []}
        drawerOpen={drawer !== null}
        onOpenTask={(task) => setDrawer({ mode: 'edit', task })}
        className="mb-0"
        emptyHint={
          <>
            Chưa có view Task cho trang Review — chạy file <code>supabase/migrations/0020_review_views.sql</code> trong Supabase SQL Editor.
          </>
        }
      />

      <ProjectsBlock />

      <div className="grid gap-5 lg:grid-cols-2">
        <HabitsWeek />
        <NotesAndResources />
      </div>

      {drawer?.mode === 'edit' && <TaskDetailDrawer key={drawer.task.id} task={drawer.task} onClose={() => setDrawer(null)} onOpenTask={(task) => setDrawer({ mode: 'edit', task })} />}
      {drawer?.mode === 'create' && <TaskDetailDrawer defaults={drawer.defaults} onClose={() => setDrawer(null)} />}
    </div>
  )
}

function useOverdueCount() {
  return useQuery({
    queryKey: ['review-overdue'],
    queryFn: async () => {
      const client = getSupabaseClient()
      if (!client) return 0
      const { count } = await client
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('complete', false)
        .lt('due_at', new Date().toISOString())
      return count ?? 0
    },
  })
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={cx('mt-0.5 text-2xl font-semibold', tone === 'danger' ? 'text-danger' : 'text-fg')}>{value}</p>
    </Card>
  )
}

function BlockHeader({ icon: Icon, title, right }: { icon: typeof ListChecks; title: string; right?: ReactNode }) {
  return (
    <header className="mb-3 flex flex-wrap items-center gap-2">
      <Icon size={18} className="text-accent" />
      <h2 className="text-lg font-semibold tracking-tight text-fg">{title}</h2>
      {right && <div className="ml-auto">{right}</div>}
    </header>
  )
}

// ---------------------------------------------------------------------------
// Projects: 5 view
// ---------------------------------------------------------------------------
type PView = 'running' | 'done_week' | 'done' | 'late' | 'stalled'
const PVIEWS: Array<{ key: PView; label: string; icon: typeof CircleDashed; hint: string }> = [
  { key: 'running', label: 'Đang chạy', icon: CircleDashed, hint: 'Project chưa hoàn thành, chưa lưu trữ.' },
  { key: 'done_week', label: 'Hoàn thành tuần này', icon: CheckCircle2, hint: 'Project đánh dấu Completed trong tuần này.' },
  { key: 'done', label: 'Đã hoàn thành', icon: Check, hint: 'Mọi project đã Completed, mới xong trước.' },
  { key: 'late', label: 'Quá deadline', icon: AlarmClockOff, hint: 'Chưa xong mà đã qua deadline — dời deadline hoặc chốt lại.' },
  { key: 'stalled', label: 'Chưa có việc tiếp theo', icon: PauseCircle, hint: 'Đang chạy nhưng không còn task nào mở — thêm bước tiếp theo.' },
]

function ProjectsBlock() {
  const { data: projects, isLoading } = useParaRecords('projects')
  const { data: stats } = useParaStats('projects')
  const update = useUpdatePara('projects')
  const [view, setView] = useState<PView>('running')
  const weekStart = weekStartOf()
  const now = new Date()

  const rows = useMemo(() => {
    const all = (projects ?? []) as Project[]
    const running = all.filter((p) => !p.completed && !p.archived)
    const byView: Record<PView, Project[]> = {
      running,
      done_week: all.filter((p) => p.completed && p.completed_at && parseISO(p.completed_at) >= weekStart),
      done: all.filter((p) => p.completed).sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? '')),
      late: running.filter((p) => p.due_at && parseISO(p.due_at) < now),
      stalled: running.filter((p) => (stats?.get(p.id)?.open ?? 0) === 0),
    }
    return byView
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, stats])
  const list = rows[view]
  const def = PVIEWS.find((v) => v.key === view)!

  return (
    <section aria-label="Projects">
      <BlockHeader icon={FolderKanban} title="Projects" right={<Link to="/projects" className="text-xs text-muted hover:text-accent">Mở trang Projects →</Link>} />
      <div className="mb-2 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--border)]">
        <div className="flex w-max gap-1" role="tablist" aria-label="View Projects">
          {PVIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              onClick={() => setView(v.key)}
              className={cx(
                'inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors',
                view === v.key ? 'border-accent font-medium text-fg' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              <v.icon size={14} /> {v.label} <span className="text-xs font-normal text-subtle">{rows[v.key].length}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="mb-2 text-xs text-subtle">{def.hint}</p>
      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="grid place-items-center py-8">
            <LoaderCircle size={18} className="animate-spin text-subtle" />
          </div>
        ) : list.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-subtle">Không có project nào trong view này.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-subtle">
                <th className="min-w-[220px] border-r border-line px-3 py-2 font-normal">Tên</th>
                <th className="w-36 border-r border-line px-3 py-2 font-normal">Area</th>
                <th className="w-32 border-r border-line px-3 py-2 font-normal">Deadline</th>
                <th className="w-40 border-r border-line px-0 py-2 font-normal"><span className="px-2">Status</span></th>
                <th className="w-40 border-r border-line px-3 py-2 font-normal">Tiến độ</th>
                <th className="w-32 px-3 py-2 font-normal">Hoàn thành lúc</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const s = stats?.get(p.id)
                const total = (s?.open ?? 0) + (s?.done ?? 0)
                const late = !p.completed && p.due_at && parseISO(p.due_at) < now
                return (
                  <tr key={p.id} className="border-b border-line last:border-b-0 hover:bg-surface-2/40">
                    <td className="border-r border-line px-3 py-2">
                      <Link to={`/projects/${p.id}`} className={cx('flex items-center gap-2 font-medium hover:text-accent', p.completed ? 'text-muted' : 'text-fg')}>
                        <ParaIcon icon={p.icon} kind="projects" size={16} /> <span className="truncate">{p.name}</span>
                      </Link>
                    </td>
                    <td className="border-r border-line px-3 py-2">
                      <RelationValue kind="areas" valueId={p.area_id} />
                    </td>
                    <td className={cx('border-r border-line px-3 py-2 tabular-nums', late ? 'text-danger' : 'text-muted')}>
                      {p.due_at ? format(parseISO(p.due_at), 'dd/MM/yyyy') : <span className="text-subtle">—</span>}
                    </td>
                    <td className="border-r border-line p-0">
                      <StatusCell compact project={p} onPatch={(patch) => update.mutate({ id: p.id, patch })} />
                    </td>
                    <td className="border-r border-line px-3 py-2">
                      {total ? (
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                            <span className="block h-full rounded-full bg-chart" style={{ width: `${((s?.done ?? 0) / total) * 100}%` }} />
                          </span>
                          <span className="text-xs tabular-nums text-muted">
                            {s?.done}/{total}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-subtle">Chưa có task</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums text-muted">{p.completed_at ? format(parseISO(p.completed_at), 'HH:mm dd/MM') : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Thói quen tuần này
// ---------------------------------------------------------------------------
const dayShort = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function HabitsWeek() {
  const { data: habits = [] } = useHabits()
  const { data: logs = [] } = useHabitLogs()
  const start = weekStartOf()
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const today = startOfDay(new Date())
  const done = new Set(logs.map((l) => `${l.habit_id}|${l.day}`))
  const active = habits.filter((h) => !h.archived)

  return (
    <section aria-label="Thói quen tuần này">
      <BlockHeader icon={Repeat} title="Thói quen tuần này" right={<Link to="/habits" className="text-xs text-muted hover:text-accent">Mở Habits →</Link>} />
      <Card className="overflow-x-auto">
        {active.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-subtle">Chưa có thói quen nào.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-subtle">
                <th className="px-3 py-2 text-left font-normal">Thói quen</th>
                {days.map((d) => (
                  <th key={d.toISOString()} className={cx('w-8 px-0.5 py-2 text-center font-normal', isSameDay(d, today) && 'text-accent')}>
                    {dayShort[isoDow(d) - 1]}
                  </th>
                ))}
                <th className="w-14 px-3 py-2 text-right font-normal">Đạt</th>
              </tr>
            </thead>
            <tbody>
              {active.map((h) => {
                let need = 0
                let got = 0
                return (
                  <tr key={h.id} className="border-b border-line last:border-b-0">
                    <td className="truncate px-3 py-1.5 text-fg">
                      {h.icon && <span className="mr-1.5">{h.icon}</span>}
                      {h.name}
                    </td>
                    {days.map((d) => {
                      const isDone = done.has(`${h.id}|${dayKey(d)}`)
                      const needed = h.days.includes(isoDow(d))
                      const future = isAfter(d, today)
                      if (needed && !future && !(isSameDay(d, today) && !isDone)) {
                        need++
                        if (isDone) got++
                      }
                      return (
                        <td key={d.toISOString()} className="px-0.5 py-1.5 text-center">
                          <span
                            aria-label={`${h.name} ${format(d, 'EEEE', { locale: vi })}: ${isDone ? 'đã làm' : needed ? 'chưa làm' : 'ngày nghỉ'}`}
                            className={cx(
                              'mx-auto grid size-5 place-items-center rounded-full',
                              isDone ? 'bg-chart text-white' : future ? '' : needed ? 'border border-line-strong' : 'border border-dashed border-line',
                            )}
                          >
                            {isDone && <Check size={11} strokeWidth={3} />}
                          </span>
                        </td>
                      )
                    })}
                    <td className="px-3 py-1.5 text-right text-xs tabular-nums text-muted">{need ? `${Math.round((got / need) * 100)}%` : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Ghi chú & tài nguyên trong tuần
// ---------------------------------------------------------------------------
type WeekNote = { id: string; title: string; area_id: string | null; project_id: string | null; created_at: string }
type WeekRes = { id: string; title: string; kind: string; finished: boolean; created_at: string; updated_at: string }

function useWeekNotesResources() {
  const start = weekStartOf().toISOString()
  return useQuery({
    queryKey: ['review-week-notes', start],
    queryFn: async () => {
      const client = getSupabaseClient()
      if (!client) return { notes: [] as WeekNote[], added: [] as WeekRes[], finished: [] as WeekRes[] }
      const [n, added, fin] = await Promise.all([
        client.from('notes').select('id, title, area_id, project_id, created_at').gte('created_at', start).order('created_at', { ascending: false }),
        client.from('resources').select('id, title, kind, finished, created_at, updated_at').gte('created_at', start).order('created_at', { ascending: false }),
        client.from('resources').select('id, title, kind, finished, created_at, updated_at').eq('finished', true).gte('updated_at', start).order('updated_at', { ascending: false }),
      ])
      return {
        notes: (n.error ? [] : n.data ?? []) as WeekNote[],
        added: (added.error ? [] : added.data ?? []) as WeekRes[],
        finished: (fin.error ? [] : fin.data ?? []) as WeekRes[],
      }
    },
  })
}

function NotesAndResources() {
  const { data } = useWeekNotesResources()
  const notes = data?.notes ?? []
  const added = data?.added ?? []
  const finished = data?.finished ?? []
  return (
    <section aria-label="Ghi chú và tài nguyên tuần này" className="space-y-5">
      <div>
        <BlockHeader icon={NotebookText} title={`Ghi chú tuần này (${notes.length})`} right={<Link to="/notes" className="text-xs text-muted hover:text-accent">Mở Notes →</Link>} />
        <Card>
          {notes.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-subtle">Tuần này chưa có ghi chú mới.</p>
          ) : (
            <ul className="divide-y divide-line">
              {notes.slice(0, 8).map((n) => (
                <li key={n.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-fg">{n.title || 'Chưa đặt tên'}</span>
                  {n.area_id || n.project_id ? (
                    <RelationValue kind={n.project_id ? 'projects' : 'areas'} valueId={n.project_id ?? n.area_id} />
                  ) : (
                    <span className="text-xs text-yellow">Chưa gắn Area/Project</span>
                  )}
                  <span className="shrink-0 text-xs capitalize text-subtle">{format(parseISO(n.created_at), 'EEEEEE', { locale: vi })}</span>
                </li>
              ))}
              {notes.length > 8 && <li className="px-3 py-2 text-xs text-subtle">+{notes.length - 8} ghi chú khác</li>}
            </ul>
          )}
        </Card>
      </div>
      <div>
        <BlockHeader icon={BookOpen} title="Tài nguyên tuần này" right={<Link to="/resources" className="text-xs text-muted hover:text-accent">Mở Resources →</Link>} />
        <Card>
          {added.length + finished.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-subtle">Tuần này chưa lưu hay xem xong tài nguyên nào.</p>
          ) : (
            <ul className="divide-y divide-line">
              {[...finished.map((r) => ({ ...r, tag: 'Đã xem xong' })), ...added.filter((r) => !finished.some((f) => f.id === r.id)).map((r) => ({ ...r, tag: 'Mới lưu' }))]
                .slice(0, 8)
                .map((r) => {
                  const k = kindOf(r.kind as never)
                  return (
                    <li key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <k.icon size={14} className="shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate text-fg">{r.title}</span>
                      <span className={cx('shrink-0 text-xs', r.tag === 'Đã xem xong' ? 'text-success' : 'text-subtle')}>{r.tag}</span>
                    </li>
                  )
                })}
            </ul>
          )}
        </Card>
      </div>
    </section>
  )
}
