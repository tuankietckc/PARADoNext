import { useEffect, useRef, type ReactNode } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDownUp, Check, ChevronDown, Columns3, Eye, EyeOff, GripVertical, LayoutGrid, List, ListFilter, Plus, RotateCcw, Rows3, Trash2, X } from 'lucide-react'
import { AnchoredPopover, usePopoverAnchor } from '../../components/Popover'
import { Tag, cx } from '../../components/ui'
import { ParaIcon } from '../para/ParaIcon'
import { useParaList } from '../para/usePara'
import { topicClass } from '../notes/topics'
import { useTopicSuggestions } from '../notes/useNotes'
import {
  colDef,
  columns,
  filterFieldDef,
  filterFields,
  groupFields,
  kindOf,
  kindOptions,
  sortFields,
  stars,
  type ColKey,
  type Filter,
  type GroupKey,
  type Layout,
  type Sort,
  type SortField,
} from './resourceFields'
import type { ResourceKind } from './useResources'

export const chip = 'inline-flex h-7 max-w-[280px] items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors'
export const chipActive = 'border-transparent bg-accent-soft text-accent hover:brightness-95'
export const chipIdle = 'border-line text-muted hover:bg-surface-2 hover:text-fg'
export const menuItem = 'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg transition-colors hover:bg-surface-2'
export const MenuLabel = ({ children }: { children: ReactNode }) => <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-subtle">{children}</p>
const selectClass = 'h-8 rounded-md border border-line bg-surface px-1.5 text-sm text-fg'

// ---------------------------------------------------------------------------
export function LayoutChip({ value, onChange }: { value: Layout; onChange: (v: Layout) => void }) {
  const pop = usePopoverAnchor()
  const Icon = value === 'table' ? List : LayoutGrid
  return (
    <>
      <button type="button" onClick={pop.toggle} aria-label="Bố cục" className={cx(chip, chipIdle)}>
        <Icon size={13} /> {value === 'table' ? 'Bảng' : 'Thẻ'} <ChevronDown size={12} />
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={180}>
          <MenuLabel>Bố cục</MenuLabel>
          {(
            [
              ['table', 'Bảng', List],
              ['gallery', 'Thẻ', LayoutGrid],
            ] as const
          ).map(([k, label, I]) => (
            <button key={k} type="button" className={menuItem} onClick={() => { onChange(k); pop.close() }}>
              <span className="inline-flex items-center gap-2"><I size={14} className="text-muted" /> {label}</span>
              {value === k && <Check size={14} className="text-muted" />}
            </button>
          ))}
        </AnchoredPopover>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
export function ColumnsChip({ value, defaults, onChange }: { value: ColKey[]; defaults: ColKey[]; onChange: (v: ColKey[]) => void }) {
  const pop = usePopoverAnchor()
  const hidden = columns.filter((c) => !value.includes(c.key))
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const isDefault = value.join() === defaults.join()
  return (
    <>
      <button type="button" onClick={pop.toggle} aria-label="Cột" className={cx(chip, chipIdle)}>
        <Columns3 size={13} /> {`Cột · ${value.length + 1}`} <ChevronDown size={12} />
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={240}>
          <MenuLabel>Đang hiện · kéo để đổi thứ tự</MenuLabel>
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-subtle">
            <span className="w-3.5" /> <span className="flex-1">Tên</span> <span className="text-[11px]">luôn hiện</span>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            accessibility={{ container: document.body }}
            onDragEnd={({ active, over }) => {
              if (over && active.id !== over.id) onChange(arrayMove(value, value.indexOf(active.id as ColKey), value.indexOf(over.id as ColKey)))
            }}
          >
            <SortableContext items={value} strategy={verticalListSortingStrategy}>
              {value.map((k) => (
                <ColumnRow key={k} col={k} onHide={() => onChange(value.filter((c) => c !== k))} />
              ))}
            </SortableContext>
          </DndContext>
          {hidden.length > 0 && (
            <>
              <div className="my-1 border-t border-line" />
              <MenuLabel>Đang ẩn</MenuLabel>
              {hidden.map((c) => (
                <button key={c.key} type="button" className={cx(menuItem, 'text-muted')} onClick={() => onChange([...value, c.key])} aria-label={`Hiện cột ${c.label}`}>
                  <span className="inline-flex items-center gap-2"><c.icon size={14} /> {c.label}</span>
                  <EyeOff size={14} className="text-subtle" />
                </button>
              ))}
            </>
          )}
          {!isDefault && (
            <>
              <div className="my-1 border-t border-line" />
              <button type="button" className={cx(menuItem, 'text-muted')} onClick={() => onChange(defaults)}>
                <span className="inline-flex items-center gap-2"><RotateCcw size={13} /> Về mặc định</span>
              </button>
            </>
          )}
        </AnchoredPopover>
      )}
    </>
  )
}

