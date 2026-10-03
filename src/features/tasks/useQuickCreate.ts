import { useState } from 'react'
import { isToday, isTomorrow } from 'date-fns'
import { quickAddDefaultsForView, taskMatchesFilters } from '../../lib/taskViewQuery'
import type { SavedView } from '../../lib/taskViewTypes'
import { useCreateTask, type TaskDraft } from './useTaskMutations'

/**
 * Logic thêm nhanh task trong 1 view (dùng cho dòng "+ Thêm task" ở bảng và mobile).
 * Ngày bắt đầu mặc định suy ra từ view để task vừa thêm hiện ngay trong view đó.
 */
/** baseDefaults: giá trị luôn gán cho task mới (vd trong trang Project: project_id + area_id) */
export function useQuickCreate(view: SavedView, baseDefaults?: TaskDraft) {
  const createTask = useCreateTask()
  const [message, setMessage] = useState<{ tone: 'info' | 'danger'; text: string } | null>(null)
  const defaults = quickAddDefaultsForView(view.filters)

  let startHint: string | null = null
  if (defaults.start_at) {
    const d = new Date(defaults.start_at)
    startHint = isToday(d) ? 'Hôm nay' : isTomorrow(d) ? 'Ngày mai' : null
  }

  /** extra: giá trị gán thêm, vd thêm trong nhóm Area "Career" → { area_id } */
  async function create(taskName: string, extra?: TaskDraft) {
    const name = taskName.trim()
    if (!name) return
    setMessage(null)
    try {
      // Ngày bắt đầu = từ view filter hoặc lúc thêm (trừ khi view đang lọc "chưa có ngày bắt đầu")
      const wantsNoStart = view.filters.some((f) => f.field === 'start_at' && f.operator === 'is_null')
      const created = await createTask.mutateAsync({
        task_name: name,
        ...(wantsNoStart ? {} : { start_at: defaults.start_at ?? new Date().toISOString() }),
        ...(defaults.due_at ? { due_at: defaults.due_at } : {}),
        ...(defaults.fields as TaskDraft),
        ...baseDefaults,
        ...extra,
      })
      if (!taskMatchesFilters(created, view.filters)) {
        setMessage({ tone: 'info', text: `Đã thêm "${name}". Task này không thuộc view ${view.name} — xem ở All Tasks.` })
      }
    } catch (err) {
      setMessage({ tone: 'danger', text: (err as Error).message })
    }
  }

  return {
    canAdd: defaults.canAdd,
    startDefault: defaults.start_at,
    dueDefault: defaults.due_at,
    startHint,
    create,
    isPending: createTask.isPending,
    message,
    clearMessage: () => setMessage(null),
  }
}

