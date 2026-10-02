import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownUp,
  Calendar,
  CalendarDays,
  Check,
  ChevronDown,
  Columns3,
  Eye,
  EyeOff,
  GripVertical,
  Group,
  RotateCcw,
  ListFilter,
  Plus,
  Rows3,
  Trash2,
  X,
} from 'lucide-react'
import { AnchoredPopover, usePopoverAnchor } from '../../components/Popover'
import { Tag, cx } from '../../components/ui'
import type { CalendarField, GroupBy, TaskFilter, TaskSort, ViewLayout } from '../../lib/taskViewTypes'
import { groupFields, groupLabel } from './grouping'
import { columnDef, columnDefs, defaultColumns, sameColumns, type ColumnKey } from './columns'
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useParaList } from '../para/usePara'
import {
  dateChoiceKey,
  dateChoices,
  defaultFilter,
  fieldDef,
  filterFields,
  selectedValues,
  sortDef,
  sortFields,
  type FilterFieldDef,
} from './filterConfig'

const chip =
  'inline-flex h-7 max-w-[260px] items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors'
const chipActive = 'border-transparent bg-accent-soft text-accent hover:brightness-95'
const chipIdle = 'border-line text-muted hover:bg-surface-2 hover:text-fg'
// menuBase không có màu chữ → tự thêm text-* (tránh 2 class màu chữ đè nhau)
const menuBase =
  'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-surface-2'
const menuItem = `${menuBase} text-fg`
const selectClass =
  'h-8 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 text-sm text-fg outline-none focus:border-accent'

function MenuLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-subtle">{children}</p>
}

// ---------------------------------------------------------------------------
// Nhãn hiển thị trên chip, vd "Trạng thái: Chưa làm, Đang làm"
// ---------------------------------------------------------------------------
function useFilterLabel(filter: TaskFilter): string {
  const def = fieldDef(filter.field)
  const { data: projects = [] } = useParaList('projects')
  const { data: areas = [] } = useParaList('areas')
  if (!def) return filter.field

  let value = ''
  switch (def.kind) {
    case 'boolean':
      value = filter.value === true ? 'Đã xong' : 'Chưa xong'
      break
    case 'date':
      value = dateChoices.find((c) => c.key === dateChoiceKey(filter))?.label ?? '…'
      break
    case 'number':
      value = `${filter.operator === 'gte' ? '≥' : '≤'} ${filter.value ?? ''} phút`
      break
    case 'select': {
      const labels = selectedValues(filter).map((v) => def.options?.find((o) => o.value === v)?.label ?? v)
      value = labels.length ? labels.join(', ') : 'Chọn…'
      break
    }
    case 'relation': {
      if (filter.operator === 'is_null') {
        value = 'Trống'
        break
      }
      const items = def.relation === 'projects' ? projects : areas
      const names = selectedValues(filter).map((id) => items.find((i) => i.id === id)?.name ?? '…')
      value = names.length ? names.join(', ') : 'Chọn…'
      break
    }
  }
  return `${def.label}: ${value}`
}

