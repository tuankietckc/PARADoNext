import { useState } from 'react'
import { cx } from '../../components/ui'

/**
 * Biểu đồ đơn giản bằng HTML (không thư viện):
 * - 1 dãy số liệu → 1 màu (--chart), không cần chú thích — tiêu đề nói lên nội dung
 * - Cột ≤ 24px, bo 4px đầu cột, mọc từ 1 đường gốc; lưới mảnh, nhạt
 * - Rê chuột / focus bàn phím vào cột → tooltip (giá trị đậm, nhãn phụ nhạt)
 * - Chữ luôn dùng màu chữ, không dùng màu dữ liệu
 */
export type Datum = { key: string; label: string; value: number; detail?: string }

/** Mốc trục tròn: 1·2·5 × 10ⁿ, tối đa ~4 vạch */
export function niceMax(max: number, integer = false): { top: number; step: number } {
  if (max <= 0) return { top: integer ? 4 : 1, step: 1 }
  const raw = max / 4
  const pow = 10 ** Math.floor(Math.log10(raw))
  let step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow
  // Số đếm (task) → vạch là số nguyên
  if (integer) step = Math.max(1, Math.round(step))
  return { top: Math.ceil(max / step) * step, step }
}

export function ColumnChart({
  data,
  format,
  height = 180,
  labelEvery = 1,
  ariaLabel,
  integer = false,
}: {
  data: Datum[]
  format: (v: number) => string
  height?: number
  /** Hiện nhãn trục X mỗi n cột (dữ liệu dày) */
  labelEvery?: number
  ariaLabel: string
  /** Giá trị là số đếm → vạch trục là số nguyên */
  integer?: boolean
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(0, ...data.map((d) => d.value))
  const { top, step } = niceMax(max, integer)
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
  const peak = data.findIndex((d) => d.value === max && max > 0)

  return (
    <div role="figure" aria-label={ariaLabel} className="relative select-none" onMouseLeave={() => setHover(null)}>
      <div className="flex">
        {/* Trục Y */}
        <div className="relative mr-2 w-10 shrink-0 text-right text-[11px] tabular-nums text-subtle" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
              {format(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {/* Lưới */}
          <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height }} aria-hidden>
            {ticks.map((t) => (
              <span key={t} className={cx('absolute inset-x-0 h-px', t === 0 ? 'bg-line-strong' : 'bg-line')} style={{ bottom: `${(t / top) * 100}%` }} />
            ))}
          </div>
          {/* Cột */}
          <div className="relative flex items-end gap-[2px]" style={{ height }}>
            {data.map((d, i) => {
              const h = (d.value / top) * 100
              return (
                <button
                  key={d.key}
                  type="button"
                  aria-label={`${d.label}: ${format(d.value)}${d.detail ? ' · ' + d.detail : ''}`}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center outline-none"
                >
                  {i === peak && hover == null && (
                    <span className="absolute text-[11px] font-medium tabular-nums text-muted" style={{ bottom: `calc(${h}% + 4px)` }}>
                      {format(d.value)}
                    </span>
                  )}
                  <span
                    className={cx(
                      'block w-full max-w-6 rounded-t-[4px] bg-chart transition-opacity',
                      hover != null && hover !== i && 'opacity-45',
                      d.value > 0 && 'min-h-[2px]',
                      'group-focus-visible:ring-2 group-focus-visible:ring-accent/40',
                    )}
                    style={{ height: `${h}%` }}
                  />
                </button>
              )
            })}
          </div>
          {/* Trục X */}
          <div className="mt-1.5 flex gap-[2px] text-[11px] text-subtle" aria-hidden>
            {data.map((d, i) => (
              <span key={d.key} className={cx('min-w-0 flex-1 text-center', labelEvery > 1 ? 'overflow-visible whitespace-nowrap' : 'truncate')}>
                {i % labelEvery === 0 || (i === data.length - 1 && (data.length - 1) % labelEvery >= labelEvery / 2) ? d.label : ''}
              </span>
            ))}
          </div>
          {hover != null && data[hover] && (
            <div
              role="tooltip"
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg"
              style={{ left: `${((hover + 0.5) / data.length) * 100}%`, top: height - (height * data[hover].value) / top - 6 }}
            >
              <b className="block text-sm font-semibold tabular-nums text-fg">{format(data[hover].value)}</b>
              <span className="text-muted">{data[hover].label}</span>
              {data[hover].detail && <span className="block text-subtle">{data[hover].detail}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Thanh ngang xếp hạng (Area / Project / Năng lượng): nhãn trái, giá trị ở đầu thanh */
export function BarList({ data, format, ariaLabel, empty }: { data: Datum[]; format: (v: number) => string; ariaLabel: string; empty: string }) {
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(0, ...data.map((d) => d.value))
  if (!data.length || max === 0) return <p className="py-6 text-center text-sm text-subtle">{empty}</p>
  return (
    <ul role="list" aria-label={ariaLabel} className="space-y-1.5" onMouseLeave={() => setHover(null)}>
      {data.map((d) => (
        <li
          key={d.key}
          tabIndex={0}
          onMouseEnter={() => setHover(d.key)}
          onFocus={() => setHover(d.key)}
          onBlur={() => setHover(null)}
          aria-label={`${d.label}: ${format(d.value)}${d.detail ? ' · ' + d.detail : ''}`}
          className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 rounded-md px-1 py-0.5 outline-none focus-visible:bg-surface-2"
        >
          <span className="truncate text-sm text-fg" title={d.label}>{d.label}</span>
          <span className="flex items-center gap-2">
            <span
              className={cx('block h-4 max-h-6 rounded-r-[4px] bg-chart transition-opacity', hover && hover !== d.key && 'opacity-45')}
              style={{ width: `${Math.max(1.5, (d.value / max) * 85)}%` }}
            />
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {format(d.value)}
              {hover === d.key && d.detail && <span className="text-subtle"> · {d.detail}</span>}
            </span>
          </span>
        </li>
      ))}
    </ul>
  )
}
