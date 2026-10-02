import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Popover neo vào 1 phần tử (ô bảng, nút...). Render qua portal với position: fixed
 * để không bị bảng (overflow) cắt mất. Đóng khi bấm ra ngoài hoặc nhấn Esc.
 */
export function AnchoredPopover({
  anchor,
  onClose,
  width = 240,
  children,
}: {
  anchor: HTMLElement
  onClose: () => void
  width?: number
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useLayoutEffect(() => {
    function place() {
      const r = anchor.getBoundingClientRect()
      const h = ref.current?.scrollHeight ?? 0
      const below = window.innerHeight - r.bottom - 12
      const above = r.top - 12
      let top = r.bottom + 4
      let maxHeight = below
      // Không đủ chỗ phía dưới → lật lên trên (nếu phía trên rộng hơn)
      if (h > below && above > below) {
        maxHeight = above
        top = r.top - Math.min(h, above) - 4
      }
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
      setPos({ top, left, maxHeight: Math.max(160, maxHeight) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor, width])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      const target = e.target as Node
      if (ref.current?.contains(target) || anchor.contains(target)) return
      onCloseRef.current()
    }
    // Bắt ở pha capture + chặn lan truyền: Esc chỉ đóng popover, không đóng luôn drawer phía sau
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [anchor])

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      style={{
        position: 'fixed',
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        width,
        // Menu dài hơn chỗ trống → cuộn bên trong, không tràn khỏi màn hình
        maxHeight: pos?.maxHeight,
        overflowY: 'auto',
        visibility: pos ? 'visible' : 'hidden',
      }}
      className="z-50 rounded-lg border border-line bg-surface p-1 shadow-xl"
    >
      {children}
    </div>,
    document.body,
  )
}

/** Trạng thái mở/đóng popover gắn với phần tử được bấm. */
export function usePopoverAnchor() {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  return {
    anchor,
    toggle: (e: React.MouseEvent<HTMLElement>) => setAnchor(anchor ? null : e.currentTarget),
    open: (el: HTMLElement) => setAnchor(el),
    close: () => setAnchor(null),
  }
}
