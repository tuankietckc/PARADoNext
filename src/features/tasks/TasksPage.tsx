import { useState } from 'react'
import { endOfDay, format } from 'date-fns'
import { CalendarDays, CircleCheckBig, ListChecks, LoaderCircle, Play, Plus } from 'lucide-react'
import { useSavedViews } from './useSavedViews'
import type { TaskDraft } from './useTaskMutations'
import { TaskDetailDrawer } from './TaskDetailDrawer'
import { TaskViewSection } from './TaskViewSection'
import type { Task } from '../../lib/taskViewTypes'
import { Button, Notice } from '../../components/ui'
import { QuickNoteBox } from '../notes/QuickNote'

type DrawerState = { mode: 'edit'; task: Task; notice?: string } | { mode: 'create'; defaults: TaskDraft; notice?: string } | null

/**
 * Trang Tasks gồm 3 mục, mỗi mục có bộ view riêng (tuỳ chỉnh đầy đủ như Notion):
 *   ✅ Tasks List    — việc hôm nay (Tasks today, Tasks to context nhóm theo Area, Tomorrow)
 *   📅 Work Schedule — mặc định dạng lịch (Week's Tasks, All this week, Monthly tasks)
 *   📋 Work Summary  — mặc định dạng bảng (Today, Tomorrow, Overdue, Completed…)
 */
export function TasksPage() {
  const { data: views, isLoading, error } = useSavedViews()
  const [drawer, setDrawer] = useState<DrawerState>(null)

  // View cũ (trước migration 0006) chưa có section → coi là Task list
  const tasksViews = (views ?? []).filter((v) => v.section === 'tasks')
  const scheduleViews = (views ?? []).filter((v) => v.section === 'schedule')
  const listViews = (views ?? []).filter((v) => (v.section ?? 'list') === 'list')
  const openTask = (task: Task) => setDrawer({ mode: 'edit', task })

  return (
    <div className="mx-auto max-w-[1760px] px-4 py-8 sm:px-6">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Tasks</h1>
          <p className="mt-1.5 text-sm text-muted">Việc hôm nay ở trên, lịch làm việc ở giữa, tổng hợp ở dưới.</p>
        </div>
        {views && views.length > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            {/* Làm ngay: như "Mới" nhưng Bắt đầu = ngày giờ hiện tại, trạng thái Đang làm → thời gian bắt đầu tính */}
            <Button
              variant="secondary"
              onClick={() => {
                const now = new Date()
                setDrawer({
                  mode: 'create',
                  defaults: {
                    start_at: now.toISOString(),
                    due_at: endOfDay(now).toISOString(),
                    state: 'in_progress',
                  },
                  notice: `Bắt đầu lúc ${format(now, 'HH:mm')} — thời gian làm tính từ lúc này. Xong việc thì đánh dấu Xong.`,
                })
              }}
              className="px-3"
              title="Tạo task bắt đầu ngay bây giờ"
            >
              <Play size={15} /> Làm ngay
            </Button>
            <Button
              onClick={() => setDrawer({ mode: 'create', defaults: { due_at: endOfDay(new Date()).toISOString() } })}
              className="px-3"
            >
              <Plus size={16} /> Mới
            </Button>
          </div>
        )}
      </header>

      {/* Ghi chú nhanh: gõ + Enter là thành 1 ghi chú (xem ở trang Notes) */}
      <QuickNoteBox className="mb-8" />

      {isLoading && (
        <div className="grid place-items-center py-14">
          <LoaderCircle size={20} className="animate-spin text-subtle" />
        </div>
      )}

      {error && (
        <Notice tone="danger">
          Không tải được Saved Views: {(error as Error).message}
          <br />
          <span className="opacity-80">
            Kiểm tra đã chạy đủ các file trong <code>supabase/migrations</code> (theo thứ tự 0001 → 0007) trong
            Supabase SQL Editor chưa.
          </span>
        </Notice>
      )}

      {views && views.length === 0 && (
        <Notice>
          Tài khoản này chưa có Saved View. View mặc định được tạo tự động khi đăng ký — nếu bạn đăng ký trước khi
          chạy đủ migration, hãy tạo tài khoản mới sau khi chạy xong.
        </Notice>
      )}

      {views && views.length > 0 && (
        <>
          <TaskViewSection
            section="tasks"
            title="Tasks List"
            icon={CircleCheckBig}
            views={tasksViews}
            allViews={views}
            drawerOpen={drawer !== null}
            onOpenTask={openTask}
            emptyHint={
              <>
                Chưa có view Tasks List — chạy file <code>supabase/migrations/0007_tasks_list_section.sql</code>{' '}
                trong Supabase SQL Editor rồi tải lại trang.
              </>
            }
          />
          <TaskViewSection
            section="schedule"
            title="Work Schedule"
            icon={CalendarDays}
            views={scheduleViews}
            allViews={views}
            drawerOpen={drawer !== null}
            onOpenTask={openTask}
            emptyHint={
              <>
                Chưa có view Work Schedule — chạy file <code>supabase/migrations/0006_work_schedule_calendar.sql</code>{' '}
                trong Supabase SQL Editor rồi tải lại trang.
              </>
            }
          />
          <TaskViewSection
            section="list"
            title="Work Summary"
            icon={ListChecks}
            views={listViews}
            allViews={views}
            drawerOpen={drawer !== null}
            onOpenTask={openTask}
            emptyHint="Chưa có view nào trong mục này."
          />
        </>
      )}

      {drawer?.mode === 'edit' && (
        <TaskDetailDrawer
          key={drawer.task.id}
          task={drawer.task}
          notice={drawer.notice}
          onClose={() => setDrawer(null)}
          onOpenTask={(task) =>
            setDrawer({ mode: 'edit', task, notice: 'Đây là bản sao vừa tạo — sửa thoải mái, bản gốc không đổi.' })
          }
        />
      )}
      {drawer?.mode === 'create' && (
        <TaskDetailDrawer defaults={drawer.defaults} notice={drawer.notice} onClose={() => setDrawer(null)} />
      )}
    </div>
  )
}
