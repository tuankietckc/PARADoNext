import { useRef, useState } from 'react'
import { format } from 'date-fns'
import { ExternalLink, PanelRightOpen, Pencil } from 'lucide-react'
import { SelectBox, cx } from '../../components/ui'
import { RelationCell, SelectCell, cellButton } from '../tasks/cells'
import { TopicsCell } from '../notes/topics'
import { formatMinutes, kindOf, kindOptions, reviewOptions, type ColKey, type ReviewValue } from './resourceFields'
import { hrefOf, shortUrl, type Resource, type ResourceDraft } from './useResources'

const inputClass = 'min-h-10 w-full bg-surface px-2 text-sm text-fg shadow-[inset_0_0_0_2px_var(--accent)] outline-none'

/** Ô chữ: bấm để sửa tại chỗ, Enter lưu, Esc huỷ */
export function InlineInput({
  value,
  onSave,
  label,
  type = 'text',
  placeholder,
  onDone,
}: {
  value: string
  onSave: (v: string) => void
  label: string
  type?: 'text' | 'number' | 'url'
  placeholder?: string
  onDone: () => void
}) {
  const [text, setText] = useState(value)
  const cancelled = useRef(false)
  const commit = () => {
    if (cancelled.current) return
    if (text.trim() !== value.trim()) onSave(text.trim())
    onDone()
  }
  return (
    <input
      autoFocus
      type={type}
      step={type === 'number' ? 'any' : undefined}
      min={type === 'number' ? 0 : undefined}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') {
          e.stopPropagation()
          cancelled.current = true
          onDone()
        }
      }}
      aria-label={label}
      className={cx(inputClass, type === 'number' && 'text-right tabular-nums')}
    />
  )
}

export function TextCell({ value, onSave, label, muted }: { value: string | null; onSave: (v: string | null) => void; label: string; muted?: boolean }) {
  const [editing, setEditing] = useState(false)
  if (editing) return <InlineInput value={value ?? ''} label={label} onSave={(v) => onSave(v || null)} onDone={() => setEditing(false)} />
  return (
    <button type="button" aria-label={label} onClick={() => setEditing(true)} className={cellButton}>
      <span className={cx('truncate', muted ? 'text-muted' : 'text-fg')}>{value}</span>
    </button>
  )
}

export function NumberCell({ value, onSave, label }: { value: number | null; onSave: (v: number | null) => void; label: string }) {
  const [editing, setEditing] = useState(false)
  if (editing)
    return (
      <InlineInput
        type="number"
        value={value == null ? '' : String(value)}
        label={label}
        onSave={(v) => {
          const n = Number(v.replace(',', '.'))
          onSave(v === '' || isNaN(n) ? null : Math.max(0, n))
        }}
        onDone={() => setEditing(false)}
      />
    )
  return (
    <button type="button" aria-label={label} title={value != null && value >= 60 ? `${value} phút` : undefined} onClick={() => setEditing(true)} className={cx(cellButton, 'justify-end tabular-nums text-fg')}>
      {formatMinutes(value)}
    </button>
  )
}

/** URL: bấm link mở tab mới, bút chì để sửa */
export function UrlCell({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false)
  if (editing) return <InlineInput type="url" value={value ?? ''} label="URL" placeholder="https://…" onSave={(v) => onSave(v || null)} onDone={() => setEditing(false)} />
  if (!value)
    return (
      <button type="button" aria-label="URL" onClick={() => setEditing(true)} className={cellButton}>
        <span />
      </button>
    )
  return (
    <div className="group/url flex min-h-10 items-center gap-1 px-2">
      <a href={hrefOf(value)} target="_blank" rel="noreferrer" title={value} className="min-w-0 flex-1 truncate text-sm text-fg underline decoration-line-strong underline-offset-2 hover:text-accent">
        {shortUrl(value)}
      </a>
      <button type="button" aria-label="Sửa URL" onClick={() => setEditing(true)} className="grid size-6 shrink-0 place-items-center rounded text-subtle opacity-0 hover:bg-surface-2 hover:text-fg focus-visible:opacity-100 group-hover/url:opacity-100">
        <Pencil size={12} />
      </button>
    </div>
  )
}

