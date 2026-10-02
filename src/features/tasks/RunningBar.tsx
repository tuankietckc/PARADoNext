import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronUp, PanelRightOpen } from 'lucide-react'
import { getSupabaseClient } from '../../lib/supabaseClient'
import type { Task } from '../../lib/taskViewTypes'
import { AnchoredPopover, usePopoverAnchor } from '../../components/Popover'
import { useUpdateTask } from './useTaskMutations'
import { TaskDetailDrawer } from './TaskDetailDrawer'

/** Task đang làm (trạng thái Đang làm, chưa xong). Key bắt đầu bằng 'tasks' → tự làm mới khi task thay đổi. */
function useRunningTasks() {
  return useQuery({
    queryKey: ['tasks', 'running'],
    queryFn: async (): Promise<Task[]> => {
      const client = getSupabaseClient()
      if (!client) return []
      const { data, error } = await client
        .from('tasks')
        .select('*')
        .eq('state', 'in_progress')
        .eq('complete', false)
        .order('start_at', { ascending: false, nullsFirst: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as Task[]
    },
    refetchInterval: 60_000,
  })
}

/** 1:05:09 · 05:09 */
function elapsed(fromIso: string, now: number) {
  const s = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`
}

/**
 * Thanh "Đang làm" nổi ở góc dưới: task đang làm + đồng hồ chạy từ lúc Bắt đầu.
 * Xong → đánh dấu hoàn thành (database tự ghi giờ kết thúc). Bấm tên → mở chi tiết.
 */
export function RunningBar() {
  const { data: running = [] } = useRunningTasks()
  const updateTask = useUpdateTask()
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [openTask, setOpenTask] = useState<Task | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const pop = usePopoverAnchor()

  useEffect(() => {
    if (running.length === 0) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running.length])

  const task = running.find((t) => t.id === pickedId) ?? running[0]
  if (!task) return openTask ? <TaskDetailDrawer task={openTask} onClose={() => setOpenTask(null)} /> : null
  const from = task.start_at ?? task.created_at

  return (
    <>
      <div
        role="region"
        aria-label="Đang làm"
        className="fixed inset-x-3 bottom-3 z-20 flex items-center gap-2 rounded-xl border border-line bg-surface py-1.5 pl-3 pr-1.5 shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-md"
      >
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
        </span>
        <button
          type="button"
          onClick={() => setOpenTask(task)}
          title="Mở chi tiết"
          className="group flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0">
            <span className="block text-[11px] leading-tight text-subtle">Đang làm</span>
            <span className="block truncate text-sm font-medium text-fg">{task.task_name || 'Chưa đặt tên'}</span>
          </span>
          <PanelRightOpen size={13} className="shrink-0 text-subtle opacity-0 group-hover:opacity-100" />
        </button>
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-accent" aria-label="Thời gian đã làm">
          {elapsed(from, now)}
        </span>
        {running.length > 1 && (
          <button
            type="button"
            onClick={pop.toggle}
            aria-label={`${running.length - 1} việc khác đang làm`}
            className="inline-flex h-8 shrink-0 items-center gap-0.5 rounded-md px-1.5 text-xs text-muted hover:bg-surface-2 hover:text-fg"
          >
            +{running.length - 1} <ChevronUp size={13} />
          </button>
        )}
        <button
          type="button"
          onClick={() => updateTask.mutate({ id: task.id, patch: { complete: true, state: 'done' } })}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-accent px-2.5 text-sm font-medium text-accent-fg hover:bg-accent-hover"
        >
          <Check size={15} /> Xong
        </button>
      </div>

      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={280}>
          <p className="px-2 pb-1 pt-0.5 text-[11px] font-medium text-subtle">Đang làm</p>
          {running.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setPickedId(t.id)
                pop.close()
              }}
              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg hover:bg-surface-2"
            >
              <span className="truncate">{t.task_name}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted">{elapsed(t.start_at ?? t.created_at, now)}</span>
            </button>
          ))}
        </AnchoredPopover>
      )}

      {openTask && <TaskDetailDrawer key={openTask.id} task={openTask} onClose={() => setOpenTask(null)} />}
    </>
  )
}
