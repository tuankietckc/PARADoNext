import { useRef, useState, type ReactNode } from 'react'
import { Check, FolderKanban, Layers, PanelRightOpen, Plus, Repeat, X } from 'lucide-react'
import { format } from 'date-fns'
import { AnchoredPopover, usePopoverAnchor } from '../../components/Popover'
import { Tag, cx } from '../../components/ui'
import { DatePicker } from './DatePicker'
import { ParaIcon } from '../para/ParaIcon'
import type { Task } from '../../lib/taskViewTypes'
import { useCreateParaItem, useParaList, type ParaKind } from '../para/usePara'
import { formatDay, normalizeSearch, type Option } from './taskFields'

/** Vùng bấm phủ kín ô — giống ô trong bảng Notion. */
export const cellButton =
  'flex min-h-10 w-full items-center gap-1 px-2 text-left text-sm transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none'

function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-subtle">{children}</p>
}

const menuItem =
  'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg transition-colors hover:bg-surface-2'

// ---------------------------------------------------------------------------
// Tên task: bấm để sửa tại chỗ, di chuột hiện nút "Mở"
// ---------------------------------------------------------------------------
export function NameCell({
  task,
  onSave,
  onOpen,
}: {
  task: Task
  onSave: (name: string) => void
  onOpen: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(task.task_name)
  const cancelled = useRef(false)

  function commit() {
    if (cancelled.current) return
    const name = value.trim()
    if (name && name !== task.task_name) onSave(name)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            e.stopPropagation()
            cancelled.current = true
            setEditing(false)
          }
        }}
        aria-label="Tên task"
        className="min-h-10 w-full bg-surface px-2 text-sm text-fg shadow-[inset_0_0_0_2px_var(--accent)] outline-none"
      />
    )
  }

  return (
    <div className="flex min-h-10 items-center pr-2">
      <button
        type="button"
        onClick={() => {
          cancelled.current = false
          setValue(task.task_name)
          setEditing(true)
        }}
        className={cx(cellButton, 'min-w-0 flex-1 hover:bg-transparent')}
      >
        <span className={cx('truncate font-medium', task.complete ? 'text-subtle line-through' : 'text-fg')}>
          {task.task_name || <span className="font-normal text-subtle">Chưa đặt tên</span>}
        </span>
        {(task.repeat_rule || task.repeat_parent_id) && (
          <Repeat
            size={12}
            aria-label={task.repeat_rule ? 'Task lặp lại' : 'Bản lặp lại'}
            className={cx('shrink-0', task.repeat_rule ? 'text-info' : 'text-subtle')}
          >
            <title>{task.repeat_rule ? 'Task lặp lại — mỗi chu kỳ tự tạo 1 bản mới' : 'Bản tạo tự động từ task lặp lại'}</title>
          </Repeat>
        )}
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted opacity-0 shadow-sm transition-opacity hover:text-fg focus-visible:opacity-100 group-hover/row:opacity-100"
      >
        <PanelRightOpen size={12} /> Mở
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Select (Quan trọng / Gấp / Trạng thái)
// ---------------------------------------------------------------------------
export function SelectMenu<T extends string>({
  label,
  value,
  options,
  onChange,
  onClear,
}: {
  label: string
  value: T | null
  options: Option<T>[]
  onChange: (value: T) => void
  /** Có thì hiện thêm dòng "Bỏ chọn" (trường được để trống) */
  onClear?: () => void
}) {
  return (
    <>
      <MenuLabel>{label}</MenuLabel>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={menuItem}>
          <Tag className={o.className}>{o.label}</Tag>
          {o.value === value && <Check size={14} className="text-muted" />}
        </button>
      ))}
      {onClear && value != null && (
        <button type="button" onClick={onClear} className={cx(menuItem, 'text-subtle')}>
          Bỏ chọn
        </button>
      )}
    </>
  )
}