function ColumnRow({ col, onHide }: { col: ColKey; onHide: () => void }) {
  const def = colDef(col)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: col })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} className={cx('flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg', isDragging ? 'relative z-10 bg-surface-2 shadow-md' : 'hover:bg-surface-2')}>
      <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} aria-label={`Kéo cột ${def.label}`} className="cursor-grab touch-none text-subtle hover:text-fg">
        <GripVertical size={14} />
      </button>
      <def.icon size={14} className="text-muted" />
      <span className="flex-1">{def.label}</span>
      <button type="button" onClick={onHide} aria-label={`Ẩn cột ${def.label}`} className="rounded p-0.5 text-muted hover:text-fg">
        <Eye size={14} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
export function SortChip({ value, onChange }: { value: Sort[]; onChange: (v: Sort[]) => void }) {
  const pop = usePopoverAnchor()
  const first = value[0]
  const def = first && sortFields.find((s) => s.field === first.field)
  const label = def ? `${def.label}: ${first.direction === 'asc' ? def.asc : def.desc}${value.length > 1 ? ` +${value.length - 1}` : ''}` : 'Sắp xếp'
  return (
    <>
      <button type="button" onClick={pop.toggle} aria-label="Sắp xếp" className={cx(chip, value.length ? chipActive : chipIdle)}>
        <ArrowDownUp size={13} /> <span className="truncate">{label}</span> <ChevronDown size={12} />
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={320}>
          <MenuLabel>Sắp xếp (ưu tiên từ trên xuống)</MenuLabel>
          {value.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 px-1 py-1">
              <select value={s.field} aria-label="Trường sắp xếp" onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, field: e.target.value as SortField } : x)))} className={cx(selectClass, 'flex-1')}>
                {sortFields.map((f) => (
                  <option key={f.field} value={f.field}>{f.label}</option>
                ))}
              </select>
              <select value={s.direction} aria-label="Chiều sắp xếp" onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, direction: e.target.value as 'asc' | 'desc' } : x)))} className={cx(selectClass, 'w-32')}>
                <option value="asc">{sortFields.find((f) => f.field === s.field)?.asc}</option>
                <option value="desc">{sortFields.find((f) => f.field === s.field)?.desc}</option>
              </select>
              <button type="button" aria-label="Bỏ sắp xếp này" onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-danger">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button type="button" className={cx(menuItem, 'justify-start text-muted')} onClick={() => onChange([...value, { field: sortFields.find((f) => !value.some((v) => v.field === f.field))?.field ?? 'title', direction: 'desc' }])}>
            <Plus size={14} /> Thêm mức sắp xếp
          </button>
        </AnchoredPopover>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