/** Tên tài nguyên: icon theo loại, bấm để sửa tại chỗ, "Mở" để xem chi tiết */
export function TitleCell({ r, onSave, onOpen }: { r: Resource; onSave: (title: string) => void; onOpen: () => void }) {
  const [editing, setEditing] = useState(false)
  const k = kindOf(r.kind)
  if (editing) return <InlineInput value={r.title} label="Tên tài nguyên" onSave={(v) => v && onSave(v)} onDone={() => setEditing(false)} />
  return (
    <div className="flex min-h-10 items-center pr-2">
      <button type="button" onClick={() => setEditing(true)} className={cx(cellButton, 'min-w-0 flex-1 gap-2 hover:bg-transparent')}>
        <k.icon size={15} className={cx('shrink-0', k.className.split(' ').find((c) => c.startsWith('text-')))} />
        <span className={cx('truncate font-medium', r.finished ? 'text-muted' : 'text-fg')}>{r.title || <span className="font-normal text-subtle">Chưa đặt tên</span>}</span>
      </button>
      {r.url && (
        <a href={hrefOf(r.url)} target="_blank" rel="noreferrer" aria-label={`Mở link ${r.title}`} title="Mở link" className="grid size-6 shrink-0 place-items-center rounded text-subtle opacity-0 hover:bg-surface-2 hover:text-fg focus-visible:opacity-100 group-hover/row:opacity-100">
          <ExternalLink size={13} />
        </a>
      )}
      <button
        type="button"
        onClick={onOpen}
        className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted opacity-0 shadow-sm transition-opacity hover:text-fg focus-visible:opacity-100 group-hover/row:opacity-100"
      >
        <PanelRightOpen size={12} /> Mở
      </button>
    </div>
  )
}

/** 1 ô trong bảng theo cột */
export function ResourceCell({ r, col, onPatch }: { r: Resource; col: ColKey; onPatch: (patch: ResourceDraft) => void }) {
  switch (col) {
    case 'kind':
      return <SelectCell label="Loại" value={r.kind} options={kindOptions} onChange={(kind) => onPatch({ kind })} />
    case 'creator':
      return <TextCell label="Creator" value={r.creator} onSave={(creator) => onPatch({ creator })} />
    case 'project_id':
      return <RelationCell kind="projects" valueId={r.project_id} onChange={(project_id) => onPatch({ project_id })} />
    case 'area_id':
      return <RelationCell kind="areas" valueId={r.area_id} onChange={(area_id) => onPatch({ area_id })} />
    case 'topics':
      return <TopicsCell value={r.topics} onChange={(topics) => onPatch({ topics })} />
    case 'url':
      return <UrlCell value={r.url} onSave={(url) => onPatch({ url })} />
    case 'review':
      return (
        <SelectCell
          label="Reviews"
          value={r.review ? (String(r.review) as ReviewValue) : null}
          options={reviewOptions}
          onChange={(v) => onPatch({ review: Number(v) })}
          onClear={() => onPatch({ review: null })}
        />
      )
    case 'minutes':
      return <NumberCell label="Minutes" value={r.minutes} onSave={(minutes) => onPatch({ minutes })} />
    case 'finished':
      return (
        <span className="flex min-h-10 items-center px-2">
          <SelectBox checked={r.finished} onChange={() => onPatch({ finished: !r.finished })} label={`Xong ${r.title}`} />
        </span>
      )
    case 'created_at':
    case 'updated_at': {
      const v = r[col]
      return <span className="block whitespace-nowrap px-2 text-sm tabular-nums text-muted">{v && !isNaN(Date.parse(v)) ? format(new Date(v), 'dd/MM/yyyy HH:mm') : ''}</span>
    }
  }
}
