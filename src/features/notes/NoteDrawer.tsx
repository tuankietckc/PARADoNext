import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Archive, ArchiveRestore, ListPlus, Trash2, X } from 'lucide-react'
import { endOfDay } from 'date-fns'
import { TaskDetailDrawer } from '../tasks/TaskDetailDrawer'
import { Button, Field, Notice } from '../../components/ui'
import { RelationCell } from '../tasks/cells'
import { TopicsCell } from './topics'
import { useCreateNote, useDeleteNote, useUpdateNote, type Note, type NoteDraft } from './useNotes'

type Values = { title: string; content: string; area_id: string | null; project_id: string | null; topics: string[] }

const toValues = (n?: Note): Values => ({
  title: n?.title ?? '',
  content: n?.content ?? '',
  area_id: n?.area_id ?? null,
  project_id: n?.project_id ?? null,
  topics: n?.topics ?? [],
})

/** Trang chi tiết ghi chú (mở từ bảng Notes). note = undefined → ghi chú mới. */
export function NoteDrawer({ note, onClose }: { note?: Note; onClose: () => void }) {
  const isCreate = !note
  const [values, setValues] = useState<Values>(() => toValues(note))
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Biến ghi chú thành task: mở trang Task mới điền sẵn
  const [asTask, setAsTask] = useState(false)
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const set = <K extends keyof Values>(k: K, v: Values[K]) => setValues((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  // Nội dung tự cao theo chữ
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 220)}px`
  }, [values.content])

  async function save() {
    const title = values.title.trim()
    if (!title) {
      setError('Tên ghi chú không được để trống.')
      return
    }
    setError(null)
    const patch: NoteDraft = { ...values, title, content: values.content.trim() || null }
    try {
      if (isCreate) await createNote.mutateAsync({ ...patch, title })
      else await updateNote.mutateAsync({ id: note.id, patch })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function toggleArchive() {
    if (!note) return
    try {
      await updateNote.mutateAsync({ id: note.id, patch: { ...values, archived: !note.archived } })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function remove() {
    if (!note) return
    try {
      await deleteNote.mutateAsync(note.id)
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const saving = createNote.isPending || updateNote.isPending

  if (asTask) {
    return (
      <TaskDetailDrawer
        defaults={{
          task_name: values.title.trim(),
          notes: values.content.trim() || null,
          area_id: values.area_id,
          project_id: values.project_id,
          due_at: endOfDay(new Date()).toISOString(),
        }}
        notice={`Tạo từ ghi chú “${values.title.trim()}” — ghi chú vẫn được giữ nguyên.`}
        onClose={onClose}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={isCreate ? 'Ghi chú mới' : 'Ghi chú'}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            void save()
          }
        }}
        className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-line bg-surface shadow-2xl"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
          <h2 className="text-sm font-semibold text-fg">
            {isCreate ? 'Ghi chú mới' : note.archived ? 'Ghi chú · đã lưu trữ' : 'Ghi chú'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="grid size-8 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <input
            autoFocus={isCreate}
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Chưa đặt tên"
            aria-label="Tên ghi chú"
            className="w-full bg-transparent text-2xl font-semibold text-fg outline-none placeholder:text-subtle"
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Area" group>
              <RelationCell kind="areas" variant="field" valueId={values.area_id} onChange={(id) => set('area_id', id)} />
            </Field>
            <Field label="Project" group>
              <RelationCell kind="projects" variant="field" valueId={values.project_id} onChange={(id) => set('project_id', id)} />
            </Field>
            <Field label="Topics" group>
              <TopicsCell variant="field" value={values.topics} onChange={(t) => set('topics', t)} />
            </Field>
          </div>
          {note && (
            <p className="text-xs text-subtle">
              Tạo lúc {format(new Date(note.created_at), 'dd/MM/yyyy HH:mm')}
              {note.updated_at !== note.created_at && <> · sửa lần cuối {format(new Date(note.updated_at), 'dd/MM/yyyy HH:mm')}</>}
            </p>
          )}

          <textarea
            ref={contentRef}
            value={values.content}
            onChange={(e) => set('content', e.target.value)}
            placeholder="Viết nội dung ghi chú…"
            aria-label="Nội dung ghi chú"
            className="w-full resize-none border-t border-line bg-transparent pt-4 text-[15px] leading-relaxed text-fg outline-none placeholder:text-subtle"
          />

          {error && <Notice tone="danger">{error}</Notice>}
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-line px-5 py-3">
          {note && confirmDelete ? (
            <>
              <span className="mr-auto text-sm text-danger">Xoá hẳn ghi chú này?</span>
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Không
              </Button>
              <Button type="button" variant="destructive" onClick={remove} disabled={deleteNote.isPending}>
                Xoá
              </Button>
            </>
          ) : (
            <>
              {note && (
                <>
                  <Button type="button" variant="ghost" className="px-2.5 text-danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={15} /> Xoá
                  </Button>
                  <Button type="button" variant="ghost" className="px-2.5" onClick={toggleArchive} disabled={saving}>
                    {note.archived ? (
                      <>
                        <ArchiveRestore size={15} /> Khôi phục
                      </>
                    ) : (
                      <>
                        <Archive size={15} /> Lưu trữ
                      </>
                    )}
                  </Button>
                </>
              )}
              <span className="ml-auto" />
              {values.title.trim() && (
                <Button type="button" variant="secondary" className="px-2.5" onClick={() => setAsTask(true)} title="Tạo task từ ghi chú này">
                  <ListPlus size={15} /> Tạo task
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={onClose}>
                Huỷ
              </Button>
              <Button type="submit" disabled={saving} title="Ctrl + Enter">
                {saving ? 'Đang lưu…' : isCreate ? 'Tạo ghi chú' : 'Lưu'}
              </Button>
            </>
          )}
        </footer>
      </form>
    </div>
  )
}
