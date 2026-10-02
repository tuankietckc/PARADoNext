import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Copy, Trash2, X } from 'lucide-react'
import { format } from 'date-fns'
import type { Energy, RepeatRule, Task } from '../../lib/taskViewTypes'
import { RepeatField } from './RepeatPicker'
import { useCreateTask, useDeleteTask, useDuplicateTasks, useUpdateTask, type TaskDraft } from './useTaskMutations'
import { Button, Field, Notice, Segmented, Tag, Textarea, cx } from '../../components/ui'
import { RelationCell } from './cells'
import { DateField } from './DatePicker'
import {
  energyOptions,
  formatDuration,
  importanceOptions,
  minutesBetween,
  stateOptions,
  urgencyOptions,
  type Level,
  type Option,
} from './taskFields'

type FormValues = {
  task_name: string
  // ISO hoặc null — chọn bằng DateField (bộ chọn ngày giờ kiểu Notion)
  due_at: string | null
  start_at: string | null
  end_at: string | null
  importance: Level
  urgency: Level
  energy_level: Energy | null
  state: Task['state']
  project_id: string | null
  area_id: string | null
  notes: string
  repeat_rule: RepeatRule | null
  remind_at: string | null
}

// Segmented hiển thị theo thứ tự thấp → cao
const asc = <T extends string>(opts: Option<T>[], order: T[]) =>
  order.map((v) => {
    const o = opts.find((x) => x.value === v)!
    return { value: o.value, label: o.label }
  })
const levels: Level[] = ['low', 'medium', 'high']

function toFormValues(task: Task | undefined, defaults: TaskDraft | undefined): FormValues {
  const src = { ...defaults, ...task }
  return {
    task_name: src.task_name ?? '',
    due_at: src.due_at ?? null,
    start_at: src.start_at ?? null,
    end_at: src.end_at ?? null,
    importance: src.importance ?? 'medium',
    urgency: src.urgency ?? 'medium',
    energy_level: src.energy_level ?? null,
    state: src.complete ? 'done' : (src.state ?? 'not_started'),
    project_id: src.project_id ?? null,
    area_id: src.area_id ?? null,
    notes: src.notes ?? '',
    repeat_rule: src.repeat_rule ?? null,
    remind_at: src.remind_at ?? null,
  }
}

