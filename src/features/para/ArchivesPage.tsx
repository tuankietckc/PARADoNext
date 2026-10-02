import { Link } from 'react-router-dom'
import { Archive, ArchiveRestore, BookOpen, FolderKanban, Layers, NotebookText } from 'lucide-react'
import { Card, cx } from '../../components/ui'
import type { ParaKind } from './usePara'
import { useParaRecords, useUpdatePara } from './useParaAdmin'
import { useResources, useUpdateResource } from '../resources/useResources'

/** Archives (chữ A trong PARA): Area / Project đã lưu trữ — khôi phục hoặc mở lại xem. */
export function ArchivesPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-fg">
          <Archive size={22} className="text-accent" /> Archives
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Những gì đã xong hoặc tạm cất. Không hiện trong danh sách chọn nhanh, nhưng task và ghi chú bên trong vẫn còn nguyên.
        </p>
      </header>
      <div className="space-y-8">
        <ArchivedList kind="projects" />
        <ArchivedList kind="areas" />
        <ArchivedResources />
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-fg">
            <NotebookText size={18} className="text-accent" /> Ghi chú
          </h2>
          <Link to="/notes?tab=archive" className="text-sm text-muted underline underline-offset-2 hover:text-fg">
            Xem ghi chú đã lưu trữ trong Notes → Archive
          </Link>
        </section>
      </div>
    </div>
  )
}

function ArchivedList({ kind }: { kind: ParaKind }) {
  const { data: records = [] } = useParaRecords(kind)
  const update = useUpdatePara(kind)
  const rows = records.filter((r) => r.archived)
  const Icon = kind === 'projects' ? FolderKanban : Layers
  const title = kind === 'projects' ? 'Projects' : 'Areas'
  return (
    <section aria-label={`${title} đã lưu trữ`}>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-fg">
        <Icon size={18} className="text-accent" /> {title} <span className="text-sm font-normal text-subtle">{rows.length}</span>
      </h2>
      <Card className="overflow-hidden">
        {rows.length === 0 && <p className="px-4 py-5 text-sm text-subtle">Chưa có {title} nào được lưu trữ.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2 border-b border-line px-4 py-2.5 last:border-b-0">
            <Link to={`/${kind}/${r.id}`} className={cx('flex-1 text-sm font-medium text-fg hover:text-accent')}>
              {r.name}
            </Link>
            <button
              type="button"
              onClick={() => update.mutate({ id: r.id, patch: { archived: false } })}
              aria-label={`Khôi phục ${r.name}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted hover:bg-surface-2 hover:text-fg"
            >
              <ArchiveRestore size={14} /> Khôi phục
            </button>
          </div>
        ))}
      </Card>
    </section>
  )
}

function ArchivedResources() {
  const { data = [] } = useResources()
  const update = useUpdateResource()
  const rows = data.filter((r) => r.archived)
  return (
    <section aria-label="Resources đã lưu trữ">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-fg">
        <BookOpen size={18} className="text-accent" /> Resources <span className="text-sm font-normal text-subtle">{rows.length}</span>
      </h2>
      <Card className="overflow-hidden">
        {rows.length === 0 && <p className="px-4 py-5 text-sm text-subtle">Chưa có tài nguyên nào được lưu trữ.</p>}
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-2 border-b border-line px-4 py-2.5 last:border-b-0">
            {r.url ? (
              <a href={/^https?:\/\//i.test(r.url) ? r.url : `https://${r.url}`} target="_blank" rel="noreferrer" className="flex-1 truncate text-sm font-medium text-fg hover:text-accent">
                {r.title}
              </a>
            ) : (
              <span className="flex-1 truncate text-sm font-medium text-fg">{r.title}</span>
            )}
            <button
              type="button"
              onClick={() => update.mutate({ id: r.id, patch: { archived: false } })}
              aria-label={`Khôi phục ${r.title}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted hover:bg-surface-2 hover:text-fg"
            >
              <ArchiveRestore size={14} /> Khôi phục
            </button>
          </div>
        ))}
      </Card>
    </section>
  )
}
