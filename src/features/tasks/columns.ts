import { ArrowUpRight, Calendar, CircleChevronDown, Repeat, Sigma, type LucideIcon } from 'lucide-react'
import type { TaskSort } from '../../lib/taskViewTypes'

/** Các cột của bảng task (ngoài cột Tên luôn đứng đầu). */
export type ColumnKey =
  | 'start_at'
  | 'due_at'
  | 'end_at'
  | 'importance'
  | 'urgency'
  | 'state'
  | 'energy_level'
  | 'project_id'
  | 'area_id'
  | 'actual_minutes'
  | 'repeat_rule'

export type ColumnDef = {
  key: ColumnKey
  label: string
  icon: LucideIcon
  width: string
  /** Trường sắp xếp tương ứng (có thì menu tiêu đề cột hiện "Sắp xếp") */
  sortField?: TaskSort['field']
}

export const columnDefs: ColumnDef[] = [
  { key: 'start_at', label: 'Bắt đầu', icon: Calendar, width: 'w-32', sortField: 'start_at' },
  { key: 'due_at', label: 'Hạn', icon: Calendar, width: 'w-28', sortField: 'due_at' },
  { key: 'end_at', label: 'Kết thúc', icon: Calendar, width: 'w-32', sortField: 'end_at' },
  { key: 'importance', label: 'Quan trọng', icon: CircleChevronDown, width: 'w-28', sortField: 'importance' },
  { key: 'urgency', label: 'Gấp', icon: CircleChevronDown, width: 'w-28', sortField: 'urgency' },
  { key: 'state', label: 'Trạng thái', icon: CircleChevronDown, width: 'w-28' },
  { key: 'energy_level', label: 'Năng lượng', icon: CircleChevronDown, width: 'w-28' },
  { key: 'project_id', label: 'Project', icon: ArrowUpRight, width: 'w-36' },
  { key: 'area_id', label: 'Area', icon: ArrowUpRight, width: 'w-32' },
  { key: 'actual_minutes', label: 'Thời gian', icon: Sigma, width: 'w-24', sortField: 'actual_minutes' },
  { key: 'repeat_rule', label: 'Lặp lại', icon: Repeat, width: 'w-28' },
]

export const columnDef = (key: ColumnKey) => columnDefs.find((c) => c.key === key)!

/** Mặc định: mọi cột trừ Kết thúc và Lặp lại (bật trong menu Cột nếu cần). */
export const defaultColumns: ColumnKey[] = columnDefs.map((c) => c.key).filter((k) => k !== 'end_at' && k !== 'repeat_rule')

const isColumnKey = (k: string): k is ColumnKey => columnDefs.some((c) => c.key === k)

/**
 * saved_views.visible_columns = ['task_name', ...cột đang hiện theo thứ tự].
 * Mảng rỗng / dữ liệu cũ (không bắt đầu bằng 'task_name') → bố cục mặc định.
 */
export function resolveColumns(visible: string[] | null | undefined): ColumnKey[] {
  if (!visible || visible[0] !== 'task_name') return defaultColumns
  return [...new Set(visible.slice(1).filter(isColumnKey))]
}

export const toVisibleColumns = (cols: ColumnKey[]): string[] => ['task_name', ...cols]

export const sameColumns = (a: ColumnKey[], b: ColumnKey[]) => a.join() === b.join()
