import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  subDays,
  subMonths,
} from 'date-fns'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RelativeDateValue, Task, TaskFilter, TaskSort } from './taskViewTypes'

/**
 * Dịch 1 RelativeDateValue ("today"/"tomorrow"/"this_week"/"now") thành khoảng
 * [from, to] (ISO string) tại thời điểm gọi. Không lưu giá trị này trong DB —
 * chỉ dùng lúc build query, vì "hôm nay" đổi mỗi ngày (xem README mục 8.4/8.5).
 */
export function resolveRelativeDateRange(value: RelativeDateValue): { from: string; to: string } {
  const now = new Date()
  switch (value) {
    case 'today':
      return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() }
    case 'tomorrow': {
      const tomorrow = addDays(now, 1)
      return { from: startOfDay(tomorrow).toISOString(), to: endOfDay(tomorrow).toISOString() }
    }
    case 'yesterday': {
      const y = subDays(now, 1)
      return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() }
    }
    case 'this_week':
      return {
        from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
        to: endOfWeek(now, { weekStartsOn: 1 }).toISOString(),
      }
    case 'last_week': {
      const w = subDays(now, 7)
      return {
        from: startOfWeek(w, { weekStartsOn: 1 }).toISOString(),
        to: endOfWeek(w, { weekStartsOn: 1 }).toISOString(),
      }
    }
    case 'this_month':
      return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() }
    case 'last_month': {
      const m = subMonths(now, 1)
      return { from: startOfMonth(m).toISOString(), to: endOfMonth(m).toISOString() }
    }
    case 'now':
      return { from: now.toISOString(), to: now.toISOString() }
  }
}

/** Filter "là một trong" nhưng chưa chọn giá trị nào → không lọc gì. */
export function isEmptyFilter(filter: TaskFilter) {
  return filter.operator === 'in' && (!Array.isArray(filter.value) || filter.value.length === 0)
}

/**
 * Áp 1 TaskFilter lên Supabase query builder. Chỉ nhận field/operator đã khai báo
 * trong TaskFilterField/TaskFilterOperator — không có đường nào để filter tự do
 * lọt vào đây (đúng nguyên tắc README mục 8.4: không cho query tự do).
 */
function applyFilter(query: any, filter: TaskFilter) {
  const { field, operator, value } = filter
  if (isEmptyFilter(filter)) return query

  switch (operator) {
    case 'eq':
      return query.eq(field, value)
    case 'neq':
      return query.neq(field, value)
    case 'lt':
      return query.lt(field, value)
    case 'lte':
      return query.lte(field, value)
    case 'gt':
      return query.gt(field, value)
    case 'gte':
      return query.gte(field, value)
    case 'in':
      return query.in(field, value as unknown[])
    case 'is_null':
      return query.is(field, null)
    case 'not_null':
      return query.not(field, 'is', null)
    case 'within': {
      const { from, to } = resolveRelativeDateRange(value as RelativeDateValue)
      // "lt" cho "now" nghĩa là due_at trước hiện tại (dùng cho Overdue nếu cần)
      if ((value as RelativeDateValue) === 'now') {
        return query.lt(field, from)
      }
      return query.gte(field, from).lte(field, to)
    }
    default:
      return query
  }
}

// Filter "due_at eq today/tomorrow" trong seed thực chất nên dùng operator "within"
// để lấy đúng cả ngày; ta chuẩn hoá ở đây cho các view seed cũ dùng "eq"+relative value.
export function normalizeFilter(filter: TaskFilter): TaskFilter {
  const isDateField = filter.field === 'start_at' || filter.field === 'due_at' || filter.field === 'end_at'
  const isRelativeValue =
    typeof filter.value === 'string' &&
    ['today', 'tomorrow', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'now'].includes(filter.value)

  if (isDateField && isRelativeValue && filter.operator === 'eq') {
    return { ...filter, operator: 'within' }
  }
  if (isDateField && isRelativeValue && filter.operator === 'lt' && filter.value === 'now') {
    return { ...filter, operator: 'within' }
  }
  return filter
}

/**
 * Build + chạy query tasks theo 1 Saved View (filters + sorts).
 * Đây là "Task View query engine" — README mục 8: mọi view (Today, Overdue,
 * QUICK, EASY...) đều chạy qua đây, không có bảng riêng cho từng loại view.
 */