/** Minutes / Hours tự tính — giống 2 cột công thức trong Notion. */
function DurationSummary({ minutes }: { minutes: number | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
      <div className="text-xs leading-relaxed text-subtle">
        Tự tính = Kết thúc − Bắt đầu.
        <br />
        Kết thúc tự điền khi đánh dấu Xong.
      </div>
      {minutes == null ? (
        <span className="shrink-0 text-sm text-subtle">—</span>
      ) : (
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-fg">{formatDuration(minutes)}</p>
          <p className="text-xs tabular-nums text-muted">
            {minutes} phút · {(minutes / 60).toFixed(2).replace('.', ',')} giờ
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Trang chi tiết task (giống "peek" của Notion).
 * Có task → sửa; không có task → tạo mới (chưa lưu gì cho tới khi bấm "Tạo task").
 */
export function TaskDetailDrawer({
  task,
  defaults,
  onClose,
  onOpenTask,
  notice,
}: {
  task?: Task
  defaults?: TaskDraft
  onClose: () => void
  /** Dòng thông báo ở đầu trang (vd: "Đây là bản sao…") */
  notice?: string
  /** Mở 1 task khác trong drawer (dùng sau khi nhân bản → mở ngay bản sao để sửa) */
  onOpenTask?: (task: Task) => void
}) {
  const isCreate = !task
  const createTask = useCreateTask()
  const duplicateTasks = useDuplicateTasks()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<FormValues>({ defaultValues: toFormValues(task, defaults) })

  // Esc để đóng, khoá cuộn trang phía sau
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValue(key, value as never, { shouldDirty: true })

  async function onSubmit(values: FormValues) {
    setError(null)
    const patch: TaskDraft = {
      task_name: values.task_name.trim(),
      due_at: values.due_at,
      start_at: values.start_at,
      // Để trống khi đánh dấu Xong → database tự điền giờ kết thúc = lúc lưu
      end_at: values.end_at,
      importance: values.importance,
      urgency: values.urgency,
      energy_level: values.energy_level,
      state: values.state,
      complete: values.state === 'done',
      project_id: values.project_id,
      area_id: values.area_id,
      notes: values.notes.trim() || null,
    }
    // Chỉ gửi "Lặp lại" khi có đổi (database chưa chạy migration 0016 vẫn lưu được task)
    if (dirtyFields.repeat_rule || (isCreate && values.repeat_rule)) patch.repeat_rule = values.repeat_rule
    if (dirtyFields.remind_at || (isCreate && values.remind_at)) patch.remind_at = values.remind_at
    try {
      if (isCreate) await createTask.mutateAsync({ ...patch, task_name: patch.task_name! })
      else await updateTask.mutateAsync({ id: task.id, patch })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function onDuplicate() {
    if (!task) return
    setError(null)
    try {
      const [copy] = await duplicateTasks.mutateAsync([task])
      if (copy && onOpenTask) onOpenTask(copy)
      else onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function onDelete() {
    if (!task) return
    setError(null)
    try {
      await deleteTask.mutateAsync(task.id)
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const saving = createTask.isPending || updateTask.isPending

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={isCreate ? 'Task mới' : 'Chi tiết task'}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-surface shadow-2xl"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
          <h2 className="text-sm font-semibold text-fg">{isCreate ? 'Task mới' : 'Chi tiết task'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="grid size-8 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {notice && <Notice tone="success">{notice}</Notice>}
          <div>
            <input
              autoFocus
              placeholder="Chưa đặt tên"
              aria-label="Tên task"
              className="w-full bg-transparent text-xl font-semibold text-fg outline-none placeholder:text-subtle"
              {...register('task_name', {
                validate: (v) => v.trim().length > 0 || 'Tên task không được để trống.',
              })}
            />
            {errors.task_name && <span className="text-xs text-danger">{errors.task_name.message}</span>}
          </div>

          <Field label="Trạng thái" group>
            <Segmented
              value={watch('state')}
              options={asc<Task['state']>(stateOptions, ['not_started', 'in_progress', 'done'])}
              onChange={(v) => setField('state', v)}
            />
          </Field>

          <Field label="Hạn" group>
            <DateField label="Hạn" edge="end" value={watch('due_at')} onChange={(v) => setField('due_at', v)} />
          </Field>

          <Field
            label="Lặp lại"
            hint={
              watch('repeat_rule')
                ? 'Mỗi chu kỳ tự tạo 1 bản sao mới, ngày được dời sang ngày lặp. Lâu không mở app thì chỉ tạo bản gần nhất.'
                : undefined
            }
            group
          >
            <RepeatField
              value={watch('repeat_rule')}
              anchorIso={
                task?.repeat_rule && task.repeat_rule === watch('repeat_rule')
                  ? (task.repeat_anchor ?? task.start_at ?? task.due_at)
                  : (watch('start_at') ?? watch('due_at'))
              }
              onChange={(v) => setField('repeat_rule', v)}
            />
          </Field>
          <Field label="Nhắc lúc" hint="Bot Telegram (trang Channel) nhắc bạn đúng giờ này." group>
            <DateField
              label="Nhắc lúc"
              edge="start"
              defaultWithTime
              placeholder="Không nhắc"
              value={watch('remind_at')}
              onChange={(v) => setField('remind_at', v)}
            />
          </Field>
          {task?.repeat_parent_id && (
            <p className="-mt-3 flex items-center gap-1.5 text-xs text-subtle">
              Bản lặp lại{task.repeat_on ? ` ngày ${format(new Date(task.repeat_on + 'T00:00:00'), 'dd/MM/yyyy')}` : ''}, tạo tự động từ task gốc.
            </p>
          )}

          <div className="space-y-3 rounded-xl border border-line p-3">
            <Field label="Bắt đầu" group>
              <DateField
                label="Bắt đầu"
                edge="start"
                defaultWithTime
                value={watch('start_at')}
                onChange={(v) => setField('start_at', v)}
              />
            </Field>
            <Field label="Kết thúc" group>
              <DateField
                label="Kết thúc"
                edge="end"
                defaultWithTime
                placeholder="Tự điền khi đánh dấu Xong"
                value={watch('end_at')}
                onChange={(v) => setField('end_at', v)}
              />
            </Field>
            <DurationSummary
              minutes={minutesBetween(
                watch('start_at'),
                watch('end_at'),
                task?.created_at,
              )}
            />
          </div>

          <Field label="Quan trọng" group>
            <Segmented
              value={watch('importance')}
              options={asc(importanceOptions, levels)}
              onChange={(v) => setField('importance', v)}
            />
          </Field>

          <Field label="Gấp" group>
            <Segmented value={watch('urgency')} options={asc(urgencyOptions, levels)} onChange={(v) => setField('urgency', v)} />
          </Field>

          <Field label="Năng lượng" hint="Kiểu việc — chọn 1. Bấm lại để bỏ chọn." group>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Năng lượng">
              {energyOptions.map((o) => {
                const active = watch('energy_level') === o.value
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setField('energy_level', active ? null : o.value)}
                    className={cx(
                      'rounded-md p-0.5 transition-opacity',
                      active ? 'ring-2 ring-accent' : 'opacity-60 hover:opacity-100',
                    )}
                  >
                    <Tag className={o.className}>{o.label}</Tag>
                  </button>
                )
              })}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Project" group>
              <RelationCell
                kind="projects"
                variant="field"
                valueId={watch('project_id')}
                onChange={(id) => setField('project_id', id)}
              />
            </Field>
            <Field label="Area" group>
              <RelationCell kind="areas" variant="field" valueId={watch('area_id')} onChange={(id) => setField('area_id', id)} />
            </Field>
          </div>

          <Field label="Ghi chú">
            <Textarea placeholder="Bước đầu tiên là gì?…" {...register('notes')} />
          </Field>

          {error && <Notice tone="danger">{error}</Notice>}
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-line px-5 py-3">
          {confirmDelete ? (
            <>
              <span className="mr-auto text-sm text-danger">Xoá task này?</span>
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Huỷ
              </Button>
              <Button type="button" variant="destructive" onClick={onDelete} disabled={deleteTask.isPending}>
                {deleteTask.isPending ? 'Đang xoá…' : 'Xoá'}
              </Button>
            </>
          ) : (
            <>
              {!isCreate && (
                <>
                  <Button type="button" variant="danger" className="px-3" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={15} /> Xoá
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-3"
                    onClick={onDuplicate}
                    disabled={duplicateTasks.isPending || isDirty}
                    title={isDirty ? 'Lưu thay đổi trước khi nhân bản' : 'Tạo bản sao và mở ra để sửa'}
                  >
                    <Copy size={15} /> {duplicateTasks.isPending ? 'Đang nhân bản…' : 'Nhân bản'}
                  </Button>
                </>
              )}
              <Button type="button" variant="ghost" className="ml-auto" onClick={onClose}>
                Huỷ
              </Button>
              <Button type="submit" disabled={saving || (!isCreate && !isDirty)}>
                {saving ? 'Đang lưu…' : isCreate ? 'Tạo task' : 'Lưu'}
              </Button>
            </>
          )}
        </footer>
      </form>
    </div>
  )
}
