import { Fragment, useMemo, useState } from 'react'
import { addDays, addWeeks, format, isAfter, isSameDay, startOfDay, subDays, subWeeks } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Archive, ArchiveRestore, Check, ChevronLeft, ChevronRight, Flame, LoaderCircle, Plus, Repeat, Trash2, X } from 'lucide-react'
import { AnchoredPopover, usePopoverAnchor } from '../../components/Popover'
import { Button, Card, Notice, cx } from '../../components/ui'
import { IconPicker } from '../para/ParaIcon'
import { RelationCell } from '../tasks/cells'
import {
  dayKey,
  habitStats,
  isoDow,
  useCreateHabit,
  useDeleteHabit,
  useHabitLogs,
  useHabits,
  useToggleHabitDay,
  useUpdateHabit,
  weekDays,
  type Habit,
  type HabitStats,
} from './useHabits'

const dayShort = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const pct = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`)

export function HabitsPage() {
  const { data: habits, isLoading, error } = useHabits()
  const { data: logs = [] } = useHabitLogs()
  const create = useCreateHabit()
  const [anchor, setAnchor] = useState(() => new Date())
  const [name, setName] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const today = startOfDay(new Date())
  const days = weekDays(anchor)
  const isThisWeek = days.some((d) => isSameDay(d, today))

  const doneMap = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const l of logs) {
      if (!m.has(l.habit_id)) m.set(l.habit_id, new Set())
      m.get(l.habit_id)!.add(l.day)
    }
    return m
  }, [logs])
  const doneOf = (id: string) => doneMap.get(id) ?? new Set<string>()

  const active = (habits ?? []).filter((h) => !h.archived)
  const archived = (habits ?? []).filter((h) => h.archived)
  const stats = new Map(active.map((h) => [h.id, habitStats(h, doneOf(h.id))]))
  const dueToday = active.filter((h) => h.days.includes(isoDow(today)))
  const doneToday = dueToday.filter((h) => doneOf(h.id).has(dayKey(today))).length

  async function add() {
    const n = name.trim()
    if (!n) return
    await create.mutateAsync({ name: n, sort_order: Math.max(0, ...(habits ?? []).map((h) => h.sort_order)) + 1 })
    setName('')
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-fg">
            <Repeat size={22} className="text-accent" /> Thói quen
          </h1>
          <p className="mt-1.5 text-sm text-muted">Tick mỗi ngày làm được. Chuỗi 🔥 chỉ tính những ngày bạn chọn là “cần làm”, ngày nghỉ không làm đứt chuỗi.</p>
        </div>
        {dueToday.length > 0 && (
          <div className="w-56" aria-label="Tiến độ hôm nay">
            <p className="text-xs text-muted">Hôm nay</p>
            <p className="text-2xl font-semibold text-fg">
              {doneToday}
              <span className="text-base font-normal text-subtle">/{dueToday.length}</span>
            </p>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full rounded-full bg-chart transition-[width]" style={{ width: `${(doneToday / dueToday.length) * 100}%` }} />
            </span>
          </div>
        )}
      </header>

      {error && <Notice tone="danger">{(error as Error).message}</Notice>}
      {isLoading && (
        <div className="grid place-items-center py-14">
          <LoaderCircle size={20} className="animate-spin text-subtle" />
        </div>
      )}

      {habits && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <button type="button" aria-label="Tuần trước" onClick={() => setAnchor(subWeeks(anchor, 1))} className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg">
              <ChevronLeft size={16} />
            </button>
            <button type="button" aria-label="Tuần sau" disabled={isThisWeek} onClick={() => setAnchor(addWeeks(anchor, 1))} className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
            <span className="text-sm font-medium text-fg">
              {format(days[0], 'dd/MM')} – {format(days[6], 'dd/MM/yyyy')}
            </span>
            {!isThisWeek && (
              <button type="button" onClick={() => setAnchor(new Date())} className="ml-1 rounded-md px-2 py-1 text-xs text-accent hover:bg-accent-soft">
                Tuần này
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-subtle">
                  <th className="min-w-[220px] px-3 py-2 text-left font-normal">Thói quen</th>
                  {days.map((d) => (
                    <th key={d.toISOString()} className={cx('w-12 px-1 py-2 text-center font-normal', isSameDay(d, today) && 'text-accent')}>
                      <span className="block">{dayShort[isoDow(d) - 1]}</span>
                      <span className={cx('block tabular-nums', isSameDay(d, today) ? 'font-semibold' : 'text-subtle')}>{format(d, 'dd')}</span>
                    </th>
                  ))}
                  <th className="w-20 px-2 py-2 text-right font-normal" title="Chuỗi ngày cần làm liên tiếp đã làm">Chuỗi</th>
                  <th className="w-20 px-3 py-2 text-right font-normal" title="Tỉ lệ làm được trong 30 ngày qua">30 ngày</th>
                </tr>
              </thead>
              <tbody>
                {active.map((h) => (
                  <Fragment key={h.id}>
                    <HabitRow
                      habit={h}
                      days={days}
                      today={today}
                      done={doneOf(h.id)}
                      stats={stats.get(h.id)!}
                      open={open === h.id}
                      onToggleOpen={() => setOpen(open === h.id ? null : h.id)}
                    />
                    {open === h.id && (
                      <tr className="border-b border-line bg-surface-2/30">
                        <td colSpan={10} className="px-4 py-4">
                          <HabitDetail habit={h} done={doneOf(h.id)} stats={stats.get(h.id)!} onClose={() => setOpen(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          {active.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-subtle">Chưa có thói quen nào. Bắt đầu với 1 việc nhỏ: “Đọc 10 trang sách”, “Đi bộ 15 phút”…</p>
          )}
          <form
            className="flex items-center gap-2 border-t border-line px-3"
            onSubmit={(e) => {
              e.preventDefault()
              void add()
            }}
          >
            <Plus size={15} className="shrink-0 text-subtle" />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Thói quen mới… (Enter)" aria-label="Thêm thói quen" className="h-11 w-full bg-transparent text-sm text-fg outline-none placeholder:text-subtle" />
          </form>
        </Card>
      )}
      {create.error && <div className="mt-3"><Notice tone="danger">{(create.error as Error).message}</Notice></div>}

      {archived.length > 0 && (
        <section className="mt-6">
          <button type="button" onClick={() => setShowArchived((v) => !v)} className="flex items-center gap-1.5 text-sm text-muted hover:text-fg">
            <ChevronRight size={14} className={cx('transition-transform', showArchived && 'rotate-90')} /> Đã lưu trữ ({archived.length})
          </button>
          {showArchived && <ArchivedList habits={archived} />}
        </section>
      )}
    </div>
  )
}

function HabitRow({
  habit: h,
  days,
  today,
  done,
  stats,
  open,
  onToggleOpen,
}: {
  habit: Habit
  days: Date[]
  today: Date
  done: Set<string>
  stats: HabitStats
  open: boolean
  onToggleOpen: () => void
}) {
  const toggle = useToggleHabitDay()
  return (
    <tr className={cx('border-b border-line', open ? 'bg-surface-2/30' : 'hover:bg-surface-2/40')}>
      <td className="px-3 py-1.5">
        <button type="button" onClick={onToggleOpen} aria-expanded={open} className="flex w-full items-center gap-2 text-left">
          <span className="grid size-6 shrink-0 place-items-center text-base">{h.icon ?? '•'}</span>
          <span className="min-w-0">
            <span className="block truncate font-medium text-fg">{h.name}</span>
            {h.days.length < 7 && <span className="block text-[11px] text-subtle">{h.days.map((d) => dayShort[d - 1]).join(' · ')}</span>}
          </span>
        </button>
      </td>
      {days.map((d) => {
        const key = dayKey(d)
        const isDone = done.has(key)
        const needed = h.days.includes(isoDow(d))
        const future = isAfter(d, today)
        return (
          <td key={key} className="px-1 py-1.5 text-center">
            <button
              type="button"
              role="checkbox"
              aria-checked={isDone}
              disabled={future}
              aria-label={`${h.name} ${format(d, 'EEEE dd/MM', { locale: vi })}${needed ? '' : ' (ngày nghỉ)'}`}
              onClick={() => toggle.mutate({ habitId: h.id, day: key, done: !isDone })}
              className={cx(
                'mx-auto grid size-8 place-items-center rounded-full border-[1.5px] transition-colors disabled:cursor-default',
                isDone
                  ? 'border-chart bg-chart text-white'
                  : future
                    ? 'border-transparent'
                    : needed
                      ? 'border-line-strong hover:border-chart'
                      : 'border-dashed border-line hover:border-line-strong',
                isSameDay(d, today) && !isDone && 'ring-2 ring-accent/25',
              )}
            >
              {isDone && <Check size={15} strokeWidth={3} />}
            </button>
          </td>
        )
      })}
      <td className="px-2 py-1.5 text-right tabular-nums">
        {stats.streak > 0 ? (
          <span className="inline-flex items-center gap-0.5 font-semibold text-fg" title={`Chuỗi hiện tại ${stats.streak} ngày · dài nhất ${stats.best}`}>
            <Flame size={14} className="text-accent" /> {stats.streak}
          </span>
        ) : (
          <span className="text-subtle">0</span>
        )}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums text-muted">{pct(stats.rate30)}</td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Chi tiết: bản đồ nhiệt 16 tuần + chỉnh sửa
// ---------------------------------------------------------------------------
function HabitDetail({ habit: h, done, stats, onClose }: { habit: Habit; done: Set<string>; stats: HabitStats; onClose: () => void }) {
  const update = useUpdateHabit()
  const del = useDeleteHabit()
  const [name, setName] = useState(h.name)
  const [confirm, setConfirm] = useState(false)
  const iconPop = usePopoverAnchor()
  const patch = (p: Parameters<typeof update.mutate>[0]['patch']) => update.mutate({ id: h.id, patch: p })

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <div>
        <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2" aria-label="Thống kê thói quen">
          <Stat label="Chuỗi hiện tại" value={`${stats.streak} ngày`} />
          <Stat label="Dài nhất" value={`${stats.best} ngày`} />
          <Stat label="30 ngày qua" value={pct(stats.rate30)} />
        </div>
        <Heatmap habit={h} done={done} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <button type="button" onClick={iconPop.toggle} aria-label="Đổi icon" className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-xl hover:bg-surface-2">
            {h.icon ?? '•'}
          </button>
          {iconPop.anchor && (
            <AnchoredPopover anchor={iconPop.anchor} onClose={iconPop.close} width={320}>
              <IconPicker
                value={h.icon}
                onChange={(icon) => {
                  patch({ icon })
                  iconPop.close()
                }}
              />
            </AnchoredPopover>
          )}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name.trim() !== h.name && patch({ name: name.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label="Tên thói quen"
            className="h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm font-medium text-fg outline-none focus:border-accent"
          />
          <button type="button" onClick={onClose} aria-label="Đóng" className="grid size-9 shrink-0 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg">
            <X size={16} />
          </button>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted">Ngày cần làm</p>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Ngày cần làm">
            {dayShort.map((n, i) => {
              const d = i + 1
              const on = h.days.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    const next = on ? h.days.filter((x) => x !== d) : [...h.days, d].sort()
                    if (next.length) patch({ days: next })
                  }}
                  className={cx('h-8 w-9 rounded-md border text-xs font-medium', on ? 'border-transparent bg-accent-soft text-accent' : 'border-line text-subtle hover:bg-surface-2')}
                >
                  {n}
                </button>
              )
            })}
            <button type="button" onClick={() => patch({ days: [1, 2, 3, 4, 5] })} className="h-8 rounded-md px-2 text-xs text-muted hover:bg-surface-2">
              T2–T6
            </button>
            <button type="button" onClick={() => patch({ days: [1, 2, 3, 4, 5, 6, 7] })} className="h-8 rounded-md px-2 text-xs text-muted hover:bg-surface-2">
              Mỗi ngày
            </button>
          </div>
        </div>
        <div className="max-w-xs">
          <p className="mb-1.5 text-xs font-medium text-muted">Area</p>
          <RelationCell kind="areas" variant="field" valueId={h.area_id} onChange={(area_id) => patch({ area_id })} />
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="ghost" className="h-8 px-2.5" onClick={() => patch({ archived: true })}>
            <Archive size={14} /> Lưu trữ
          </Button>
          {confirm ? (
            <>
              <span className="self-center text-sm text-danger">Xoá hẳn cả lịch sử tick?</span>
              <Button variant="ghost" className="h-8" onClick={() => setConfirm(false)}>Không</Button>
              <Button variant="destructive" className="h-8" onClick={() => del.mutate(h.id)}>Xoá</Button>
            </>
          ) : (
            <Button variant="ghost" className="h-8 px-2.5 text-danger" onClick={() => setConfirm(true)}>
              <Trash2 size={14} /> Xoá
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold text-fg">{value}</p>
    </div>
  )
}

/** Bản đồ nhiệt 16 tuần: mỗi ô 1 ngày (cột = tuần, hàng = thứ). Bấm ô để tick ngày đã qua. */
function Heatmap({ habit: h, done }: { habit: Habit; done: Set<string> }) {
  const toggle = useToggleHabitDay()
  const [tip, setTip] = useState<{ x: number; y: number; text: string; sub: string } | null>(null)
  const today = startOfDay(new Date())
  const weeks = 16
  const firstMonday = subDays(today, isoDow(today) - 1 + (weeks - 1) * 7)
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(firstMonday, w * 7 + i)))
  const created = startOfDay(new Date(h.created_at))

  return (
    <div className="relative inline-block" onMouseLeave={() => setTip(null)}>
      <div className="mb-1 flex gap-[3px] pl-6 text-[10px] text-subtle" aria-hidden>
        {cols.map((c, i) => (
          <span key={i} className="w-3">
            {i === 0 || c[0].getMonth() !== cols[i - 1][0].getMonth() ? format(c[0], 'M') + 'thg' : ''}
          </span>
        ))}
      </div>
      <div className="flex gap-[3px]">
        <div className="flex w-5 flex-col gap-[3px] text-[10px] leading-3 text-subtle" aria-hidden>
          {dayShort.map((d, i) => (
            <span key={d} className="h-3">{i % 2 === 0 ? d : ''}</span>
          ))}
        </div>
        {cols.map((c, w) => (
          <div key={w} className="flex flex-col gap-[3px]">
            {c.map((d) => {
              const key = dayKey(d)
              const future = isAfter(d, today)
              const isDone = done.has(key)
              const needed = h.days.includes(isoDow(d))
              const before = isAfter(created, d)
              const status = isDone ? 'Đã làm' : !needed ? 'Ngày nghỉ' : before ? 'Trước khi tạo' : 'Chưa làm'
              if (future) return <span key={key} className="size-3" />
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`${format(d, 'EEEE dd/MM', { locale: vi })}: ${status}`}
                  onClick={() => toggle.mutate({ habitId: h.id, day: key, done: !isDone })}
                  onMouseEnter={(e) => {
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    const p = (e.currentTarget.closest('.relative') as HTMLElement).getBoundingClientRect()
                    setTip({ x: r.left - p.left + 6, y: r.top - p.top, text: status, sub: format(d, 'EEEE dd/MM', { locale: vi }) })
                  }}
                  onFocus={(e) => {
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    const p = (e.currentTarget.closest('.relative') as HTMLElement).getBoundingClientRect()
                    setTip({ x: r.left - p.left + 6, y: r.top - p.top, text: status, sub: format(d, 'EEEE dd/MM', { locale: vi }) })
                  }}
                  onBlur={() => setTip(null)}
                  className={cx(
                    'size-3 rounded-[3px] outline-offset-1 hover:outline hover:outline-2 hover:outline-line-strong',
                    isDone ? 'bg-chart' : needed && !before ? 'bg-surface-2 ring-1 ring-inset ring-line' : 'ring-1 ring-inset ring-line/60',
                    isSameDay(d, today) && 'outline outline-1 outline-accent',
                  )}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted" aria-label="Chú thích">
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-[2px] bg-chart" /> Đã làm</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-[2px] bg-surface-2 ring-1 ring-inset ring-line" /> Chưa làm</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-[2px] ring-1 ring-inset ring-line/60" /> Ngày nghỉ</span>
      </div>
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-md"
          style={{ left: tip.x, top: tip.y - 4 }}
        >
          <b className="block font-semibold text-fg">{tip.text}</b>
          <span className="text-muted">{tip.sub}</span>
        </div>
      )}
    </div>
  )
}

function ArchivedList({ habits }: { habits: Habit[] }) {
  const update = useUpdateHabit()
  return (
    <Card className="mt-2 overflow-hidden">
      {habits.map((h) => (
        <div key={h.id} className="flex items-center gap-2 border-b border-line px-4 py-2 last:border-b-0">
          <span className="w-6 text-center">{h.icon ?? '•'}</span>
          <span className="flex-1 text-sm text-muted">{h.name}</span>
          <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={() => update.mutate({ id: h.id, patch: { archived: false } })}>
            <ArchiveRestore size={14} /> Khôi phục
          </Button>
        </div>
      ))}
    </Card>
  )
}
