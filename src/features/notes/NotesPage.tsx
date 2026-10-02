import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { endOfDay, format, isThisYear } from 'date-fns'
import { TaskDetailDrawer } from '../tasks/TaskDetailDrawer'
import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  ListPlus,
  Clock3,
  FileText,
  Hash,
  LoaderCircle,
  PanelRightOpen,
  Plus,
  Search,
  Type,
  X,
} from 'lucide-react'
import { Button, Card, Notice, cx } from '../../components/ui'
import { RelationCell, RelationValue } from '../tasks/cells'
import { normalizeSearch } from '../tasks/taskFields'
import { NoteDrawer } from './NoteDrawer'
import { QuickNoteBox } from './QuickNote'
import { TopicTags, TopicsCell } from './topics'
import { useNotes, useUpdateNote, type Note } from './useNotes'

const th = 'whitespace-nowrap border-r border-line px-2 py-2 text-left text-xs font-normal text-subtle last:border-r-0'
const td = 'border-r border-line p-0 align-middle last:border-r-0'

const created = (iso: string) => {
  const d = new Date(iso)
  return format(d, isThisYear(d) ? 'dd/MM HH:mm' : 'dd/MM/yyyy HH:mm')
}

/**
 * Notes — giống bảng Quick Notes trong Notion: New notes / Archive,
 * cột Tên · Areas · Projects · Topics · Created time.
 */
