import { useMemo, useRef, useState } from 'react'
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BookOpen, CheckSquare, Copy, LoaderCircle, Pencil, Plus, RotateCcw, Search, Square, Trash2, X } from 'lucide-react'
import { AnchoredPopover, usePopoverAnchor } from '../../components/Popover'
import { Button, Notice, SelectBox, Tag, cx } from '../../components/ui'
import { normalizeSearch } from '../tasks/taskFields'
import { useParaList } from '../para/usePara'
import { useUiPref } from '../../lib/useUiPref'
import { TopicTags } from '../notes/topics'
import {
  builtinOrder,
  builtinViews,
  defaultPref,
  defaultsFromFilters,
  formatMinutes,
  isCustomized,
  kindOf,
  matchFilter,
  stars,
  viewCfg,
  viewIcons,
  type Filter,
  type ResourcesPref,
  type ViewCfg,
  type ViewIcon,
} from './resourceFields'
import { AddFilter, ColumnsChip, FilterChip, GroupChip, LayoutChip, MenuLabel, NoFilter, SortChip, menuItem } from './ResourceToolbar'
import { AddRow, GroupHeaderButton, ResourceTable } from './ResourceTable'
import { ResourceDrawer } from './ResourceDrawer'
import { buildGroups } from './grouping'
import {
  guessKind,
  hrefOf,
  looksLikeUrl,
  shortUrl,
  useCreateResource,
  useDeleteResource,
  useResources,
  useUpdateResource,
  youtubeThumb,
  type Resource,
  type ResourceDraft,
} from './useResources'

/** Lấy tên + tác giả của link (YouTube, Vimeo…) qua noembed — không được thì bỏ qua */
async function fetchMeta(url: string): Promise<{ title?: string; author?: string }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, { signal: ctrl.signal })
    const data = (await res.json()) as { title?: string; author_name?: string; error?: string }
    return data.error ? {} : { title: data.title, author: data.author_name }
  } catch {
    return {}
  } finally {
    clearTimeout(timer)
  }
}

function sortRows(list: Resource[], cfg: ViewCfg) {
  return [...list].sort((a, b) => {
    for (const s of cfg.sorts) {
      const av = a[s.field]
      const bv = b[s.field]
      // Ô trống luôn nằm cuối
      if (av == null || av === '') {
        if (bv == null || bv === '') continue
        return 1
      }
      if (bv == null || bv === '') return -1
      const c =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : typeof av === 'boolean'
            ? Number(av) - Number(bv)
            : s.field === 'kind'
              ? kindOf(a.kind).label.localeCompare(kindOf(b.kind).label)
              : String(av).localeCompare(String(bv), 'vi')
      if (c) return s.direction === 'asc' ? c : -c
    }
    return 0
  })
}

