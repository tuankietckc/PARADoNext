import { Check, X } from 'lucide-react'
import { AnchoredPopover, usePopoverAnchor } from '../../components/Popover'
import { Tag, cx } from '../../components/ui'
import type { Project } from './useParaAdmin'

/**
 * Status của Project — CHỈ CHỌN 1 (hoặc để trống), giống select của Notion:
 *   Fav · On-going · Deadline · Completed · Archive · Moved the Needle
 *
 * Lưu vào các cột sẵn có để các view (Fav / Finished / Archive…) vẫn chạy:
 *   Fav → is_favorite · Completed → completed · Archive → archived
 *   On-going / Deadline / Moved the Needle → labels = [giá trị đó]
 * Chọn 1 status sẽ tắt hết các status còn lại.
 */
export type StatusKey = 'fav' | 'ongoing' | 'deadline' | 'completed' | 'archive' | 'moved_the_needle'
export type ProjectLabel = 'ongoing' | 'deadline' | 'moved_the_needle'

export const statusOptions: Array<{ key: StatusKey; label: string; className: string }> = [
  { key: 'fav', label: 'Fav', className: 'bg-yellow-soft text-yellow' },
  { key: 'ongoing', label: 'On-going', className: 'bg-info-soft text-info' },
  { key: 'deadline', label: 'Deadline', className: 'bg-danger-soft text-danger' },
  { key: 'completed', label: 'Completed', className: 'bg-success-soft text-success' },
  { key: 'archive', label: 'Archive', className: 'bg-surface-2 text-muted' },
  { key: 'moved_the_needle', label: 'Moved the Needle', className: 'bg-purple-soft text-purple' },
]
export const statusOption = (key: StatusKey) => statusOptions.find((o) => o.key === key)!

// Dữ liệu cũ có thể bật nhiều cờ cùng lúc → lấy cái "nặng" nhất để hiển thị
const priority: StatusKey[] = ['archive', 'completed', 'deadline', 'ongoing', 'moved_the_needle', 'fav']

export function projectStatus(p: Project): StatusKey | null {
  const labels = (p.labels ?? []) as ProjectLabel[]
  return (
    priority.find((k) =>
      k === 'fav' ? p.is_favorite : k === 'completed' ? p.completed : k === 'archive' ? p.archived : labels.includes(k as ProjectLabel),
    ) ?? null
  )
}

/** Giữ để tương thích chỗ cũ: mảng 0 hoặc 1 phần tử */
export const projectStatuses = (p: Project): StatusKey[] => {
  const s = projectStatus(p)
  return s ? [s] : []
}

/** Đặt đúng 1 status (null = bỏ trống) → phần cần lưu vào database */
export function setStatusPatch(key: StatusKey | null): Partial<Project> {
  return {
    is_favorite: key === 'fav',
    completed: key === 'completed',
    archived: key === 'archive',
    labels: key === 'ongoing' || key === 'deadline' || key === 'moved_the_needle' ? [key] : [],
  }
}

/** Bật/tắt nhanh 1 status (nút sao, nút hoàn thành trên thẻ): đang là nó → bỏ trống, chưa → chọn nó */
export function toggleStatusPatch(p: Project, key: StatusKey): Partial<Project> {
  return setStatusPatch(projectStatus(p) === key ? null : key)
}

export function StatusTag({ status }: { status: StatusKey | null }) {
  if (!status) return null
  const o = statusOption(status)
  return <Tag className={o.className}>{o.label}</Tag>
}

/** Giữ để tương thích: hiện các status (giờ tối đa 1) */
export function StatusTags({ keys, hide = [] }: { keys: StatusKey[]; hide?: StatusKey[] }) {
  return (
    <>
      {keys
        .filter((k) => !hide.includes(k))
        .map((k) => (
          <StatusTag key={k} status={k} />
        ))}
    </>
  )
}

/** Ô Status: bấm → chọn 1 (giống select của Notion), có "Bỏ chọn". */
export function StatusCell({
  project,
  onPatch,
  compact = false,
}: {
  project: Project
  onPatch: (patch: Partial<Project>) => void
  /** Dạng ô bảng (không chữ "Trống") */
  compact?: boolean
}) {
  const pop = usePopoverAnchor()
  const current = projectStatus(project)
  const choose = (key: StatusKey | null) => {
    onPatch(setStatusPatch(key))
    pop.close()
  }
  return (
    <>
      <button
        type="button"
        onClick={pop.toggle}
        aria-label="Status"
        className={cx(
          'flex w-full flex-wrap items-center gap-1 text-left text-sm hover:bg-surface-2',
          compact ? 'min-h-10 px-2' : 'min-h-9 rounded-md px-2 py-1',
        )}
      >
        {current ? <StatusTag status={current} /> : !compact && <span className="text-subtle">Trống</span>}
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={240}>
          <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-subtle">Chọn 1 status</p>
          {statusOptions.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => choose(o.key)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2"
            >
              <Tag className={o.className}>{o.label}</Tag>
              {current === o.key && <Check size={14} className="text-muted" />}
            </button>
          ))}
          {current && (
            <button
              type="button"
              onClick={() => choose(null)}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted hover:bg-surface-2"
            >
              Bỏ chọn <X size={14} />
            </button>
          )}
        </AnchoredPopover>
      )}
    </>
  )
}
