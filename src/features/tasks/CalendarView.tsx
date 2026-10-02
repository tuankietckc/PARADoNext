import { useMemo, useRef, useState } from 'react'
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { CalendarField, Task } from '../../lib/taskViewTypes'
import { CompleteToggle, Tag, cx } from '../../components/ui'
import { energyOptions, importanceOptions, optionOf } from './taskFields'

export type CalendarLayout = 'calendar_week' | 'calendar_month'

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

/** Khoảng ngày lịch đang hiển thị (tuần bắt đầu thứ 2). Dùng để chỉ tải task trong khoảng này. */
export function calendarRange(layout: CalendarLayout, anchor: Date) {
  const opts = { weekStartsOn: 1 as const }
  if (layout === 'calendar_week') return { start: startOfWeek(anchor, opts), end: endOfWeek(anchor, opts) }
  return { start: startOfWeek(startOfMonth(anchor), opts), end: endOfWeek(endOfMonth(anchor), opts) }
}

/** Đổi sang ngày khác nhưng giữ nguyên giờ (vd hạn 23:59 vẫn là 23:59 ở ngày mới). */
function moveToDay(iso: string, day: Date) {
  const d = new Date(iso)
  const next = new Date(day)
  next.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds())
  return next.toISOString()
}

type Props = {
  tasks: Task[]
  layout: CalendarLayout
  field: CalendarField
  anchor: Date
  onAnchorChange: (d: Date) => void
  onOpen: (task: Task) => void
  onToggle: (task: Task) => void
  onMove: (task: Task, iso: string) => void
  onCreate: (day: Date, name: string) => void
}

