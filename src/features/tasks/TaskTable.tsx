import { Fragment, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  EyeOff,
  FolderKanban,
  GripVertical,
  Layers,
  Plus,
  Timer,
  Type,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { moveIds } from './reorder'
import { buildGroups, sumMinutes, type TaskGroup } from './grouping'
import { useParaList } from '../para/usePara'
import type { GroupBy, SavedView, Task, TaskSort } from '../../lib/taskViewTypes'
import { AnchoredPopover, usePopoverAnchor } from '../../components/Popover'
import { columnDef, type ColumnKey } from './columns'
import { CompleteToggle, Notice, SelectBox, Tag, cx } from '../../components/ui'
import type { TaskDraft } from './useTaskMutations'
import { useQuickCreate } from './useQuickCreate'
import { DateCell, NameCell, RelationCell, SelectCell } from './cells'
import { RepeatCell } from './RepeatPicker'
import { energyOptions, formatDay, formatDuration, importanceOptions, optionOf, stateOptions, urgencyOptions } from './taskFields'

type Handlers = {
  onOpen: (task: Task) => void
  onToggle: (task: Task) => void
  onUpdate: (task: Task, patch: TaskDraft) => void
}

export type Selection = {
  selectedIds: Set<string>
  /** shift = true khi giữ Shift → chọn cả dải từ dòng bấm trước đó */
  onSelect: (id: string, shift: boolean) => void
  onSelectAll: () => void
}

const td = 'border-r border-line p-0 align-middle last:border-r-0'

function Th({ icon: Icon, children, className }: { icon?: typeof Type; children?: ReactNode; className?: string }) {
  return (
    <th className={cx('whitespace-nowrap border-r border-line px-2 py-2 text-left text-xs font-normal text-subtle last:border-r-0', className)}>
      <span className="inline-flex items-center gap-1.5">
        {Icon && <Icon size={13} />}
        {children}
      </span>
    </th>
  )
}

/** Bảng task kiểu Notion: bấm vào ô nào sửa ô đó. */
export function TaskTable({
  tasks,
  view,
  onOpen,
  onToggle,
  onUpdate,
  onReorder,
  onRegroup,
  selection,
  columns,
  onColumnsChange,
  onSortBy,
  createDefaults,
  hideEmptyGroups = false,
}: {
  tasks: Task[]
  view: SavedView
  selection: Selection
  /** Ẩn nhóm không có task (trang Project/Area: không liệt kê Project của Area khác) */
  hideEmptyGroups?: boolean
  /** Gán sẵn cho task thêm nhanh (trang Project/Area) */
  createDefaults?: TaskDraft
  /** Các cột đang hiện, theo thứ tự (cột Tên luôn đứng đầu, không nằm trong mảng) */
  columns: ColumnKey[]
  /** Kéo tiêu đề cột / ẩn cột → thứ tự cột mới */
  onColumnsChange: (next: ColumnKey[]) => void
  /** Menu tiêu đề cột → sắp xếp theo cột đó */
  onSortBy?: (field: TaskSort['field'], direction: TaskSort['direction']) => void
  /** Thả xong: thứ tự mới của cả danh sách + các task vừa được kéo */
  onReorder: (orderedIds: string[], movedIds: string[]) => void
  /** Kéo task sang nhóm khác → gán giá trị của nhóm đó (vd đổi Area) */
  onRegroup: (tasks: Task[], patch: TaskDraft) => void
} & Handlers) {
  const quick = useQuickCreate(view, createDefaults)
  const groupBy: GroupBy | null = view.group_by ?? null
  const { data: projects = [] } = useParaList('projects')
  const { data: areas = [] } = useParaList('areas')
  const groups = useMemo(
    () => {
      if (!groupBy) return null
      const all = buildGroups(tasks, groupBy, { projects, areas })
      return hideEmptyGroups ? all.filter((g) => g.tasks.length > 0) : all
    },
    [tasks, groupBy, projects, areas, hideEmptyGroups],
  )
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggleGroup = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  // Thứ tự hiển thị: có nhóm thì nối các nhóm (bỏ nhóm đang thu gọn khỏi vùng kéo thả)
  const displayTasks = groups ? groups.flatMap((g) => g.tasks) : tasks
  const sortableIds = (groups ? groups.filter((g) => !collapsed.has(g.key)).flatMap((g) => g.tasks) : tasks).map(
    (t) => t.id,
  )
  const groupOf = useMemo(() => {
    const m = new Map<string, TaskGroup>()
    groups?.forEach((g) => g.tasks.forEach((t) => m.set(t.id, g)))
    return m
  }, [groups])
  const hasSorts = view.sorts.length > 0
  const selectedCount = tasks.filter((t) => selection.selectedIds.has(t.id)).length
  const anySelected = selectedCount > 0
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Kéo 1 dòng đang nằm trong nhóm đã chọn → kéo cả nhóm; không thì chỉ dòng đó
  const movingIds = (id: string | null): string[] => {
    if (!id) return []
    if (selection.selectedIds.has(id) && selectedCount > 1) {
      return tasks.filter((t) => selection.selectedIds.has(t.id)).map((t) => t.id)
    }
    return [id]
  }
  const dragging = movingIds(activeId)
  const activeTask = tasks.find((t) => t.id === activeId)

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = displayTasks.map((t) => t.id)
    const moved = movingIds(String(active.id))
    const overId = String(over.id)

    // Thả lên tiêu đề nhóm → chuyển vào cuối nhóm đó
    let target: TaskGroup | undefined
    let next: string[] | null
    if (overId.startsWith('group:')) {
      target = groups?.find((g) => g.key === overId.slice(6))
      if (!target) return
      const remaining = ids.filter((id) => !moved.includes(id))
      const lastInGroup = [...remaining].reverse().find((id) => groupOf.get(id)?.key === target!.key)
      const at = lastInGroup ? remaining.indexOf(lastInGroup) + 1 : remaining.length
      next = [...remaining.slice(0, at), ...moved, ...remaining.slice(at)]
      if (next.join() === ids.join()) next = null
    } else {
      target = groupOf.get(overId)
      const draggedDown = ids.indexOf(overId) > ids.indexOf(String(active.id))
      next = moveIds(ids, moved, overId, draggedDown)
    }

    // Sang nhóm khác → đổi giá trị (Area/Project/…). View có sắp xếp thì chỉ đổi nhóm, không hỏi thứ tự.
    const changing = target ? displayTasks.filter((t) => moved.includes(t.id) && groupOf.get(t.id)?.key !== target!.key) : []
    if (target && changing.length > 0) {
      onRegroup(changing, target.patch)
      if (hasSorts) return
    }
    if (next) onReorder(next, moved)
  }

  const rowProps = (task: Task) => ({
    task,
    selected: selection.selectedIds.has(task.id),
    anySelected,
    dimmed: activeId !== null && dragging.includes(task.id),
    onSelect: (shift: boolean) => selection.onSelect(task.id, shift),
    onOpen: () => onOpen(task),
    onToggle: () => onToggle(task),
    onUpdate: (patch: TaskDraft) => onUpdate(task, patch),
  })
  const totalMinutes = sumMinutes(tasks)
  const colCount = columns.length + 3
  const cellProps = { columns }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="group/head border-b border-line">
                <th className="w-12 min-w-12 pl-7" aria-label="Chọn">
                  {tasks.length > 0 && (
                    <SelectBox
                      label="Chọn tất cả"
                      checked={selectedCount === tasks.length}
                      indeterminate={anySelected && selectedCount < tasks.length}
                      onChange={selection.onSelectAll}
                      className={cx(!anySelected && 'opacity-0 focus-visible:opacity-100 group-hover/head:opacity-100')}
                    />
                  )}
                </th>
                <th className="w-11 min-w-11 border-r border-line" aria-label="Hoàn thành" />
                <Th icon={Type} className="min-w-[180px]">Tên</Th>
                <ColumnHeaders columns={columns} onChange={onColumnsChange} onSortBy={onSortBy} sorts={view.sorts} />
              </tr>
            </thead>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {groups ? (
                groups.map((g) => (
                  <tbody key={g.key}>
                    <GroupHeaderRow
                      group={g}
                      colCount={colCount}
                      collapsed={collapsed.has(g.key)}
                      onToggle={() => toggleGroup(g.key)}
                    />
                    {!collapsed.has(g.key) && (
                      <>
                        {g.tasks.map((task) => (
                          <SortableTaskRow key={task.id} {...rowProps(task)} {...cellProps} />
                        ))}
                        {g.tasks.length === 0 && !quick.canAdd && (
                          <tr>
                            <td colSpan={colCount} className="px-10 py-3 text-sm text-subtle">
                              Trống
                            </td>
                          </tr>
                        )}
                        {quick.canAdd && <NewTaskRow quick={quick} extra={g.patch} groupLabel={g.label} colCount={colCount} />}
                      </>
                    )}
                  </tbody>
                ))
              ) : (
                <tbody>
                  {tasks.map((task) => (
                    <SortableTaskRow key={task.id} {...rowProps(task)} {...cellProps} />
                  ))}
                  {tasks.length === 0 && !quick.canAdd && (
                    <tr>
                      <td colSpan={colCount} className="px-3 py-8 text-center text-sm text-subtle">
                        Không có task nào trong view này.
                      </td>
                    </tr>
                  )}
                  {quick.canAdd && <NewTaskRow quick={quick} colCount={colCount} />}
                </tbody>
              )}
            </SortableContext>
            {/* Tổng thời gian làm (giống ô SUM của Notion) */}
            <tfoot>
              <tr className="border-t border-line text-xs text-subtle">
                {columns.includes('actual_minutes') ? (
                  <>
                    <td colSpan={3 + columns.indexOf('actual_minutes')} />
                    <SumCell minutes={totalMinutes} />
                    {columns.length - columns.indexOf('actual_minutes') - 1 > 0 && (
                      <td colSpan={columns.length - columns.indexOf('actual_minutes') - 1} />
                    )}
                  </>
                ) : (
                  <>
                    <td colSpan={colCount - 1} />
                    <SumCell minutes={totalMinutes} />
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Thẻ nổi đi theo con trỏ khi kéo */}
        <DragOverlay dropAnimation={null}>
          {activeTask && (
            <div className="inline-flex max-w-80 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-fg shadow-2xl">
              <GripVertical size={14} className="shrink-0 text-subtle" />
              <span className="truncate">{activeTask.task_name || 'Chưa đặt tên'}</span>
              {dragging.length > 1 && (
                <span className="shrink-0 rounded-full bg-accent px-1.5 text-xs font-semibold text-accent-fg">
                  +{dragging.length - 1}
                </span>
              )}
            </div>
          )}
        </DragOverlay>
      </DndContext>
      {quick.message && (
        <div className="border-t border-line p-3">
          <Notice tone={quick.message.tone}>{quick.message.text}</Notice>
        </div>
      )}
    </>
  )
}

