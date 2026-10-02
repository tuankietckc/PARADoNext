import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { addDays, format, parseISO, startOfDay, subDays } from 'date-fns'
import { vi } from 'date-fns/locale'
import { ArrowDownRight, ArrowUpRight, BarChart3, LoaderCircle, Minus } from 'lucide-react'
import { Card, Notice, cx } from '../../components/ui'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { useParaList } from '../para/usePara'
import { energyOptions } from '../tasks/taskFields'
import { dayKey, isoDow, useHabitLogs, useHabits } from '../habits/useHabits'
import { BarList, ColumnChart, type Datum } from './charts'
import { fmtMin } from './format'

type Range = '7d' | '30d' | '12w'
type Metric = 'count' | 'minutes'
const RANGES: Array<{ key: Range; label: string; days: number }> = [
  { key: '7d', label: '7 ngày', days: 7 },
  { key: '30d', label: '30 ngày', days: 30 },
  { key: '12w', label: '12 tuần', days: 84 },
]
type DoneTask = {
  id: string
  task_name: string
  end_at: string
  actual_minutes: number | null
  area_id: string | null
  project_id: string | null
  energy_level: string | null
}

const fmtCount = (n: number) => String(Math.round(n))
const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function useDoneTasks(fromIso: string) {
  return useQuery({
    queryKey: ['stats', 'done', fromIso],
    queryFn: async (): Promise<DoneTask[]> => {
      const client = getSupabaseClient()
      if (!client) throw new Error('Chưa kết nối Supabase.')
      const { data, error } = await client
        .from('tasks')
        .select('id, task_name, end_at, actual_minutes, area_id, project_id, energy_level')
        .eq('complete', true)
        .gte('end_at', fromIso)
        .order('end_at')
      if (error) throw new Error(error.message)
      return (data ?? []) as DoneTask[]
    },
    placeholderData: (prev) => prev,
  })
}

function useOverdueCount() {
  return useQuery({
    queryKey: ['stats', 'overdue'],
    queryFn: async () => {
      const client = getSupabaseClient()
      if (!client) return 0
      const { count } = await client
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('complete', false)
        .lt('due_at', startOfDay(new Date()).toISOString())
      return count ?? 0
    },
  })
}

