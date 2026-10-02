import { useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { Archive, ArchiveRestore, CheckCircle2, CircleDashed, FileText, NotebookText, Plus, type LucideIcon } from 'lucide-react'
import { CompleteToggle, cx } from '../../components/ui'
import { DateCell, NameCell, SelectCell } from '../tasks/cells'
import { energyOptions, formatDuration, importanceOptions, stateOptions, urgencyOptions } from '../tasks/taskFields'
import { useCreateTask, useUpdateTask, type TaskDraft } from '../tasks/useTaskMutations'
import type { Task } from '../../lib/taskViewTypes'
import { TopicsCell } from '../notes/topics'
import { useCreateNote, useUpdateNote, type Note } from '../notes/useNotes'

const th = 'whitespace-nowrap border-r border-line px-2 py-2 text-left text-xs font-normal text-subtle last:border-r-0'
const td = 'border-r border-line p-0 align-middle last:border-r-0'

/** Khối có tiêu đề + tab view (giống linked database trong trang Notion) */
export function Block<T extends string>({
  title,
  icon: Icon,
  tabs,
  tab,
  onTab,
  children,
}: {
  title: string
  icon: LucideIcon
  tabs: Array<{ key: T; label: string; icon: LucideIcon; count: number }>
  tab: T
  onTab: (t: T) => void
  children: ReactNode
}) {
  return (
    <section aria-label={title} className="mb-10">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="mr-2 flex items-center gap-2 text-lg font-semibold text-fg">
          <Icon size={18} className="text-accent" /> {title}
        </h2>
        <div className="flex gap-1 rounded-lg bg-surface-2 p-0.5" role="tablist" aria-label={`View ${title}`}>
          {tabs.map((t) => {
            const TIcon = t.icon
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => onTab(t.key)}
                className={cx(
                  'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs transition-colors',
                  tab === t.key ? 'bg-surface font-medium text-fg shadow-sm' : 'text-muted hover:text-fg',
                )}
              >
                <TIcon size={13} /> {t.label} <span className="text-subtle">{t.count}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-surface">{children}</div>
    </section>
  )
}

function AddRow({ placeholder, label, onAdd, inputRef }: { placeholder: string; label: string; onAdd: (name: string) => Promise<unknown>; inputRef?: React.Ref<HTMLInputElement> }) {
  const [name, setName] = useState('')
  return (
    <form
      className="flex items-center gap-2 border-t border-line px-3 first:border-t-0"
      onSubmit={async (e) => {
        e.preventDefault()
        const n = name.trim()
        if (!n) return
        await onAdd(n)
        setName('')
      }}
    >
      <Plus size={15} className="shrink-0 text-subtle" />
      <input
        ref={inputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
      />
    </form>
  )
}

// ---------------------------------------------------------------------------
// Tasks: Project Tasks · Completed Tasks
// ---------------------------------------------------------------------------
export function TasksBlock({
  tasks,
  link,
  onOpen,
  scopeLabel,
  addRef,
}: {
  tasks: Task[]
  /** Giá trị gán cho task mới (area_id / project_id) */
  link: TaskDraft
  onOpen: (t: Task) => void
  scopeLabel: 'Project' | 'Area'
  addRef?: React.Ref<HTMLInputElement>
}) {
  const [tab, setTab] = useState<'open' | 'done'>('open')
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const open = tasks.filter((t) => !t.complete)
  const done = tasks.filter((t) => t.complete)
  const rows = tab === 'open' ? open : done
  const upd = (t: Task, patch: TaskDraft) => updateTask.mutate({ id: t.id, patch, refetchDelayMs: 600 })

  return (
    <Block
      title="Tasks"
      icon={CheckCircle2}
      tab={tab}
      onTab={setTab}
      tabs={[
        { key: 'open', label: `${scopeLabel} Tasks`, icon: CircleDashed, count: open.length },
        { key: 'done', label: 'Completed Tasks', icon: CheckCircle2, count: done.length },
      ]}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className="w-10" aria-label="Hoàn thành" />
              <th className={cx(th, 'min-w-[220px]')}>Tên</th>
              <th className={cx(th, 'w-28')}>Hạn</th>
              <th className={cx(th, 'w-28')}>Quan trọng</th>
              <th className={cx(th, 'w-24')}>Gấp</th>
              <th className={cx(th, 'w-28')}>Trạng thái</th>
              <th className={cx(th, 'w-28')}>Năng lượng</th>
              <th className={cx(th, 'w-20')}>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="group/row border-b border-line last:border-b-0">
                <td className="text-center">
                  <span className="grid place-items-center">
                    <CompleteToggle
                      checked={t.complete}
                      onToggle={() => upd(t, { complete: !t.complete, state: t.complete ? 'not_started' : 'done' })}
                      label={`Hoàn thành ${t.task_name}`}
                    />
                  </span>
                </td>
                <td className={td}>
                  <NameCell task={t} onSave={(task_name) => upd(t, { task_name })} onOpen={() => onOpen(t)} />
                </td>
                <td className={td}>
                  <DateCell label="Hạn" edge="end" value={t.due_at} highlightOverdue={!t.complete} onChange={(due_at) => upd(t, { due_at })} />
                </td>
                <td className={td}>
                  <SelectCell label="Quan trọng" value={t.importance} options={importanceOptions} onChange={(importance) => upd(t, { importance })} />
                </td>
                <td className={td}>
                  <SelectCell label="Gấp" value={t.urgency} options={urgencyOptions} onChange={(urgency) => upd(t, { urgency })} />
                </td>
                <td className={td}>
                  <SelectCell
                    label="Trạng thái"
                    value={t.complete ? 'done' : t.state}
                    options={stateOptions}
                    onChange={(state) => upd(t, { state, complete: state === 'done' })}
                  />
                </td>
                <td className={td}>
                  <SelectCell
                    label="Năng lượng"
                    value={t.energy_level}
                    options={energyOptions}
                    onChange={(energy_level) => upd(t, { energy_level })}
                    onClear={() => upd(t, { energy_level: null })}
                  />
                </td>
                <td className={cx(td, 'px-2 tabular-nums text-muted')}>{formatDuration(t.actual_minutes, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="px-4 py-5 text-center text-sm text-subtle">
          {tab === 'open' ? 'Chưa có việc nào đang mở — thêm task đầu tiên ở dòng bên dưới.' : 'Chưa có việc nào hoàn thành.'}
        </p>
      )}
      {tab === 'open' && (
        <AddRow
          inputRef={addRef}
          placeholder="Thêm task… (Enter)"
          label="Thêm task vào đây"
          onAdd={(task_name) => createTask.mutateAsync({ task_name, start_at: new Date().toISOString(), ...link })}
        />
      )}
    </Block>
  )
}

// ---------------------------------------------------------------------------
// Notes: Notes · Archive
// ---------------------------------------------------------------------------
export function NotesBlock({
  notes,
  link,
  onOpen,
}: {
  notes: Note[]
  link: { area_id: string | null; project_id: string | null }
  onOpen: (n: Note) => void
}) {
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const active = notes.filter((n) => !n.archived)
  const archived = notes.filter((n) => n.archived)
  const rows = tab === 'active' ? active : archived
  const when = (iso: string) => format(new Date(iso), 'dd/MM/yyyy HH:mm')

  return (
    <Block
      title="Notes"
      icon={NotebookText}
      tab={tab}
      onTab={setTab}
      tabs={[
        { key: 'active', label: 'Notes', icon: FileText, count: active.length },
        { key: 'archived', label: 'Archive', icon: Archive, count: archived.length },
      ]}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <th className={cx(th, 'min-w-[240px] pl-3')}>Tên</th>
              <th className={cx(th, 'w-56')}>Topics</th>
              <th className={cx(th, 'w-36')}>Created time</th>
              <th className={cx(th, 'w-36')}>Last edited</th>
              <th className="w-10" aria-label="Thao tác" />
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id} className="group/row border-b border-line last:border-b-0">
                <td className={td}>
                  <button type="button" onClick={() => onOpen(n)} className="flex min-h-10 w-full items-center gap-2 px-3 text-left">
                    <FileText size={14} className="shrink-0 text-subtle" />
                    <span className="font-medium text-fg">{n.title || 'Chưa đặt tên'}</span>
                  </button>
                </td>
                <td className={td}>
                  <TopicsCell value={n.topics} onChange={(topics) => updateNote.mutate({ id: n.id, patch: { topics } })} />
                </td>
                <td className={cx(td, 'whitespace-nowrap px-2 tabular-nums text-muted')}>{when(n.created_at)}</td>
                <td className={cx(td, 'whitespace-nowrap px-2 tabular-nums text-muted')}>{when(n.updated_at)}</td>
                <td className="px-1 text-center">
                  <button
                    type="button"
                    onClick={() => updateNote.mutate({ id: n.id, patch: { archived: !n.archived } })}
                    aria-label={n.archived ? `Khôi phục ${n.title}` : `Lưu trữ ${n.title}`}
                    title={n.archived ? 'Khôi phục' : 'Lưu trữ'}
                    className="grid size-7 place-items-center rounded-md text-subtle opacity-0 hover:bg-surface-2 hover:text-fg focus-visible:opacity-100 group-hover/row:opacity-100"
                  >
                    {n.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="px-4 py-5 text-center text-sm text-subtle">
          {tab === 'active' ? 'Chưa có ghi chú — gõ tên ở dòng dưới, hoặc bấm N để ghi nhanh.' : 'Chưa có ghi chú nào được lưu trữ.'}
        </p>
      )}
      {tab === 'active' && (
        <AddRow placeholder="Ghi chú mới… (Enter)" label="Thêm ghi chú vào đây" onAdd={(title) => createNote.mutateAsync({ title, ...link })} />
      )}
    </Block>
  )
}
