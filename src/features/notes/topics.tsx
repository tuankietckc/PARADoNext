import { useState } from 'react'
import { Check, Hash, Plus, X } from 'lucide-react'
import { AnchoredPopover, usePopoverAnchor } from '../../components/Popover'
import { Tag, cx } from '../../components/ui'
import { normalizeSearch } from '../tasks/taskFields'
import { useTopicSuggestions } from './useNotes'

// Mỗi Topic 1 màu cố định (suy từ tên) — giống tag nhiều màu của Notion
const palette = [
  'bg-info-soft text-info',
  'bg-yellow-soft text-yellow',
  'bg-pink-soft text-pink',
  'bg-success-soft text-success',
  'bg-accent-soft text-accent',
  'bg-surface-2 text-muted',
]
export function topicClass(name: string) {
  let h = 0
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return palette[h % palette.length]
}

export function TopicTags({ topics, max }: { topics: string[]; max?: number }) {
  const shown = max ? topics.slice(0, max) : topics
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {shown.map((t) => (
        <Tag key={t} className={topicClass(t)}>
          {t}
        </Tag>
      ))}
      {max && topics.length > max && <span className="text-xs text-subtle">+{topics.length - max}</span>}
    </span>
  )
}

/** Chọn / tạo Topics: gõ tên + Enter để thêm, bấm để bật/tắt, × để gỡ. */
export function TopicsPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const { data: known = [] } = useTopicSuggestions()
  const [query, setQuery] = useState('')
  const q = normalizeSearch(query.trim())
  const all = [...new Set([...value, ...known])]
  const filtered = q ? all.filter((t) => normalizeSearch(t).includes(q)) : all
  const exact = all.find((t) => normalizeSearch(t) === q)
  const toggle = (t: string) => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t])

  function addTyped() {
    const name = query.trim().replace(/^#/, '')
    if (!name) return
    if (exact) {
      if (!value.includes(exact)) onChange([...value, exact])
    } else onChange([...value, name])
    setQuery('')
  }

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1 px-1">
          {value.map((t) => (
            <Tag key={t} className={topicClass(t)}>
              {t}
              <button type="button" aria-label={`Gỡ ${t}`} onClick={() => toggle(t)} className="-mr-0.5 opacity-70 hover:opacity-100">
                <X size={11} />
              </button>
            </Tag>
          ))}
        </div>
      )}
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            addTyped()
          } else if (e.key === 'Backspace' && !query && value.length) onChange(value.slice(0, -1))
        }}
        placeholder="Tìm hoặc tạo Topic…"
        aria-label="Tìm hoặc tạo Topic"
        className="mb-1 h-9 w-full rounded-md bg-surface-2 px-2 text-sm text-fg outline-none placeholder:text-subtle"
      />
      <div className="max-h-56 overflow-y-auto">
        {filtered.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => toggle(t)}
            className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg hover:bg-surface-2"
          >
            <Tag className={topicClass(t)}>{t}</Tag>
            {value.includes(t) && <Check size={14} className="text-muted" />}
          </button>
        ))}
        {query.trim() && !exact && (
          <button
            type="button"
            onClick={addTyped}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg hover:bg-surface-2"
          >
            <Plus size={14} className="text-accent" /> Tạo <span className="font-medium">“{query.trim().replace(/^#/, '')}”</span>
          </button>
        )}
        {all.length === 0 && !query && <p className="px-2 py-1.5 text-sm text-subtle">Chưa có Topic nào — gõ tên để tạo.</p>}
      </div>
    </div>
  )
}

/** Ô Topics: trong bảng (cell) hoặc dạng field (trang chi tiết / ghi chú nhanh). */
export function TopicsCell({
  value,
  onChange,
  variant = 'cell',
}: {
  value: string[]
  onChange: (next: string[]) => void
  variant?: 'cell' | 'field' | 'chip'
}) {
  const pop = usePopoverAnchor()
  return (
    <>
      <button
        type="button"
        aria-label="Topics"
        onClick={pop.toggle}
        className={cx(
          variant === 'cell' &&
            'flex min-h-10 w-full items-center px-2 py-1.5 text-left text-sm hover:bg-surface-2',
          variant === 'field' &&
            'flex min-h-10 w-full items-center rounded-lg border border-line bg-surface px-2 py-1.5 text-left text-sm transition-colors hover:border-line-strong',
          variant === 'chip' &&
            'inline-flex h-7 items-center gap-1.5 rounded-full border border-line px-2.5 text-xs text-muted hover:bg-surface-2 hover:text-fg',
        )}
      >
        {variant === 'chip' ? (
          <>
            <Hash size={13} />
            {value.length ? value.join(', ') : 'Topics'}
          </>
        ) : value.length ? (
          <TopicTags topics={value} />
        ) : (
          variant === 'field' && <span className="px-1 text-subtle">Thêm Topic…</span>
        )}
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={260}>
          <TopicsPicker value={value} onChange={onChange} />
        </AnchoredPopover>
      )}
    </>
  )
}