export function StatsPage() {
  const [range, setRange] = useState<Range>('7d')
  const [metric, setMetric] = useState<Metric>('count')
  const [by, setBy] = useState<'area' | 'project' | 'energy'>('area')
  const days = RANGES.find((r) => r.key === range)!.days
  const today = startOfDay(new Date())
  const from = subDays(today, days - 1)
  const prevFrom = subDays(from, days)
  const { data: all, isLoading, error, isPlaceholderData } = useDoneTasks(prevFrom.toISOString())
  const { data: overdue = 0 } = useOverdueCount()
  const { data: areas = [] } = useParaList('areas')
  const { data: projects = [] } = useParaList('projects')
  const { data: habits = [] } = useHabits()
  const { data: logs = [] } = useHabitLogs()

  const cur = useMemo(() => (all ?? []).filter((t) => parseISO(t.end_at) >= from), [all, from])
  const prev = useMemo(() => (all ?? []).filter((t) => parseISO(t.end_at) < from), [all, from])
  const minutesOf = (list: DoneTask[]) => list.reduce((s, t) => s + (t.actual_minutes ?? 0), 0)
  const val = (list: DoneTask[]) => (metric === 'count' ? list.length : minutesOf(list))
  const fmt = metric === 'count' ? fmtCount : fmtMin

  // Theo ngày (7/30 ngày) hoặc theo tuần (12 tuần)
  const series: Datum[] = useMemo(() => {
    if (range === '12w') {
      return Array.from({ length: 12 }, (_, w) => {
        const s = addDays(from, w * 7)
        const e = addDays(s, 7)
        const list = cur.filter((t) => {
          const d = parseISO(t.end_at)
          return d >= s && d < e
        })
        return { key: dayKey(s), label: format(s, 'dd/MM'), value: val(list), detail: metric === 'count' ? fmtMin(minutesOf(list)) + ' ghi nhận' : `${list.length} task` }
      })
    }
    return Array.from({ length: days }, (_, i) => {
      const d = addDays(from, i)
      const list = cur.filter((t) => dayKey(parseISO(t.end_at)) === dayKey(d))
      return {
        key: dayKey(d),
        label: range === '7d' ? format(d, 'EEEEEE dd/MM', { locale: vi }) : format(d, 'dd/MM'),
        value: val(list),
        detail: metric === 'count' ? `${fmtMin(minutesOf(list))} ghi nhận` : `${list.length} task`,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, range, metric])

  const breakdown: Datum[] = useMemo(() => {
    const groups = new Map<string, DoneTask[]>()
    for (const t of cur) {
      const k = by === 'area' ? t.area_id ?? '' : by === 'project' ? t.project_id ?? '' : t.energy_level ?? ''
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(t)
    }
    const name = (k: string) => {
      if (!k) return by === 'area' ? 'Chưa có Area' : by === 'project' ? 'Chưa có Project' : 'Chưa chọn'
      if (by === 'energy') return energyOptions.find((o) => o.value === k)?.label ?? k
      return (by === 'area' ? areas : projects).find((x) => x.id === k)?.name ?? '(đã lưu trữ)'
    }
    const rows = [...groups.entries()]
      .map(([k, list]) => ({ key: k || 'none', label: name(k), value: val(list), detail: metric === 'count' ? fmtMin(minutesOf(list)) : `${list.length} task` }))
      .sort((a, b) => b.value - a.value)
    // Tối đa 8 dòng, phần còn lại gộp vào "Khác"
    if (rows.length > 8) {
      const rest = rows.slice(7)
      return [...rows.slice(0, 7), { key: 'other', label: `Khác (${rest.length})`, value: rest.reduce((s, r) => s + r.value, 0) }]
    }
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, by, metric, areas, projects])

  const byHour: Datum[] = useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) => {
        const n = cur.filter((t) => parseISO(t.end_at).getHours() === h).length
        return { key: String(h), label: `${h}h`, value: n, detail: `${h}:00–${h}:59` }
      }),
    [cur],
  )
  const byWeekday: Datum[] = useMemo(
    () =>
      dayNames.map((n, i) => {
        const list = cur.filter((t) => isoDow(parseISO(t.end_at)) === i + 1)
        return { key: n, label: n, value: list.length, detail: fmtMin(minutesOf(list)) + ' ghi nhận' }
      }),
    [cur],
  )
  const peakHour = byHour.reduce((a, b) => (b.value > a.value ? b : a), byHour[0])
  const peakDay = byWeekday.reduce((a, b) => (b.value > a.value ? b : a), byWeekday[0])

  // Thói quen trong kỳ
  const habitRate = useMemo(() => {
    const done = new Set(logs.map((l) => `${l.habit_id}|${l.day}`))
    let need = 0
    let got = 0
    for (const h of habits.filter((x) => !x.archived)) {
      const created = startOfDay(parseISO(h.created_at))
      for (let i = 0; i < days; i++) {
        const d = addDays(from, i)
        if (d < created || !h.days.includes(isoDow(d))) continue
        if (i === days - 1 && !done.has(`${h.id}|${dayKey(d)}`)) continue // hôm nay chưa tick: chưa tính
        need++
        if (done.has(`${h.id}|${dayKey(d)}`)) got++
      }
    }
    return need ? got / need : null
  }, [habits, logs, days, from])

  const noData = !isLoading && cur.length === 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-fg">
          <BarChart3 size={22} className="text-accent" /> Thống kê
        </h1>
        <p className="mt-1.5 text-sm text-muted">Task đã hoàn thành và thời gian ghi nhận (Kết thúc − Bắt đầu). Tính theo ngày hoàn thành.</p>
      </header>

      {/* Bộ lọc: 1 hàng, áp dụng cho mọi số liệu bên dưới */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Segment value={range} onChange={setRange} options={RANGES.map((r) => [r.key, r.label])} label="Khoảng thời gian" />
        <Segment value={metric} onChange={setMetric} options={[['count', 'Số task'], ['minutes', 'Thời gian']]} label="Số liệu" />
      </div>

      {error && <Notice tone="danger">{(error as Error).message}</Notice>}
      {isLoading && (
        <div className="grid place-items-center py-14">
          <LoaderCircle size={20} className="animate-spin text-subtle" />
        </div>
      )}

      {all && (
        <div className={cx('space-y-5 transition-opacity', isPlaceholderData && 'opacity-60')}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile label="Task hoàn thành" value={fmtCount(cur.length)} now={cur.length} before={prev.length} range={RANGES.find((r) => r.key === range)!.label} />
            <StatTile label="Thời gian ghi nhận" value={fmtMin(minutesOf(cur))} now={minutesOf(cur)} before={minutesOf(prev)} range={RANGES.find((r) => r.key === range)!.label} />
            <StatTile label="Trung bình mỗi ngày" value={`${(cur.length / days).toFixed(1).replace('.', ',')} task`} />
            <StatTile label="Thói quen đạt" value={habitRate == null ? '—' : `${Math.round(habitRate * 100)}%`} />
            <StatTile label="Đang quá hạn" value={fmtCount(overdue)} tone={overdue > 0 ? 'warn' : undefined} />
          </div>

          <Card className="p-5">
            <ChartTitle
              title={metric === 'count' ? `Task hoàn thành ${range === '12w' ? 'mỗi tuần' : 'mỗi ngày'}` : `Thời gian ghi nhận ${range === '12w' ? 'mỗi tuần' : 'mỗi ngày'}`}
              sub={noData ? 'Chưa có task nào hoàn thành trong khoảng này.' : undefined}
            />
            <ColumnChart data={series} format={fmt} integer={metric === 'count'} labelEvery={range === '30d' ? 5 : 1} ariaLabel="Biểu đồ theo thời gian" />
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs text-muted hover:text-fg">Xem dạng bảng</summary>
              <table className="mt-2 w-full max-w-md text-sm">
                <tbody>
                  {series.map((d) => (
                    <tr key={d.key} className="border-b border-line last:border-b-0">
                      <td className="py-1 text-muted">{d.label}</td>
                      <td className="py-1 text-right tabular-nums text-fg">{fmt(d.value)}</td>
                      <td className="py-1 pl-3 text-right text-xs text-subtle">{d.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <ChartTitle title={metric === 'count' ? 'Task hoàn thành theo…' : 'Thời gian đổ vào…'} inline />
              <Segment value={by} onChange={setBy} options={[['area', 'Area'], ['project', 'Project'], ['energy', 'Năng lượng']]} label="Nhóm theo" small />
            </div>
            <BarList data={breakdown} format={fmt} ariaLabel="Phân bổ" empty="Chưa có dữ liệu trong khoảng này." />
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <ChartTitle title="Giờ bạn hay hoàn thành việc" sub={peakHour.value > 0 ? `Nhiều nhất lúc ${peakHour.detail} (${peakHour.value} task).` : undefined} />
              <ColumnChart data={byHour} format={fmtCount} integer height={140} labelEvery={6} ariaLabel="Theo giờ trong ngày" />
            </Card>
            <Card className="p-5">
              <ChartTitle title="Ngày trong tuần" sub={peakDay.value > 0 ? `Làm được nhiều nhất vào ${peakDay.label === 'CN' ? 'Chủ nhật' : 'thứ ' + peakDay.label.slice(1)}.` : undefined} />
              <ColumnChart data={byWeekday} format={fmtCount} integer height={140} ariaLabel="Theo ngày trong tuần" />
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

function ChartTitle({ title, sub, inline }: { title: string; sub?: string; inline?: boolean }) {
  return (
    <div className={inline ? '' : 'mb-4'}>
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  )
}

function StatTile({ label, value, now, before, range, tone }: { label: string; value: string; now?: number; before?: number; range?: string; tone?: 'warn' }) {
  let delta: { text: string; up: boolean | null } | null = null
  if (now != null && before != null && (now > 0 || before > 0)) {
    if (before === 0) delta = { text: 'mới', up: true }
    else {
      const p = Math.round(((now - before) / before) * 100)
      delta = { text: `${p > 0 ? '+' : ''}${p}%`, up: p === 0 ? null : p > 0 }
    }
  }
  const Icon = delta?.up == null ? Minus : delta.up ? ArrowUpRight : ArrowDownRight
  return (
    <Card className="px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={cx('mt-0.5 text-2xl font-semibold', tone === 'warn' ? 'text-danger' : 'text-fg')}>{value}</p>
      {delta && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted" title={`So với ${range} trước đó`}>
          <Icon size={13} className={delta.up == null ? 'text-subtle' : delta.up ? 'text-success' : 'text-danger'} aria-hidden />
          <span>
            {delta.text} <span className="text-subtle">so với kỳ trước</span>
          </span>
        </p>
      )}
    </Card>
  )
}

function Segment<T extends string>({ value, onChange, options, label, small }: { value: T; onChange: (v: T) => void; options: Array<[T, string]>; label: string; small?: boolean }) {
  return (
    <div className="flex rounded-lg bg-surface-2 p-0.5" role="radiogroup" aria-label={label}>
      {options.map(([k, l]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={cx('rounded-md px-3 transition-colors', small ? 'h-7 text-xs' : 'h-8 text-sm', value === k ? 'bg-surface font-medium text-fg shadow-sm' : 'text-muted hover:text-fg')}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
