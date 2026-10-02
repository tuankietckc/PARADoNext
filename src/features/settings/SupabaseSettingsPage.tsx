import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleCheck, Plug } from 'lucide-react'
import { useSupabaseConfigStore } from '../../lib/supabaseConfigStore'
import { testSupabaseConnection } from '../../lib/supabaseClient'
import { useSession } from '../../lib/useSession'
import { Button, Card, Field, Input, Notice, PageHeader, buttonClass } from '../../components/ui'

type ConnectionStatus =
  | { state: 'idle' }
  | { state: 'testing' }
  | { state: 'success'; message: string }
  | { state: 'error'; message: string }

function hostOf(url: string) {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

export function SupabaseSettingsPage() {
  const config = useSupabaseConfigStore((s) => s.config)
  const setConfig = useSupabaseConfigStore((s) => s.setConfig)
  const clearConfig = useSupabaseConfigStore((s) => s.clearConfig)
  const { session } = useSession()

  const [url, setUrl] = useState(config?.url ?? '')
  const [anonKey, setAnonKey] = useState(config?.anonKey ?? '')
  const [status, setStatus] = useState<ConnectionStatus>({ state: 'idle' })

  async function handleTestAndSave(e: React.FormEvent) {
    e.preventDefault()
    const trimmedUrl = url.trim()
    const trimmedKey = anonKey.trim()

    if (!trimmedUrl || !trimmedKey) {
      setStatus({ state: 'error', message: 'Nhập đủ cả Project URL và Publishable key.' })
      return
    }

    setStatus({ state: 'testing' })
    const result = await testSupabaseConnection(trimmedUrl, trimmedKey)

    if (result.ok) {
      setConfig({ url: trimmedUrl, anonKey: trimmedKey })
      setStatus({ state: 'success', message: result.message })
    } else {
      setStatus({ state: 'error', message: result.message })
    }
  }

  function handleDisconnect() {
    clearConfig()
    setUrl('')
    setAnonKey('')
    setStatus({ state: 'idle' })
  }

  const isConnected = Boolean(config?.url && config?.anonKey)

  return (
    <div className="mx-auto max-w-xl px-6 py-10">
      <PageHeader
        title="Kết nối Supabase"
        description="Nơi lưu toàn bộ dữ liệu của bạn. Lấy Project URL và Publishable key trong Supabase Dashboard → Project Settings → API Keys."
      />

      <Card className="p-6">
        {isConnected ? (
          <div className="mb-6 flex items-center gap-2.5 rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success">
            <CircleCheck size={16} className="shrink-0" />
            <span className="truncate">
              Đã kết nối tới <span className="font-medium">{hostOf(config!.url)}</span>
            </span>
          </div>
        ) : (
          <div className="mb-6 flex items-center gap-2.5 rounded-lg bg-surface-2 px-3 py-2.5 text-sm text-muted">
            <Plug size={16} className="shrink-0" />
            Chưa kết nối
          </div>
        )}

        <form onSubmit={handleTestAndSave} className="flex flex-col gap-5">
          <Field label="Project URL">
            <Input
              type="url"
              required
              placeholder="https://xxxxxxxx.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>

          <Field
            label="Publishable key"
            hint={
              <>
                Dạng <code className="font-mono">sb_publishable_…</code> (hoặc anon key cũ{' '}
                <code className="font-mono">eyJ…</code>). Không dán Secret key vào đây.
              </>
            }
          >
            <Input
              type="text"
              required
              spellCheck={false}
              autoComplete="off"
              placeholder="sb_publishable_…"
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              className="font-mono text-[13px]"
            />
          </Field>

          {status.state === 'error' && <Notice tone="danger">{status.message}</Notice>}
          {status.state === 'success' && <Notice tone="success">{status.message}</Notice>}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button type="submit" disabled={status.state === 'testing'}>
              {status.state === 'testing' ? 'Đang kiểm tra…' : 'Kiểm tra & lưu'}
            </Button>
            {isConnected && (
              <Button type="button" variant="ghost" onClick={handleDisconnect}>
                Ngắt kết nối
              </Button>
            )}
            {isConnected && !session && (
              <Link to="/login" className={buttonClass('secondary', 'ml-auto')}>
                Tiếp: Đăng nhập <ArrowRight size={15} />
              </Link>
            )}
          </div>
        </form>
      </Card>

      <p className="mt-4 px-1 text-xs leading-relaxed text-subtle">
        Publishable key được thiết kế để dùng công khai trong app. Dữ liệu được bảo vệ bằng Row Level
        Security — mỗi tài khoản chỉ đọc/ghi được dữ liệu của chính mình.
      </p>
    </div>
  )
}
