import { useEffect, useRef, useState } from 'react'
import { endOfDay, format } from 'date-fns'
import { Archive, ArchiveRestore, ExternalLink, ListPlus, Star, Trash2, X } from 'lucide-react'
import { TaskDetailDrawer } from '../tasks/TaskDetailDrawer'
import { Button, Field, Notice, SelectBox, cx } from '../../components/ui'
import { RelationCell } from '../tasks/cells'
import { TopicsCell } from '../notes/topics'
import { kindOptions } from './resourceFields'
import { guessKind, hrefOf, youtubeThumb, useCreateResource, useDeleteResource, useUpdateResource, type Resource, type ResourceDraft, type ResourceKind } from './useResources'

type Values = {
  title: string
  kind: ResourceKind
  url: string
  creator: string
  minutes: string
  review: number | null
  finished: boolean
  area_id: string | null
  project_id: string | null
  topics: string[]
  content: string
}

const toValues = (r?: Resource, d: ResourceDraft = {}): Values => ({
  title: r?.title ?? d.title ?? '',
  kind: r?.kind ?? d.kind ?? 'article',
  url: r?.url ?? d.url ?? '',
  creator: r?.creator ?? d.creator ?? '',
  minutes: r?.minutes != null ? String(r.minutes) : d.minutes != null ? String(d.minutes) : '',
  review: r?.review ?? d.review ?? null,
  finished: r?.finished ?? d.finished ?? false,
  area_id: r?.area_id ?? d.area_id ?? null,
  project_id: r?.project_id ?? d.project_id ?? null,
  topics: r?.topics ?? d.topics ?? [],
  content: r?.content ?? d.content ?? '',
})

const inputClass = 'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg outline-none transition-colors placeholder:text-subtle hover:border-line-strong focus:border-accent'