// ---------------------------------------------------------------------------
// Editor cho từng loại trường
// ---------------------------------------------------------------------------
function FilterEditor({
  filter,
  onChange,
  onRemove,
}: {
  filter: TaskFilter
  onChange: (f: TaskFilter) => void
  onRemove: () => void
}) {
  const def = fieldDef(filter.field) as FilterFieldDef
  const relationKind = def.relation ?? 'projects'
  const { data: relationItems = [] } = useParaList(relationKind)

  const toggleValue = (v: string) => {
    const current = selectedValues(filter)
    const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v]
    onChange({ field: filter.field, operator: 'in', value: next })
  }

  return (
    <div>
      <MenuLabel>{def.label}</MenuLabel>

      {def.kind === 'boolean' &&
        [
          { v: false, label: 'Chưa xong' },
          { v: true, label: 'Đã xong' },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            className={menuItem}
            onClick={() => onChange({ field: filter.field, operator: 'eq', value: o.v })}
          >
            {o.label}
            {filter.value === o.v && <Check size={14} className="text-muted" />}
          </button>
        ))}

      {def.kind === 'select' &&
        def.options!.map((o) => (
          <button key={o.value} type="button" className={menuItem} onClick={() => toggleValue(o.value)}>
            <Tag className={o.className}>{o.label}</Tag>
            {selectedValues(filter).includes(o.value) && <Check size={14} className="text-muted" />}
          </button>
        ))}

      {def.kind === 'date' &&
        dateChoices.map((c) => (
          <button key={c.key} type="button" className={menuItem} onClick={() => onChange(c.make(filter.field))}>
            {c.label}
            {dateChoiceKey(filter) === c.key && <Check size={14} className="text-muted" />}
          </button>
        ))}

      {def.kind === 'relation' && (
        <div className="max-h-64 overflow-y-auto">
          {relationItems.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-subtle">Chưa có {def.label} nào.</p>
          )}
          {relationItems.map((item) => (
            <button key={item.id} type="button" className={menuItem} onClick={() => toggleValue(item.id)}>
              <span className="truncate">{item.name}</span>
              {filter.operator === 'in' && selectedValues(filter).includes(item.id) && (
                <Check size={14} className="shrink-0 text-muted" />
              )}
            </button>
          ))}
          <button
            type="button"
            className={cx(menuBase, 'text-muted')}
            onClick={() => onChange({ field: filter.field, operator: 'is_null' })}
          >
            Trống (chưa gán)
            {filter.operator === 'is_null' && <Check size={14} className="text-muted" />}
          </button>
        </div>
      )}

      {def.kind === 'number' && (
        <div className="flex items-center gap-2 px-2 py-1.5">
          <select
            aria-label="Điều kiện"
            value={filter.operator}
            onChange={(e) => onChange({ ...filter, operator: e.target.value as 'lte' | 'gte' })}
            className={cx(selectClass, 'flex-none')}
          >
            <option value="lte">≤</option>
            <option value="gte">≥</option>
          </select>
          <input
            type="number"
            min={0}
            autoFocus
            aria-label="Số phút"
            value={String(filter.value ?? '')}
            onChange={(e) => onChange({ ...filter, value: e.target.value === '' ? 0 : Number(e.target.value) })}
            className={cx(selectClass, 'w-20 flex-none')}
          />
          <span className="text-sm text-muted">phút</span>
        </div>
      )}

      <div className="mt-1 border-t border-line pt-1">
        <button type="button" className={cx(menuBase, 'text-danger')} onClick={onRemove}>
          Xoá bộ lọc <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}

function FilterChip({
  filter,
  onChange,
  onRemove,
  autoOpen = false,
  onAutoOpened,
}: {
  filter: TaskFilter
  onChange: (f: TaskFilter) => void
  onRemove: () => void
  autoOpen?: boolean
  onAutoOpened?: () => void
}) {
  const pop = usePopoverAnchor()
  const label = useFilterLabel(filter)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Vừa thêm bộ lọc → mở luôn editor của nó (chỉ 1 lần)
  useEffect(() => {
    if (autoOpen && buttonRef.current) {
      pop.open(buttonRef.current)
      onAutoOpened?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen])

  return (
    <>
      <button
        type="button"
        onClick={pop.toggle}
        ref={buttonRef}
        className={cx(chip, chipActive)}
        title={label}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={12} className="shrink-0" />
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={240}>
          <FilterEditor
            filter={filter}
            onChange={onChange}
            onRemove={() => {
              pop.close()
              onRemove()
            }}
          />
        </AnchoredPopover>
      )}
    </>
  )
}

