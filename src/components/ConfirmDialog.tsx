import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './ui'

/** Hộp thoại xác nhận giữa màn hình. Esc = huỷ, Enter = đồng ý. */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = 'Không',
  busy = false,
  onConfirm,
  onCancel,
}: {
  title: string
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCancel()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [onCancel])

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <form
        className="relative w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault()
          onConfirm()
        }}
      >
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {children && <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="submit" autoFocus disabled={busy}>
            {busy ? 'Đang lưu…' : confirmLabel}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