export function ResourcesPage() {
  const { data: all, isLoading, error } = useResources()
  const { data: areas = [] } = useParaList('areas')
  const { data: projects = [] } = useParaList('projects')
  const create = useCreateResource()
  const update = useUpdateResource()
  const del = useDeleteResource()
  // Cấu hình view đồng bộ giữa các máy (ui_prefs — migration 0014)
  const [pref, savePref] = useUiPref<ResourcesPref>('resources-view', defaultPref)
  const order = pref.order.length ? pref.order : builtinOrder
  const activeId = order.includes(pref.active) ? pref.active : order[0]
  const cfg = viewCfg(pref, activeId)
  const [query, setQuery] = useState('')
  const [drawer, setDrawer] = useState<{ resource?: Resource; defaults?: ResourceDraft } | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newFilter, setNewFilter] = useState<number | null>(null)
  const lastSelected = useRef<string | null>(null)

  const setCfg = (patch: Partial<ViewCfg>) => savePref({ ...pref, order, active: activeId, views: { ...pref.views, [activeId]: { ...cfg, ...patch } } })
  const selectView = (id: string) => {
    setSelected(new Set())
    savePref({ ...pref, order, active: id })
  }

  const live = useMemo(() => (all ?? []).filter((r) => !r.archived), [all])
  const count = (id: string) => live.filter((r) => viewCfg(pref, id).filters.every((f) => matchFilter(r, f))).length

  const shown = useMemo(() => {
    const q = normalizeSearch(query.trim())
    const list = live
      .filter((r) => cfg.filters.every((f) => matchFilter(r, f)))
      .filter((r) => !q || normalizeSearch([r.title, r.creator ?? '', r.url ?? '', r.topics.join(' ')].join(' ')).includes(q))
    return sortRows(list, cfg)
  }, [live, cfg, query])

  const groups = useMemo(() => (cfg.group ? buildGroups(shown, cfg.group, { areas, projects }) : null), [shown, cfg.group, areas, projects])
  const flat = useMemo(() => (groups ? groups.flatMap((g) => (cfg.collapsed?.includes(g.key) ? [] : g.rows)) : shown), [groups, shown, cfg.collapsed])

  async function createFrom(text: string, patch: ResourceDraft) {
    setCreateError(null)
    const base: ResourceDraft = { ...defaultsFromFilters(cfg.filters), ...patch }
    try {
      if (looksLikeUrl(text)) {
        const url = hrefOf(text.trim())
        const row = await create.mutateAsync({ ...base, url, kind: base.kind ?? guessKind(url) ?? 'article', title: shortUrl(url) })
        // Tự điền tên + kênh cho video (YouTube, Vimeo…)
        const meta = await fetchMeta(url)
        if (meta.title) update.mutate({ id: row.id, patch: { title: meta.title, ...(meta.author && !row.creator ? { creator: meta.author } : {}) } })
      } else {
        await create.mutateAsync({ ...base, kind: base.kind ?? 'article', title: text })
      }
    } catch (err) {
      setCreateError((err as Error).message)
      throw err
    }
  }

  function select(id: string, shift: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (shift && lastSelected.current) {
        const a = flat.findIndex((r) => r.id === lastSelected.current)
        const b = flat.findIndex((r) => r.id === id)
        if (a >= 0 && b >= 0) {
          flat.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((r) => next.add(r.id))
          return next
        }
      }
      if (next.has(id)) next.delete(id)
      else next.add(id)
      lastSelected.current = id
      return next
    })
  }
  const selectAll = () => setSelected((prev) => (flat.length && flat.every((r) => prev.has(r.id)) ? new Set() : new Set(flat.map((r) => r.id))))
  const bulkPatch = (patch: ResourceDraft) => selected.forEach((id) => update.mutate({ id, patch }))
  const bulkDelete = () => {
    selected.forEach((id) => del.mutate(id))
    setSelected(new Set())
    setConfirmBulkDelete(false)
  }

  const toggleGroup = (key: string) => {
    const c = cfg.collapsed ?? []
    setCfg({ collapsed: c.includes(key) ? c.filter((k) => k !== key) : [...c, key] })
  }

  // --- Quản lý view ---
  const tabSensors = useSensors(useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }))
  function addView(name: string, icon: ViewIcon, from?: ViewCfg) {
    const id = `v${Date.now().toString(36)}`
    const base: ViewCfg = from ? { ...from, name } : { ...builtinViews.all, name, icon }
    savePref({ ...pref, active: id, order: [...order, id], views: { ...pref.views, [id]: base } })
  }
  function removeView(id: string) {
    const nextOrder = order.filter((v) => v !== id)
    if (!nextOrder.length) return
    const views = { ...pref.views }
    delete views[id]
    savePref({ ...pref, order: nextOrder, active: nextOrder[Math.max(0, order.indexOf(id) - 1)], views })
  }
  function resetView(id: string) {
    const views = { ...pref.views }
    delete views[id]
    savePref({ ...pref, views })
  }

  const isBuiltin = !!builtinViews[activeId]
  const hiddenBuiltins = builtinOrder.filter((id) => !order.includes(id))
  const defaults = builtinViews[activeId] ?? cfg

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <header className="mb-4">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-fg">
          <BookOpen size={22} className="text-accent" /> All Resources
        </h1>
        <p className="mt-1.5 text-sm text-muted">Video, sách, bài viết, khoá học đáng giữ lại. Dán link YouTube vào dòng "Mới" là tự điền tên và kênh.</p>
      </header>

      {/* Tab view: bấm để mở, kéo để đổi thứ tự, bấm lại tab đang mở để đổi tên / nhân bản / xoá */}
      <div className="mb-3 flex items-end gap-1 overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--border)]">
        <DndContext
          sensors={tabSensors}
          collisionDetection={closestCenter}
          accessibility={{ container: document.body }}
          onDragEnd={({ active, over }) => {
            if (over && active.id !== over.id) savePref({ ...pref, active: activeId, order: arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id))) })
          }}
        >
          <SortableContext items={order} strategy={horizontalListSortingStrategy}>
            <div className="flex w-max gap-1" role="tablist" aria-label="View Resources">
              {order.map((id) => (
                <ViewTab
                  key={id}
                  id={id}
                  cfg={viewCfg(pref, id)}
                  count={count(id)}
                  active={id === activeId}
                  canDelete={order.length > 1}
                  builtin={!!builtinViews[id]}
                  changed={isCustomized(pref, id)}
                  onSelect={() => selectView(id)}
                  onRename={(name) => savePref({ ...pref, order, active: id, views: { ...pref.views, [id]: { ...viewCfg(pref, id), name } } })}
                  onDuplicate={() => addView(`${viewCfg(pref, id).name} (bản sao)`, viewCfg(pref, id).icon, viewCfg(pref, id))}
                  onDelete={() => removeView(id)}
                  onReset={() => resetView(id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <AddViewButton hiddenBuiltins={hiddenBuiltins} onAdd={(name) => addView(name, 'hash')} onRestore={(id) => savePref({ ...pref, order: [...order, id], active: id })} />
      </div>

      {/* Thanh công cụ */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <LayoutChip value={cfg.layout} onChange={(layout) => setCfg({ layout })} />
        {cfg.layout === 'table' && <ColumnsChip value={cfg.cols} defaults={defaults.cols} onChange={(cols) => setCfg({ cols })} />}
        <SortChip value={cfg.sorts} onChange={(sorts) => setCfg({ sorts })} />
        <GroupChip value={cfg.group} onChange={(group) => setCfg({ group })} />
        <span className="mx-1 h-4 w-px bg-line" aria-hidden />
        {cfg.filters.length === 0 && <NoFilter />}
        {cfg.filters.map((f, i) => (
          <FilterChip
            key={i}
            filter={f}
            autoOpen={newFilter === i}
            onChange={(next: Filter) => setCfg({ filters: cfg.filters.map((x, j) => (j === i ? next : x)) })}
            onRemove={() => setCfg({ filters: cfg.filters.filter((_, j) => j !== i) })}
          />
        ))}
        <AddFilter
          onAdd={(f) => {
            setNewFilter(cfg.filters.length)
            setCfg({ filters: [...cfg.filters, f] })
          }}
        />
        {isBuiltin && isCustomized(pref, activeId) && (
          <button type="button" onClick={() => resetView(activeId)} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg" title="Về cấu hình mặc định của view này">
            <RotateCcw size={12} /> Đặt lại
          </button>
        )}
        <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
          <label className="flex h-8 flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 text-sm focus-within:border-accent sm:w-56 sm:flex-none">
            <Search size={14} className="shrink-0 text-subtle" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên, creator, topic…" aria-label="Tìm tài nguyên" className="w-full bg-transparent text-fg outline-none placeholder:text-subtle" />
            {query && (
              <button type="button" aria-label="Xoá tìm kiếm" onClick={() => setQuery('')} className="text-subtle hover:text-fg">
                <X size={13} />
              </button>
            )}
          </label>
          <Button type="button" className="h-8 px-3" onClick={() => setDrawer({ defaults: defaultsFromFilters(cfg.filters) })}>
            <Plus size={15} /> Mới
          </Button>
        </div>
      </div>

      {/* Thanh thao tác khi chọn nhiều */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 shadow-lg">
          <span className="mr-2 text-sm font-medium text-fg">Đã chọn {selected.size}</span>
          {confirmBulkDelete ? (
            <>
              <span className="text-sm text-danger">Xoá hẳn {selected.size} tài nguyên?</span>
              <Button type="button" variant="ghost" className="h-8" onClick={() => setConfirmBulkDelete(false)}>Không</Button>
              <Button type="button" variant="destructive" className="h-8" onClick={bulkDelete}>Xoá</Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" className="h-8 px-2.5" onClick={() => bulkPatch({ finished: true })}>
                <CheckSquare size={14} /> Đánh dấu xong
              </Button>
              <Button type="button" variant="ghost" className="h-8 px-2.5" onClick={() => bulkPatch({ finished: false })}>
                <Square size={14} /> Chưa xong
              </Button>
              <Button type="button" variant="ghost" className="h-8 px-2.5" onClick={() => { bulkPatch({ archived: true }); setSelected(new Set()) }}>
                Lưu trữ
              </Button>
              <Button type="button" variant="ghost" className="h-8 px-2.5 text-danger" onClick={() => setConfirmBulkDelete(true)}>
                <Trash2 size={14} /> Xoá
              </Button>
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg">
                <X size={13} /> Bỏ chọn
              </button>
            </>
          )}
        </div>
      )}

      {createError && <div className="mb-3"><Notice tone="danger">{createError}</Notice></div>}
      {error && <Notice tone="danger">{(error as Error).message}</Notice>}
      {isLoading && (
        <div className="grid place-items-center py-14">
          <LoaderCircle size={20} className="animate-spin text-subtle" />
        </div>
      )}

      {all && (query || cfg.filters.length > 0) && shown.length === 0 && (
        <p className="mb-2 px-1 text-sm text-subtle">Không có tài nguyên nào khớp{query ? ` với “${query}”` : ' bộ lọc của view này'}.</p>
      )}

      {all &&
        (cfg.layout === 'gallery' ? (
          <Gallery
            rows={shown}
            groups={groups}
            collapsed={cfg.collapsed ?? []}
            onToggleGroup={toggleGroup}
            onOpen={(r) => setDrawer({ resource: r })}
            onPatch={(r, patch) => update.mutate({ id: r.id, patch })}
            onCreate={createFrom}
          />
        ) : (
          <ResourceTable
            rows={shown}
            groups={groups}
            collapsed={cfg.collapsed ?? []}
            onToggleGroup={toggleGroup}
            cols={cfg.cols}
            sorts={cfg.sorts}
            onCols={(cols) => setCfg({ cols })}
            onSort={(field, direction) => setCfg({ sorts: [{ field, direction }, ...cfg.sorts.filter((s) => s.field !== field)] })}
            onPatch={(r, patch) => update.mutate({ id: r.id, patch })}
            onOpen={(r) => setDrawer({ resource: r })}
            onCreate={createFrom}
            selected={selected}
            onSelect={select}
            onSelectAll={selectAll}
          />
        ))}

      {all && shown.length > 0 && (
        <p className="mt-2 px-1 text-xs text-subtle">
          {shown.length} tài nguyên
          {shown.some((r) => r.minutes) && <> · tổng {formatMinutes(shown.reduce((s, r) => s + (r.minutes ?? 0), 0))}{shown.reduce((s, r) => s + (r.minutes ?? 0), 0) < 60 ? ' phút' : ''}</>}
        </p>
      )}

      {drawer && (
        <ResourceDrawer
          key={drawer.resource?.id ?? 'new'}
          resource={drawer.resource ? (all?.find((r) => r.id === drawer.resource!.id) ?? drawer.resource) : undefined}
          defaults={drawer.defaults}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab view
// ---------------------------------------------------------------------------
function ViewTab({
  id,
  cfg,
  count,
  active,
  canDelete,
  builtin,
  changed,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onReset,
}: {
  id: string
  cfg: ViewCfg
  count: number
  active: boolean
  canDelete: boolean
  builtin: boolean
  changed: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onDuplicate: () => void
  onDelete: () => void
  onReset: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const pop = usePopoverAnchor()
  const [name, setName] = useState(cfg.name)
  const Icon = viewIcons[cfg.icon] ?? viewIcons.hash
  return (
    <>
      <button
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform ? { ...transform, y: 0 } : null), transition }}
        {...attributes}
        {...listeners}
        role="tab"
        aria-selected={active}
        onClick={(e) => {
          if (active) {
            setName(cfg.name)
            pop.toggle(e)
          } else onSelect()
        }}
        title={active ? 'Bấm để đổi tên / nhân bản / xoá view · kéo để đổi thứ tự' : 'Bấm để mở · kéo để đổi thứ tự'}
        className={cx(
          'inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-sm transition-colors',
          active ? 'border-accent font-medium text-fg' : 'border-transparent text-muted hover:text-fg',
          isDragging && 'relative z-10 cursor-grabbing rounded-t-md bg-surface-2',
        )}
      >
        <Icon size={14} /> {cfg.name} <span className="text-xs font-normal text-subtle">{count}</span>
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={240}>
          <form
            className="p-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) onRename(name.trim())
              pop.close()
            }}
          >
            <label className="flex h-8 items-center gap-2 rounded-md border border-line bg-surface px-2 focus-within:border-accent">
              <Pencil size={13} className="text-subtle" />
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} aria-label="Tên view" className="w-full bg-transparent text-sm text-fg outline-none" />
            </label>
          </form>
          <button type="button" className={menuItem} onClick={() => { onDuplicate(); pop.close() }}>
            <span className="inline-flex items-center gap-2"><Copy size={14} className="text-muted" /> Nhân bản view</span>
          </button>
          {builtin && changed && (
            <button type="button" className={menuItem} onClick={() => { onReset(); pop.close() }}>
              <span className="inline-flex items-center gap-2"><RotateCcw size={14} className="text-muted" /> Về mặc định</span>
            </button>
          )}
          {canDelete && (
            <button type="button" className={cx(menuItem, 'text-danger')} onClick={() => { onDelete(); pop.close() }}>
              <span className="inline-flex items-center gap-2"><Trash2 size={14} /> {builtin ? 'Ẩn view' : 'Xoá view'}</span>
            </button>
          )}
        </AnchoredPopover>
      )}
    </>
  )
}

