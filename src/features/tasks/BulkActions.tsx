import { useEffect } from 'react'
import { Copy, Trash2, X } from 'lucide-react'
import { cx } from '../../components/ui'

const kbd = 'rounded border border-line px-1 font-mono text-[10px] text-subtle'
const barButton =
  'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors hover:bg-surface-2 disabled:opacity-50'

/** Thanh nổi khi đang chọn task (giống Notion). */
export function BulkActionBar({
  count,
  busy,
  onDuplicate,
  onDelete,
  onClear,
}: {
  count: number
  busy: boolean
  onDuplicate: () => void
  onDelete: () => void
  onClear: () => void
}) {
  if (count === 0) return null
  return (
    <div
      role="toolbar"
      aria-label="Thao tác với task đã chọn"
      className="fixed bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-line bg-surface px-1.5 py-1.5 shadow-2xl md:left-[calc(50%+7.5rem)]"
    >
      <span className="px-2 text-sm font-medium text-accent">{count} đã chọn</span>
      <span className="h-5 w-px bg-line" aria-hidden />
      <button type="button" className={cx(barButton, 'text-fg')} onClick={onDuplicate} disabled={busy}>
        <Copy size={15} /> Nhân bản <kbd className={cx(kbd, 'hidden sm:inline')}>Ctrl D</kbd>
      </button>
      <button type="button" className={cx(barButton, 'text-danger hover:bg-danger-soft')} onClick={onDelete} disabled={busy}>
        <Trash2 size={15} /> Xoá <kbd className={cx(kbd, 'hidden sm:inline')}>Del</kbd>
      </button>
      <span className="h-5 w-px bg-line" aria-hidden />
      <button
        type="button"
        aria-label="Bỏ chọn"
        title="Bỏ chọn (Esc)"
        className="grid size-8 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        onClick={onClear}
      >
        <X size={16} />
      </button>
    </div>
  )
}

export type ToastState = { id: number; text: string; tone?: 'info' | 'danger'; undo?: () => void } | null

/** Thông báo ngắn ở đáy màn hình, có nút Hoàn tác. Tự ẩn sau 8 giây. */
export function Toast({
  toast,
  onDismiss,
  raised = false,
}: {
  toast: ToastState
  onDismiss: () => void
  /** true khi thanh thao tác đang hiện → đẩy thông báo lên trên nó */
  raised?: boolean
}) {
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(onDismiss, 8000)
    return () => clearTimeout(timer)
  }, [toast, onDismiss])

  if (!toast) return null
  return (
    <div
      role="status"
      className={cx(
        raised ? 'bottom-20' : 'bottom-6',
        'fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-2.5 text-sm shadow-2xl md:left-[calc(50%+7.5rem)]',
        toast.tone === 'danger' ? 'bg-danger text-white' : 'bg-fg text-bg',
      )}
    >
      <span>{toast.text}</span>
      {toast.undo && (
        <button
          type="button"
          onClick={() => {
            toast.undo?.()
            onDismiss()
          }}
          className="font-semibold underline-offset-2 hover:underline"
        >
          Hoàn tác
        </button>
      )}
      <button type="button" aria-label="Đóng thông báo" onClick={onDismiss} className="opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  )
}
