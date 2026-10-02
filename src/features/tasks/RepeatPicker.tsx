import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { Check, Repeat } from 'lucide-react'
import { AnchoredPopover, usePopoverAnchor } from '../../components/Popover'
import { cx } from '../../components/ui'
import type { RepeatRule } from '../../lib/taskViewTypes'
import { cellButton } from './cells'
import { nextOccurrence, repeatLabel, repeatOptions } from './recurrence'

const menuItem = 'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg transition-colors hover:bg-surface-2'

/** Menu "Lặp lại mỗi…" (giống "Duplicate every…" của Notion) */
function RepeatMenu({ value, onChange }: { value: RepeatRule | null; onChange: (v: RepeatRule | null) => void }) {
  return (
    <>
      <p className="flex items-center gap-1.5 px-2 pb-1 pt-1.5 text-[11px] font-medium text-subtle">
        <Repeat size={12} /> Lặp lại mỗi…
      </p>
      {repeatOptions.map((o) => (
        <button key={o.value} type="button" className={menuItem} onClick={() => onChange(o.value)}>
          {o.label}
          {value === o.value && <Check size={14} className="text-muted" />}
        </button>
      ))}
      {value && (
        <>
          <div className="my-1 border-t border-line" />
          <button type="button" className={cx(menuItem, 'text-muted')} onClick={() => onChange(null)}>
            Không lặp nữa
          </button>
        </>
      )}
    </>
  )
}

export const nextText = (rule: RepeatRule, anchorIso: string | null) =>
  format(nextOccurrence(rule, anchorIso), 'EEEEEE dd/MM', { locale: vi })

/** Ô "Lặp lại" trong bảng task */
export function RepeatCell({ value, onChange }: { value: RepeatRule | null; onChange: (v: RepeatRule | null) => void }) {
  const pop = usePopoverAnchor()
  return (
    <>
      <button type="button" aria-label="Lặp lại" onClick={pop.toggle} className={cellButton}>
        {value && (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-info-soft px-1.5 text-xs font-medium leading-5 text-info">
            <Repeat size={11} /> {repeatLabel(value)}
          </span>
        )}
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={210}>
          <RepeatMenu
            value={value}
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

/** Trường "Lặp lại" trong trang chi tiết task */
export function RepeatField({
  value,
  anchorIso,
  onChange,
}: {
  value: RepeatRule | null
  /** Mốc tính chu kỳ (để hiện "Lần tới") */
  anchorIso: string | null
  onChange: (v: RepeatRule | null) => void
}) {
  const pop = usePopoverAnchor()
  return (
    <>
      <button
        type="button"
        aria-label="Lặp lại"
        onClick={pop.toggle}
        className="flex h-10 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm transition-colors hover:border-line-strong"
      >
        <Repeat size={15} className={value ? 'text-info' : 'text-subtle'} />
        {value ? (
          <>
            <span className="font-medium text-fg">{repeatOptions.find((o) => o.value === value)?.label}</span>
            <span className="ml-auto text-xs text-muted">Lần tới: {nextText(value, anchorIso)}</span>
          </>
        ) : (
          <span className="text-subtle">Không lặp</span>
        )}
      </button>
      {pop.anchor && (
        <AnchoredPopover anchor={pop.anchor} onClose={pop.close} width={230}>
          <RepeatMenu
            value={value}
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