function SortableTaskRow({
  task,
  selected,
  anySelected,
  dimmed,
  onSelect,
  onOpen,
  onToggle,
  onUpdate,
  columns,
}: {
  columns: ColumnKey[]
  task: Task
  selected: boolean
  anySelected: boolean
  dimmed: boolean
  onSelect: (shift: boolean) => void
  onOpen: () => void
  onToggle: () => void
  onUpdate: (patch: TaskDraft) => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({
    id: task.id,
  })
  const update = onUpdate
  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-selected={selected}
      className={cx(
        'group/row border-b border-line',
        selected ? 'bg-accent-soft/50' : 'bg-surface',
        dimmed && 'opacity-40',
      )}
    >
      <td className="w-12 min-w-12 align-middle">
        <div className="flex items-center gap-0.5 pl-1">
          {/* Tay nắm kéo — chỉ vùng này bắt đầu kéo, các ô khác vẫn bấm để sửa như cũ */}
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Kéo để sắp xếp ${task.task_name}`}
            title="Kéo để sắp xếp"
            className="grid h-6 w-5 shrink-0 cursor-grab touch-none place-items-center rounded text-subtle opacity-0 transition-opacity hover:bg-surface-2 hover:text-fg focus-visible:opacity-100 active:cursor-grabbing group-hover/row:opacity-100"
          >
            <GripVertical size={14} />
          </button>
          <SelectBox
            label={`Chọn ${task.task_name}`}
            checked={selected}
            onChange={(e) => onSelect(e.shiftKey)}
            className={cx(!anySelected && 'opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100')}
          />
        </div>
      </td>
      <td className={cx(td, 'text-center')}>
        <div className="grid place-items-center">
          <CompleteToggle checked={task.complete} onToggle={onToggle} label={`Hoàn thành ${task.task_name}`} />
        </div>
      </td>
      <td className={td}>
        <NameCell task={task} onSave={(task_name) => update({ task_name })} onOpen={onOpen} />
      </td>
      {columns.map((key) => (
        <DataCell key={key} column={key} task={task} update={update} />
      ))}
    </tr>
  )
}

/** 1 ô dữ liệu theo loại cột */
function DataCell({ column, task, update }: { column: ColumnKey; task: Task; update: (patch: TaskDraft) => void }) {
  switch (column) {
    case 'start_at':
      return (
        <td className={td}>
          <DateCell label="Bắt đầu" edge="start" withTime value={task.start_at} onChange={(start_at) => update({ start_at })} />
        </td>
      )
    case 'due_at':
      return (
        <td className={td}>
          <DateCell
            label="Hạn"
            edge="end"
            value={task.due_at}
            highlightOverdue={!task.complete}
            onChange={(due_at) => update({ due_at })}
          />
        </td>
      )
    case 'end_at':
      return (
        <td className={td}>
          <DateCell label="Kết thúc" edge="end" withTime value={task.end_at} onChange={(end_at) => update({ end_at })} />
        </td>
      )
    case 'importance':
      return (
        <td className={td}>
          <SelectCell
            label="Quan trọng"
            value={task.importance}
            options={importanceOptions}
            onChange={(importance) => update({ importance })}
          />
        </td>
      )
    case 'urgency':
      return (
        <td className={td}>
          <SelectCell label="Gấp" value={task.urgency} options={urgencyOptions} onChange={(urgency) => update({ urgency })} />
        </td>
      )
    case 'state':
      return (
        <td className={td}>
          <SelectCell
            label="Trạng thái"
            value={task.complete ? 'done' : task.state}
            options={stateOptions}
            onChange={(state) => update({ state, complete: state === 'done' })}
          />
        </td>
      )
    case 'energy_level':
      return (
        <td className={td}>
          <SelectCell
            label="Năng lượng"
            value={task.energy_level}
            options={energyOptions}
            onChange={(energy_level) => update({ energy_level })}
            onClear={() => update({ energy_level: null })}
          />
        </td>
      )
    case 'project_id':
      return (
        <td className={td}>
          <RelationCell kind="projects" valueId={task.project_id} onChange={(project_id) => update({ project_id })} />
        </td>
      )
    case 'area_id':
      return (
        <td className={td}>
          <RelationCell kind="areas" valueId={task.area_id} onChange={(area_id) => update({ area_id })} />
        </td>
      )
    case 'repeat_rule':
      return (
        <td className={td}>
          <RepeatCell value={task.repeat_rule ?? null} onChange={(repeat_rule) => update({ repeat_rule })} />
        </td>
      )
    case 'actual_minutes':
      return (
        <td
          className={cx(td, 'px-2 tabular-nums text-muted')}
          title={
            task.actual_minutes != null
              ? `${task.actual_minutes} phút · ${task.actual_hours ?? ''} giờ`
              : 'Tự tính khi hoàn thành'
          }
        >
          {formatDuration(task.actual_minutes, true)}
        </td>
      )
  }
}

function SumCell({ minutes }: { minutes: number }) {
  return (
    <td className="px-2 py-2 tabular-nums" title={`${minutes} phút`}>
      <span className="mr-1 uppercase tracking-wide">Σ</span>
      <span className="text-muted">{formatDuration(minutes, true) || '0p'}</span>
    </td>
  )
}

// ---------------------------------------------------------------------------
// Tiêu đề cột: kéo để đổi thứ tự, bấm để mở menu (sắp xếp / dời / ẩn)
// ---------------------------------------------------------------------------
function ColumnHeaders({
  columns,
  onChange,
  onSortBy,
  sorts,
}: {
  columns: ColumnKey[]
  onChange: (next: ColumnKey[]) => void
  onSortBy?: (field: TaskSort['field'], direction: TaskSort['direction']) => void
  sorts: TaskSort[]
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const [activeKey, setActiveKey] = useState<ColumnKey | null>(null)
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ container: document.body }}
      onDragStart={(e) => setActiveKey(e.active.id as ColumnKey)}
      onDragCancel={() => setActiveKey(null)}
      onDragEnd={(e) => {
        setActiveKey(null)
        const { active, over } = e
        if (!over || active.id === over.id) return
        onChange(arrayMove(columns, columns.indexOf(active.id as ColumnKey), columns.indexOf(over.id as ColumnKey)))
      }}
    >
      <SortableContext items={columns} strategy={horizontalListSortingStrategy}>
        {columns.map((key, i) => (
          <SortableTh
            key={key}
            column={key}
            dragging={activeKey === key}
            sortDir={sorts.find((s) => s.field === columnDef(key).sortField)?.direction}
            onSortBy={onSortBy}
            onMove={(delta) => onChange(arrayMove(columns, i, i + delta))}
            canMoveLeft={i > 0}
            canMoveRight={i < columns.length - 1}
            onHide={() => onChange(columns.filter((c) => c !== key))}
          />
        ))}
      </SortableContext>
    </DndContext>
  )
}

function SortableTh({
  column,
  dragging,
  sortDir,
  onSortBy,
  onMove,
  canMoveLeft,
  canMoveRight,
  onHide,
}: {
  column: ColumnKey
  dragging: boolean
  sortDir?: TaskSort['direction']
  onSortBy?: (field: TaskSort['field'], direction: TaskSort['direction']) => void
  onMove: (delta: -1 | 1) => void
  canMoveLeft: boolean
  canMoveRight: boolean
  onHide: () => void
}) {
  const def = columnDef(column)
  const Icon = def.icon
  const pop = usePopoverAnchor()
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: column })
  const run = (fn: () => void) => () => {
    fn()
    pop.close()
  }
  return (
    <th
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform ? { ...transform, y: 0 } : null), transition }}
      className={cx(
        'relative whitespace-nowrap border-r border-line p-0 text-left text-xs font-normal text-subtle last:border-r-0',
        def.width,
        dragging && 'z-10 bg-surface-2 opacity-90 shadow-lg',
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        role="button"
        aria-label={`Cột ${def.label}`}
        title="Kéo để đổi chỗ · bấm để xem tuỳ chọn"
        onClick={pop.toggle}
        className="flex w-full cursor-grab touch-none items-center gap-1.5 px-1.5 py-2 hover:bg-surface-2 hover:text-muted active:cursor-grabbing"
      >
        <Icon size={13} className="shrink-0" />
        {def.label}
        {sortDir && (sortDir === 'asc' ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />)}
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={200}>
          {def.sortField && onSortBy && (
            <>
              <button type="button" className={headerMenuItem} onClick={run(() => onSortBy(def.sortField!, 'asc'))}>
                <ArrowUp size={14} className="text-muted" /> Sắp xếp tăng dần
              </button>
              <button type="button" className={headerMenuItem} onClick={run(() => onSortBy(def.sortField!, 'desc'))}>
                <ArrowDown size={14} className="text-muted" /> Sắp xếp giảm dần
              </button>
              <div className="my-1 border-t border-line" />
            </>
          )}
          {canMoveLeft && (
            <button type="button" className={headerMenuItem} onClick={run(() => onMove(-1))}>
              <ArrowLeft size={14} className="text-muted" /> Dời sang trái
            </button>
          )}
          {canMoveRight && (
            <button type="button" className={headerMenuItem} onClick={run(() => onMove(1))}>
              <ArrowRight size={14} className="text-muted" /> Dời sang phải
            </button>
          )}
          <button type="button" className={headerMenuItem} onClick={run(onHide)}>
            <EyeOff size={14} className="text-muted" /> Ẩn cột
          </button>
        </AnchoredPopover>
      )}
    </th>
  )
}

const headerMenuItem =
  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg transition-colors hover:bg-surface-2'

/** Tiêu đề nhóm: ▾ tên nhóm · số task · tổng thời gian. Thả task lên đây = chuyển vào nhóm. */
function GroupHeaderRow({
  group,
  colCount,
  collapsed,
  onToggle,
}: {
  group: TaskGroup
  colCount: number
  collapsed: boolean
  onToggle: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `group:${group.key}` })
  const minutes = sumMinutes(group.tasks)
  const Icon = group.kind === 'relation' ? (group.patch.area_id !== undefined ? Layers : FolderKanban) : null
  return (
    <tr ref={setNodeRef} className={cx('border-b border-line', isOver && 'bg-accent-soft/60')}>
      <td colSpan={colCount} className="px-2 pb-1.5 pt-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-sm hover:bg-surface-2"
        >
          {collapsed ? <ChevronRight size={15} className="text-subtle" /> : <ChevronDown size={15} className="text-subtle" />}
          {group.kind === 'option' ? (
            <Tag className={group.className}>{group.label}</Tag>
          ) : (
            <span className={cx('inline-flex items-center gap-1.5 font-semibold', group.kind === 'none' ? 'text-muted' : 'text-fg')}>
              {Icon && <Icon size={14} className="text-accent" />}
              {group.label}
            </span>
          )}
          <span className="ml-1 text-xs tabular-nums text-subtle">{group.tasks.length}</span>
          {minutes > 0 && (
            <span className="ml-1 text-xs tabular-nums text-subtle">· Σ {formatDuration(minutes, true)}</span>
          )}
        </button>
      </td>
    </tr>
  )
}

/**
 * Dòng "+ Thêm task" cuối bảng (giống "+ New page" của Notion).
 * Enter → lưu và mở sẵn dòng trống tiếp theo để ghi liên tục. Esc → huỷ.
 */
function NewTaskRow({
  quick,
  extra,
  groupLabel,
  colCount,
}: {
  colCount: number
  quick: ReturnType<typeof useQuickCreate>
  /** Giá trị gán thêm khi thêm trong 1 nhóm (vd area_id của nhóm) */
  extra?: TaskDraft
  groupLabel?: string
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const cancelled = useRef(false)

  function submit(keepOpen: boolean) {
    if (cancelled.current) return
    const value = name.trim()
    if (value) void quick.create(value, extra)
    setName('')
    if (!keepOpen) setAdding(false)
  }

  if (!adding) {
    return (
      <tr>
        <td />
        <td colSpan={colCount - 1} className="p-0">
          <button
            type="button"
            data-add-task
            onClick={() => {
              quick.clearMessage()
              cancelled.current = false
              setAdding(true)
            }}
            className="flex h-10 w-full items-center gap-2 px-3 text-sm text-subtle transition-colors hover:bg-surface-2 hover:text-muted"
          >
            <Plus size={16} /> Thêm task
            {groupLabel && <span className="sr-only"> vào {groupLabel}</span>}
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-line bg-surface-2/40">
      <td />
      <td className={td} />
      <td className={td}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => submit(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit(true)
            if (e.key === 'Escape') {
              cancelled.current = true
              setName('')
              setAdding(false)
            }
          }}
          placeholder="Tên task… (Enter để lưu)"
          aria-label="Tên task mới"
          className="min-h-10 w-full bg-surface px-2 text-sm text-fg shadow-[inset_0_0_0_2px_var(--accent)] outline-none placeholder:text-subtle"
        />
      </td>
      {colCount > 3 && (
        <td colSpan={colCount - 3} className="px-2 text-xs text-subtle">
          {quick.dueHint && <span className="mr-3 text-sm text-muted">Hạn: {quick.dueHint}</span>}
          {quick.isPending ? 'Đang lưu…' : 'Esc để huỷ'}
        </td>
      )}
    </tr>
  )
}

/** Danh sách cho màn hình hẹp: chạm để mở chi tiết, có dòng thêm task ở cuối. */
export function TaskList({
  tasks,
  view,
  onOpen,
  onToggle,
  createDefaults,
}: { tasks: Task[]; view: SavedView; createDefaults?: TaskDraft } & Omit<Handlers, 'onUpdate'>) {
  const quick = useQuickCreate(view, createDefaults)
  const { data: projects = [] } = useParaList('projects')
  const { data: areas = [] } = useParaList('areas')
  const groups = view.group_by ? buildGroups(tasks, view.group_by, { projects, areas }).filter((g) => g.tasks.length > 0) : null
  const headerBefore = new Map(groups?.map((g) => [g.tasks[0].id, g]))
  const [name, setName] = useState('')

  return (
    <>
      <ul>
        {(groups ? groups.flatMap((g) => g.tasks) : tasks).map((task) => {
          const due = formatDay(task.due_at)
          const imp = optionOf(importanceOptions, task.importance)
          const state = optionOf(stateOptions, task.complete ? 'done' : task.state)
          const energy = energyOptions.find((o) => o.value === task.energy_level)
          const header = headerBefore.get(task.id)
          return (
            <Fragment key={task.id}>
            {header && (
              <li className="bg-surface-2/60 px-4 pb-1.5 pt-3 text-xs font-semibold text-muted">
                {header.label} <span className="font-normal text-subtle">· {header.tasks.length}</span>
              </li>
            )}
            <li
              onClick={() => onOpen(task)}
              className="flex cursor-pointer gap-3 border-b border-line px-4 py-3 active:bg-surface-2"
            >
              <div className="pt-0.5">
                <CompleteToggle checked={task.complete} onToggle={() => onToggle(task)} label={`Hoàn thành ${task.task_name}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cx('text-sm font-medium', task.complete ? 'text-subtle line-through' : 'text-fg')}>
                  {task.task_name || 'Chưa đặt tên'}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                  {due.text && (
                    <span className={cx('mr-1', due.overdue && !task.complete ? 'font-medium text-danger' : 'text-muted')}>
                      {due.text}
                    </span>
                  )}
                  <Tag className={imp.className}>{imp.label}</Tag>
                  <Tag className={state.className}>{state.label}</Tag>
                  {energy && <Tag className={energy.className}>{energy.label}</Tag>}
                  {task.actual_minutes != null && (
                    <span className="ml-1 inline-flex items-center gap-1 text-subtle">
                      <Timer size={12} /> {formatDuration(task.actual_minutes, true)}
                    </span>
                  )}
                </div>
              </div>
            </li>
            </Fragment>
          )
        })}
      </ul>
      {quick.canAdd && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void quick.create(name)
            setName('')
          }}
          className="flex items-center gap-2 px-4"
        >
          <Plus size={16} className="shrink-0 text-subtle" />
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              quick.clearMessage()
            }}
            placeholder="Thêm task"
            aria-label="Tên task mới"
            className="h-11 min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle"
          />
        </form>
      )}
      {quick.message && (
        <div className="border-t border-line p-3">
          <Notice tone={quick.message.tone}>{quick.message.text}</Notice>
        </div>
      )}
    </>
  )
}
