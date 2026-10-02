import type { Task } from '../../lib/taskViewTypes'

const STEP = 1024

/**
 * Tính thứ tự mới sau khi kéo: bỏ các task đang kéo ra khỏi danh sách rồi chèn cả
 * nhóm (giữ thứ tự tương đối giữa chúng) vào chỗ thả.
 * Trả về null nếu thả lên chính nhóm đang kéo (không có gì thay đổi).
 */
export function moveIds(ids: string[], movingIds: string[], overId: string, draggedDown: boolean): string[] | null {
  const moving = ids.filter((id) => movingIds.includes(id)) // giữ thứ tự hiển thị
  const remaining = ids.filter((id) => !movingIds.includes(id))
  let insertAt = remaining.indexOf(overId)
  if (insertAt === -1) return null
  if (draggedDown) insertAt += 1 // kéo xuống → nằm SAU dòng được thả lên
  const next = [...remaining.slice(0, insertAt), ...moving, ...remaining.slice(insertAt)]
  return next.join() === ids.join() ? null : next
}

/**
 * Tính position mới cho thứ tự `orderedIds`.
 * - Bình thường: chỉ đổi position của các task vừa kéo — chèn vào giữa 2 hàng xóm
 *   (1–vài request thay vì cập nhật cả danh sách).
 * - Nếu các task còn lại chưa có position / không tăng dần theo thứ tự mới
 *   (vd: lần đầu kéo, hoặc vừa bỏ sắp xếp) → đánh số lại cả danh sách hiển thị.
 */
export function computePositionChanges(
  tasks: Task[],
  orderedIds: string[],
  movedIds: string[],
): Array<{ id: string; position: number }> {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const ordered = orderedIds.map((id) => byId.get(id)!).filter(Boolean)
  const moved = new Set(movedIds)

  const fixed = ordered.filter((t) => !moved.has(t.id))
  const fixedOk = fixed.every(
    (t, i) => t.position != null && (i === 0 || (fixed[i - 1].position as number) < (t.position as number)),
  )

  if (fixedOk) {
    const changes: Array<{ id: string; position: number }> = []
    let i = 0
    while (i < ordered.length) {
      if (!moved.has(ordered[i].id)) {
        i++
        continue
      }
      // Một cụm task vừa kéo liền nhau: [i..j)
      let j = i
      while (j < ordered.length && moved.has(ordered[j].id)) j++
      const count = j - i
      const prev = i > 0 ? (ordered[i - 1].position as number) : null
      const next = j < ordered.length ? (ordered[j].position as number) : null
      const lo = prev ?? (next != null ? next - STEP * (count + 1) : 0)
      const hi = next ?? lo + STEP * (count + 1)
      const gap = (hi - lo) / (count + 1)
      if (gap < 1e-6) break // hết chỗ chen → đánh số lại bên dưới
      for (let k = 0; k < count; k++) changes.push({ id: ordered[i + k].id, position: lo + gap * (k + 1) })
      i = j
    }
    if (changes.length === movedIds.length) return changes
  }

  // Đánh số lại: 1024, 2048, … — chỉ gửi những task có position thực sự đổi
  return ordered
    .map((t, idx) => ({ id: t.id, position: (idx + 1) * STEP, old: t.position }))
    .filter((c) => c.old !== c.position)
    .map(({ id, position }) => ({ id, position }))
}
