// Khớp với Filter DSL định nghĩa ở README mục 8.4

export type TaskFilterField =
  | 'complete'
  | 'start_at'
  | 'end_at'
  | 'due_at'
  | 'importance'
  | 'urgency'
  | 'energy_level'
  | 'state'
  | 'project_id'
  | 'area_id'
  | 'task_type'
  | 'moved_the_needle'

export type TaskFilterOperator =
  | 'eq'
  | 'neq'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'in'
  | 'is_null'
  | 'not_null'
  | 'within' // chỉ dùng cho field ngày với value dạng RelativeDateValue

export type RelativeDateValue = 'today' | 'tomorrow' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'now'

export type TaskFilter = {
  field: TaskFilterField
  operator: TaskFilterOperator
  value?: unknown
}

export type TaskSort = {
  field:
    | 'importance'
    | 'urgency'
    | 'start_at'
    | 'end_at'
    | 'due_at'
    | 'actual_minutes'
    | 'task_name'
    | 'created_at'
  direction: 'asc' | 'desc'
}

export type SavedView = {
  id: string
  user_id: string
  name: string
  icon: string | null
  /** Ghi chú giải thích view đang hiện gì (migration 0005). null = dùng câu mô tả tự sinh. */
  description?: string | null
  filters: TaskFilter[]
  sorts: TaskSort[]
  /** Nhóm task theo trường nào (view bảng) */
  group_by: GroupBy | null
  visible_columns: string[]
  /** Bố cục: bảng, lịch tuần, lịch tháng (migration 0006) */
  view_type: ViewLayout
  /** Mục chứa view trong trang Tasks: Task list hoặc Work Schedule */
  section?: ViewSection
  /** Lịch hiện task theo ngày nào */
  calendar_field?: CalendarField
  is_system: boolean
  sort_order: number
}

export type ViewLayout = 'table' | 'calendar_week' | 'calendar_month'
export type ViewSection = 'tasks' | 'schedule' | 'list' | 'project' | 'area' | 'review'
export type GroupBy = 'area_id' | 'project_id' | 'state' | 'importance' | 'urgency' | 'energy_level'

export type Energy = 'flow' | 'quick' | 'easy' | 'personal'
/** Chu kỳ lặp lại (migration 0016) */
export type RepeatRule = 'day' | 'weekday' | 'week' | '2weeks' | 'month' | '3months' | '6months' | 'year'
export type CalendarField = 'due_at' | 'start_at' | 'end_at'

export type Task = {
  id: string
  user_id: string
  project_id: string | null
  area_id: string | null
  task_name: string
  notes: string | null
  start_at: string | null
  due_at: string | null
  importance: 'low' | 'medium' | 'high'
  urgency: 'low' | 'medium' | 'high'
  /** Năng lượng / kiểu việc — chọn 1 hoặc để trống (migration 0008) */
  energy_level: Energy | null
  /** Thời điểm hoàn thành — database tự điền khi task được đánh dấu xong. */
  end_at: string | null
  /** Tự tính = end_at − (start_at hoặc created_at). Chỉ đọc. */
  actual_minutes: number | null
  /** Như actual_minutes nhưng theo giờ (2 chữ số thập phân). Chỉ đọc. */
  actual_hours: number | null
  state: 'not_started' | 'in_progress' | 'done'
  task_type: 'task' | 'habit'
  complete: boolean
  moved_the_needle: boolean | null
  /** Thứ tự thủ công (kéo thả). Dùng khi view không có sắp xếp. */
  position: number | null
  /** Lặp lại: đặt trên task gốc, mỗi chu kỳ tạo 1 bản sao (migration 0016). Thiếu cột → undefined. */
  repeat_rule?: RepeatRule | null
  /** Mốc tính chu kỳ — database tự đặt khi chọn/đổi chu kỳ */
  repeat_anchor?: string | null
  repeat_last_on?: string | null
  /** Bản sao: trỏ về task gốc + ngày lặp */
  repeat_parent_id?: string | null
  repeat_on?: string | null
  /** "Nhắc lúc": bot Telegram nhắc đúng giờ này (migration 0017/0018) */
  remind_at?: string | null
  created_at: string
  updated_at: string
}
