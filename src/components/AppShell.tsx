import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  Archive,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Repeat,
  BookOpen,
  FolderKanban,
  Layers,
  ListChecks,
  NotebookPen,
  NotebookText,
  LogIn,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import { useSession } from '../lib/useSession'
import { getSupabaseClient } from '../lib/supabaseClient'
import { cx } from './ui'
import { QuickNoteDialog, useQuickNoteStore } from '../features/notes/QuickNote'
import { RunningBar } from '../features/tasks/RunningBar'
import { useRecurringTasks } from '../features/tasks/recurrence'
import { OfflineIndicator } from './OfflineIndicator'

/** Nút "Ghi chú nhanh" (phím N) ở đầu sidebar */
function QuickNoteButton({ compact }: { compact: boolean }) {
  const open = useQuickNoteStore((s) => s.setOpen)
  return (
    <button
      type="button"
      onClick={() => open(true)}
      title="Ghi chú nhanh (N)"
      aria-label="Ghi chú nhanh"
      className={cx(
        'mb-2 flex h-9 items-center rounded-lg border border-line text-sm text-muted transition-colors hover:border-line-strong hover:bg-surface-2 hover:text-fg',
        compact ? 'w-9 justify-center self-center' : 'gap-2.5 px-2.5',
      )}
    >
      <NotebookPen size={16} className="shrink-0 text-accent" />
      {!compact && (
        <>
          <span className="flex-1 text-left">Ghi chú nhanh</span>
          <kbd className="rounded border border-line px-1.5 text-[10px] text-subtle">N</kbd>
        </>
      )}
    </button>
  )
}

type NavItem = { label: string; icon: LucideIcon; to?: string }

// Theo cấu trúc README mục 7. Mục chưa có `to` = chưa làm, hiển thị "Sắp có".
const mainNav: NavItem[] = [
  { label: 'Tasks', icon: ListChecks, to: '/tasks' },
  { label: 'Notes', icon: NotebookText, to: '/notes' },
  { label: 'Habits', icon: Repeat, to: '/habits' },
  { label: 'Review', icon: ClipboardCheck, to: '/review' },
  { label: 'Stats', icon: BarChart3, to: '/stats' },
  { label: 'Channel', icon: Send, to: '/channel' },
]

const paraNav: NavItem[] = [
  { label: 'Projects', icon: FolderKanban, to: '/projects' },
  { label: 'Areas', icon: Layers, to: '/areas' },
  { label: 'Resources', icon: BookOpen, to: '/resources' },
  { label: 'Archives', icon: Archive, to: '/archives' },
]

const COLLAPSE_KEY = 'paradonext-sidebar-collapsed'

/** Sidebar thu gọn: nhớ theo trình duyệt (chỉ là tuỳ chọn giao diện). Phím tắt Ctrl/Cmd + \ */
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* trình duyệt chặn lưu trữ → chỉ nhớ trong phiên */
    }
  }, [collapsed])
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault()
        setCollapsed((c) => !c)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return [collapsed, () => setCollapsed((c) => !c)] as const
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" title="PARADoNext">
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg">
        <ArrowRight size={16} strokeWidth={2.5} />
      </span>
      {!compact && (
        <span className="whitespace-nowrap text-[15px] font-semibold tracking-tight text-fg">
          PARA<span className="text-accent">Do</span>Next
        </span>
      )}
    </Link>
  )
}

function NavRow({ item, compact = false }: { item: NavItem; compact?: boolean }) {
  const Icon = item.icon
  const base = cx(
    'flex h-9 items-center rounded-lg text-sm transition-colors',
    compact ? 'w-9 justify-center self-center' : 'gap-2.5 px-2.5',
  )

  if (!item.to) {
    return (
      <div className={cx(base, 'cursor-default text-subtle')} title={compact ? `${item.label} · Sắp có` : undefined}>
        <Icon size={17} className="shrink-0" />
        {!compact && (
          <>
            <span className="flex-1">{item.label}</span>
            <span className="text-[11px]">Sắp có</span>
          </>
        )}
      </div>
    )
  }

  return (
    <NavLink
      to={item.to}
      title={compact ? item.label : undefined}
      aria-label={compact ? item.label : undefined}
      className={({ isActive }) =>
        cx(
          base,
          isActive
            ? 'bg-surface-2 font-medium text-fg'
            : 'text-muted hover:bg-surface-2 hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={17} className={cx('shrink-0', isActive && 'text-accent')} />
          {!compact && item.label}
        </>
      )}
    </NavLink>
  )
}