function AddViewButton({ hiddenBuiltins, onAdd, onRestore }: { hiddenBuiltins: string[]; onAdd: (name: string) => void; onRestore: (id: string) => void }) {
  const pop = usePopoverAnchor()
  const [name, setName] = useState('')
  return (
    <>
      <button type="button" onClick={pop.toggle} aria-label="Thêm view" title="Thêm view" className="mb-1.5 grid size-7 shrink-0 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-fg">
        <Plus size={15} />
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={240}>
          <MenuLabel>View mới (bắt đầu từ All Resources)</MenuLabel>
          <form
            className="p-1.5 pt-0"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim()) return
              onAdd(name.trim())
              setName('')
              pop.close()
            }}
          >
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên view… (Enter)" aria-label="Tên view mới" className="h-8 w-full rounded-md border border-line bg-surface px-2 text-sm text-fg outline-none focus:border-accent" />
          </form>
          {hiddenBuiltins.length > 0 && (
            <>
              <div className="my-1 border-t border-line" />
              <MenuLabel>Hiện lại view đã ẩn</MenuLabel>
              {hiddenBuiltins.map((id) => {
                const v = builtinViews[id]
                const I = viewIcons[v.icon]
                return (
                  <button key={id} type="button" className={menuItem} onClick={() => { onRestore(id); pop.close() }}>
                    <span className="inline-flex items-center gap-2"><I size={14} className="text-muted" /> {v.name}</span>
                  </button>
                )
              })}
            </>
          )}
        </AnchoredPopover>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Thẻ (gallery)
