import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { isBefore, startOfDay } from 'date-fns'
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleChevronDown,
  FolderKanban,
  LoaderCircle,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Button, Notice, cx } from '../../components/ui'
import { DateCell, RelationCell } from '../tasks/cells'
import { formatDuration } from '../tasks/taskFields'
import { TaskDetailDrawer } from '../tasks/TaskDetailDrawer'
import { TaskViewSection } from '../tasks/TaskViewSection'
import { useSavedViews } from '../tasks/useSavedViews'
import type { Task } from '../../lib/taskViewTypes'
import { NoteDrawer } from '../notes/NoteDrawer'
import type { Note } from '../notes/useNotes'
import type { ParaKind } from './usePara'
import { StatusCell } from './projectStatus'
import { IconButton, ParaIcon } from './ParaIcon'
import { NotesBlock, TasksBlock } from './ParaBlocks'
import {
  useCreatePara,
  useDeletePara,
  useParaNotes,
  useParaRecords,
  useParaStats,
  useParaTasks,
  useUpdatePara,
  type Project,
} from './useParaAdmin'

/**
 * Trang 1 Area / Project — bố cục như 1 trang Notion:
 * icon + tên, thuộc tính (Project: Areas · Deadline · Status), số liệu gọn,
 * rồi các khối có tab view: Tasks (Project Tasks / Completed Tasks), Notes (Notes / Archive), (Area) Projects.
 */