export function SelectCell<T extends string>({
  label,
  value,
  options,
  onChange,
  onClear,
}: {
  label: string
  value: T | null
  options: Option<T>[]
  onChange: (value: T) => void
  onClear?: () => void
}) {
  const pop = usePopoverAnchor()
  const current = options.find((o) => o.value === value)
  return (
    <>
      <button type="button" aria-label={label} onClick={pop.toggle} className={cellButton}>
        {current && <Tag className={current.className}>{current.label}</Tag>}
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={190}>
          <SelectMenu
            label={label}
            value={value}
            options={options}
            onChange={(v) => {
              onChange(v)
              pop.close()
            }}
            onClear={
              onClear &&
              (() => {
                onClear()
                pop.close()
              })
            }
          />
        </AnchoredPopover>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Ngày (Bắt đầu / Hạn)
// ---------------------------------------------------------------------------
function fullDateText(iso: string) {
  const d = new Date(iso)
  const hm = format(d, 'HH:mm')
  return format(d, 'dd/MM/yyyy') + (hm !== '00:00' && hm !== '23:59' ? ' ' + hm : '')
}

export function DateCell({
  label,
  value,
  edge,
  withTime = false,
  highlightOverdue = false,
  onChange,
  emptyLabel,
  fullDate = false,
}: {
  label: string
  value: string | null
  edge: 'start' | 'end'
  withTime?: boolean
  highlightOverdue?: boolean
  onChange: (iso: string | null) => void
  emptyLabel?: string
  /** Hiện đủ dd/MM/yyyy (trang thuộc tính) thay vì "Hôm nay"… */
  fullDate?: boolean
}) {
  const pop = usePopoverAnchor()
  // Hiện giờ nếu giá trị có giờ cụ thể (kể cả Hạn có giờ)
  const day = formatDay(value, true)
  return (
    <>
      <button type="button" aria-label={label} onClick={pop.toggle} className={cellButton}>
        <span className={cx('whitespace-nowrap tabular-nums', highlightOverdue && day.overdue ? 'font-medium text-danger' : 'text-muted')}>
          {fullDate && value ? fullDateText(value) : day.text}
          {!value && emptyLabel && <span className="text-subtle">{emptyLabel}</span>}
        </span>
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={272}>
          <DatePicker
            label={label}
            value={value}
            edge={edge}
            defaultWithTime={withTime}
            onChange={onChange}
            onDone={pop.close}
          />
        </AnchoredPopover>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Relation (Project / Area) — chọn có sẵn hoặc gõ tên để tạo mới
// ---------------------------------------------------------------------------
const paraMeta: Record<ParaKind, { label: string; icon: typeof FolderKanban; className: string }> = {
  projects: { label: 'Project', icon: FolderKanban, className: 'bg-accent-soft text-accent' },
  areas: { label: 'Area', icon: Layers, className: 'bg-info-soft text-info' },
}

export function RelationPicker({
  kind,
  valueId,
  onSelect,
}: {
  kind: ParaKind
  valueId: string | null
  onSelect: (id: string | null) => void
}) {
  const { data: items = [], isLoading } = useParaList(kind)
  const createItem = useCreateParaItem(kind)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const meta = paraMeta[kind]
  const Icon = meta.icon

  const q = normalizeSearch(query)
  const filtered = q ? items.filter((i) => normalizeSearch(i.name).includes(q)) : items
  const exact = items.some((i) => normalizeSearch(i.name) === q)
  const canCreate = query.trim().length > 0 && !exact

  async function create() {
    setError(null)
    try {
      const item = await createItem.mutateAsync(query.trim())
      onSelect(item.id)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          e.preventDefault()
          if (filtered.length === 1 && !canCreate) onSelect(filtered[0].id)
          else if (canCreate) void create()
        }}
        placeholder={`Tìm hoặc tạo ${meta.label}…`}
        className="mb-1 h-9 w-full rounded-md bg-surface-2 px-2 text-sm text-fg outline-none placeholder:text-subtle"
      />
      <div className="max-h-60 overflow-y-auto">
        {isLoading && <p className="px-2 py-1.5 text-sm text-subtle">Đang tải…</p>}
        {filtered.map((item) => (
          <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={menuItem}>
            <Tag className={meta.className}>
              {item.icon ? <ParaIcon icon={item.icon} kind={kind} size={12} /> : <Icon size={12} className="shrink-0" />}
              <span className="truncate">{item.name}</span>
            </Tag>
            {item.id === valueId && <Check size={14} className="shrink-0 text-muted" />}
          </button>
        ))}
        {!isLoading && items.length === 0 && !query && (
          <p className="px-2 py-1.5 text-sm text-subtle">Chưa có {meta.label} nào — gõ tên để tạo.</p>
        )}
        {canCreate && (
          <button type="button" onClick={create} disabled={createItem.isPending} className={cx(menuItem, 'justify-start')}>
            <Plus size={14} className="text-accent" />
            <span className="truncate">
              {createItem.isPending ? 'Đang tạo…' : <>Tạo <span className="font-medium">“{query.trim()}”</span></>}
            </span>
          </button>
        )}
        {valueId && (
          <button type="button" onClick={() => onSelect(null)} className={cx(menuItem, 'text-muted')}>
            Bỏ chọn <X size={14} />
          </button>
        )}
        {error && <p className="px-2 py-1.5 text-xs text-danger">{error}</p>}
      </div>
    </div>
  )
}

export function RelationValue({ kind, valueId }: { kind: ParaKind; valueId: string | null }) {
  const { data: items = [] } = useParaList(kind)
  if (!valueId) return null
  const item = items.find((i) => i.id === valueId)
  if (!item) return null
  const meta = paraMeta[kind]
  const Icon = meta.icon
  return (
    <Tag className={meta.className}>
      {item.icon ? <ParaIcon icon={item.icon} kind={kind} size={12} /> : <Icon size={12} className="shrink-0" />}
      <span className="truncate">{item.name}</span>
    </Tag>
  )
}

export function RelationCell({
  kind,
  valueId,
  onChange,
  variant = 'cell',
  emptyLabel,
}: {
  kind: ParaKind
  valueId: string | null
  onChange: (id: string | null) => void
  /** 'field' = dạng ô nhập trong bảng chi tiết · 'chip' = nút nhỏ (ghi chú nhanh) */
  variant?: 'cell' | 'field' | 'chip'
  /** Chữ mờ khi trống (dạng cell) — vd "Trống" trong trang thuộc tính kiểu Notion */
  emptyLabel?: string
}) {
  const pop = usePopoverAnchor()
  const meta = paraMeta[kind]
  const Icon = meta.icon
  return (
    <>
      <button
        type="button"
        aria-label={meta.label}
        onClick={pop.toggle}
        className={
          variant === 'cell'
            ? cellButton
            : variant === 'chip'
              ? cx(
                  'inline-flex h-7 max-w-[200px] items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors',
                  valueId ? 'border-transparent p-0' : 'border-line text-muted hover:bg-surface-2 hover:text-fg',
                )
              : 'flex h-10 w-full items-center rounded-lg border border-line bg-surface px-2 text-left text-sm transition-colors hover:border-line-strong'
        }
      >
        <RelationValue kind={kind} valueId={valueId} />
        {variant === 'field' && !valueId && <span className="px-1 text-subtle">Chọn {meta.label}…</span>}
        {variant === 'cell' && !valueId && emptyLabel && <span className="text-subtle">{emptyLabel}</span>}
        {variant === 'chip' && !valueId && (
          <>
            <Icon size={13} /> {meta.label}
          </>
        )}
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={260}>
          <RelationPicker
            kind={kind}
            valueId={valueId}
            onSelect={(id) => {
              onChange(id)
              pop.close()
            }}
          />
        </AnchoredPopover>
      )}
    </>
  )
}
