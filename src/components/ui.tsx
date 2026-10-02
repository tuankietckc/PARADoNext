import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { Check, CircleAlert, CircleCheck, Info, Minus } from 'lucide-react'

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

const focusRing = 'focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--ring)]'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'destructive'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-fg hover:border-line-strong hover:bg-surface-2',
  ghost: 'text-muted hover:bg-surface-2 hover:text-fg',
  danger: 'text-danger hover:bg-danger-soft',
  destructive: 'bg-danger text-white hover:opacity-90',
}

export const buttonClass = (variant: ButtonVariant = 'primary', extra?: string) =>
  cx(
    'inline-flex h-9 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors',
    'disabled:pointer-events-none disabled:opacity-50',
    focusRing,
    buttonVariants[variant],
    extra,
  )

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg transition-colors',
        'placeholder:text-subtle hover:border-line-strong',
        'focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)] focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}

export function Field({
  label,
  hint,
  group = false,
  children,
}: {
  label: string
  hint?: ReactNode
  /** true khi bên trong là nhóm nút (Segmented) — dùng div, không dùng <label>. */
  group?: boolean
  children: ReactNode
}) {
  const Wrapper = group ? 'div' : 'label'
  return (
    <Wrapper className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-fg">{label}</span>
      {children}
      {hint && <span className="text-xs leading-relaxed text-subtle">{hint}</span>}
    </Wrapper>
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        'min-h-24 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-fg transition-colors',
        'placeholder:text-subtle hover:border-line-strong',
        'focus:border-accent focus:shadow-[0_0_0_3px_var(--ring)] focus:outline-none',
        className,
      )}
      {...props}
    />
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div
      className="grid gap-1 rounded-lg bg-surface-2 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cx(
            'h-8 rounded-md text-sm transition-colors',
            focusRing,
            value === o.value ? 'bg-surface font-medium text-fg shadow-sm' : 'text-muted hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Nút tick tròn để đánh dấu hoàn thành. */
export function CompleteToggle({
  checked,
  onToggle,
  label,
}: {
  checked: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={cx(
        'grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-all',
        focusRing,
        checked
          ? 'border-success bg-success text-surface'
          : 'border-line-strong text-transparent hover:border-accent hover:text-accent/60',
      )}
    >
      <Check size={12} strokeWidth={3.5} />
    </button>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04)]', className)}>
      {children}
    </div>
  )
}

type NoticeTone = 'info' | 'success' | 'danger'

const noticeStyles: Record<NoticeTone, string> = {
  info: 'bg-surface-2 text-muted',
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
}

const noticeIcons = { info: Info, success: CircleCheck, danger: CircleAlert }

export function Notice({ tone = 'info', children }: { tone?: NoticeTone; children: ReactNode }) {
  const Icon = noticeIcons[tone]
  return (
    <div className={cx('flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm', noticeStyles[tone])}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function PageHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
      {description && <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>}
    </header>
  )
}

/** Nhãn màu kiểu Notion select. */
export function Tag({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1 truncate whitespace-nowrap rounded-md px-1.5 text-xs font-medium leading-5',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** Ô chọn vuông (chọn dòng) — khác CompleteToggle tròn (hoàn thành task). */
export function SelectBox({
  checked,
  indeterminate = false,
  onChange,
  label,
  className,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (e: React.MouseEvent) => void
  label: string
  className?: string
}) {
  const on = checked || indeterminate
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange(e)
      }}
      className={cx(
        'grid size-4 shrink-0 place-items-center rounded-[4px] border transition-colors',
        focusRing,
        on ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong bg-surface hover:border-accent',
        className,
      )}
    >
      {indeterminate ? <Minus size={11} strokeWidth={3.5} /> : checked ? <Check size={11} strokeWidth={3.5} /> : null}
    </button>
  )
}
