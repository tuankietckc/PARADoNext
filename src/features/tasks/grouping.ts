import type { GroupBy, Task } from '../../lib/taskViewTypes'
import type { ParaItem } from '../para/usePara'
import type { TaskDraft } from './useTaskMutations'
import { energyOptions, importanceOptions, stateOptions, urgencyOptions, type Option } from './taskFields'

export const groupFields: Array<{ value: GroupBy; label: string }> = [
  { value: 'area_id', label: 'Area' },
  { value: 'project_id', label: 'Project' },
  { value: 'state', label: 'Trạng thái' },
  { value: 'importance', label: 'Quan trọng' },
  { value: 'urgency', label: 'Gấp' },
  { value: 'energy_level', label: 'Năng lượng' },
]
export const groupLabel = (g: GroupBy) => groupFields.find((f) => f.value === g)?.label ?? g

export type TaskGroup = {
  key: string
  label: string
  /** 'relation' → hiện icon Project/Area; 'option' → nhãn màu; 'none' → nhóm "Chưa có …" */
  kind: 'relation' | 'option' | 'none'
  className?: string
  /** Giá trị gán cho task khi kéo vào / thêm trong nhóm này */
  patch: TaskDraft
  tasks: Task[]
}

const NONE = '__none'

/**
 * Chia task thành các nhóm theo trường groupBy (giống "Group by" của Notion).
 * Hiện cả nhóm trống; nhóm "Chưa có Area/Project" luôn ở cuối.
 */
export function buildGroups(
  tasks: Task[],
  groupBy: GroupBy,
  lists: { projects: ParaItem[]; areas: ParaItem[] },
): TaskGroup[] {
  if (groupBy === 'area_id' || groupBy === 'project_id') {
    const items = groupBy === 'area_id' ? lists.areas : lists.projects
    const label = groupBy === 'area_id' ? 'Area' : 'Project'
    const known = new Set(items.map((i) => i.id))
    // Task trỏ tới Area/Project không còn trong danh sách (vd đã lưu trữ) → vẫn có nhóm riêng
    const orphanIds = [...new Set(tasks.map((t) => t[groupBy]).filter((id): id is string => !!id && !known.has(id)))]
    const groups: TaskGroup[] = [
      ...items.map((i) => ({ id: i.id, name: i.name })),
      ...orphanIds.map((id) => ({ id, name: `(${label} đã lưu trữ)` })),
    ].map((i) => ({
      key: i.id,
      label: i.name,
      kind: 'relation' as const,
      patch: { [groupBy]: i.id },
      tasks: tasks.filter((t) => t[groupBy] === i.id),
    }))
    groups.push({
      key: NONE,
      label: `Chưa có ${label}`,
      kind: 'none',
      patch: { [groupBy]: null },
      tasks: tasks.filter((t) => !t[groupBy]),
    })
    return groups
  }

  if (groupBy === 'energy_level') {
    return [
      ...energyOptions.map((o) => ({
        key: o.value,
        label: o.label,
        kind: 'option' as const,
        className: o.className,
        patch: { energy_level: o.value },
        tasks: tasks.filter((t) => t.energy_level === o.value),
      })),
      { key: NONE, label: 'Chưa chọn năng lượng', kind: 'none' as const, patch: { energy_level: null }, tasks: tasks.filter((t) => !t.energy_level) },
    ]
  }

  const options: Option<string>[] =
    groupBy === 'state' ? stateOptions : groupBy === 'importance' ? importanceOptions : urgencyOptions
  return options.map((o) => ({
    key: o.value,
    label: o.label,
    kind: 'option' as const,
    className: o.className,
    patch:
      groupBy === 'state'
        ? { state: o.value as Task['state'], complete: o.value === 'done' }
        : { [groupBy]: o.value },
    tasks: tasks.filter((t) => (groupBy === 'state' ? (t.complete ? 'done' : t.state) : t[groupBy]) === o.value),
  }))
}

export const sumMinutes = (tasks: Task[]) => tasks.reduce((sum, t) => sum + (t.actual_minutes ?? 0), 0)
