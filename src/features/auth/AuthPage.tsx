import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { getSupabaseClient } from '../../lib/supabaseClient'
import { useSupabaseConfigStore } from '../../lib/supabaseConfigStore'
import { useSession } from '../../lib/useSession'
import { Button, Card, Field, Input, Notice, buttonClass, cx } from '../../components/ui'

type Mode = 'signin' | 'signup'

export function AuthPage() {
  const navigate = useNavigate()
  const isConnected = Boolean(useSupabaseConfigStore((s) => s.config))
  const { session } = useSession()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (session) return <Navigate to="/tasks" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const client = getSupabaseClient()
    if (!client) {
      setError('Chưa kết nối Supabase.')
      return
    }

    setLoading(true)
    setError(null)
    setNotice(null)

    if (mode === 'signin') {
      const { error } = await client.auth.signInWithPassword({ email, password })
      setLoading(false)
      if (error) {
        setError(error.message)
        return
      }
      navigate('/tasks')
    } else {
      const { data, error } = await client.auth.signUp({ email, password })
      setLoading(false)
      if (error) {
        setError(error.message)
        return
      }
      if (data.session) {
        navigate('/tasks')
        return
      }
      setNotice('Đã tạo tài khoản. Kiểm tra email để xác nhận, rồi quay lại đăng nhập.')
      setMode('signin')
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">
        {mode === 'signin' ? 'Chào mừng trở lại' : 'Tạo tài khoản'}
      </h1>
      <p className="mt-1.5 mb-6 text-sm text-muted">
        {mode === 'signin' ? 'Đăng nhập để xem việc cần làm tiếp theo.' : 'Chỉ mất vài giây.'}
      </p>

      {!isConnected ? (
        <Card className="p-6">
          <Notice>Cần kết nối Supabase trước khi đăng nhập.</Notice>
          <Link to="/settings" className={buttonClass('primary', 'mt-4 w-full')}>
            Đi tới Settings
          </Link>
        </Card>
      ) : (
        <Card className="p-6">
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={cx(
                  'h-8 rounded-md text-sm font-medium transition-colors',
                  mode === m ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg',
                )}
              >
                {m === 'signin' ? 'Đăng nhập' : 'Đăng ký'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Email">
              <Input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field label="Mật khẩu" hint={mode === 'signup' ? 'Tối thiểu 6 ký tự.' : undefined}>
              <Input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            {error && <Notice tone="danger">{error}</Notice>}
            {notice && <Notice tone="success">{notice}</Notice>}

            <Button type="submit" disabled={loading} className="mt-1 w-full">
              {loading ? 'Đang xử lý…' : mode === 'signin' ? 'Đăng nhập' : 'Tạo tài khoản'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  )
}
