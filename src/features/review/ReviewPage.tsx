import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { addDays, format, getISOWeek, parseISO, subDays } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
  ArrowDownUp,
  BookMarked,
  Check,
  Gauge,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  LayoutGrid,
  List,
  LoaderCircle,
  PenLine,
  Rows3,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { Button, Card, Notice, cx } from '../../components/ui'
import { useUiPref } from '../../lib/useUiPref'
import { normalizeSearch } from '../tasks/taskFields'
import { fmtMin } from '../stats/format'
import { ReviewOverview } from './ReviewOverview'
import {
  useDeleteReview,
  useSaveReview,
  useWeekStats,
  useWeeklyReviews,
  weekKey,
  weekRangeText,
  type WeeklyReview,
} from './useReview'

type View = 'table' | 'gallery' | 'timeline'
type Pref = { view: View; sort: 'desc' | 'asc'; tab: 'overview' | 'journal' }
const defaultPref: Pref = { view: 'gallery', sort: 'desc', tab: 'overview' }

const QUESTIONS = [
  ['wins', 'Tuần này điều gì tốt?', 'Việc làm được, điều khiến bạn vui…'],
  ['improve', 'Điều gì cần làm khác đi?', 'Chỗ bị kẹt, việc hay trì hoãn…'],
  ['next_focus', 'Tuần tới tập trung vào đâu?', '1–3 điều quan trọng nhất…'],
  ['notes', 'Ghi chú thêm', 'Bất cứ điều gì muốn nhớ về tuần này…'],
] as const
type Field = (typeof QUESTIONS)[number][0]

const weekNo = (week: string) => getISOWeek(parseISO(week))

