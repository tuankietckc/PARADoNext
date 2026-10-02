import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { useSupabaseConfigStore } from '../../lib/supabaseConfigStore'
import { useSession } from '../../lib/useSession'
import { Card, buttonClass, cx } from '../../components/ui'

type Step = { title: string; description: string; done: boolean; to: string; cta: string }

export function HomePage() {
  const isConnected = Boolean(useSupabaseConfigStore((s) => s.config))
  const { session, loading } = useSession()

  if (!loading && session) return <Navigate to="/tasks" replace />

  const steps: Step[] = [
    {
      title: 'Kết nối Supabase',
      description: 'Nơi lưu dữ liệu của bạn.',
      done: isConnected,
      to: '/settings',
      cta: 'Kết nối',
    },
    {
      title: 'Đăng nhập',
      description: 'Tạo tài khoản hoặc đăng nhập.',
      done: Boolean(session),
      to: '/login',
      cta: 'Đăng nhập',
    },
  ]

  // Chỉ làm nổi bật MỘT bước tiếp theo — đúng tinh thần "Do Next"
  const nextIndex = steps.findIndex((s) => !s.done)
  const remaining = steps.filter((s) => !s.done).length

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <p className="mb-2 text-sm font-medium text-accent">Bắt đầu</p>
      <h1 className="text-3xl font-semibold leading-tight tracking-tight text-fg">
        PARA để sắp xếp.
        <br />
        Do Next để bắt tay vào làm.
      </h1>
      <p className="mt-3 mb-8 text-muted">Còn {remaining} bước để sẵn sàng.</p>

      <Card>
        <ol>
          {steps.map((step, i) => {
            const isNext = i === nextIndex
            return (
              <li key={step.title} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
                <span
                  className={cx(
                    'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold',
                    step.done && 'bg-success-soft text-success',
                    isNext && 'bg-accent text-accent-fg',
                    !step.done && !isNext && 'bg-surface-2 text-subtle',
                  )}
                >
                  {step.done ? <Check size={14} strokeWidth={3} /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cx('text-sm font-medium', step.done ? 'text-muted line-through' : 'text-fg')}>
                    {step.title}
                  </p>
                  <p className="text-xs text-subtle">{step.description}</p>
                </div>
                {isNext && (
                  <Link to={step.to} className={buttonClass('primary', 'h-8 px-3')}>
                    {step.cta} <ArrowRight size={14} />
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </Card>
    </div>
  )
}