function AddFilterButton({ used, onAdd }: { used: TaskFilter['field'][]; onAdd: (f: TaskFilter) => void }) {
  const pop = usePopoverAnchor()
  const available = filterFields.filter((f) => !used.includes(f.field))
  if (available.length === 0) return null
  return (
    <>
      <button type="button" onClick={pop.toggle} className={cx(chip, 'border-transparent text-subtle hover:text-fg')}>
        <Plus size={13} /> Bộ lọc
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={220}>
          <MenuLabel>Lọc theo</MenuLabel>
          {available.map((def) => (
            <button
              key={def.field}
              type="button"
              className={menuItem}
              onClick={() => {
                pop.close()
                onAdd(defaultFilter(def))
              }}
            >
              {def.label}
            </button>
          ))}
        </AnchoredPopover>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Sắp xếp
// ---------------------------------------------------------------------------
function SortButton({ sorts, onChange }: { sorts: TaskSort[]; onChange: (s: TaskSort[]) => void }) {
  const pop = usePopoverAnchor()
  const label =
    sorts.length === 0
      ? 'Thứ tự thủ công'
      : sorts.length === 1
        ? `${sortDef(sorts[0].field)?.label ?? sorts[0].field}: ${
            sorts[0].direction === 'asc' ? sortDef(sorts[0].field)?.asc : sortDef(sorts[0].field)?.desc
          }`
        : `${sorts.length} sắp xếp`
  const unused = sortFields.filter((s) => !sorts.some((x) => x.field === s.field))

  const update = (i: number, patch: Partial<TaskSort>) =>
    onChange(sorts.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))

  return (
    <>
      <button type="button" onClick={pop.toggle} className={cx(chip, sorts.length ? chipActive : chipIdle)}>
        <ArrowDownUp size={13} className="shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronDown size={12} className="shrink-0" />
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={340}>
          <MenuLabel>Sắp xếp theo (ưu tiên từ trên xuống)</MenuLabel>
          {sorts.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-subtle">Chưa sắp xếp — task theo thứ tự bạn kéo thả.</p>
          )}
          {sorts.map((s, i) => {
            const def = sortDef(s.field)
            return (
              <div key={s.field} className="flex items-center gap-1.5 px-2 py-1">
                <select
                  aria-label="Trường sắp xếp"
                  value={s.field}
                  onChange={(e) => update(i, { field: e.target.value as TaskSort['field'] })}
                  className={selectClass}
                >
                  {sortFields
                    .filter((f) => f.field === s.field || !sorts.some((x) => x.field === f.field))
                    .map((f) => (
                      <option key={f.field} value={f.field}>
                        {f.label}
                      </option>
                    ))}
                </select>
                <select
                  aria-label="Chiều sắp xếp"
                  value={s.direction}
                  onChange={(e) => update(i, { direction: e.target.value as 'asc' | 'desc' })}
                  className={selectClass}
                >
                  <option value="asc">{def?.asc ?? 'Tăng dần'}</option>
                  <option value="desc">{def?.desc ?? 'Giảm dần'}</option>
                </select>
                <button
                  type="button"
                  aria-label="Bỏ sắp xếp này"
                  onClick={() => onChange(sorts.filter((_, idx) => idx !== i))}
                  className="grid size-8 shrink-0 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg"
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}
          <div className="mt-1 flex items-center justify-between border-t border-line pt-1">
            {unused.length > 0 ? (
              <button
                type="button"
                className={cx(menuBase, 'w-auto justify-start text-muted')}
                onClick={() => onChange([...sorts, { field: unused[0].field, direction: 'asc' }])}
              >
                <Plus size={14} /> Thêm sắp xếp
              </button>
            ) : (
              <span />
            )}
            {sorts.length > 0 && (
              <button type="button" className={cx(menuBase, 'w-auto text-danger')} onClick={() => onChange([])}>
                Xoá hết
              </button>
            )}
          </div>
        </AnchoredPopover>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Bố cục: Bảng / Lịch tuần / Lịch tháng (+ lịch hiện theo ngày nào)
// ---------------------------------------------------------------------------
export type LayoutValue = { view_type: ViewLayout; calendar_field: CalendarField }

const layouts: Array<{ value: ViewLayout; label: string; icon: typeof Rows3 }> = [
  { value: 'table', label: 'Bảng', icon: Rows3 },
  { value: 'calendar_week', label: 'Lịch tuần', icon: CalendarDays },
  { value: 'calendar_month', label: 'Lịch tháng', icon: Calendar },
]

export const calendarFields: Array<{ value: CalendarField; label: string }> = [
  { value: 'due_at', label: 'Hạn' },
  { value: 'start_at', label: 'Bắt đầu' },
  { value: 'end_at', label: 'Kết thúc' },
]

function LayoutButton({ value, onChange }: { value: LayoutValue; onChange: (v: LayoutValue) => void }) {
  const pop = usePopoverAnchor()
  const current = layouts.find((l) => l.value === value.view_type) ?? layouts[0]
  const Icon = current.icon
  const isCalendar = value.view_type !== 'table'
  const fieldLabel = calendarFields.find((f) => f.value === value.calendar_field)?.label ?? 'Hạn'
  return (
    <>
      <button type="button" onClick={pop.toggle} className={cx(chip, chipIdle)} aria-label="Bố cục">
        <Icon size={13} className="shrink-0" />
        <span className="truncate">{isCalendar ? `${current.label} · theo ${fieldLabel}` : current.label}</span>
        <ChevronDown size={12} className="shrink-0" />
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={220}>
          <MenuLabel>Bố cục</MenuLabel>
          {layouts.map((l) => {
            const LIcon = l.icon
            return (
              <button
                key={l.value}
                type="button"
                className={menuItem}
                onClick={() => onChange({ ...value, view_type: l.value })}
              >
                <span className="inline-flex items-center gap-2">
                  <LIcon size={14} className="text-muted" /> {l.label}
                </span>
                {l.value === value.view_type && <Check size={14} className="text-muted" />}
              </button>
            )
          })}
          {isCalendar && (
            <>
              <div className="my-1 border-t border-line" />
              <MenuLabel>Hiện task trên lịch theo</MenuLabel>
              {calendarFields.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={menuItem}
                  onClick={() => onChange({ ...value, calendar_field: f.value })}
                >
                  {f.label}
                  {f.value === value.calendar_field && <Check size={14} className="text-muted" />}
                </button>
              ))}
            </>
          )}
        </AnchoredPopover>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Nhóm theo (Group by) — chỉ cho bố cục Bảng
// ---------------------------------------------------------------------------
function GroupButton({ value, onChange }: { value: GroupBy | null; onChange: (v: GroupBy | null) => void }) {
  const pop = usePopoverAnchor()
  return (
    <>
      <button
        type="button"
        onClick={pop.toggle}
        aria-label="Nhóm theo"
        className={cx(chip, value ? chipActive : chipIdle)}
      >
        <Group size={13} className="shrink-0" />
        <span className="truncate">{value ? `Nhóm: ${groupLabel(value)}` : 'Nhóm'}</span>
        <ChevronDown size={12} className="shrink-0" />
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={200}>
          <MenuLabel>Nhóm task theo</MenuLabel>
          <button type="button" className={cx(menuBase, 'text-muted')} onClick={() => { onChange(null); pop.close() }}>
            Không nhóm
            {value === null && <Check size={14} className="text-muted" />}
          </button>
          {groupFields.map((g) => (
            <button
              key={g.value}
              type="button"
              className={menuItem}
              onClick={() => {
                onChange(g.value)
                pop.close()
              }}
            >
              {g.label}
              {value === g.value && <Check size={14} className="text-muted" />}
            </button>
          ))}
        </AnchoredPopover>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Cột: bật/tắt và kéo đổi thứ tự (lưu ngay vào view, không đụng dữ liệu task)
// ---------------------------------------------------------------------------
function ColumnsButton({ value, onChange }: { value: ColumnKey[]; onChange: (v: ColumnKey[]) => void }) {
  const pop = usePopoverAnchor()
  const hidden = columnDefs.filter((c) => !value.includes(c.key))
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  return (
    <>
      <button
        type="button"
        onClick={pop.toggle}
        aria-label="Cột"
        className={cx(chip, chipIdle)}
        title="Ẩn/hiện và sắp xếp cột"
      >
        <Columns3 size={13} className="shrink-0" />
        <span className="truncate">{sameColumns(value, defaultColumns) ? 'Cột' : `Cột · ${value.length + 1} hiện`}</span>
        <ChevronDown size={12} className="shrink-0" />
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={240}>
          <MenuLabel>Đang hiện · kéo để đổi thứ tự</MenuLabel>
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-subtle">
            <span className="w-3.5" />
            <span className="flex-1">Tên</span>
            <span className="text-[11px]">luôn hiện</span>
          </div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={({ active, over }) => {
              if (!over || active.id === over.id) return
              onChange(arrayMove(value, value.indexOf(active.id as ColumnKey), value.indexOf(over.id as ColumnKey)))
            }}
          >
            <SortableContext items={value} strategy={verticalListSortingStrategy}>
              {value.map((key) => (
                <ColumnMenuRow key={key} column={key} onHide={() => onChange(value.filter((c) => c !== key))} />
              ))}
            </SortableContext>
          </DndContext>
          {hidden.length > 0 && (
            <>
              <div className="my-1 border-t border-line" />
              <MenuLabel>Đang ẩn</MenuLabel>
              {hidden.map((c) => {
                const Icon = c.icon
                return (
                  <button
                    key={c.key}
                    type="button"
                    className={cx(menuBase, 'text-muted')}
                    onClick={() => onChange([...value, c.key])}
                    aria-label={`Hiện cột ${c.label}`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon size={14} /> {c.label}
                    </span>
                    <EyeOff size={14} className="text-subtle" />
                  </button>
                )
              })}
            </>
          )}
          {!sameColumns(value, defaultColumns) && (
            <>
              <div className="my-1 border-t border-line" />
              <button type="button" className={cx(menuBase, 'text-muted')} onClick={() => onChange(defaultColumns)}>
                <span className="inline-flex items-center gap-2">
                  <RotateCcw size={13} /> Về mặc định
                </span>
              </button>
            </>
          )}
        </AnchoredPopover>
      )}
    </>
  )
}

function ColumnMenuRow({ column, onHide }: { column: ColumnKey; onHide: () => void }) {
  const def = columnDef(column)
  const Icon = def.icon
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: column,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg',
        isDragging ? 'relative z-10 bg-surface-2 shadow-md' : 'hover:bg-surface-2',
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Kéo cột ${def.label}`}
        className="cursor-grab touch-none text-subtle hover:text-fg active:cursor-grabbing"
      >
        <GripVertical size={14} />
      </button>
      <Icon size={14} className="text-muted" />
      <span className="flex-1">{def.label}</span>
      <button
        type="button"
        onClick={onHide}
        aria-label={`Ẩn cột ${def.label}`}
        className="rounded p-0.5 text-muted hover:bg-surface hover:text-fg"
      >
        <Eye size={14} />
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Thanh công cụ
// ---------------------------------------------------------------------------
export function ViewToolbar({
  filters,
  sorts,
  onChange,
  layout,
  onLayoutChange,
  groupBy,
  onGroupByChange,
  columns,
  onColumnsChange,
  actions,
}: {
  filters: TaskFilter[]
  sorts: TaskSort[]
  onChange: (next: { filters: TaskFilter[]; sorts: TaskSort[] }) => void
  layout?: LayoutValue
  onLayoutChange?: (next: LayoutValue) => void
  /** Có truyền → hiện chip Nhóm theo */
  groupBy?: GroupBy | null
  onGroupByChange?: (next: GroupBy | null) => void
  /** Có truyền → hiện chip Cột (ẩn/hiện, thứ tự) */
  columns?: ColumnKey[]
  onColumnsChange?: (next: ColumnKey[]) => void
  actions?: React.ReactNode
}) {
  const [justAdded, setJustAdded] = useState<string | null>(null)

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {layout && onLayoutChange && <LayoutButton value={layout} onChange={onLayoutChange} />}
      {onGroupByChange && <GroupButton value={groupBy ?? null} onChange={onGroupByChange} />}
      {columns && onColumnsChange && <ColumnsButton value={columns} onChange={onColumnsChange} />}
      <SortButton sorts={sorts} onChange={(s) => onChange({ filters, sorts: s })} />
      <span className="mx-1 h-4 w-px bg-line" aria-hidden />
      {filters.length === 0 && (
        <span className="inline-flex items-center gap-1.5 px-1 text-xs text-subtle">
          <ListFilter size={13} /> Không lọc
        </span>
      )}
      {filters.map((f, i) => (
        <FilterChip
          key={f.field}
          filter={f}
          autoOpen={justAdded === f.field}
          onAutoOpened={() => setJustAdded(null)}
          onChange={(next) => {
            onChange({ filters: filters.map((x, idx) => (idx === i ? next : x)), sorts })
          }}
          onRemove={() => {
            onChange({ filters: filters.filter((_, idx) => idx !== i), sorts })
          }}
        />
      ))}
      <AddFilterButton
        used={filters.map((f) => f.field)}
        onAdd={(f) => {
          setJustAdded(f.field)
          onChange({ filters: [...filters, f], sorts })
        }}
      />
      {actions && (
        <div className="flex w-full flex-wrap items-center justify-end gap-1.5 whitespace-nowrap sm:ml-auto sm:w-auto">
          {actions}
        </div>
      )}
    </div>
  )
}