// ---------------------------------------------------------------------------
function Gallery({
  rows,
  groups,
  collapsed,
  onToggleGroup,
  onOpen,
  onPatch,
  onCreate,
}: {
  rows: Resource[]
  groups: ReturnType<typeof buildGroups> | null
  collapsed: string[]
  onToggleGroup: (key: string) => void
  onOpen: (r: Resource) => void
  onPatch: (r: Resource, patch: ResourceDraft) => void
  onCreate: (text: string, patch: ResourceDraft) => Promise<unknown>
}) {
  const grid = (list: Resource[], patch: ResourceDraft) => (
    <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
        {list.map((r) => (
          <ResourceCard key={r.id} r={r} onOpen={() => onOpen(r)} onPatch={(p) => onPatch(r, p)} />
        ))}
      </div>
      <AddRow patch={patch} onCreate={onCreate} className="mt-2 rounded-lg border border-dashed border-line" />
    </>
  )
  if (!groups) return grid(rows, {})
  return (
    <div className="space-y-5">
      {groups.map((g) => {
        const open = !collapsed.includes(g.key)
        return (
          <section key={g.key}>
            <div className="mb-2">
              <GroupHeaderButton g={g} open={open} onToggle={() => onToggleGroup(g.key)} />
            </div>
            {open && grid(g.rows, g.patch)}
          </section>
        )
      })}
    </div>
  )
}