/** Trang chi tiết tài nguyên. resource = undefined → tạo mới (defaults điền sẵn). */
export function ResourceDrawer({ resource, defaults, onClose }: { resource?: Resource; defaults?: ResourceDraft; onClose: () => void }) {
  const isCreate = !resource
  const [values, setValues] = useState<Values>(() => toValues(resource, defaults))
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [asTask, setAsTask] = useState(false)
  const create = useCreateResource()
  const update = useUpdateResource()
  const del = useDeleteResource()
  const contentRef = useRef<HTMLTextAreaElement>(null)
  const kindTouched = useRef(!isCreate || !!defaults?.kind)
  const set = <K extends keyof Values>(k: K, v: Values[K]) => setValues((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 160)}px`
  }, [values.content])

  const toDraft = (): ResourceDraft => {
    const n = Number(values.minutes.replace(',', '.'))
    return {
      title: values.title.trim(),
      kind: values.kind,
      url: values.url.trim() || null,
      creator: values.creator.trim() || null,
      minutes: values.minutes.trim() === '' || isNaN(n) ? null : Math.max(0, n),
      review: values.review,
      finished: values.finished,
      area_id: values.area_id,
      project_id: values.project_id,
      topics: values.topics,
      content: values.content.trim() || null,
    }
  }

  async function save() {
    const draft = toDraft()
    if (!draft.title) {
      setError('Tên tài nguyên không được để trống.')
      return
    }
    setError(null)
    try {
      if (isCreate) await create.mutateAsync({ ...draft, title: draft.title })
      else await update.mutateAsync({ id: resource.id, patch: draft })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function toggleArchive() {
    if (!resource) return
    try {
      await update.mutateAsync({ id: resource.id, patch: { ...toDraft(), archived: !resource.archived } })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function remove() {
    if (!resource) return
    try {
      await del.mutateAsync(resource.id)
      onClose()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const saving = create.isPending || update.isPending
  const thumb = youtubeThumb(values.url)
  const verb = values.kind === 'video' || values.kind === 'course' ? 'Xem' : 'Đọc'

  if (asTask) {
    return (
      <TaskDetailDrawer
        defaults={{
          task_name: `${verb}: ${values.title.trim()}`,
          notes: [values.url.trim(), values.content.trim()].filter(Boolean).join('\n\n') || null,
          area_id: values.area_id,
          project_id: values.project_id,
          due_at: endOfDay(new Date()).toISOString(),
        }}
        notice={`Tạo từ tài nguyên “${values.title.trim()}” — tài nguyên vẫn được giữ nguyên.`}
        onClose={onClose}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={isCreate ? 'Tài nguyên mới' : 'Tài nguyên'}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            void save()
          }
        }}
        className="absolute inset-y-0 right-0 flex w-full max-w-2xl flex-col border-l border-line bg-surface shadow-2xl"
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line px-5">
          <h2 className="text-sm font-semibold text-fg">{isCreate ? 'Tài nguyên mới' : resource.archived ? 'Tài nguyên · đã lưu trữ' : 'Tài nguyên'}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="grid size-8 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {thumb && (
            <a href={hrefOf(values.url)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-line">
              <img src={thumb} alt="" className="aspect-video w-full object-cover" />
            </a>
          )}
          <input
            autoFocus={isCreate}
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            onFocus={(e) => !isCreate && e.currentTarget.select()}
            placeholder="Chưa đặt tên"
            aria-label="Tên tài nguyên"
            className="w-full bg-transparent text-2xl font-semibold text-fg outline-none placeholder:text-subtle"
          />

          <Field label="Loại" group>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Loại">
              {kindOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={values.kind === o.value}
                  onClick={() => {
                    kindTouched.current = true
                    set('kind', o.value)
                  }}
                  className={cx(
                    'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm transition-colors',
                    values.kind === o.value ? cx('border-transparent font-medium', o.className) : 'border-line text-muted hover:bg-surface-2 hover:text-fg',
                  )}
                >
                  <o.icon size={14} /> {o.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="URL">
            <span className="flex gap-2">
              <input
                value={values.url}
                onChange={(e) => {
                  set('url', e.target.value)
                  const k = guessKind(e.target.value)
                  if (k && !kindTouched.current) set('kind', k)
                }}
                placeholder="https://…"
                aria-label="URL"
                className={inputClass}
              />
              {values.url.trim() && (
                <a href={hrefOf(values.url.trim())} target="_blank" rel="noreferrer" aria-label="Mở link" title="Mở link" className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-muted hover:bg-surface-2 hover:text-fg">
                  <ExternalLink size={15} />
                </a>
              )}
            </span>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Creator">
              <input value={values.creator} onChange={(e) => set('creator', e.target.value)} placeholder="Tác giả / kênh…" aria-label="Creator" className={inputClass} />
            </Field>
            <Field label="Minutes">
              <input type="number" min={0} step="any" value={values.minutes} onChange={(e) => set('minutes', e.target.value)} placeholder="Độ dài (phút)" aria-label="Minutes" className={inputClass} />
            </Field>
            <Field label="Areas" group>
              <RelationCell kind="areas" variant="field" valueId={values.area_id} onChange={(id) => set('area_id', id)} />
            </Field>
            <Field label="Projects" group>
              <RelationCell kind="projects" variant="field" valueId={values.project_id} onChange={(id) => set('project_id', id)} />
            </Field>
          </div>
          <Field label="Topics" group>
            <TopicsCell variant="field" value={values.topics} onChange={(t) => set('topics', t)} />
          </Field>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-fg">Reviews</span>
              <div className="flex" role="radiogroup" aria-label="Reviews">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={values.review === n}
                    aria-label={`${n} sao`}
                    title={values.review === n ? 'Bấm lại để bỏ đánh giá' : `${n} sao`}
                    onClick={() => set('review', values.review === n ? null : n)}
                    className="grid size-7 place-items-center rounded-md hover:bg-surface-2"
                  >
                    <Star size={17} className={values.review != null && n <= values.review ? 'fill-yellow text-yellow' : 'text-line-strong'} />
                  </button>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-fg">
              <SelectBox checked={values.finished} onChange={() => set('finished', !values.finished)} label="Đã xem / đọc xong" />
              Đã xem / đọc xong
            </label>
          </div>

          {resource && (
            <p className="text-xs text-subtle">
              Tạo lúc {format(new Date(resource.created_at), 'dd/MM/yyyy HH:mm')}
              {resource.updated_at !== resource.created_at && <> · sửa lần cuối {format(new Date(resource.updated_at), 'dd/MM/yyyy HH:mm')}</>}
            </p>
          )}

          <textarea
            ref={contentRef}
            value={values.content}
            onChange={(e) => set('content', e.target.value)}
            placeholder="Ghi chú, tóm tắt, điều rút ra…"
            aria-label="Ghi chú tài nguyên"
            className="w-full resize-none border-t border-line bg-transparent pt-4 text-[15px] leading-relaxed text-fg outline-none placeholder:text-subtle"
          />

          {error && <Notice tone="danger">{error}</Notice>}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line px-5 py-3">
          {resource && confirmDelete ? (
            <>
              <span className="mr-auto text-sm text-danger">Xoá hẳn tài nguyên này?</span>
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Không
              </Button>
              <Button type="button" variant="destructive" onClick={remove} disabled={del.isPending}>
                Xoá
              </Button>
            </>
          ) : (
            <>
              {resource && (
                <>
                  <Button type="button" variant="ghost" className="px-2.5 text-danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={15} /> Xoá
                  </Button>
                  <Button type="button" variant="ghost" className="px-2.5" onClick={toggleArchive} disabled={saving}>
                    {resource.archived ? (
                      <>
                        <ArchiveRestore size={15} /> Khôi phục
                      </>
                    ) : (
                      <>
                        <Archive size={15} /> Lưu trữ
                      </>
                    )}
                  </Button>
                </>
              )}
              <span className="ml-auto" />
              {values.title.trim() && (
                <Button type="button" variant="secondary" className="px-2.5" onClick={() => setAsTask(true)} title={`Tạo task "${verb}: …" từ tài nguyên này`}>
                  <ListPlus size={15} /> Tạo task
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={onClose}>
                Huỷ
              </Button>
              <Button type="submit" disabled={saving} title="Ctrl + Enter">
                {saving ? 'Đang lưu…' : isCreate ? 'Tạo tài nguyên' : 'Lưu'}
              </Button>
            </>
          )}
        </footer>
      </form>
    </div>
  )
}