export function GroupChip({ value, onChange }: { value: GroupKey | null; onChange: (v: GroupKey | null) => void }) {
  const pop = usePopoverAnchor()
  const def = groupFields.find((g) => g.value === value)
  return (
    <>
      <button type="button" onClick={pop.toggle} aria-label="Nhóm" className={cx(chip, value ? chipActive : chipIdle)}>
        <Rows3 size={13} /> {def ? `Nhóm: ${def.label}` : 'Nhóm'} <ChevronDown size={12} />
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={200}>
          <MenuLabel>Nhóm theo</MenuLabel>
          <button type="button" className={menuItem} onClick={() => { onChange(null); pop.close() }}>
            <span className="text-muted">Không nhóm</span>
            {!value && <Check size={14} className="text-muted" />}
          </button>
          {groupFields.map((g) => (
            <button key={g.value} type="button" className={menuItem} onClick={() => { onChange(g.value); pop.close() }}>
              <span className="inline-flex items-center gap-2"><g.icon size={14} className="text-muted" /> {g.label}</span>
              {value === g.value && <Check size={14} className="text-muted" />}
            </button>
          ))}
        </AnchoredPopover>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Bộ lọc
// ---------------------------------------------------------------------------
function useFilterText() {
  const { data: areas = [] } = useParaList('areas')
  const { data: projects = [] } = useParaList('projects')
  const nameOf = (field: 'area_id' | 'project_id', id: string) => (field === 'area_id' ? areas : projects).find((x) => x.id === id)?.name ?? '(đã lưu trữ)'
  return (f: Filter): string => {
    const label = filterFieldDef(f.field).label
    switch (f.field) {
      case 'title':
      case 'creator':
      case 'url':
        return f.op === 'empty' ? `${label} trống` : f.op === 'not_empty' ? `${label} có giá trị` : `${label} chứa: ${f.value || '…'}`
      case 'kind':
        return `${label} ${f.op === 'is' ? 'là' : 'không là'}: ${f.value.length ? f.value.map((k) => kindOf(k).label).join(', ') : '…'}`
      case 'area_id':
      case 'project_id':
        return f.op === 'empty' ? `${label} trống` : f.op === 'not_empty' ? `Có ${label}` : `${label}: ${f.value.length ? f.value.map((id) => nameOf(f.field, id)).join(', ') : '…'}`
      case 'topics':
        return f.op === 'empty' ? 'Chưa có Topic' : f.op === 'not_empty' ? 'Có Topic' : `Topics: ${f.value.length ? f.value.join(', ') : '…'}`
      case 'review':
        return f.op === 'empty' ? 'Chưa đánh giá' : `Reviews ${f.op === 'gte' ? '≥' : '='} ${stars(f.value).replace(/☆/g, '')}`
      case 'minutes':
        return f.op === 'empty' ? 'Chưa có Minutes' : `Minutes ${f.op === 'gt' ? '>' : '<'} ${f.value}`
      case 'finished':
        return f.value ? 'Đã xong' : 'Chưa xong'
    }
  }
}

function OpSelect<T extends string>({ value, options, onChange }: { value: T; options: Array<[T, string]>; onChange: (v: T) => void }) {
  return (
    <select value={value} aria-label="Điều kiện" onChange={(e) => onChange(e.target.value as T)} className={cx(selectClass, 'w-full')}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  )
}

function MultiList({ items, value, onChange, empty }: { items: Array<{ id: string; node: ReactNode }>; value: string[]; onChange: (v: string[]) => void; empty: string }) {
  if (!items.length) return <p className="px-2 py-1.5 text-sm text-subtle">{empty}</p>
  return (
    <div className="max-h-60 overflow-y-auto">
      {items.map((it) => (
        <button key={it.id} type="button" className={menuItem} onClick={() => onChange(value.includes(it.id) ? value.filter((x) => x !== it.id) : [...value, it.id])}>
          <span className="flex min-w-0 items-center gap-2">{it.node}</span>
          {value.includes(it.id) && <Check size={14} className="shrink-0 text-muted" />}
        </button>
      ))}
    </div>
  )
}

function FilterEditor({ filter, onChange }: { filter: Filter; onChange: (f: Filter) => void }) {
  const { data: areas = [] } = useParaList('areas')
  const { data: projects = [] } = useParaList('projects')
  const { data: topics = [] } = useTopicSuggestions()
  const f = filter
  switch (f.field) {
    case 'title':
    case 'creator':
    case 'url':
      return (
        <div className="space-y-2 p-1.5">
          <OpSelect value={f.op} options={[['contains', 'Chứa'], ['empty', 'Trống'], ['not_empty', 'Có giá trị']]} onChange={(op) => onChange({ ...f, op })} />
          {f.op === 'contains' && (
            <input autoFocus value={f.value} onChange={(e) => onChange({ ...f, value: e.target.value })} placeholder="Gõ chữ…" aria-label="Giá trị lọc" className="h-8 w-full rounded-md border border-line bg-surface px-2 text-sm text-fg outline-none focus:border-accent" />
          )}
        </div>
      )
    case 'kind':
      return (
        <div className="p-1">
          <div className="p-0.5 pb-1.5">
            <OpSelect value={f.op} options={[['is', 'Là 1 trong'], ['is_not', 'Không là']]} onChange={(op) => onChange({ ...f, op })} />
          </div>
          <MultiList
            empty=""
            value={f.value}
            onChange={(v) => onChange({ ...f, value: v as ResourceKind[] })}
            items={kindOptions.map((o) => ({ id: o.value, node: <Tag className={o.className}>{o.label}</Tag> }))}
          />
        </div>
      )
    case 'area_id':
    case 'project_id': {
      const kind = f.field === 'area_id' ? 'areas' : 'projects'
      const list = f.field === 'area_id' ? areas : projects
      return (
        <div className="p-1">
          <div className="p-0.5 pb-1.5">
            <OpSelect value={f.op} options={[['is', 'Là 1 trong'], ['empty', 'Trống'], ['not_empty', 'Có giá trị']]} onChange={(op) => onChange({ ...f, op })} />
          </div>
          {f.op === 'is' && (
            <MultiList
              empty="Chưa có mục nào."
              value={f.value}
              onChange={(v) => onChange({ ...f, value: v })}
              items={list.map((x) => ({ id: x.id, node: <><ParaIcon icon={x.icon} kind={kind} size={14} /> <span className="truncate">{x.name}</span></> }))}
            />
          )}
        </div>
      )
    }
    case 'topics':
      return (
        <div className="p-1">
          <div className="p-0.5 pb-1.5">
            <OpSelect value={f.op} options={[['has', 'Có 1 trong'], ['empty', 'Chưa có Topic'], ['not_empty', 'Có Topic']]} onChange={(op) => onChange({ ...f, op })} />
          </div>
          {f.op === 'has' && (
            <MultiList empty="Chưa có Topic nào." value={f.value} onChange={(v) => onChange({ ...f, value: v })} items={topics.map((t) => ({ id: t, node: <Tag className={topicClass(t)}>{t}</Tag> }))} />
          )}
        </div>
      )
    case 'review':
      return (
        <div className="space-y-2 p-1.5">
          <OpSelect value={f.op} options={[['gte', 'Từ … sao trở lên'], ['eq', 'Đúng … sao'], ['empty', 'Chưa đánh giá']]} onChange={(op) => onChange({ ...f, op })} />
          {f.op !== 'empty' && (
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-label={`${n} sao`} onClick={() => onChange({ ...f, value: n })} className={cx('h-8 flex-1 rounded-md border text-sm', f.value === n ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:bg-surface-2')}>
                  {n}★
                </button>
              ))}
            </div>
          )}
        </div>
      )
    case 'minutes':
      return (
        <div className="space-y-2 p-1.5">
          <OpSelect value={f.op} options={[['lt', 'Ngắn hơn (<)'], ['gt', 'Dài hơn (>)'], ['empty', 'Chưa có']]} onChange={(op) => onChange({ ...f, op })} />
          {f.op !== 'empty' && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input autoFocus type="number" min={0} value={f.value} onChange={(e) => onChange({ ...f, value: Number(e.target.value) || 0 })} aria-label="Số phút" className="h-8 flex-1 rounded-md border border-line bg-surface px-2 text-sm text-fg outline-none focus:border-accent" />
              phút
            </label>
          )}
        </div>
      )
    case 'finished':
      return (
        <div className="p-1">
          {([
            [false, 'Chưa xong'],
            [true, 'Đã xong'],
          ] as const).map(([v, l]) => (
            <button key={String(v)} type="button" className={menuItem} onClick={() => onChange({ ...f, value: v })}>
              {l}
              {f.value === v && <Check size={14} className="text-muted" />}
            </button>
          ))}
        </div>
      )
  }
}

