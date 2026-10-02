import { differenceInMinutes, endOfDay, format, isToday, isTomorrow, isYesterday, parse, startOfDay } from 'date-fns'
import type { Energy, Task } from '../../lib/taskViewTypes'

export type Level = 'low' | 'medium' | 'high'
export type Option<T extends string> = { value: T; label: string; className: string }

// Màu nhãn kiểu Notion — dùng chung cho bảng, danh sách mobile và bảng chi tiết
export const importanceOptions: Option<Level>[] = [
  { value: 'high', label: 'Cao', className: 'bg-accent-soft text-accent' },
  { value: 'medium', label: 'Vừa', className: 'bg-surface-2 text-muted' },
  { value: 'low', label: 'Thấp', className: 'bg-surface-2 text-subtle' },
]

export const urgencyOptions: Option<Level>[] = [
  { value: 'high', label: 'Gấp', className: 'bg-danger-soft text-danger' },
  { value: 'medium', label: 'Vừa', className: 'bg-surface-2 text-muted' },
  { value: 'low', label: 'Không gấp', className: 'bg-surface-2 text-subtle' },
]

/** Năng lượng = kiểu việc (chọn 1). Personal = việc dành cho cá nhân. */
export const energyOptions: Option<Energy>[] = [
  { value: 'flow', label: 'Flow', className: 'bg-info-soft text-info' },
  { value: 'quick', label: 'Quick', className: 'bg-surface-2 text-muted' },
  { value: 'easy', label: 'Easy', className: 'bg-yellow-soft text-yellow' },
  { value: 'personal', label: 'Personal', className: 'bg-pink-soft text-pink' },
]

export const stateOptions: Option<Task['state']>[] = [
  { value: 'not_started', label: 'Chưa làm', className: 'bg-surface-2 text-muted' },
  { value: 'in_progress', label: 'Đang làm', className: 'bg-info-soft text-info' },
  { value: 'done', label: 'Xong', className: 'bg-success-soft text-success' },
]

export function optionOf<T extends string>(options: Option<T>[], value: T): Option<T> {
  return options.find((o) => o.value === value) ?? options[0]
}

/** "Hôm nay" / "Ngày mai" / "Hôm qua" / dd/MM — kèm giờ nếu withTime và không phải 00:00. */
export function formatDay(value: string | null, withTime = false): { text: string; overdue: boolean } {
  if (!value) return { text: '', overdue: false }
  const date = new Date(value)
  const overdue = date.getTime() < Date.now() && !isToday(date)
  let text = format(date, 'dd/MM')
  if (isToday(date)) text = 'Hôm nay'
  else if (isTomorrow(date)) text = 'Ngày mai'
  else if (isYesterday(date)) text = 'Hôm qua'
  // 00:00 / 23:59 là mốc "chỉ có ngày" (đầu/cuối ngày) → không hiện giờ
  const hm = format(date, 'HH:mm')
  if (withTime && hm !== '00:00' && hm !== '23:59') text += ' ' + hm
  return { text, overdue }
}

export const toDateTimeInput = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '')
export const fromDateTimeInput = (value: string) => (value ? new Date(value).toISOString() : null)

/** 45 → "45 phút", 90 → "1 giờ 30 phút". short: "45p", "1g 30p". */
export function formatDuration(minutes: number | null, short = false): string {
  if (minutes == null) return ''
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (short) return h ? `${h}g${m ? ` ${m}p` : ''}` : `${m}p`
  if (!h) return `${m} phút`
  return m ? `${h} giờ ${m} phút` : `${h} giờ`
}

/** Số phút giữa bắt đầu (hoặc lúc tạo) và kết thúc — cùng công thức với cột tự tính trong database. */
export function minutesBetween(startIso: string | null, endIso: string | null, createdIso?: string | null) {
  const from = startIso ?? createdIso
  if (!from || !endIso) return null
  const minutes = differenceInMinutes(new Date(endIso), new Date(from))
  return minutes >= 0 ? minutes : null
}

export const toDateInput = (iso: string | null) => (iso ? format(new Date(iso), 'yyyy-MM-dd') : '')

/** Hạn lưu là cuối ngày (để không bị tính quá hạn ngay trong ngày), ngày bắt đầu lưu là đầu ngày. */
export function fromDateInput(value: string, edge: 'start' | 'end'): string | null {
  if (!value) return null
  const d = parse(value, 'yyyy-MM-dd', new Date())
  return (edge === 'end' ? endOfDay(d) : startOfDay(d)).toISOString()
}

/** Bỏ dấu tiếng Việt để tìm kiếm ("du an" khớp "Dự án"). */
export function normalizeSearch(text: string) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}