export function NotesPage() {
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<'active' | 'archived'>(() => (params.get('tab') === 'archive' ? 'archived' : 'active'))
  const [query, setQuery] = useState('')
  const [topicFilter, setTopicFilter] = useState<string | null>(null)
  const [drawer, setDrawer] = useState<{ note?: Note } | null>(null)
  const [taskFrom, setTaskFrom] = useState<Note | null>(null)
  const { data: notes, isLoading, error } = useNotes(tab === 'archived')
  const updateNote = useUpdateNote()

  // Mở ghi chú từ link "Mở" sau khi ghi chú nhanh (/notes?open=<id>)
  const openId = params.get('open')
  useEffect(() => {
    if (!openId || !notes) return
    const n = notes.find((x) => x.id === openId)
    if (n) setDrawer({ note: n })
    setParams({}, { replace: true })
  }, [openId, notes, setParams])

  const shown = useMemo(() => {
    const q = normalizeSearch(query.trim())
    return (notes ?? []).filter(
      (n) =>
        (!topicFilter || n.topics.includes(topicFilter)) &&
        (!q || normalizeSearch(`${n.title} ${n.content ?? ''} ${n.topics.join(' ')}`).includes(q)),
    )
  }, [notes, query, topicFilter])

  const patch = (n: Note, p: Partial<Note>) => updateNote.mutate({ id: n.id, patch: p })

  return (
    <div className="mx-auto max-w-[1760px] px-4 py-8 sm:px-6">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Notes</h1>
          <p className="mt-1.5 text-sm text-muted">Ghi chú nhanh, gắn với Area · Project · Topics. Phím N để ghi từ bất kỳ đâu.</p>
        </div>
        <Button onClick={() => setDrawer({})} className="shrink-0 px-3">
          <Plus size={16} /> Mới
        </Button>
      </header>

      <QuickNoteBox className="mb-6" />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-surface-2 p-0.5" role="tablist">
          {(
            [
              ['active', 'New notes', FileText],
              ['archived', 'Archive', Archive],
            ] as const
          ).map(([key, label, Icon]) => (
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
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        {topicFilter && (
          <button
            type="button"
            onClick={() => setTopicFilter(null)}
            className="inline-flex h-7 items-center gap-1 rounded-full bg-accent-soft px-2.5 text-xs text-accent"
          >
            <Hash size={12} /> {topicFilter} <X size={12} />
          </button>
        )}
        <label className="ml-auto flex h-8 w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-sm focus-within:border-accent sm:w-64">
          <Search size={14} className="shrink-0 text-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm ghi chú…"
            aria-label="Tìm ghi chú"
            className="w-full bg-transparent text-fg outline-none placeholder:text-subtle"
          />
        </label>
      </div>

      {error && <Notice tone="danger">{(error as Error).message}</Notice>}

      <Card className="overflow-hidden">
        {isLoading && (
          <div className="grid place-items-center py-14">
            <LoaderCircle size={20} className="animate-spin text-subtle" />
          </div>
        )}

        {notes && shown.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-subtle">
            {query || topicFilter
              ? 'Không có ghi chú nào khớp.'
              : tab === 'archived'
                ? 'Chưa có ghi chú nào được lưu trữ.'
                : 'Chưa có ghi chú — gõ vào ô Ghi chú nhanh ở trên rồi Enter.'}
          </p>
        )}

        {notes && shown.length > 0 && (
          <>
            {/* Bảng — máy tính */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={cx(th, 'min-w-[260px]')}>
                      <span className="inline-flex items-center gap-1.5"><Type size={13} /> Tên</span>
                    </th>
                    <th className={cx(th, 'w-40')}>
                      <span className="inline-flex items-center gap-1.5"><ArrowUpRight size={13} /> Areas</span>
                    </th>
                    <th className={cx(th, 'w-44')}>
                      <span className="inline-flex items-center gap-1.5"><ArrowUpRight size={13} /> Projects</span>
                    </th>
                    <th className={cx(th, 'w-56')}>
                      <span className="inline-flex items-center gap-1.5"><Hash size={13} /> Topics</span>
                    </th>
                    <th className={cx(th, 'w-36')}>
                      <span className="inline-flex items-center gap-1.5"><Clock3 size={13} /> Created time</span>
                    </th>
                    <th className="w-20" aria-label="Thao tác" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((n) => (
                    <tr key={n.id} className="group/row border-b border-line last:border-b-0 hover:bg-surface-2/40">
                      <td className={td}>
                        <button
                          type="button"
                          onClick={() => setDrawer({ note: n })}
                          className="flex min-h-10 w-full items-center gap-2 px-3 py-2 text-left"
                        >
                          <FileText size={15} className="shrink-0 text-subtle" />
                          <span className="min-w-0 flex-1 font-medium text-fg">{n.title || 'Chưa đặt tên'}</span>
                          {n.content && <span className="hidden max-w-[40%] truncate text-xs text-subtle lg:inline">{n.content.split('\n')[0]}</span>}
                          <PanelRightOpen size={13} className="shrink-0 text-subtle opacity-0 group-hover/row:opacity-100" />
                        </button>
                      </td>
                      <td className={td}>
                        <RelationCell kind="areas" valueId={n.area_id} onChange={(area_id) => patch(n, { area_id })} />
                      </td>
                      <td className={td}>
                        <RelationCell kind="projects" valueId={n.project_id} onChange={(project_id) => patch(n, { project_id })} />
                      </td>
                      <td className={td}>
                        <TopicsCell value={n.topics} onChange={(topics) => patch(n, { topics })} />
                      </td>
                      <td className={cx(td, 'whitespace-nowrap px-2 text-muted tabular-nums')}>{created(n.created_at)}</td>
                      <td className="whitespace-nowrap px-1 text-center">
                        <button
                          type="button"
                          onClick={() => setTaskFrom(n)}
                          aria-label={`Tạo task từ ${n.title}`}
                          title="Tạo task từ ghi chú"
                          className="inline-grid size-7 place-items-center rounded-md text-subtle opacity-0 hover:bg-surface-2 hover:text-fg focus-visible:opacity-100 group-hover/row:opacity-100"
                        >
                          <ListPlus size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => patch(n, { archived: !n.archived })}
                          aria-label={n.archived ? `Khôi phục ${n.title}` : `Lưu trữ ${n.title}`}
                          title={n.archived ? 'Khôi phục' : 'Lưu trữ'}
                          className="inline-grid size-7 place-items-center rounded-md text-subtle opacity-0 hover:bg-surface-2 hover:text-fg focus-visible:opacity-100 group-hover/row:opacity-100"
                        >
                          {n.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Danh sách — điện thoại */}
            <ul className="sm:hidden">
              {shown.map((n) => (
                <li key={n.id} onClick={() => setDrawer({ note: n })} className="cursor-pointer border-b border-line px-4 py-3 last:border-b-0">
                  <p className="text-sm font-medium text-fg">{n.title || 'Chưa đặt tên'}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-subtle">{created(n.created_at)}</span>
                    <RelationValue kind="areas" valueId={n.area_id} />
                    <RelationValue kind="projects" valueId={n.project_id} />
                    <TopicTags topics={n.topics} max={3} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {/* Topics hay dùng → bấm để lọc */}
      {notes && notes.some((n) => n.topics.length) && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-subtle">
          <span>Lọc theo Topic:</span>
          {[...new Set(notes.flatMap((n) => n.topics))].sort().map((t) => (
            <button key={t} type="button" onClick={() => setTopicFilter(t === topicFilter ? null : t)} aria-pressed={t === topicFilter}>
              <TopicTags topics={[t]} />
            </button>
          ))}
        </div>
      )}

      {taskFrom && (
        <TaskDetailDrawer
          defaults={{
            task_name: taskFrom.title,
            notes: taskFrom.content,
            area_id: taskFrom.area_id,
            project_id: taskFrom.project_id,
            due_at: endOfDay(new Date()).toISOString(),
          }}
          notice={`Tạo từ ghi chú “${taskFrom.title}” — ghi chú vẫn được giữ nguyên.`}
          onClose={() => setTaskFrom(null)}
        />
      )}
      {drawer && <NoteDrawer key={drawer.note?.id ?? 'new'} note={drawer.note} onClose={() => setDrawer(null)} />}
    </div>
  )
}
