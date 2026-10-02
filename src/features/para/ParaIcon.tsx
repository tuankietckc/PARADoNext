import { useState } from 'react'
import { FolderKanban, ImageIcon, Layers, Shuffle, Smile, Trash2 } from 'lucide-react'
import { AnchoredPopover, usePopoverAnchor } from '../../components/Popover'
import { cx } from '../../components/ui'
import type { ParaKind } from './usePara'

/** Icon của Project / Area: emoji (vd "🚀") hoặc link ảnh (https://…). Trống → icon mặc định. */
export const isImageIcon = (icon?: string | null) => !!icon && /^https?:\/\//i.test(icon.trim())

export function ParaIcon({
  icon,
  kind,
  size = 16,
  className,
}: {
  icon?: string | null
  kind: ParaKind
  size?: number
  className?: string
}) {
  if (icon && isImageIcon(icon)) {
    return (
      <img
        src={icon}
        alt=""
        style={{ width: size, height: size }}
        className={cx('shrink-0 rounded-[3px] object-cover', className)}
        onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
      />
    )
  }
  if (icon) {
    return (
      <span aria-hidden style={{ fontSize: size * 0.95, lineHeight: 1, width: size, height: size }} className={cx('grid shrink-0 place-items-center', className)}>
        {icon}
      </span>
    )
  }
  const Default = kind === 'projects' ? FolderKanban : Layers
  return <Default size={size} strokeWidth={size > 30 ? 1.6 : 2} className={cx('shrink-0', kind === 'projects' ? 'text-info' : 'text-accent', className)} />
}

// Emoji hay dùng cho Project / Area (chia nhóm để dễ tìm)
const emojiGroups: Array<[string, string[]]> = [
  ['Công việc', ['📁', '📂', '🗂️', '🚀', '🎯', '💡', '🔥', '⭐', '✅', '📌', '📝', '📋', '💼', '📈', '📊', '🗓️', '⏰', '🛠️', '⚙️', '🧪', '🔍', '🧩', '🏆', '📦']],
  ['Học & sáng tạo', ['📚', '🎓', '🧠', '✍️', '📖', '🎨', '🎵', '🎸', '🎬', '📷', '🎤', '🗣️', '💻', '🖥️', '📱', '🌐', '🤖', '🧑‍💻']],
  ['Cuộc sống', ['❤️', '🏠', '💰', '🏦', '🛒', '🍎', '☕', '🍽️', '🏃', '🏋️', '🧘', '⚽', '✈️', '🧳', '🗺️', '🏖️', '🐶', '🐱', '🌱', '🌸', '🍀', '🌈', '☀️', '🌙', '⛰️', '🎁', '🎉', '💎', '🔑', '🤝']],
]
const allEmoji = emojiGroups.flatMap(([, list]) => list)

/** Bộ chọn icon: Emoji · Link ảnh · Ngẫu nhiên · Xoá (giống Notion) */
export function IconPicker({ value, onChange }: { value: string | null; onChange: (icon: string | null) => void }) {
  const [tab, setTab] = useState<'emoji' | 'link'>(isImageIcon(value) ? 'link' : 'emoji')
  const [url, setUrl] = useState(isImageIcon(value) ? (value ?? '') : '')
  const [custom, setCustom] = useState('')
  const validUrl = isImageIcon(url)

  return (
    <div className="p-1">
      <div className="mb-2 flex items-center gap-1 border-b border-line pb-1.5">
        {(
          [
            ['emoji', 'Emoji', Smile],
            ['link', 'Link ảnh', ImageIcon],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cx(
              'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs',
              tab === key ? 'bg-surface-2 font-medium text-fg' : 'text-muted hover:text-fg',
            )}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          title="Ngẫu nhiên"
          aria-label="Icon ngẫu nhiên"
          onClick={() => onChange(allEmoji[Math.floor(Math.random() * allEmoji.length)])}
          className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
        >
          <Shuffle size={13} />
        </button>
        {value && (
          <button
            type="button"
            title="Xoá icon"
            aria-label="Xoá icon"
            onClick={() => onChange(null)}
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-danger"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {tab === 'emoji' ? (
        <div className="max-h-72 overflow-y-auto pr-1">
          {emojiGroups.map(([group, list]) => (
            <div key={group} className="mb-2">
              <p className="px-1 pb-1 text-[11px] font-medium text-subtle">{group}</p>
              <div className="grid grid-cols-8 gap-0.5">
                {list.map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-label={`Chọn ${e}`}
                    onClick={() => onChange(e)}
                    className={cx('grid h-8 place-items-center rounded-md text-lg hover:bg-surface-2', value === e && 'bg-accent-soft')}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <form
            className="flex items-center gap-1.5 border-t border-line px-1 pt-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (custom.trim()) onChange(custom.trim())
            }}
          >
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Hoặc dán / gõ 1 emoji khác…"
              aria-label="Emoji khác"
              maxLength={16}
              className="h-8 flex-1 rounded-md bg-surface-2 px-2 text-sm text-fg outline-none placeholder:text-subtle"
            />
            <button type="submit" className="h-8 rounded-md px-2 text-xs font-medium text-accent hover:bg-accent-soft">
              Dùng
            </button>
          </form>
        </div>
      ) : (
        <form
          className="space-y-2 px-1"
          onSubmit={(e) => {
            e.preventDefault()
            if (validUrl) onChange(url.trim())
          }}
        >
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… (link ảnh .png, .jpg, .svg…)"
            aria-label="Link ảnh"
            className="h-9 w-full rounded-md bg-surface-2 px-2 text-sm text-fg outline-none placeholder:text-subtle"
          />
          {validUrl && (
            <div className="flex items-center gap-2 text-xs text-muted">
              <img src={url.trim()} alt="" className="size-10 rounded-md border border-line object-cover" />
              Xem trước
            </div>
          )}
          <button
            type="submit"
            disabled={!validUrl}
            className="h-8 w-full rounded-md bg-accent text-xs font-medium text-accent-fg disabled:opacity-40"
          >
            Dùng ảnh này
          </button>
          <p className="text-[11px] leading-relaxed text-subtle">Mẹo: ảnh vuông nhìn đẹp nhất. Link phải bắt đầu bằng http:// hoặc https://</p>
        </form>
      )}
    </div>
  )
}

/** Icon lớn đầu trang, bấm để đổi */
export function IconButton({
  icon,
  kind,
  onChange,
  size = 44,
}: {
  icon: string | null
  kind: ParaKind
  onChange: (icon: string | null) => void
  size?: number
}) {
  const pop = usePopoverAnchor()
  return (
    <>
      <button
        type="button"
        onClick={pop.toggle}
        aria-label="Đổi icon"
        title="Đổi icon (emoji hoặc link ảnh)"
        className="-ml-1 grid place-items-center rounded-lg p-1 transition-colors hover:bg-surface-2"
      >
        <ParaIcon icon={icon} kind={kind} size={size} />
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={320}>
          <IconPicker
            value={icon}
            onChange={(v) => {
              onChange(v)
              pop.close()
            }}
          />
        </AnchoredPopover>
      )}
    </>
  )
}