export function FilterChip({ filter, onChange, onRemove, autoOpen = false }: { filter: Filter; onChange: (f: Filter) => void; onRemove: () => void; autoOpen?: boolean }) {
  const pop = usePopoverAnchor()
  const btn = useRef<HTMLButtonElement>(null)
  // Vừa thêm bộ lọc → mở ngay ô chọn giá trị (giống Notion)
  useEffect(() => {
    if (autoOpen && btn.current) pop.open(btn.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const text = useFilterText()
  const Icon = filterFieldDef(filter.field).icon
  return (
    <>
      <span className={cx(chip, chipActive, 'pr-1')}>
        <button ref={btn} type="button" onClick={pop.toggle} className="inline-flex min-w-0 items-center gap-1.5" aria-label={`Bộ lọc ${text(filter)}`}>
          <Icon size={12} className="shrink-0" /> <span className="truncate">{text(filter)}</span>
        </button>
        <button type="button" aria-label="Bỏ bộ lọc" onClick={onRemove} className="grid size-5 shrink-0 place-items-center rounded-full hover:bg-accent/15">
          <X size={11} />
        </button>
      </span>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={260}>
          <FilterEditor filter={filter} onChange={onChange} />
        </AnchoredPopover>
      )}
    </>
  )
}

export function AddFilter({ onAdd }: { onAdd: (f: Filter) => void }) {
  const pop = usePopoverAnchor()
  return (
    <>
      <button type="button" onClick={pop.toggle} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg">
        <Plus size={13} /> Bộ lọc
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={220}>
          <MenuLabel>Lọc theo</MenuLabel>
          {filterFields.map((f) => (
            <button key={f.field} type="button" className={menuItem} onClick={() => { onAdd(f.initial); pop.close() }}>
              <span className="inline-flex items-center gap-2"><f.icon size={14} className="text-muted" /> {f.label}</span>
            </button>
          ))}
        </AnchoredPopover>
      )}
    </>
  )
}

export function NoFilter() {
  return (
    <span className="inline-flex items-center gap-1.5 px-1 text-xs text-subtle">
      <ListFilter size={13} /> Không lọc
    </span>
  )
}