export function ParaDetailPage({ kind }: { kind: ParaKind }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const isProject = kind === 'projects'
  const { data: records, isLoading } = useParaRecords(kind)
  const { data: projects = [] } = useParaRecords('projects')
  const { data: projectStats } = useParaStats('projects')
  const record = records?.find((r) => r.id === id)
  const project = isProject ? (record as Project | undefined) : undefined
  const update = useUpdatePara(kind)
  const remove = useDeletePara(kind)
  const createProject = useCreatePara('projects')
  const { data: tasks = [] } = useParaTasks(kind, id)
  const { data: notes = [] } = useParaNotes(kind, id)
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [openTask, setOpenTask] = useState<Task | null>(null)
  const [openNote, setOpenNote] = useState<Note | null>(null)
  const [newProject, setNewProject] = useState('')
  const [projectMsg, setProjectMsg] = useState<{ tone: 'success' | 'danger'; text: string; id?: string } | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const addTaskRef = useRef<HTMLInputElement>(null)
  const [params, setParams] = useSearchParams()
  const isNew = params.get('new') === '1'
  // View Task dùng chung cho mọi trang Project / Area (migration 0013)
  const { data: allViews = [] } = useSavedViews()
  const sectionViews = allViews.filter((v) => v.section === (isProject ? 'project' : 'area'))
  const projectArea = (record as Project | undefined)?.area_id ?? null
  const scope = useMemo(
    () =>
      id
        ? {
            filters: [{ field: (isProject ? 'project_id' : 'area_id') as 'project_id' | 'area_id', operator: 'eq' as const, value: id }],
            defaults: isProject ? { project_id: id, area_id: projectArea } : { area_id: id },
          }
        : undefined,
    [id, isProject, projectArea],
  )

  useEffect(() => setName(record?.name ?? ''), [record?.name])

  // Vừa tạo mới (?new=1) → con trỏ ở ô tên, chọn sẵn để gõ đè (chờ ô đã có chữ)
  useEffect(() => {
    if (!isNew || !record || name !== record.name) return
    titleRef.current?.focus()
    titleRef.current?.select()
    setParams({}, { replace: true })
  }, [isNew, record, name, setParams])

  if (isLoading) {
    return (
      <div className="grid place-items-center py-20">
        <LoaderCircle size={20} className="animate-spin text-subtle" />
      </div>
    )
  }
  if (!record || !id) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Notice>
          Không tìm thấy {isProject ? 'Project' : 'Area'} này.{' '}
          <Link to={`/${kind}`} className="underline">
            Quay lại danh sách
          </Link>
        </Notice>
      </div>
    )
  }

  const overdue = !!project?.due_at && !project.completed && isBefore(new Date(project.due_at), startOfDay(new Date()))
  const open = tasks.filter((t) => !t.complete)
  const done = tasks.filter((t) => t.complete)
  const minutes = tasks.reduce((s, t) => s + (t.actual_minutes ?? 0), 0)
  const activeNotes = notes.filter((n) => !n.archived)
  const childProjects = isProject ? [] : (projects as Project[]).filter((p) => p.area_id === id && !p.archived)
  const rename = () => {
    const n = name.trim()
    if (n && n !== record.name) update.mutate({ id, patch: { name: n } })
    else setName(record.name)
  }
  // Task / ghi chú mới trong Project cũng gắn luôn Area của Project đó
  const areaOf = isProject ? (project?.area_id ?? null) : id
  const taskLink = isProject ? { project_id: id, area_id: areaOf } : { area_id: id }
  const noteLink = { area_id: areaOf, project_id: isProject ? id : null }
  const total = open.length + done.length

  // Trang Project vừa tạo, chưa có gì → gợi ý 3 bước bắt đầu
  const steps = project
    ? [
        { done: !!project.area_id, label: 'Gắn vào 1 Area', hint: 'Bấm ô Areas phía trên' },
        { done: !!project.due_at, label: 'Đặt Deadline', hint: 'Bấm ô Deadline' },
        { done: total > 0, label: 'Thêm task đầu tiên', hint: 'Bước nhỏ nhất bạn làm được ngay', action: () => {
            if (addTaskRef.current) addTaskRef.current.focus()
            else (document.querySelector('section[aria-label="Tasks"] button[data-add-task]') as HTMLButtonElement | null)?.click()
          } },
      ]
    : []
  const showStart = !!project && steps.some((s) => !s.done) && total === 0

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-8">
      <Link to={record.archived ? '/archives' : `/${kind}`} className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft size={15} /> {record.archived ? 'Archives' : isProject ? 'Projects' : 'Areas'}
      </Link>

      <header className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <IconButton icon={record.icon ?? null} kind={kind} onChange={(icon) => update.mutate({ id, patch: { icon } })} />
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {!isProject && (
              <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => update.mutate({ id, patch: { archived: !record.archived } })}>
                {record.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                {record.archived ? 'Khôi phục' : 'Lưu trữ'}
              </Button>
            )}
            {confirmDelete ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-danger">Xoá hẳn? Task & ghi chú vẫn giữ, chỉ bỏ liên kết.</span>
                <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setConfirmDelete(false)}>
                  Không
                </Button>
                <Button
                  variant="destructive"
                  className="h-8 px-2.5 text-xs"
                  onClick={async () => {
                    await remove.mutateAsync(id)
                    navigate(`/${kind}`)
                  }}
                >
                  Xoá
                </Button>
              </span>
            ) : (
              <Button variant="ghost" className="h-8 px-2 text-xs text-muted hover:text-danger" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} /> Xoá
              </Button>
            )}
          </div>
        </div>

        <input
          ref={titleRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="Chưa đặt tên"
          aria-label={`Tên ${isProject ? 'Project' : 'Area'}`}
          className="mt-3 w-full bg-transparent text-4xl font-bold tracking-tight text-fg outline-none placeholder:text-subtle"
        />

        {project && (
          <dl className="mt-4 grid max-w-2xl grid-cols-[140px_minmax(0,1fr)] items-center gap-y-0.5 text-sm">
            <dt className="flex items-center gap-2 text-muted">
              <ArrowUpRight size={15} /> Areas
            </dt>
            <dd>
              <RelationCell kind="areas" valueId={project.area_id} emptyLabel="Trống" onChange={(area_id) => update.mutate({ id, patch: { area_id } })} />
            </dd>
            <dt className={cx('flex items-center gap-2', overdue ? 'font-medium text-danger' : 'text-muted')}>
              <CalendarDays size={15} /> {overdue ? 'Quá hạn' : 'Deadline'}
            </dt>
            <dd>
              <DateCell
                label="Deadline"
                edge="end"
                fullDate
                highlightOverdue={!project.completed}
                emptyLabel="Trống"
                value={project.due_at ?? null}
                onChange={(due_at) => update.mutate({ id, patch: { due_at } })}
              />
            </dd>
            <dt className="flex items-center gap-2 text-muted">
              <CircleChevronDown size={15} /> Status
            </dt>
            <dd>
              <StatusCell project={project} onPatch={(patch) => update.mutate({ id, patch })} />
            </dd>
          </dl>
        )}

        {/* Số liệu gọn */}
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-line py-3 text-sm text-muted">
          <span>
            <b className="font-semibold text-fg">{open.length}</b> việc đang mở
          </span>
          <span>
            <b className="font-semibold text-fg">{done.length}</b> đã xong
          </span>
          <span>
            <b className="font-semibold text-fg">{minutes ? formatDuration(minutes, true) : '0p'}</b> đã làm
          </span>
          <span>
            <b className="font-semibold text-fg">{activeNotes.length}</b> ghi chú
          </span>
          {isProject && total > 0 && (
            <span className="flex min-w-40 flex-1 items-center gap-2" aria-label="Tiến độ">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full rounded-full bg-success transition-all" style={{ width: `${(done.length / total) * 100}%` }} />
              </span>
              <span className="text-xs tabular-nums">{Math.round((done.length / total) * 100)}%</span>
            </span>
          )}
        </div>
      </header>

      {record.archived && (
        <div className="mb-6">
          <Notice>
            Mục này đang được lưu trữ — không hiện trong danh sách chọn nhanh. {isProject ? 'Bỏ "Archive" trong Status' : 'Bấm Khôi phục'} để dùng
            lại.
          </Notice>
        </div>
      )}

      {showStart && (
        <div className="mb-8 rounded-xl border border-dashed border-line bg-surface-2/40 p-4" aria-label="Bắt đầu">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-fg">
            <Sparkles size={15} className="text-accent" /> Bắt đầu Project trong 3 bước
          </p>
          <ol className="grid gap-2 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={s.action}
                  disabled={!s.action}
                  className={cx(
                    'flex w-full items-start gap-2.5 rounded-lg border border-line bg-surface p-3 text-left text-sm',
                    s.action && 'hover:border-accent',
                  )}
                >
                  <span
                    className={cx(
                      'grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold',
                      s.done ? 'bg-success text-surface' : 'bg-surface-2 text-muted',
                    )}
                  >
                    {s.done ? <Check size={12} strokeWidth={3} /> : i + 1}
                  </span>
                  <span>
                    <span className={cx('block font-medium', s.done ? 'text-subtle line-through' : 'text-fg')}>{s.label}</span>
                    <span className="block text-xs text-subtle">{s.hint}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {sectionViews.length > 0 && scope ? (
        <TaskViewSection
          key={id}
          section={isProject ? 'project' : 'area'}
          title="Tasks"
          icon={CheckCircle2}
          views={sectionViews}
          allViews={allViews}
          drawerOpen={!!openTask || !!openNote}
          onOpenTask={setOpenTask}
          emptyHint=""
          scope={scope}
          className="mb-10"
        />
      ) : (
        <>
          <TasksBlock tasks={tasks} link={taskLink} onOpen={setOpenTask} scopeLabel={isProject ? 'Project' : 'Area'} addRef={addTaskRef} />
          <p className="-mt-8 mb-10 text-xs text-subtle">
            Muốn lọc, sắp xếp, nhóm, kéo cột… như trang Tasks: chạy <code>supabase/migrations/0013_para_task_views.sql</code> trong Supabase SQL Editor.
          </p>
        </>
      )}

      {!isProject && (
        <section aria-label="Projects" className="mb-10">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-fg">
            <FolderKanban size={18} className="text-accent" /> Projects <span className="text-sm font-normal text-subtle">{childProjects.length}</span>
          </h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {childProjects.map((p) => {
              const s = projectStats?.get(p.id)
              return (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface p-3 text-sm transition-colors hover:border-line-strong"
                >
                  <ParaIcon icon={p.icon} kind="projects" size={16} />
                  <span className={cx('flex-1 font-medium', p.completed ? 'text-subtle line-through' : 'text-fg')}>{p.name}</span>
                  {s && <span className="text-xs text-muted">{s.open} việc mở</span>}
                </Link>
              )
            })}
            <form
              className="flex items-center gap-2 rounded-xl border border-dashed border-line px-3"
              onSubmit={async (e) => {
                e.preventDefault()
                const n = newProject.trim()
                if (!n) return
                setProjectMsg(null)
                try {
                  const created = await createProject.mutateAsync({ name: n, area_id: id })
                  setNewProject('')
                  setProjectMsg({ tone: 'success', text: `Đã tạo Project “${created.name}”`, id: created.id })
                } catch (err) {
                  setProjectMsg({ tone: 'danger', text: `Không tạo được Project: ${(err as Error).message}` })
                }
              }}
            >
              <Plus size={14} className="shrink-0 text-subtle" />
              <input
                value={newProject}
                onChange={(e) => setNewProject(e.target.value)}
                placeholder="Project mới… (Enter)"
                aria-label="Project mới trong Area"
                className="h-11 w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
              />
            </form>
          </div>
          {projectMsg && (
            <p className={cx('mt-2 text-sm', projectMsg.tone === 'danger' ? 'text-danger' : 'text-success')}>
              {projectMsg.text}
              {projectMsg.id && (
                <>
                  {' · '}
                  <Link to={`/projects/${projectMsg.id}`} className="underline underline-offset-2">
                    Mở
                  </Link>
                </>
              )}
            </p>
          )}
        </section>
      )}

      <NotesBlock notes={notes} link={noteLink} onOpen={setOpenNote} />

      {openTask && <TaskDetailDrawer key={openTask.id} task={openTask} onClose={() => setOpenTask(null)} />}
      {openNote && <NoteDrawer key={openNote.id} note={openNote} onClose={() => setOpenNote(null)} />}
    </div>
  )
}
