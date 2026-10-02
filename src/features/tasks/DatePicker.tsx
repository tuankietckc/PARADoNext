import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addDays,
  addMonths,
  endOfDay,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parse,
  setHours,
  setMinutes,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { cx } from '../../components/ui'
import { AnchoredPopover, usePopoverAnchor } from '../../components/Popover'

/**
 * Bộ chọn ngày giờ kiểu Notion: ô gõ ngày ở trên, lịch tháng, công tắc "Có giờ", Xoá.
 *
 * Quy ước lưu (không đổi so với trước):
 *   - Không có giờ: Hạn/Kết thúc lưu cuối ngày (23:59:59.999), Bắt đầu lưu đầu ngày (00:00)
 *   - Có giờ: lưu đúng giờ đã chọn
 */
export type DateEdge = 'start' | 'end'

const DATE_FMT = 'dd/MM/yyyy'
const DATE_TIME_FMT = 'dd/MM/yyyy HH:mm'
const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

/** Giá trị có mang giờ cụ thể không (khác mốc đầu/cuối ngày dùng cho "chỉ ngày") */
export function hasTimePart(iso: string | null, edge: DateEdge): boolean {
  if (!iso) return false
  const d = new Date(iso)
  const hm = format(d, 'HH:mm')
  return edge === 'end' ? hm !== '23:59' : hm !== '00:00'
}

/** Gõ tay: 24/09/2026 · 24/9 · 24/9/26 · 24/09/2026 14:30 · 24/9 9:00 */
function parseTyped(text: string, base: Date): { date: Date; withTime: boolean } | null {
  const t = text.trim().replace(/\s+/g, ' ')
  if (!t) return null
  const withTimeFormats = ['dd/MM/yyyy HH:mm', 'd/M/yyyy H:mm', 'd/M/yy H:mm', 'd/M H:mm']
  for (const f of withTimeFormats) {
    const d = parse(t, f, base)
    if (isValid(d)) return { date: d, withTime: true }
  }
  for (const f of ['dd/MM/yyyy', 'd/M/yyyy', 'd/M/yy', 'd/M']) {
    const d = parse(t, f, base)
    if (isValid(d)) return { date: d, withTime: false }
  }
  return null
}

/**
 * Đặt giờ:phút cho 1 ngày, giữ nguyên giây của giá trị cũ (nếu có). Nhờ vậy đổi Kết thúc 21:47 → 23:47
 * cho ra đúng 2 giờ, không bị hụt 1 phút vì phần giây của giờ Bắt đầu tự điền.
 */
function withClock(day: Date, h: number, m: number, keepSecondsOf: Date | null): Date {
  const d = setMinutes(setHours(startOfDay(day), h), m)
  if (keepSecondsOf) d.setSeconds(keepSecondsOf.getSeconds(), keepSecondsOf.getMilliseconds())
  return d
}

