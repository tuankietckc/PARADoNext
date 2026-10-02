import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Inbox, LoaderCircle, RotateCcw, Search, Trash2, X, type LucideIcon } from 'lucide-react'
import { normalizeSearch } from './taskFields'
import { useTasksView } from './useTasksView'
import {
  useDeleteTasks,
  useDuplicateTasks,
  useReorderTasks,
  useRestoreTasks,
  useCreateTask,
  useUpdateTask,
  type TaskDraft,
} from './useTaskMutations'
import { BulkActionBar, Toast, type ToastState } from './BulkActions'
import { useCreateSavedView, useDeleteSavedView, usePatchSavedViews, useUpdateSavedView } from './useSavedViewMutations'
import { resolveColumns, toVisibleColumns, type ColumnKey } from './columns'
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CalendarView, calendarRange, type CalendarLayout } from './CalendarView'
import { TaskList, TaskTable } from './TaskTable'
import { ViewToolbar } from './ViewToolbar'
import { ViewNote } from './ViewNote'
import { computePositionChanges } from './reorder'
import { sortDef } from './filterConfig'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { endOfDay, startOfDay } from 'date-fns'
import type {
  CalendarField,
  GroupBy,
  SavedView,
  Task,
  TaskFilter,
  TaskSort,
  ViewLayout,
  ViewSection,
} from '../../lib/taskViewTypes'
import { AnchoredPopover, usePopoverAnchor } from '../../components/Popover'
import { Button, Card, Notice, cx } from '../../components/ui'

/** Phần đang chỉnh (chưa lưu) của 1 view: bộ lọc, sắp xếp, bố cục */
type ViewDraft = {
  filters: TaskFilter[]
  sorts: TaskSort[]
  view_type: ViewLayout
  calendar_field: CalendarField
  group_by: GroupBy | null
}

const baseOf = (v: SavedView): ViewDraft => ({
  filters: v.filters,
  sorts: v.sorts,
  view_type: v.view_type ?? 'table',
  calendar_field: v.calendar_field ?? 'due_at',
  group_by: v.group_by ?? null,
})

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">{children}</div>
}

const sameDraft = (a: ViewDraft, b: SavedView | ViewDraft) => {
  const bb = 'id' in b ? baseOf(b) : b
  return JSON.stringify(a) === JSON.stringify(bb)
}

/** Ô nhập tên để "Lưu thành view mới". */
function SaveAsNewView({ onSave, pending }: { onSave: (name: string) => Promise<void>; pending: boolean }) {
  const pop = usePopoverAnchor()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <Button variant="secondary" className="h-7 px-2.5 text-xs" onClick={pop.toggle}>
        Lưu thành view mới
      </Button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={240}>
          <form
            className="p-1"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!name.trim()) return
              setError(null)
              try {
                await onSave(name.trim())
                setName('')
                pop.close()
              } catch (err) {
                setError((err as Error).message)
              }
            }}
          >
            <p className="px-1 pb-1.5 text-[11px] font-medium text-subtle">Tên view mới</p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="vd: QUICK, Việc nhẹ buổi tối…"
              className="mb-1.5 h-9 w-full rounded-md border border-line bg-surface px-2 text-sm text-fg outline-none focus:border-accent"
            />
            {error && <p className="px-1 pb-1.5 text-xs text-danger">{error}</p>}
            <Button type="submit" className="h-8 w-full text-xs" disabled={!name.trim() || pending}>
              {pending ? 'Đang lưu…' : 'Tạo view'}
            </Button>
          </form>
        </AnchoredPopover>
      )}
    </>
  )
}

/**
 * 1 mục view trong trang Tasks (Work Schedule hoặc Task list): tab view, ghi chú,
 * bộ lọc/sắp xếp/bố cục, và nội dung dạng bảng hoặc lịch.
 */