function AccountBox({ compact = false }: { compact?: boolean }) {
  const { session } = useSession()
  const navigate = useNavigate()

  async function signOut() {
    await getSupabaseClient()?.auth.signOut()
    navigate('/login')
  }

  if (!session) {
    return <NavRow compact={compact} item={{ label: 'Đăng nhập', icon: LogIn, to: '/login' }} />
  }

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-1 py-1">
        <span
          title={session.user.email}
          className="grid size-7 place-items-center rounded-full bg-accent-soft text-xs font-semibold uppercase text-accent"
        >
          {session.user.email?.[0] ?? '?'}
        </span>
        <button
          onClick={signOut}
          title="Đăng xuất"
          aria-label="Đăng xuất"
          className="grid size-8 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <LogOut size={15} />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-lg px-2.5 py-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold uppercase text-accent">
        {session.user.email?.[0] ?? '?'}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted" title={session.user.email}>
        {session.user.email}
      </span>
      <button
        onClick={signOut}
        title="Đăng xuất"
        className="grid size-7 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
      >
        <LogOut size={15} />
      </button>
    </div>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, toggle] = useSidebarCollapsed()
  const { session } = useSession()
  const openQuickNote = useQuickNoteStore((s) => s.setOpen)
  // Task lặp lại: tự tạo bản sao đến hạn khi mở app / quay lại tab
  useRecurringTasks()
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose
  const toggleLabel = collapsed ? 'Mở rộng thanh bên (Ctrl + \\)' : 'Thu gọn thanh bên (Ctrl + \\)'
  return (
    <div className="flex min-h-svh">
      {/* Sidebar — desktop. Thu gọn còn dải icon để nhường chỗ cho bảng */}
      <aside
        aria-label="Thanh bên"
        className={cx(
          'sticky top-0 hidden h-svh shrink-0 flex-col border-r border-line bg-surface py-4 transition-[width] duration-200 md:flex',
          collapsed ? 'w-16 px-2' : 'w-60 px-3',
        )}
      >
        <div className={cx('flex items-center pb-6', collapsed ? 'flex-col gap-3' : 'justify-between pl-2.5')}>
          <Logo compact={collapsed} />
          <button
            type="button"
            onClick={toggle}
            title={toggleLabel}
            aria-label={collapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            aria-expanded={!collapsed}
            className="grid size-8 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <ToggleIcon size={17} />
          </button>
        </div>

        {session && <QuickNoteButton compact={collapsed} />}
        <nav className="flex flex-col gap-0.5">
          {mainNav.map((item) => (
            <NavRow key={item.label} item={item} compact={collapsed} />
          ))}
        </nav>

        {collapsed ? (
          <div className="mx-auto my-4 h-px w-6 bg-line" aria-hidden />
        ) : (
          <p className="mt-6 mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wider text-subtle">PARA</p>
        )}
        <nav className="flex flex-col gap-0.5">
          {paraNav.map((item) => (
            <NavRow key={item.label} item={item} compact={collapsed} />
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-3">
          <NavRow compact={collapsed} item={{ label: 'Settings', icon: Settings, to: '/settings' }} />
          <AccountBox compact={collapsed} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — mobile */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur md:hidden">
          <Logo />
          <nav className="flex items-center gap-1">
            {session && (
              <button
                type="button"
                onClick={() => openQuickNote(true)}
                aria-label="Ghi chú nhanh"
                title="Ghi chú nhanh"
                className="grid size-9 place-items-center rounded-lg text-accent transition-colors hover:bg-surface-2"
              >
                <NotebookPen size={18} />
              </button>
            )}
            <MobileLink to="/tasks" icon={ListChecks} label="Tasks" />
            <MobileLink to="/notes" icon={NotebookText} label="Notes" />
            <MobileLink to="/settings" icon={Settings} label="Settings" />
          </nav>
        </header>

        {/* chừa chỗ cho thanh "Đang làm" ở đáy */}
        <main className="flex-1 pb-20">{children}</main>
        {session && (
          <>
            <RunningBar />
            <QuickNoteDialog />
          </>
        )}
        <OfflineIndicator />
      </div>
    </div>
  )
}

function MobileLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) =>
        cx(
          'grid size-9 place-items-center rounded-lg transition-colors',
          isActive ? 'bg-surface-2 text-accent' : 'text-muted hover:bg-surface-2',
        )
      }
    >
      <Icon size={18} />
    </NavLink>
  )
}