export function ReviewPage() {
  const { data: reviews, isLoading, error } = useWeeklyReviews()
  const [pref, savePref] = useUiPref<Pref>('reviews-view', defaultPref)
  const [query, setQuery] = useState('')
  const [year, setYear] = useState<string>('all')
  const [open, setOpen] = useState<string | null>(null)
  const thisWeek = weekKey()
  const hasThisWeek = reviews?.some((r) => r.week_start === thisWeek)

  const years = useMemo(() => [...new Set((reviews ?? []).map((r) => r.week_start.slice(0, 4)))].sort().reverse(), [reviews])
  const shown = useMemo(() => {
    const q = normalizeSearch(query.trim())
    const list = (reviews ?? [])
      .filter((r) => year === 'all' || r.week_start.startsWith(year))
      .filter((r) => !q || normalizeSearch([r.wins, r.improve, r.next_focus, r.notes].filter(Boolean).join(' ')).includes(q))
    return pref.sort === 'asc' ? [...list].reverse() : list
  }, [reviews, query, year, pref.sort])

  return (
    <div className={cx('mx-auto px-4 py-8 sm:px-6', pref.tab === 'overview' ? 'max-w-[1500px]' : 'max-w-5xl')}>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-fg">
            <ClipboardCheck size={22} className="text-accent" /> Weekly Review
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {pref.tab === 'overview'
              ? `Tuần ${weekNo(thisWeek)} (${weekRangeText(thisWeek)}) — nhìn lại task, project, thói quen rồi viết vài dòng review.`
              : 'Sổ review của bạn — mỗi tuần viết vài dòng, xem lại bất cứ lúc nào.'}
          </p>
        </div>
        <Button onClick={() => setOpen(thisWeek)}>
          <PenLine size={16} /> {hasThisWeek ? 'Mở review tuần này' : 'Viết review tuần này'}
        </Button>
      </header>

      {/* 2 phần của trang */}
      <div className="mb-6 inline-flex rounded-lg bg-surface-2 p-0.5" role="tablist" aria-label="Phần của trang Review">
        {(
          [
            ['overview', 'Tổng quan tuần', Gauge],
            ['journal', `Sổ review${reviews?.length ? ` (${reviews.length})` : ''}`, BookMarked],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={pref.tab === k}
            onClick={() => savePref({ ...pref, tab: k })}
            className={cx(
              'inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-sm transition-colors',
              pref.tab === k ? 'bg-surface font-medium text-fg shadow-sm' : 'text-muted hover:text-fg',
            )}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {pref.tab === 'overview' && <ReviewOverview />}
      {pref.tab === 'journal' && (
      <>

      {/* Tab view */}
      <div className="mb-3 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--border)]">
        <div className="flex w-max gap-1" role="tablist" aria-label="Chế độ xem">
          {(
            [
              ['gallery', 'Thẻ', LayoutGrid],
              ['table', 'Bảng', List],
              ['timeline', 'Dòng thời gian', Rows3],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={pref.view === k}
              onClick={() => savePref({ ...pref, view: k })}
              className={cx(
                'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors',
                pref.view === k ? 'border-accent font-medium text-fg' : 'border-transparent text-muted hover:text-fg',
              )}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Thanh công cụ */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => savePref({ ...pref, sort: pref.sort === 'desc' ? 'asc' : 'desc' })}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs text-muted hover:bg-surface-2 hover:text-fg"
          aria-label="Đổi thứ tự"
        >
          <ArrowDownUp size={13} /> {pref.sort === 'desc' ? 'Mới nhất trước' : 'Cũ nhất trước'}
        </button>
        {years.length > 1 && (
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            aria-label="Lọc theo năm"
            className="h-8 rounded-full border border-line bg-surface px-3 text-xs text-muted"
          >
            <option value="all">Mọi năm</option>
            {years.map((y) => (
              <option key={y} value={y}>
                Năm {y}
              </option>
            ))}
          </select>
        )}
        <label className="ml-auto flex h-8 w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-sm focus-within:border-accent sm:w-60">
          <Search size={14} className="shrink-0 text-subtle" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm trong các review…" aria-label="Tìm review" className="w-full bg-transparent text-fg outline-none placeholder:text-subtle" />
          {query && (
            <button type="button" aria-label="Xoá tìm kiếm" onClick={() => setQuery('')} className="text-subtle hover:text-fg">
              <X size={13} />
            </button>
          )}
        </label>
      </div>

      {error && <Notice tone="danger">{(error as Error).message}</Notice>}
      {isLoading && (
        <div className="grid place-items-center py-14">
          <LoaderCircle size={20} className="animate-spin text-subtle" />
        </div>
      )}

      {reviews && shown.length === 0 && (
        <Card className="px-4 py-10 text-center text-sm text-subtle">
          {query || year !== 'all' ? 'Không có review nào khớp.' : 'Chưa có review nào. Bấm “Viết review tuần này” để bắt đầu — 5 phút mỗi cuối tuần là đủ.'}
        </Card>
      )}

      {shown.length > 0 && pref.view === 'table' && <ReviewTable rows={shown} onOpen={setOpen} />}
      {shown.length > 0 && pref.view === 'gallery' && <ReviewCards rows={shown} onOpen={setOpen} />}
      {shown.length > 0 && pref.view === 'timeline' && <ReviewTimeline rows={shown} onOpen={setOpen} />}
      </>
      )}

      {open && <ReviewDrawer week={open} reviews={reviews ?? []} onWeek={setOpen} onClose={() => setOpen(null)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Các chế độ xem
// ---------------------------------------------------------------------------
export function Stars({ value, size = 13 }: { value: number | null; size?: number }) {
  if (!value) return <span className="text-xs text-subtle">—</span>
  return (
    <span className="inline-flex" aria-label={`${value}/5 sao`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= value ? 'fill-yellow text-yellow' : 'text-line-strong'} />
      ))}
    </span>
  )
}

function WeekTitle({ r }: { r: WeeklyReview }) {
  return (
    <span className="flex flex-col">
      <span className="font-semibold text-fg">Tuần {weekNo(r.week_start)}</span>
      <span className="text-xs text-muted">{weekRangeText(r.week_start)}</span>
    </span>
  )
}

function StatsLine({ r }: { r: WeeklyReview }) {
  if (!r.stats) return null
  return (
    <span className="flex flex-wrap gap-x-3 text-xs text-muted">
      <span>
        <b className="font-semibold text-fg">{r.stats.tasks}</b> task xong
      </span>
      {r.stats.minutes > 0 && <span>{fmtMin(r.stats.minutes)}</span>}
      {r.stats.habit_rate != null && <span>thói quen {Math.round(r.stats.habit_rate * 100)}%</span>}
    </span>
  )
}

const clip = (t: string | null) => t?.trim() || ''

function ReviewTable({ rows, onOpen }: { rows: WeeklyReview[]; onOpen: (w: string) => void }) {
  const th = 'border-r border-line px-3 py-2 text-left text-xs font-normal text-subtle last:border-r-0'
  const td = 'border-r border-line px-3 py-2 align-top last:border-r-0'
  return (
    <Card className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className={cx(th, 'w-36')}>Tuần</th>
            <th className={cx(th, 'w-28')}>Đánh giá</th>
            <th className={cx(th, 'min-w-48')}>Điều tốt</th>
            <th className={cx(th, 'min-w-48')}>Cần làm khác đi</th>
            <th className={cx(th, 'min-w-48')}>Trọng tâm tuần tới</th>
            <th className={cx(th, 'w-24 text-right')}>Task xong</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} onClick={() => onOpen(r.week_start)} className="cursor-pointer border-b border-line last:border-b-0 hover:bg-surface-2/50">
              <td className={td}>
                <button type="button" onClick={() => onOpen(r.week_start)} className="text-left hover:text-accent" aria-label={`Mở review tuần ${weekNo(r.week_start)}`}>
                  <WeekTitle r={r} />
                </button>
              </td>
              <td className={td}><Stars value={r.rating} /></td>
              {(['wins', 'improve', 'next_focus'] as const).map((k) => (
                <td key={k} className={cx(td, 'text-muted')}>
                  <span className="line-clamp-3 whitespace-pre-line">{clip(r[k]) || <span className="text-subtle">—</span>}</span>
                </td>
              ))}
              <td className={cx(td, 'text-right tabular-nums text-fg')}>{r.stats?.tasks ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function ReviewCards({ rows, onOpen }: { rows: WeeklyReview[]; onOpen: (w: string) => void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
      {rows.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onOpen(r.week_start)}
          aria-label={`Mở review tuần ${weekNo(r.week_start)}`}
          className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 text-left shadow-sm transition-colors hover:border-line-strong"
        >
          <span className="flex items-start justify-between gap-2">
            <WeekTitle r={r} />
            <Stars value={r.rating} />
          </span>
          {(['wins', 'next_focus'] as const).map((k) =>
            clip(r[k]) ? (
              <span key={k} className="text-sm">
                <span className="block text-[11px] font-medium text-subtle">{k === 'wins' ? 'Điều tốt' : 'Trọng tâm tuần tới'}</span>
                <span className="line-clamp-3 whitespace-pre-line text-muted">{clip(r[k])}</span>
              </span>
            ) : null,
          )}
          {!clip(r.wins) && !clip(r.next_focus) && <span className="text-sm text-subtle">Chưa viết gì.</span>}
          <span className="mt-auto border-t border-line pt-2">
            <StatsLine r={r} />
          </span>
        </button>
      ))}
    </div>
  )
}

function ReviewTimeline({ rows, onOpen }: { rows: WeeklyReview[]; onOpen: (w: string) => void }) {
  const groups: Array<[string, WeeklyReview[]]> = []
  for (const r of rows) {
    const m = format(parseISO(r.week_start), "'Tháng' M/yyyy")
    const last = groups[groups.length - 1]
    if (last && last[0] === m) last[1].push(r)
    else groups.push([m, [r]])
  }
  return (
    <div className="space-y-6">
      {groups.map(([month, list]) => (
        <section key={month}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-subtle">{month}</h2>
          <ol className="relative space-y-3 border-l border-line pl-5">
            {list.map((r) => (
              <li key={r.id} className="relative">
                <span className="absolute -left-[25px] top-4 size-2.5 rounded-full border-2 border-surface bg-chart" aria-hidden />
                <Card className="p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <button type="button" onClick={() => onOpen(r.week_start)} className="text-left hover:text-accent" aria-label={`Mở review tuần ${weekNo(r.week_start)}`}>
                      <WeekTitle r={r} />
                    </button>
                    <span className="flex items-center gap-3">
                      <StatsLine r={r} />
                      <Stars value={r.rating} />
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {QUESTIONS.map(([k, label]) =>
                      clip(r[k]) ? (
                        <div key={k} className="text-sm">
                          <p className="text-[11px] font-medium text-subtle">{label}</p>
                          <p className="whitespace-pre-line text-fg">{clip(r[k])}</p>
                        </div>
                      ) : null,
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trang viết / xem 1 review
// ---------------------------------------------------------------------------
type Values = Record<Field, string> & { rating: number | null }
const toValues = (r?: WeeklyReview): Values => ({
  rating: r?.rating ?? null,
  wins: r?.wins ?? '',
  improve: r?.improve ?? '',
  next_focus: r?.next_focus ?? '',
  notes: r?.notes ?? '',
})

function ReviewDrawer({ week, reviews, onWeek, onClose }: { week: string; reviews: WeeklyReview[]; onWeek: (w: string) => void; onClose: () => void }) {
  const existing = reviews.find((r) => r.week_start === week)
  const [values, setValues] = useState<Values>(() => toValues(existing))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const { data: live, isLoading: statsLoading } = useWeekStats(week)
  const save = useSaveReview()
  const del = useDeleteReview()
  const first = useRef<HTMLTextAreaElement>(null)
  const isThisWeek = week === weekKey()
  const future = parseISO(week) > new Date()

  // Đổi tuần → nạp nội dung tuần đó
  useEffect(() => {
    setValues(toValues(reviews.find((r) => r.week_start === week)))
    setConfirmDelete(false)
    setSavedAt(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  const dirty = JSON.stringify(values) !== JSON.stringify(toValues(existing))
  const set = <K extends keyof Values>(k: K, v: Values[K]) => setValues((p) => ({ ...p, [k]: v }))

  async function submit() {
    await save.mutateAsync({
      week,
      patch: {
        rating: values.rating,
        wins: values.wins.trim() || null,
        improve: values.improve.trim() || null,
        next_focus: values.next_focus.trim() || null,
        notes: values.notes.trim() || null,
        // Lưu kèm số liệu tuần để sau này xem lại vẫn có
        stats: live?.stats ?? existing?.stats ?? null,
        completed_at: existing?.completed_at ?? new Date().toISOString(),
      },
    })
    setSavedAt(Date.now())
  }

  const stats = live?.stats ?? existing?.stats
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Review tuần">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            void submit()
          }
        }}
        className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-line bg-surface shadow-2xl"
      >
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
          <button type="button" aria-label="Tuần trước" onClick={() => onWeek(format(subDays(parseISO(week), 7), 'yyyy-MM-dd'))} className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg">
            <ChevronLeft size={16} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-sm font-semibold text-fg">
              Tuần {weekNo(week)} {isThisWeek && <span className="font-normal text-accent">· tuần này</span>}
            </p>
            <p className="text-xs text-muted">{weekRangeText(week)}</p>
          </div>
          <button type="button" aria-label="Tuần sau" disabled={isThisWeek || future} onClick={() => onWeek(format(addDays(parseISO(week), 7), 'yyyy-MM-dd'))} className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
          <button type="button" onClick={onClose} aria-label="Đóng" className="ml-1 grid size-8 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {/* Số liệu tuần */}
          <div className="grid grid-cols-3 gap-2" aria-label="Số liệu tuần">
            <MiniTile label="Task xong" value={statsLoading && !stats ? '…' : String(stats?.tasks ?? 0)} />
            <MiniTile label="Thời gian ghi nhận" value={stats?.minutes ? fmtMin(stats.minutes) : '—'} />
            <MiniTile label="Thói quen" value={stats?.habit_rate != null ? `${Math.round(stats.habit_rate * 100)}%` : '—'} />
          </div>
          {live && live.tasks.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-xs text-muted hover:text-fg">Xem {live.tasks.length} task đã xong trong tuần</summary>
              <ul className="mt-2 space-y-1">
                {live.tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-muted">
                    <Check size={13} className="shrink-0 text-success" /> <span className="truncate">{t.task_name}</span>
                    <span className="ml-auto shrink-0 text-xs capitalize text-subtle">{format(parseISO(t.end_at), 'EEEEEE dd/MM', { locale: vi })}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div>
            <p className="mb-1.5 text-sm font-medium text-fg">Tuần này thế nào?</p>
            <div className="flex gap-0.5" role="radiogroup" aria-label="Đánh giá tuần">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={values.rating === n}
                  aria-label={`${n} sao`}
                  onClick={() => set('rating', values.rating === n ? null : n)}
                  className="grid size-9 place-items-center rounded-md hover:bg-surface-2"
                >
                  <Star size={22} className={values.rating != null && n <= values.rating ? 'fill-yellow text-yellow' : 'text-line-strong'} />
                </button>
              ))}
            </div>
          </div>

          {QUESTIONS.map(([k, label, ph], i) => (
            <label key={k} className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-fg">{label}</span>
              <textarea
                ref={i === 0 ? first : undefined}
                autoFocus={i === 0 && !existing}
                value={values[k]}
                onChange={(e) => set(k, e.target.value)}
                rows={k === 'notes' ? 4 : 3}
                placeholder={ph}
                aria-label={label}
                className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed text-fg outline-none placeholder:text-subtle focus:border-accent"
              />
            </label>
          ))}

          {existing?.updated_at && (
            <p className="text-xs text-subtle">Sửa lần cuối {format(parseISO(existing.updated_at), 'HH:mm dd/MM/yyyy')}</p>
          )}
          {(save.error || del.error) && <Notice tone="danger">{((save.error ?? del.error) as Error).message}</Notice>}
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-line px-5 py-3">
          {existing && confirmDelete ? (
            <>
              <span className="mr-auto text-sm text-danger">Xoá review tuần này?</span>
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>Không</Button>
              <Button type="button" variant="destructive" onClick={async () => { await del.mutateAsync(existing.id); onClose() }} disabled={del.isPending}>Xoá</Button>
            </>
          ) : (
            <>
              {existing && (
                <Button type="button" variant="ghost" className="px-2.5 text-danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={15} /> Xoá
                </Button>
              )}
              {savedAt && !dirty && (
                <span className="flex items-center gap-1 text-sm text-success">
                  <Check size={14} /> Đã lưu
                </span>
              )}
              <span className="ml-auto" />
              <Button type="button" variant="ghost" onClick={onClose}>Đóng</Button>
              <Button type="submit" disabled={save.isPending || (!dirty && !!existing)} title="Ctrl + Enter">
                {save.isPending ? 'Đang lưu…' : existing ? 'Lưu' : 'Lưu review'}
              </Button>
            </>
          )}
        </footer>
      </form>
    </div>
  )
}

function MiniTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-surface-2/60 px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-lg font-semibold text-fg">{value}</p>
    </div>
  )
}
