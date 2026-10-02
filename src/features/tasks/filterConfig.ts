import type { TaskFilter, TaskFilterField, TaskSort } from '../../lib/taskViewTypes'
import type { ParaKind } from '../para/usePara'
import { energyOptions, importanceOptions, stateOptions, urgencyOptions, type Option } from './taskFields'

// ---------------------------------------------------------------------------
// Các trường lọc được — mỗi loại có 1 kiểu editor riêng (xem ViewToolbar)
// ---------------------------------------------------------------------------
export type FilterKind = 'boolean' | 'select' | 'date' | 'relation' | 'number'

export type FilterFieldDef = {
  field: TaskFilterField
  label: string
  kind: FilterKind
  options?: Option<string>[]
  relation?: ParaKind
}

export const filterFields: FilterFieldDef[] = [
  { field: 'complete', label: 'Hoàn thành', kind: 'boolean' },
  { field: 'state', label: 'Trạng thái', kind: 'select', options: stateOptions },
  { field: 'importance', label: 'Quan trọng', kind: 'select', options: importanceOptions },
  { field: 'urgency', label: 'Gấp', kind: 'select', options: urgencyOptions },
  { field: 'energy_level', label: 'Năng lượng', kind: 'select', options: energyOptions },
  { field: 'due_at', label: 'Hạn', kind: 'date' },
  { field: 'start_at', label: 'Bắt đầu', kind: 'date' },
  { field: 'end_at', label: 'Kết thúc', kind: 'date' },
  { field: 'project_id', label: 'Project', kind: 'relation', relation: 'projects' },
  { field: 'area_id', label: 'Area', kind: 'relation', relation: 'areas' },
]

export const fieldDef = (field: TaskFilterField) => filterFields.find((f) => f.field === field)

// Lựa chọn cho trường ngày — dùng giá trị tương đối để "Hôm nay" luôn đúng mỗi ngày
export const dateChoices: Array<{ key: string; label: string; make: (field: TaskFilterField) => TaskFilter }> = [
  { key: 'today', label: 'Hôm nay', make: (field) => ({ field, operator: 'eq', value: 'today' }) },
  { key: 'tomorrow', label: 'Ngày mai', make: (field) => ({ field, operator: 'eq', value: 'tomorrow' }) },
  { key: 'yesterday', label: 'Hôm qua', make: (field) => ({ field, operator: 'within', value: 'yesterday' }) },
  { key: 'this_week', label: 'Tuần này', make: (field) => ({ field, operator: 'within', value: 'this_week' }) },
  { key: 'last_week', label: 'Tuần trước', make: (field) => ({ field, operator: 'within', value: 'last_week' }) },
  { key: 'this_month', label: 'Tháng này', make: (field) => ({ field, operator: 'within', value: 'this_month' }) },
  { key: 'last_month', label: 'Tháng trước', make: (field) => ({ field, operator: 'within', value: 'last_month' }) },
  { key: 'past', label: 'Đã qua', make: (field) => ({ field, operator: 'lt', value: 'now' }) },
  { key: 'not_null', label: 'Có ngày', make: (field) => ({ field, operator: 'not_null' }) },
  { key: 'is_null', label: 'Trống', make: (field) => ({ field, operator: 'is_null' }) },
]

export function dateChoiceKey(f: TaskFilter): string | undefined {
  if (f.operator === 'is_null' || f.operator === 'not_null') return f.operator
  if (f.value === 'now' && (f.operator === 'lt' || f.operator === 'within')) return 'past'
  if (typeof f.value === 'string' && ['today', 'tomorrow', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month'].includes(f.value)) return f.value
  return undefined
}

/** Bộ lọc mặc định khi vừa thêm 1 trường. */
export function defaultFilter(def: FilterFieldDef): TaskFilter {
  switch (def.kind) {
    case 'boolean':
      return { field: def.field, operator: 'eq', value: false }
    case 'date':
      return { field: def.field, operator: 'eq', value: 'today' }
    case 'number':
      return { field: def.field, operator: 'lte', value: 15 }
    default:
      return { field: def.field, operator: 'in', value: [] }
  }
}

/** Chuẩn hoá "eq 1 giá trị" (dữ liệu cũ) thành "in [giá trị]" để editor nhiều lựa chọn xử lý thống nhất. */
export function selectedValues(f: TaskFilter): string[] {
  if (f.operator === 'in' && Array.isArray(f.value)) return f.value as string[]
  if (f.operator === 'eq' && typeof f.value === 'string') return [f.value]
  return []
}

// ---------------------------------------------------------------------------
// Sắp xếp
// ---------------------------------------------------------------------------
export const sortFields: Array<{ field: TaskSort['field']; label: string; asc: string; desc: string }> = [
  { field: 'due_at', label: 'Hạn', asc: 'Sớm → muộn', desc: 'Muộn → sớm' },
  { field: 'start_at', label: 'Bắt đầu', asc: 'Sớm → muộn', desc: 'Muộn → sớm' },
  { field: 'end_at', label: 'Kết thúc', asc: 'Sớm → muộn', desc: 'Muộn → sớm' },
  { field: 'importance', label: 'Quan trọng', asc: 'Thấp → cao', desc: 'Cao → thấp' },
  { field: 'urgency', label: 'Gấp', asc: 'Không gấp → gấp', desc: 'Gấp → không gấp' },
  { field: 'actual_minutes', label: 'Thời gian làm', asc: 'Ngắn → dài', desc: 'Dài → ngắn' },
  { field: 'task_name', label: 'Tên', asc: 'A → Z', desc: 'Z → A' },
  { field: 'created_at', label: 'Ngày tạo', asc: 'Cũ → mới', desc: 'Mới → cũ' },
]

export const sortDef = (field: TaskSort['field']) => sortFields.find((s) => s.field === field)
