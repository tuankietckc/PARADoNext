import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { create } from 'zustand'
import { CornerDownLeft, NotebookPen, X } from 'lucide-react'
import { RelationCell } from '../tasks/cells'
import { cx } from '../../components/ui'
import { TopicsCell } from './topics'
import { useCreateNote, type Note } from './useNotes'

/** Mở/đóng hộp Ghi chú nhanh từ bất kỳ đâu (phím N, nút ở sidebar). */
export const useQuickNoteStore = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

/**
 * Ghi chú nhanh: gõ rồi Enter là lưu thành 1 ghi chú mới.
 * Gắn luôn Area / Project / Topics bằng các nút nhỏ bên dưới (không bắt buộc).
 * Dán nhiều dòng: dòng đầu là tên, phần còn lại là nội dung.
 */
export function QuickNoteBox({
  autoFocus = false,
  onSaved,
  className,
  defaultAreaId = null,
  defaultProjectId = null,
}: {
  autoFocus?: boolean
  onSaved?: (note: Note) => void
  className?: string
  /** Trang Area/Project: ghi chú mới tự gắn Area/Project đó */
  defaultAreaId?: string | null
  defaultProjectId?: string | null
}) {
  const createNote = useCreateNote()
  const [text, setText] = useState('')
  const [areaId, setAreaId] = useState<string | null>(defaultAreaId)
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId)
  const [topics, setTopics] = useState<string[]>([])
  const [saved, setSaved] = useState<Note | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function save() {
    const raw = text.trim()
    if (!raw || createNote.isPending) return
    const [first, ...rest] = raw.split('\n')
    setError(null)
    try {
      const note = await createNote.mutateAsync({
        title: first.trim(),
        content: rest.join('\n').trim() || null,
        area_id: areaId,
        project_id: projectId,
        topics,
      })
      setText('')
      setAreaId(defaultAreaId)
      setProjectId(defaultProjectId)
      setTopics([])
      setSaved(note)
      onSaved?.(note)
      inputRef.current?.focus()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  // Ô nhập tự cao theo nội dung (tối đa ~6 dòng)
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [text])

  return (
    <div className={cx('rounded-xl border border-line bg-surface shadow-sm focus-within:border-accent', className)}>
      <div className="flex items-start gap-2 px-3 pt-2.5">
        <NotebookPen size={16} className="mt-1.5 shrink-0 text-accent" />
        <textarea
          ref={inputRef}
          rows={1}
          autoFocus={autoFocus}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (saved) setSaved(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void save()
            }
          }}
          placeholder="Ghi chú nhanh… (Enter để lưu · Shift+Enter xuống dòng)"
          aria-label="Ghi chú nhanh"
          className="min-h-8 w-full resize-none bg-transparent py-1 text-sm text-fg outline-none placeholder:text-subtle"
        />
      </div>
      <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2.5 pt-1.5">
        <RelationCell kind="areas" variant="chip" valueId={areaId} onChange={setAreaId} />
        <RelationCell kind="projects" variant="chip" valueId={projectId} onChange={setProjectId} />
        <TopicsCell variant="chip" value={topics} onChange={setTopics} />
        <span className="ml-auto flex items-center gap-2 text-xs">
          {error && <span className="text-danger">{error}</span>}
          {saved && !error && (
            <span className="text-success">
              Đã lưu “{saved.title.length > 30 ? saved.title.slice(0, 30) + '…' : saved.title}” ·{' '}
              <Link to={`/notes?open=${saved.id}`} className="underline underline-offset-2 hover:text-fg">
                Mở
              </Link>
            </span>
          )}
          <button
            type="button"
            onClick={save}
            aria-label="Lưu ghi chú"
            disabled={!text.trim() || createNote.isPending}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-accent px-2.5 font-medium text-accent-fg disabled:opacity-40"
          >
            <CornerDownLeft size={13} /> {createNote.isPending ? 'Đang lưu…' : 'Lưu'}
          </button>
        </span>
      </div>
    </div>
  )
}

/** Hộp Ghi chú nhanh nổi (phím N ở bất kỳ trang nào). */
export function QuickNoteDialog() {
  const { open, setOpen } = useQuickNoteStore()

  // Phím N: mở ghi chú nhanh khi không đang gõ và không có hộp thoại khác
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return
      e.preventDefault()
      setOpen(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Ghi chú nhanh">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
      <div className="absolute inset-x-4 top-[12vh] mx-auto max-w-xl">
        <div className="mb-2 flex items-center justify-between px-1 text-xs text-white/80">
          <span>Ghi chú nhanh · Enter để lưu, Esc để đóng</span>
          <button type="button" aria-label="Đóng" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-white/10">
            <X size={15} />
          </button>
        </div>
        <QuickNoteBox autoFocus className="shadow-2xl" />
      </div>
    </div>
  )
}