function ResourceCard({ r, onOpen, onPatch }: { r: Resource; onOpen: () => void; onPatch: (p: ResourceDraft) => void }) {
  const k = kindOf(r.kind)
  const thumb = youtubeThumb(r.url)
  return (
    <div className="group/card relative flex flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-colors hover:border-line-strong">
      <button type="button" onClick={onOpen} aria-label={`Mở ${r.title}`} className="block text-left">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" className="aspect-[16/7] w-full border-b border-line object-cover" />
        ) : (
          <span className={cx('grid aspect-[16/7] w-full place-items-center border-b border-line', k.className)}>
            <k.icon size={28} strokeWidth={1.6} />
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <button type="button" onClick={onOpen} className={cx('line-clamp-2 text-left text-sm font-semibold hover:text-accent', r.finished ? 'text-muted' : 'text-fg')}>
          {r.title || 'Chưa đặt tên'}
        </button>
        {r.creator && <p className="truncate text-xs text-muted">{r.creator}</p>}
        <div className="flex flex-wrap items-center gap-1">
          <Tag className={k.className}>{k.label}</Tag>
          <TopicTags topics={r.topics} max={2} />
        </div>
        <div className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted">
          {r.minutes != null && <span className="tabular-nums">{formatMinutes(r.minutes)}{r.minutes < 60 ? ' phút' : ''}</span>}
          {r.review != null && <span className="tracking-tight text-yellow">{stars(r.review)}</span>}
          <span className="ml-auto inline-flex items-center gap-1.5">
            <SelectBox checked={r.finished} onChange={() => onPatch({ finished: !r.finished })} label={`Xong ${r.title}`} />
          </span>
        </div>
      </div>
      {r.url && (
        <a href={hrefOf(r.url)} target="_blank" rel="noreferrer" className="absolute right-2 top-2 rounded-md bg-surface/90 px-1.5 py-0.5 text-[11px] text-muted opacity-0 shadow-sm hover:text-fg group-hover/card:opacity-100">
          {shortUrl(r.url).split('/')[0]} ↗
        </a>
      )}
    </div>
  )
}