export function TaskViewSection({
  section,
  title,
  icon: SectionIcon,
  views,
  allViews,
  drawerOpen,
  onOpenTask,
  emptyHint,
  scope,
  className,
}: {
  section: ViewSection
  title: string
  icon: LucideIcon
  /** Các view thuộc mục này */
  views: SavedView[]
  /** Tất cả view (để tính thứ tự khi tạo view mới) */
  allViews: SavedView[]
  drawerOpen: boolean
  onOpenTask: (task: Task) => void
  emptyHint: React.ReactNode
  /**
   * Giới hạn view trong 1 phạm vi (trang Project/Area): thêm bộ lọc ẩn (không lưu vào view)
   * và giá trị gán sẵn cho task mới.
   */
  scope?: { filters: TaskFilter[]; defaults: TaskDraft }
  /** Khoảng cách dưới cả mục (mặc định mb-12) */
  className?: string
}) {
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const drawer = drawerOpen
  const createTask = useCreateTask()
  // Ngày đang xem trên lịch (tuần/tháng chứa ngày này)
  const [anchor, setAnchor] = useState(() => new Date())
  // Filter/sort đang chỉnh nhưng chưa lưu — giữ riêng cho từng tab
  const [drafts, setDrafts] = useState<Record<string, ViewDraft>>({})
  const [confirmDeleteView, setConfirmDeleteView] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const lastClicked = useRef<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const updateTask = useUpdateTask()
  const duplicateTasks = useDuplicateTasks()
  const deleteTasks = useDeleteTasks()
  const restoreTasks = useRestoreTasks()
  const reorderTasks = useReorderTasks()
  const qc = useQueryClient()
  // Thứ tự vừa kéo — hiển thị ngay trong lúc chờ lưu xong
  const [manualOrder, setManualOrder] = useState<string[] | null>(null)
  // Kéo thả khi view đang sắp xếp → chờ người dùng trả lời "Bỏ sắp xếp?"
  const [pendingReorder, setPendingReorder] = useState<{ orderedIds: string[]; movedIds: string[] } | null>(null)
  const updateView = useUpdateSavedView()
  const createView = useCreateSavedView()
  const deleteView = useDeleteSavedView()
  const patchViews = usePatchSavedViews()
  // Chuột: kéo 6px là bắt đầu kéo. Cảm ứng: giữ 0,3s mới kéo, để vuốt ngang vẫn cuộn được hàng tab
  const tabSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
  )

  useEffect(() => {
    if (views && views.length > 0 && !views.some((v) => v.id === activeViewId)) setActiveViewId(views[0].id)
  }, [views, activeViewId])

  const savedView = views?.find((v) => v.id === activeViewId)
  const draft = savedView ? drafts[savedView.id] : undefined
  const isDirty = Boolean(savedView && draft && !sameDraft(draft, savedView))

  // View "hiệu lực" = view đã lưu + phần đang chỉnh
  const activeView: SavedView | undefined = useMemo(
    () => (savedView ? { ...savedView, ...(draft ?? {}) } : undefined),
    [savedView, draft],
  )
  const layout: ViewLayout = activeView?.view_type ?? 'table'
  const isCalendar = layout !== 'table'
  const calendarField: CalendarField = activeView?.calendar_field ?? 'due_at'

  // Lịch: chỉ tải task nằm trong tuần/tháng đang xem
  // View có thêm bộ lọc phạm vi (Project/Area) — dùng để tải task và thêm nhanh, không lưu vào view
  const scopedView = useMemo(
    () => (activeView && scope ? { ...activeView, filters: [...scope.filters, ...activeView.filters] } : activeView),
    [activeView, scope],
  )
  const queryView = useMemo(() => {
    if (!scopedView || !isCalendar) return scopedView
    const { start, end } = calendarRange(layout as CalendarLayout, anchor)
    return {
      ...scopedView,
      filters: [
        ...scopedView.filters,
        { field: calendarField, operator: 'gte' as const, value: startOfDay(start).toISOString() },
        { field: calendarField, operator: 'lte' as const, value: endOfDay(end).toISOString() },
      ],
    }
  }, [scopedView, isCalendar, layout, anchor, calendarField])

  const {
    data: fetchedTasks,
    isLoading: loadingTasks,
    isPlaceholderData,
    error: tasksError,
  } = useTasksView(queryView)
  const orderedTasks = useMemo(() => {
    if (!fetchedTasks || !manualOrder) return fetchedTasks
    const rank = new Map(manualOrder.map((id, i) => [id, i]))
    return [...fetchedTasks].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9))
  }, [fetchedTasks, manualOrder])

  // Tìm task trong view đang mở (theo tên + ghi chú, không phân biệt dấu)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const q = normalizeSearch(query.trim())
  const tasks = useMemo(
    () => (q && orderedTasks ? orderedTasks.filter((t) => normalizeSearch(`${t.task_name} ${t.notes ?? ''}`).includes(q)) : orderedTasks),
    [orderedTasks, q],
  )

  // Phím "/" → nhảy vào ô tìm (ô tìm đầu tiên trên trang)
  useEffect(() => {
    function onSlash(e: KeyboardEvent) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]') || document.querySelector('[role="dialog"]')) return
      if (document.querySelector('[data-task-search]') !== searchRef.current) return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onSlash)
    return () => window.removeEventListener('keydown', onSlash)
  }, [])

  // ---------------- Kéo thả sắp thứ tự ----------------
  function handleReorder(orderedIds: string[], movedIds: string[]) {
    if (q) {
      setToast({ id: Date.now(), text: 'Đang tìm kiếm — xoá ô tìm để kéo sắp xếp task.' })
      return
    }
    if (activeView && activeView.sorts.length > 0) setPendingReorder({ orderedIds, movedIds })
    else void applyReorder(orderedIds, movedIds, false)
  }

  async function applyReorder(orderedIds: string[], movedIds: string[], removeSort: boolean) {
    if (!savedView) return
    const changes = computePositionChanges(tasks ?? [], orderedIds, movedIds)
    setManualOrder(orderedIds)
    setPendingReorder(null)
    try {
      await reorderTasks.mutateAsync(changes)
      if (removeSort) {
        // Bỏ sắp xếp của view (giữ nguyên bộ lọc đã lưu); nếu đang có nháp thì bỏ sort trong nháp luôn
        await updateView.mutateAsync({ id: savedView.id, filters: savedView.filters, sorts: [] })
        if (draft) setDraft(savedView.id, { ...draft, sorts: [] })
      }
      await qc.invalidateQueries({ queryKey: ['tasks'] })
    } catch (err) {
      setToast({ id: Date.now(), tone: 'danger', text: `Không lưu được thứ tự: ${(err as Error).message}` })
    } finally {
      setManualOrder(null)
    }
  }

  // ---------------- Chọn nhiều ----------------
  // Đổi view → bỏ chọn; task biến khỏi danh sách → bỏ khỏi lựa chọn
  useEffect(() => {
    setSelectedIds(new Set())
    lastClicked.current = null
    setAnchor(new Date())
  }, [activeViewId])
  const visibleSelected = useMemo(
    () => (tasks ?? []).filter((t) => selectedIds.has(t.id)),
    [tasks, selectedIds],
  )

  function selectTask(id: string, shift: boolean) {
    const list = tasks ?? []
    // Lấy mốc ra TRƯỚC: hàm cập nhật state chạy sau, lúc đó lastClicked đã bị ghi đè
    const anchor = lastClicked.current
    setSelectedIds((prev) => {
      const next = new Set(prev)
      const from = anchor ? list.findIndex((t) => t.id === anchor) : -1
      const to = list.findIndex((t) => t.id === id)
      if (shift && from !== -1 && to !== -1) {
        // Shift+click: chọn cả dải giữa 2 lần bấm
        const [a, b] = from < to ? [from, to] : [to, from]
        for (let i = a; i <= b; i++) next.add(list[i].id)
      } else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    lastClicked.current = id
  }

  function selectAll() {
    const list = tasks ?? []
    setSelectedIds(visibleSelected.length === list.length ? new Set() : new Set(list.map((t) => t.id)))
  }

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])
  const dismissToast = useCallback(() => setToast(null), [])

  async function duplicateSelected() {
    const picked = visibleSelected
    if (picked.length === 0) return
    try {
      const copies = await duplicateTasks.mutateAsync(picked)
      setSelectedIds(new Set(copies.map((c) => c.id))) // chọn sẵn bản sao để sửa/xoá tiếp
      setToast({ id: Date.now(), text: `Đã nhân bản ${copies.length} task` })
    } catch (err) {
      setToast({ id: Date.now(), tone: 'danger', text: `Không nhân bản được: ${(err as Error).message}` })
    }
  }

  async function deleteSelected() {
    const picked = visibleSelected
    if (picked.length === 0) return
    clearSelection()
    try {
      await deleteTasks.mutateAsync(picked.map((t) => t.id))
      setToast({
        id: Date.now(),
        text: `Đã xoá ${picked.length} task`,
        undo: () =>
          restoreTasks.mutate(picked, {
            onError: (err) =>
              setToast({ id: Date.now(), tone: 'danger', text: `Không hoàn tác được: ${err.message}` }),
          }),
      })
    } catch (err) {
      setToast({ id: Date.now(), tone: 'danger', text: `Không xoá được: ${(err as Error).message}` })
    }
  }

  // Phím tắt: Esc bỏ chọn · Ctrl/Cmd+D nhân bản · Delete xoá (khi không gõ trong ô nhập)
  const actionsRef = useRef({ duplicateSelected, deleteSelected, clearSelection })
  actionsRef.current = { duplicateSelected, deleteSelected, clearSelection }
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (drawer || visibleSelected.length === 0) return
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"]')) return
      if (document.querySelector('[role="alertdialog"]')) return
      if (e.key === 'Escape') actionsRef.current.clearSelection()
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        void actionsRef.current.duplicateSelected()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        void actionsRef.current.deleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer, visibleSelected.length])

  function setDraft(viewId: string, next: ViewDraft | undefined) {
    setDrafts((prev) => {
      const copy = { ...prev }
      if (next) copy[viewId] = next
      else delete copy[viewId]
      return copy
    })
  }

  /** Cập nhật 1 phần nháp (bộ lọc/sắp xếp hoặc bố cục), giữ nguyên phần còn lại */
  function patchDraft(part: Partial<ViewDraft>) {
    if (!savedView) return
    setDraft(savedView.id, { ...(draft ?? baseOf(savedView)), ...part })
  }

  // Lịch: kéo thẻ sang ngày khác / thêm task vào 1 ngày
  function moveTaskToDate(task: Task, iso: string) {
    updateTask.mutate({ id: task.id, patch: { [calendarField]: iso }, refetchDelayMs: 300 })
  }

  function createOnDay(day: Date, name: string) {
    const iso = calendarField === 'start_at' ? startOfDay(day).toISOString() : endOfDay(day).toISOString()
    createTask.mutate(
      // Lịch theo Hạn/Kết thúc: ngày bắt đầu = lúc thêm (ngày đã qua thì lấy đầu ngày đó, để không bắt đầu sau hạn);
      // lịch theo Bắt đầu: ngày đã chọn
      {
        task_name: name,
        start_at: (startOfDay(day) < startOfDay(new Date()) ? startOfDay(day) : new Date()).toISOString(),
        ...scope?.defaults,
        [calendarField]: iso,
      },
      {
        onError: (err) =>
          setToast({ id: Date.now(), tone: 'danger', text: `Không thêm được task: ${err.message}` }),
      },
    )
  }

  function toggleComplete(task: Task) {
    const complete = !task.complete
    updateTask.mutate({
      id: task.id,
      patch: { complete, state: complete ? 'done' : 'not_started' },
      // Giữ task trên màn hình ~1 giây để thấy dấu tick trước khi nó rời view
      refetchDelayMs: 1000,
    })
  }

  /** Kéo task sang nhóm khác → gán giá trị nhóm (vd area_id) cho từng task */
  function regroup(list: Task[], patch: TaskDraft) {
    for (const t of list) updateTask.mutate({ id: t.id, patch, refetchDelayMs: 300 })
  }

  function updateInline(task: Task, patch: TaskDraft) {
    updateTask.mutate({ id: task.id, patch, refetchDelayMs: 600 })
  }

  async function saveDraft() {
    if (!savedView || !draft) return
    await updateView.mutateAsync({ id: savedView.id, ...draft })
    setDraft(savedView.id, undefined)
  }

  async function saveAsNew(name: string) {
    if (!activeView || !views) return
    const created = await createView.mutateAsync({
      name,
      filters: activeView.filters,
      sorts: activeView.sorts,
      view_type: layout,
      calendar_field: calendarField,
      group_by: activeView.group_by ?? null,
      section,
      sort_order: Math.max(0, ...allViews.map((v) => v.sort_order)) + 1,
    })
    if (savedView) setDraft(savedView.id, undefined)
    setActiveViewId(created.id)
  }

  async function removeView() {
    if (!savedView) return
    await deleteView.mutateAsync(savedView.id)
    setConfirmDeleteView(false)
    setDraft(savedView.id, undefined)
    setActiveViewId(null)
  }

  // ---------------- Bố cục hiển thị (lưu ngay, chỉ ghi vào saved_views) ----------------
  const columns = resolveColumns(savedView?.visible_columns)

  function changeColumns(next: ColumnKey[]) {
    if (!savedView) return
    patchViews.mutate([{ id: savedView.id, patch: { visible_columns: toVisibleColumns(next) } }], {
      onError: (err) => setToast({ id: Date.now(), tone: 'danger', text: `Không lưu được cột: ${err.message}` }),
    })
  }

  /** Menu tiêu đề cột → sắp xếp theo cột đó (thành mức ưu tiên đầu tiên, là nháp như chip Sắp xếp) */
  function sortBy(field: TaskSort['field'], direction: TaskSort['direction']) {
    if (!activeView) return
    patchDraft({ sorts: [{ field, direction }, ...activeView.sorts.filter((x) => x.field !== field)] })
  }

  /** Kéo tab view → đổi thứ tự; dùng lại các giá trị sort_order sẵn có của mục này */
  function reorderTabs(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const ids = views.map((v) => v.id)
    const next = arrayMove(views, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)))
    const slots = views.map((v) => v.sort_order).sort((a, b) => a - b)
    // Trùng số (dữ liệu cũ) → dãn ra để thứ tự luôn rõ ràng
    const unique = new Set(slots).size === slots.length
    const orders = unique ? slots : slots.map((_, i) => (slots[0] ?? 0) + i)
    const changes = next
      .map((v, i) => ({ id: v.id, patch: { sort_order: orders[i] }, before: v.sort_order }))
      .filter((c) => c.patch.sort_order !== c.before)
      .map(({ id, patch }) => ({ id, patch }))
    if (changes.length === 0) return
    patchViews.mutate(changes, {
      onError: (err) => setToast({ id: Date.now(), tone: 'danger', text: `Không lưu được thứ tự view: ${err.message}` }),
    })
  }

  const handlers = {
    onOpen: onOpenTask,
    onToggle: toggleComplete,
  }

  const viewMutationError = updateView.error ?? deleteView.error

  return (
    <section className={className ?? 'mb-12'} aria-label={title}>
      <header className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-2">
        <SectionIcon size={18} className="shrink-0 text-accent" />
        <h2 className="text-lg font-semibold tracking-tight text-fg">{title}</h2>
        {activeView && (
          <p className="min-w-0 flex-1 truncate text-sm text-subtle">
            · {activeView.name}
            {tasks && (tasks.length > 0 || q) && (
              <> · {q ? `${tasks.length}/${orderedTasks?.length ?? 0} task khớp` : `${tasks.length} task`}</>
            )}
          </p>
        )}
        {views.length > 0 && (
          <label
            className={cx(
              'ml-auto flex h-8 w-full items-center gap-2 rounded-lg border bg-surface px-2.5 text-sm transition-colors focus-within:border-accent sm:w-60',
              q ? 'border-accent' : 'border-line',
            )}
          >
            <Search size={14} className="shrink-0 text-subtle" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  setQuery('')
                  searchRef.current?.blur()
                }
              }}
              placeholder="Tìm task trong view…  ( / )"
              aria-label={`Tìm task trong ${title}`}
              data-task-search
              className="w-full bg-transparent text-fg outline-none placeholder:text-subtle"
            />
            {query && (
              <button type="button" aria-label="Xoá tìm kiếm" onClick={() => setQuery('')} className="shrink-0 text-subtle hover:text-fg">
                <X size={13} />
              </button>
            )}
          </label>
        )}
      </header>

      {views.length === 0 && <Notice>{emptyHint}</Notice>}

      {views && views.length > 0 && activeView && savedView && (
        <>
          {/* Saved View tabs — README mục 8.6 */}
          <div className="mb-3 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--border)]">
            <DndContext
              sensors={tabSensors}
              collisionDetection={closestCenter}
              accessibility={{ container: document.body }}
              onDragEnd={reorderTabs}
            >
              <SortableContext items={views.map((v) => v.id)} strategy={horizontalListSortingStrategy}>
                <div className="flex w-max gap-1">
                  {views.map((view) => (
                    <SortableTab
                      key={view.id}
                      view={view}
                      active={view.id === activeViewId}
                      unsaved={Boolean(drafts[view.id] && !sameDraft(drafts[view.id], view))}
                      onSelect={() => {
                        setActiveViewId(view.id)
                        setConfirmDeleteView(false)
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <ViewNote
            key={savedView.id}
            view={savedView}
            filters={activeView.filters}
            sorts={activeView.sorts}
            groupBy={isCalendar ? null : (activeView.group_by ?? null)}
            isDirty={isDirty}
          />

          <ViewToolbar
            filters={activeView.filters}
            sorts={activeView.sorts}
            onChange={(next) => patchDraft(next)}
            layout={{ view_type: layout, calendar_field: calendarField }}
            onLayoutChange={(next) => patchDraft(next)}
            groupBy={activeView.group_by ?? null}
            onGroupByChange={isCalendar ? undefined : (group_by) => patchDraft({ group_by })}
            columns={isCalendar ? undefined : columns}
            onColumnsChange={changeColumns}
            actions={
              isDirty ? (
                <>
                  <Button
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => setDraft(savedView.id, undefined)}
                    title="Bỏ thay đổi, quay về view đã lưu"
                  >
                    <RotateCcw size={13} /> Đặt lại
                  </Button>
                  <SaveAsNewView onSave={saveAsNew} pending={createView.isPending} />
                  <Button className="h-7 px-2.5 text-xs" onClick={saveDraft} disabled={updateView.isPending}>
                    {updateView.isPending ? 'Đang lưu…' : `Lưu vào ${savedView.name}`}
                  </Button>
                </>
              ) : !savedView.is_system ? (
                confirmDeleteView ? (
                  <>
                    <span className="text-xs text-danger">Xoá view {savedView.name}? (task không bị xoá)</span>
                    <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmDeleteView(false)}>
                      Huỷ
                    </Button>
                    <Button
                      variant="destructive"
                      className="h-7 px-2.5 text-xs"
                      onClick={removeView}
                      disabled={deleteView.isPending}
                    >
                      Xoá view
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => setConfirmDeleteView(true)}>
                    <Trash2 size={13} /> Xoá view
                  </Button>
                )
              ) : undefined
            }
          />

          {viewMutationError && (
            <div className="mb-3">
              <Notice tone="danger">Không lưu được view: {viewMutationError.message}</Notice>
            </div>
          )}

          <Card className={cx('overflow-hidden transition-opacity', isPlaceholderData && 'opacity-60')}>
            {updateTask.isError && (
              <div className="p-3">
                <Notice tone="danger">Không cập nhật được task: {updateTask.error.message}</Notice>
              </div>
            )}

            {loadingTasks && (
              <Centered>
                <LoaderCircle size={20} className="animate-spin text-subtle" />
              </Centered>
            )}

            {tasksError && (
              <div className="p-4">
                <Notice tone="danger">Lỗi tải task: {(tasksError as Error).message}</Notice>
              </div>
            )}

            {!loadingTasks && !tasksError && tasks && q && tasks.length === 0 && (
              <div className="border-b border-line px-4 py-3 text-sm text-subtle">
                Không có task nào khớp “{query.trim()}” trong view này.{' '}
                <button type="button" onClick={() => setQuery('')} className="text-accent hover:underline">
                  Xoá tìm kiếm
                </button>
              </div>
            )}
            {!loadingTasks && !tasksError && tasks && (
              isCalendar ? (
                <CalendarView
                  tasks={tasks}
                  layout={layout as CalendarLayout}
                  field={calendarField}
                  anchor={anchor}
                  onAnchorChange={setAnchor}
                  onOpen={onOpenTask}
                  onToggle={toggleComplete}
                  onMove={moveTaskToDate}
                  onCreate={createOnDay}
                />
              ) : (
              <>
                {tasks.length === 0 && (
                  <div className="sm:hidden">
                    <Centered>
                      <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-subtle">
                        <Inbox size={18} />
                      </span>
                      <p className="text-sm font-medium text-fg">Trống</p>
                      <p className="text-sm text-muted">Không có task nào trong view này.</p>
                    </Centered>
                  </div>
                )}
                <div className="hidden sm:block">
                  <TaskTable
                    key={savedView.id}
                    tasks={tasks}
                    view={scopedView ?? activeView}
                    createDefaults={scope?.defaults}
                    hideEmptyGroups={!!scope}
                    {...handlers}
                    onUpdate={updateInline}
                    selection={{ selectedIds, onSelect: selectTask, onSelectAll: selectAll }}
                    onReorder={handleReorder}
                    onRegroup={regroup}
                    columns={columns}
                    onColumnsChange={changeColumns}
                    onSortBy={sortBy}
                  />
                </div>
                <div className="sm:hidden">
                  <TaskList key={savedView.id} tasks={tasks} view={scopedView ?? activeView} createDefaults={scope?.defaults} {...handlers} />
                </div>
              </>
              )
            )}
          </Card>
        </>
      )}

      <BulkActionBar
        count={visibleSelected.length}
        busy={duplicateTasks.isPending || deleteTasks.isPending}
        onDuplicate={duplicateSelected}
        onDelete={deleteSelected}
        onClear={clearSelection}
      />
      <Toast toast={toast} onDismiss={dismissToast} raised={visibleSelected.length > 0} />

      {pendingReorder && activeView && (
        <ConfirmDialog
          title="Bỏ sắp xếp?"
          confirmLabel="Bỏ sắp xếp"
          cancelLabel="Không"
          busy={reorderTasks.isPending || updateView.isPending}
          onCancel={() => setPendingReorder(null)}
          onConfirm={() => applyReorder(pendingReorder.orderedIds, pendingReorder.movedIds, true)}
        >
          View <span className="font-medium text-fg">{activeView.name}</span> đang sắp xếp theo{' '}
          <span className="font-medium text-fg">
            {activeView.sorts.map((s) => sortDef(s.field)?.label ?? s.field).join(', ')}
          </span>
          . Muốn task nằm đúng chỗ bạn vừa thả thì cần bỏ sắp xếp này.
        </ConfirmDialog>
      )}

    </section>
  )
}

/** Tab view kéo được (giữ và kéo ngang để đổi thứ tự, bấm để mở) */
function SortableTab({
  view,
  active,
  unsaved,
  onSelect,
}: {
  view: SavedView
  active: boolean
  unsaved: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: view.id })
  return (
    <button
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform ? { ...transform, y: 0 } : null), transition }}
      {...attributes}
      {...listeners}
      aria-current={active ? 'page' : undefined}
      onClick={onSelect}
      title="Bấm để mở · kéo để đổi thứ tự"
      className={cx(
        'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors',
        active ? 'border-accent font-medium text-fg' : 'border-transparent text-muted hover:text-fg',
        isDragging && 'relative z-10 cursor-grabbing rounded-t-md bg-surface-2',
      )}
    >
      {view.name}
      {unsaved && <span className="size-1.5 rounded-full bg-accent" title="Có thay đổi chưa lưu" />}
    </button>
  )
}