export function DatePicker({
  value,
  edge,
  defaultWithTime = false,
  label,
  onChange,
  onDone,
}: {
  value: string | null
  edge: DateEdge
  /** Khi chưa có giá trị: bật sẵn "Có giờ" (Bắt đầu/Kết thúc cần giờ để tính thời gian làm) */
  defaultWithTime?: boolean
  label: string
  onChange: (iso: string | null) => void
  /** Chọn xong 1 ngày (khi không cần giờ) → đóng popover */
  onDone?: () => void
}) {
  const current = value ? new Date(value) : null
  const [withTime, setWithTime] = useState(() => (value ? hasTimePart(value, edge) : defaultWithTime))
  const [month, setMonth] = useState(() => startOfMonth(current ?? new Date()))
  const shown = current ? format(current, withTime ? DATE_TIME_FMT : DATE_FMT) : ''
  const [text, setText] = useState(shown)
  useEffect(() => setText(shown), [shown])

  const today = new Date()
  const days = useMemo(() => {
    const first = startOfWeek(month, { weekStartsOn: 1 })
    return Array.from({ length: 42 }, (_, i) => addDays(first, i))
  }, [month])

  /** Ghép ngày được chọn với giờ (giữ giờ cũ, không có thì lấy giờ hiện tại) */
  function build(day: Date, timeOn: boolean): string {
    if (!timeOn) return (edge === 'end' ? endOfDay(day) : startOfDay(day)).toISOString()
    const src = current && hasTimePart(value, edge) ? current : new Date()
    return withClock(day, src.getHours(), src.getMinutes(), src).toISOString()
  }

  function pickDay(day: Date) {
    onChange(build(day, withTime))
    if (!isSameMonth(day, month)) setMonth(startOfMonth(day))
    if (!withTime) onDone?.()
  }

  function commitText() {
    if (text.trim() === shown) return
    if (!text.trim()) {
      onChange(null)
      return
    }
    const parsed = parseTyped(text, current ?? today)
    if (!parsed) {
      setText(shown) // gõ sai → trả về giá trị cũ
      return
    }
    if (parsed.withTime) {
      setWithTime(true)
      onChange(parsed.date.toISOString())
    } else onChange(build(parsed.date, withTime))
    setMonth(startOfMonth(parsed.date))
  }

  function toggleTime() {
    const next = !withTime
    setWithTime(next)
    if (current) onChange(build(current, next))
  }

  function setTime(hhmm: string) {
    if (!hhmm) return
    const [h, m] = hhmm.split(':').map(Number)
    const base = current ?? today
    onChange(withClock(base, h, m, current).toISOString())
  }

  return (
    <div className="p-1" aria-label={label}>
      <input
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commitText()
          }
        }}
        placeholder={withTime ? 'dd/mm/yyyy hh:mm' : 'dd/mm/yyyy'}
        aria-label={`${label} — gõ ngày`}
        className="mb-2 h-8 w-full rounded-md border border-line bg-surface-2 px-2 text-sm tabular-nums text-fg outline-none focus:border-accent"
      />

      <div className="mb-1 flex items-center gap-1 px-1">
        <span className="flex-1 whitespace-nowrap text-sm font-semibold text-fg">Tháng {format(month, 'M, yyyy')}</span>
        <button
          type="button"
          onClick={() => {
            setMonth(startOfMonth(today))
            pickDay(today)
          }}
          className="whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-fg"
        >
          Hôm nay
        </button>
        <button
          type="button"
          aria-label="Tháng trước"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          className="grid size-6 place-items-center rounded text-muted hover:bg-surface-2 hover:text-fg"
        >
          <ChevronLeft size={15} />
        </button>
        <button
          type="button"
          aria-label="Tháng sau"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="grid size-6 place-items-center rounded text-muted hover:bg-surface-2 hover:text-fg"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center" role="grid">
        {weekdays.map((w) => (
          <span key={w} className="py-1 text-[11px] text-subtle">
            {w}
          </span>
        ))}
        {days.map((d) => {
          const selected = current && isSameDay(d, current)
          const isToday = isSameDay(d, today)
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => pickDay(d)}
              aria-label={format(d, 'dd/MM/yyyy')}
              aria-pressed={Boolean(selected)}
              className={cx(
                'mx-auto grid size-8 place-items-center rounded-md text-[13px] tabular-nums transition-colors',
                selected
                  ? 'bg-accent font-semibold text-accent-fg'
                  : isToday
                    ? 'font-semibold text-accent hover:bg-surface-2'
                    : isSameMonth(d, month)
                      ? 'text-fg hover:bg-surface-2'
                      : 'text-subtle hover:bg-surface-2',
              )}
            >
              {format(d, 'd')}
            </button>
          )
        })}
      </div>

      <div className="mt-2 border-t border-line pt-1">
        <div className="flex h-9 items-center gap-2 px-1.5">
          <span className="flex-1 text-sm text-fg">Có giờ</span>
          <button
            type="button"
            role="switch"
            aria-checked={withTime}
            aria-label="Có giờ"
            onClick={toggleTime}
            className={cx(
              'relative h-5 w-9 shrink-0 rounded-full transition-colors',
              withTime ? 'bg-accent' : 'bg-line-strong',
            )}
          >
            <span
              className={cx(
                'absolute left-0 top-0.5 size-4 rounded-full bg-white shadow transition-transform',
                withTime ? 'translate-x-[18px]' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>
        {withTime && (
          <div className="flex h-9 items-center gap-2 px-1.5">
            <span className="flex-1 text-sm text-muted">Giờ</span>
            <input
              type="time"
              value={current ? format(current, 'HH:mm') : ''}
              onChange={(e) => setTime(e.target.value)}
              aria-label={`${label} — giờ`}
              className="h-7 rounded-md border border-line bg-surface-2 px-1.5 text-sm tabular-nums text-fg outline-none focus:border-accent"
            />
          </div>
        )}
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null)
              onDone?.()
            }}
            className="flex h-9 w-full items-center rounded-md px-1.5 text-left text-sm text-fg hover:bg-surface-2"
          >
            Xoá
          </button>
        )}
      </div>
    </div>
  )
}

/** Ô ngày dạng field (trang chi tiết task): bấm mở bộ chọn ngày giờ. */
export function DateField({
  label,
  value,
  edge,
  defaultWithTime = false,
  placeholder = 'Chọn ngày',
  onChange,
}: {
  label: string
  value: string | null
  edge: DateEdge
  defaultWithTime?: boolean
  placeholder?: string
  onChange: (iso: string | null) => void
}) {
  const pop = usePopoverAnchor()
  const shown = value ? format(new Date(value), hasTimePart(value, edge) ? DATE_TIME_FMT : DATE_FMT) : ''
  return (
    <>
      <button
        type="button"
        onClick={pop.toggle}
        aria-label={label}
        className={cx(
          'flex h-10 w-full items-center rounded-lg border border-line bg-surface px-3 text-left text-sm tabular-nums transition-colors hover:border-line-strong',
          pop.anchor && 'border-accent shadow-[0_0_0_3px_var(--ring)]',
          shown ? 'text-fg' : 'text-subtle',
        )}
      >
        {shown || placeholder}
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={272}>
          <DatePicker
            label={label}
            value={value}
            edge={edge}
            defaultWithTime={defaultWithTime}
            onChange={onChange}
            onDone={pop.close}
          />
        </AnchoredPopover>
      )}
    </>
  )
}