export function CalendarView({ tasks, layout, field, anchor, onAnchorChange, onOpen, onToggle, onMove, onCreate }: Props) {
  const { start, end } = calendarRange(layout, anchor)
  const days = eachDayOfInterval({ start, end })
  const isWeek = layout === 'calendar_week'
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const lastDragEnd = useRef(0)

  // Gom task theo ngày (giữ thứ tự sắp xếp của view)
  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      const value = t[field]
      if (!value) continue
      const key = dayKey(new Date(value))
      map.set(key, [...(map.get(key) ?? []), t])
    }
    return map
  }, [tasks, field])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragEnd(e: DragEndEvent) {
    setDraggingId(null)
    lastDragEnd.current = Date.now()
    const task = tasks.find((t) => t.id === e.active.id)
    const value = task?.[field]
    if (!task || !value || !e.over) return
    const target = days.find((d) => dayKey(d) === e.over!.id)
    if (!target || dayKey(new Date(value)) === e.over.id) return
    onMove(task, moveToDay(value, target))
  }

  // Bấm thẻ ngay sau khi thả → bỏ qua (tránh mở chi tiết ngoài ý muốn)
  const open = (task: Task) => {
    if (Date.now() - lastDragEnd.current > 250) onOpen(task)
  }

  const title = isWeek
    ? `${format(start, 'dd/MM')} – ${format(end, 'dd/MM/yyyy')}`
    : `Tháng ${format(anchor, 'M, yyyy')}`
  const draggingTask = tasks.find((t) => t.id === draggingId)

  return (
    <div>
      {/* Thanh điều hướng */}
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={isWeek ? 'Tuần trước' : 'Tháng trước'}
            onClick={() => onAnchorChange(isWeek ? addWeeks(anchor, -1) : addMonths(anchor, -1))}
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => onAnchorChange(new Date())}
            className="h-7 rounded-md px-2 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg"
          >
            Hôm nay
          </button>
          <button
            type="button"
            aria-label={isWeek ? 'Tuần sau' : 'Tháng sau'}
            onClick={() => onAnchorChange(isWeek ? addWeeks(anchor, 1) : addMonths(anchor, 1))}
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Máy tính: lưới 7 cột */}
      <DndContext
        sensors={sensors}
        onDragStart={(e) => setDraggingId(String(e.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggingId(null)}
      >
        <div className="hidden sm:block">
          <div className="grid grid-cols-7 border-b border-line">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={cx('px-2 py-1.5 text-center text-xs text-subtle', i >= 5 && 'bg-surface-2/40')}>
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day, i) => (
              <DayCell
                key={dayKey(day)}
                day={day}
                tasks={byDay.get(dayKey(day)) ?? []}
                tall={isWeek}
                dimmed={!isWeek && !isSameMonth(day, anchor)}
                weekend={i % 7 >= 5}
                lastInRow={i % 7 === 6}
                field={field}
                draggingId={draggingId}
                onOpen={open}
                onToggle={onToggle}
                onCreate={onCreate}
              />
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {draggingTask && <TaskCardBody task={draggingTask} field={field} floating />}
        </DragOverlay>
      </DndContext>

      {/* Điện thoại: danh sách theo ngày */}
      <div className="sm:hidden">
        {days
          .filter((d) => (byDay.get(dayKey(d))?.length ?? 0) > 0 || isToday(d))
          .map((day) => (
            <div key={dayKey(day)} className="border-b border-line px-4 py-3 last:border-0">
              <p className={cx('mb-2 text-xs font-medium', isToday(day) ? 'text-accent' : 'text-subtle')}>
                {WEEKDAYS[(day.getDay() + 6) % 7]}, {format(day, 'dd/MM')}
                {isToday(day) && ' · Hôm nay'}
              </p>
              <div className="space-y-1.5">
                {(byDay.get(dayKey(day)) ?? []).map((t) => (
                  <div key={t.id} role="button" tabIndex={0} className="block w-full text-left" onClick={() => onOpen(t)}>
                    <TaskCardBody task={t} field={field} onToggle={() => onToggle(t)} />
                  </div>
                ))}
                {(byDay.get(dayKey(day))?.length ?? 0) === 0 && <p className="text-sm text-subtle">Không có task.</p>}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}

function DayCell({
  day,
  tasks,
  tall,
  dimmed,
  weekend,
  lastInRow,
  field,
  draggingId,
  onOpen,
  onToggle,
  onCreate,
}: {
  day: Date
  tasks: Task[]
  tall: boolean
  dimmed: boolean
  weekend: boolean
  lastInRow: boolean
  field: CalendarField
  draggingId: string | null
  onOpen: (t: Task) => void
  onToggle: (t: Task) => void
  onCreate: (day: Date, name: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey(day) })
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const cancelled = useRef(false)
  const today = isToday(day)

  function submit(keepOpen: boolean) {
    if (cancelled.current) return
    if (name.trim()) onCreate(day, name.trim())
    setName('')
    if (!keepOpen) setAdding(false)
  }

  return (
    <div
      ref={setNodeRef}
      data-day={dayKey(day)}
      className={cx(
        'group/day flex flex-col gap-1 border-b border-line p-1.5 transition-colors',
        !lastInRow && 'border-r',
        tall ? 'min-h-72' : 'min-h-28',
        weekend && 'bg-surface-2/40',
        dimmed && 'bg-surface-2/60',
        isOver && 'bg-accent-soft/60',
      )}
    >
      <div className="flex h-6 items-center justify-between">
        <button
          type="button"
          aria-label={`Thêm task ngày ${format(day, 'dd/MM')}`}
          onClick={() => {
            cancelled.current = false
            setAdding(true)
          }}
          className="grid size-6 place-items-center rounded-md border border-line bg-surface text-subtle opacity-0 transition-opacity hover:text-fg focus-visible:opacity-100 group-hover/day:opacity-100"
        >
          <Plus size={13} />
        </button>
        <span
          className={cx(
            'grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs tabular-nums',
            today ? 'bg-accent font-semibold text-accent-fg' : dimmed ? 'text-subtle' : 'text-muted',
          )}
        >
          {format(day, 'd')}
        </span>
      </div>

      <div className={cx('flex flex-col gap-1', !tall && 'max-h-40 overflow-y-auto')}>
        {tasks.map((t) => (
          <DraggableCard
            key={t.id}
            task={t}
            field={field}
            hidden={draggingId === t.id}
            onOpen={() => onOpen(t)}
            onToggle={() => onToggle(t)}
          />
        ))}
        {adding && (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => submit(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit(true)
              if (e.key === 'Escape') {
                e.stopPropagation()
                cancelled.current = true
                setName('')
                setAdding(false)
              }
            }}
            placeholder="Tên task…"
            aria-label={`Tên task mới ngày ${format(day, 'dd/MM')}`}
            className="h-8 w-full rounded-md border border-accent bg-surface px-2 text-xs text-fg outline-none"
          />
        )}
      </div>
    </div>
  )
}

function DraggableCard({
  task,
  field,
  hidden,
  onOpen,
  onToggle,
}: {
  task: Task
  field: CalendarField
  hidden: boolean
  onOpen: () => void
  onToggle: () => void
}) {
  const { setNodeRef, attributes, listeners } = useDraggable({ id: task.id })
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      role="button"
      aria-label={`Mở ${task.task_name}`}
      onClick={onOpen}
      className={cx('cursor-pointer touch-none', hidden && 'opacity-30')}
    >
      <TaskCardBody task={task} field={field} onToggle={onToggle} />
    </div>
  )
}

/** Thẻ task trên lịch (giống card trong calendar của Notion). */
function TaskCardBody({
  task,
  field,
  onToggle,
  floating = false,
}: {
  task: Task
  field: CalendarField
  onToggle?: () => void
  floating?: boolean
}) {
  const value = task[field]
  const time = value && format(new Date(value), 'HH:mm')
  const showTime = field !== 'due_at' && time && time !== '00:00'
  const imp = optionOf(importanceOptions, task.importance)
  const energy = energyOptions.find((o) => o.value === task.energy_level)
  return (
    <div
      className={cx(
        'rounded-lg border border-line bg-surface px-2 py-1.5 text-left shadow-[0_1px_2px_rgb(0_0_0/0.05)] transition-colors hover:border-line-strong',
        floating && 'w-44 rotate-1 shadow-xl',
      )}
    >
      <div className="flex items-start gap-1.5">
        {onToggle && (
          <div className="pt-px" onPointerDown={(e) => e.stopPropagation()}>
            <CompleteToggle checked={task.complete} onToggle={onToggle} label={`Hoàn thành ${task.task_name}`} />
          </div>
        )}
        <p
          className={cx(
            'line-clamp-2 min-w-0 flex-1 text-xs font-medium leading-5',
            task.complete ? 'text-subtle line-through' : 'text-fg',
          )}
        >
          {task.task_name || 'Chưa đặt tên'}
        </p>
      </div>
      {(showTime || task.importance === 'high' || energy) && (
        <div className="mt-1 flex flex-wrap items-center gap-1 pl-[26px] text-[11px] text-subtle">
          {showTime && <span className="tabular-nums">{time}</span>}
          {task.importance === 'high' && <Tag className={cx(imp.className, 'text-[10px] leading-4')}>{imp.label}</Tag>}
          {energy && <Tag className={cx(energy.className, 'text-[10px] leading-4')}>{energy.label}</Tag>}
        </div>
      )}
    </div>
  )
}