export async function fetchTasksForView(
  client: SupabaseClient,
  filters: TaskFilter[],
  sorts: TaskSort[],
): Promise<{ data: Task[]; error: string | null }> {
  let query = client.from('tasks').select('*')

  for (const rawFilter of filters) {
    query = applyFilter(query, normalizeFilter(rawFilter))
  }

  for (const sort of sorts) {
    // Ô trống luôn xuống cuối, dù sắp tăng hay giảm (giống Notion)
    query = query.order(sort.field, { ascending: sort.direction === 'asc', nullsFirst: false })
  }
  if (sorts.length === 0) {
    // Không sắp xếp → theo thứ tự kéo thả; task chưa từng kéo (position trống) xếp cuối theo lúc tạo
    query = query
      .order('position', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
  }

  const { data, error } = await query

  if (error) {
    return { data: [], error: error.message }
  }
  return { data: (data ?? []) as Task[], error: null }
}

// ---------------------------------------------------------------------------
// Đánh giá filter phía client — dùng để biết task vừa tạo có hiện trong view
// đang mở hay không (tránh cảm giác "thêm xong task biến mất").
// Phải giữ cùng ngữ nghĩa với applyFilter ở trên.
// ---------------------------------------------------------------------------

function compare(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return new Date(a as string).getTime() - new Date(b as string).getTime()
}

export function taskMatchesFilters(task: Task, filters: TaskFilter[]): boolean {
  return filters.every((raw) => {
    if (isEmptyFilter(raw)) return true
    const f = normalizeFilter(raw)
    const v = (task as unknown as Record<string, unknown>)[f.field]
    switch (f.operator) {
      case 'eq':
        return v === f.value
      case 'neq':
        return v !== f.value
      case 'is_null':
        return v === null || v === undefined
      case 'not_null':
        return v !== null && v !== undefined
      case 'in':
        return Array.isArray(f.value) && f.value.includes(v)
      case 'lt':
        return v != null && compare(v, f.value) < 0
      case 'lte':
        return v != null && compare(v, f.value) <= 0
      case 'gt':
        return v != null && compare(v, f.value) > 0
      case 'gte':
        return v != null && compare(v, f.value) >= 0
      case 'within': {
        if (v == null) return false
        const t = new Date(v as string).getTime()
        const { from, to } = resolveRelativeDateRange(f.value as RelativeDateValue)
        if (f.value === 'now') return t < new Date(from).getTime()
        return t >= new Date(from).getTime() && t <= new Date(to).getTime()
      }
      default:
        return true
    }
  })
}

/**
 * Giá trị mặc định khi thêm nhanh task trong 1 view, suy ra từ filter của view:
 * đang ở "Today" thì task mới có ngày bắt đầu hôm nay, "Tomorrow" thì ngày mai...
 * canAdd = false với view chỉ chứa task đã xong hoặc task quá hạn (thêm vào đó vô nghĩa).
 */
export function quickAddDefaultsForView(filters: TaskFilter[]): {
  canAdd: boolean
  start_at: string | null
  due_at: string | null
  /** View lọc đúng 1 giá trị của trường chọn (vd Năng lượng = Quick) → task mới nhận luôn giá trị đó */
  fields: Partial<Record<'energy_level' | 'importance' | 'urgency', string>>
} {
  let start_at: string | null = null
  let due_at: string | null = null
  const fields: Partial<Record<'energy_level' | 'importance' | 'urgency', string>> = {}
  for (const f of filters) {
    if (f.field === 'energy_level' || f.field === 'importance' || f.field === 'urgency') {
      const one = f.operator === 'eq' ? f.value : f.operator === 'in' && Array.isArray(f.value) && f.value.length === 1 ? f.value[0] : null
      if (typeof one === 'string') fields[f.field] = one
    }
    if (f.field === 'complete' && f.operator === 'eq' && f.value === true) {
      return { canAdd: false, start_at: null, due_at: null, fields }
    }
    // View quá hạn (start_at/due_at < now): task mới không thể đã quá hạn → không cho thêm
    if ((f.field === 'start_at' || f.field === 'due_at') && f.value === 'now' && (f.operator === 'lt' || f.operator === 'within')) {
      return { canAdd: false, start_at: null, due_at: null, fields }
    }
    // View khoảng thời gian đã qua (hôm qua, tuần trước, tháng trước): không thêm task mới vào đó
    if ((f.field === 'start_at' || f.field === 'due_at' || f.field === 'end_at') && ['yesterday', 'last_week', 'last_month'].includes(String(f.value))) {
      return { canAdd: false, start_at: null, due_at: null, fields }
    }
    // Suy ra start_at mặc định từ filter start_at
    if (f.field === 'start_at' && typeof f.value === 'string') {
      const now = new Date()
      if (f.value === 'today' || f.value === 'this_week' || f.value === 'this_month') start_at = startOfDay(now).toISOString()
      if (f.value === 'tomorrow') start_at = startOfDay(addDays(now, 1)).toISOString()
    }
    // Giữ khả năng suy ra due_at nếu filter dùng due_at
    if (f.field === 'due_at' && typeof f.value === 'string') {
      const now = new Date()
      if (f.value === 'today' || f.value === 'this_week' || f.value === 'this_month') due_at = endOfDay(now).toISOString()
      if (f.value === 'tomorrow') due_at = endOfDay(addDays(now, 1)).toISOString()
    }
  }
  return { canAdd: true, start_at, due_at, fields }
}
