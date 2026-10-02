import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import {
  AlarmClock,
  BellRing,
  Bot,
  CalendarDays,
  Check,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Eye,
  EyeOff,
  LoaderCircle,
  MessageSquare,
  Play,
  Repeat,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Unplug,
  X,
} from 'lucide-react'
import { Button, Card, Notice, cx } from '../../components/ui'
import {
  browserOffsetMin,
  browserTimezone,
  findChats,
  getMe,
  isTokenLike,
  sendTestMessage,
  useDeleteChannel,
  useRecentLog,
  useSaveChannel,
  useSendDigestNow,
  useServerStatus,
  useTelegramChannel,
  type BotInfo,
  type Digest,
  type FoundChat,
  type LogRow,
  type TelegramChannel,
} from './useTelegram'

const inputClass =
  'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-fg outline-none transition-colors placeholder:text-subtle hover:border-line-strong focus:border-accent'
const dayNames = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const remindOptions: Array<[number | null, string]> = [
  [null, 'Tắt'],
  [0, 'Đúng giờ hạn'],
  [5, '5 phút'],
  [10, '10 phút'],
  [15, '15 phút'],
  [30, '30 phút'],
  [60, '1 giờ'],
  [120, '2 giờ'],
  [1440, '1 ngày'],
]

function offsetText(min: number) {
  const sign = min >= 0 ? '+' : '−'
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  return `UTC${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-6 w-10 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line-strong')}
    >
      <span className={cx('absolute left-0 top-0.5 size-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  )
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className={cx(
          'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold',
          done ? 'bg-success text-white' : 'bg-surface-2 text-muted',
        )}
      >
        {done ? <Check size={13} strokeWidth={3} /> : n}
      </span>
      <div className="min-w-0 flex-1 pb-5">
        <p className="mb-2 text-sm font-medium text-fg">{title}</p>
        {children}
      </div>
    </li>
  )
}

export function ChannelPage() {
  const { data: channel, isLoading, error } = useTelegramChannel()
  const { data: status } = useServerStatus()
  const [editing, setEditing] = useState(false)
  const connected = !!channel?.chat_id && !editing

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-fg">
          <Send size={22} className="text-accent" /> Channel
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          Bot Telegram đẩy thông báo task cho bạn: tóm tắt theo giờ, nhắc trước hạn, tới giờ bắt đầu và "Nhắc lúc" riêng từng task. Bot chỉ gửi, không nhận lệnh.
        </p>
      </header>

      {isLoading && (
        <div className="grid place-items-center py-14">
          <LoaderCircle size={20} className="animate-spin text-subtle" />
        </div>
      )}
      {error && <Notice tone="danger">{(error as Error).message}</Notice>}

      {!isLoading && !error && (
        <div className="space-y-6">
          {status && (!status.cron || !status.net || !status.push_job) && <ServerWarning status={status} />}
          {connected && channel ? (
            <>
              <ConnectedCard channel={channel} onChange={() => setEditing(true)} />
              <ScheduleCard channel={channel} />
              <LogCard />
            </>
          ) : (
            <ConnectCard existing={channel ?? null} onCancel={channel?.chat_id ? () => setEditing(false) : undefined} onDone={() => setEditing(false)} />
          )}
        </div>
      )}
    </div>
  )
}

function ServerWarning({ status }: { status: { cron: boolean; net: boolean; push_job: boolean } }) {
  const missing = [!status.cron && 'pg_cron (Integrations → Cron)', !status.net && 'pg_net (Database → Extensions)'].filter(Boolean)
  return (
    <div className="rounded-xl border border-yellow/40 bg-yellow-soft px-4 py-3 text-sm text-fg">
      <p className="flex items-center gap-2 font-medium">
        <CircleAlert size={16} className="text-yellow" /> Supabase chưa tự gửi được thông báo
      </p>
      <p className="mt-1 text-muted">
        {missing.length > 0 ? (
          <>Hãy bật {missing.join(' và ')} trong Supabase Dashboard, rồi chạy lại migration 0017 và 0018 trong SQL Editor.</>
        ) : (
          <>Chưa có lịch gửi — hãy chạy lại migration 0018 trong SQL Editor.</>
        )}{' '}
        Trong lúc chờ, bạn vẫn kết nối bot và gửi tin thử được.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Kết nối bot: token → tìm chat → gửi thử → lưu
// ---------------------------------------------------------------------------
function ConnectCard({ existing, onCancel, onDone }: { existing: TelegramChannel | null; onCancel?: () => void; onDone: () => void }) {
  const [token, setToken] = useState(existing?.bot_token ?? '')
  const [showToken, setShowToken] = useState(false)
  const [bot, setBot] = useState<BotInfo | null>(null)
  const [chats, setChats] = useState<FoundChat[] | null>(null)
  const [chat, setChat] = useState<FoundChat | null>(existing?.chat_id ? { id: existing.chat_id, title: existing.chat_title ?? existing.chat_id, type: 'private' } : null)
  const [manualId, setManualId] = useState('')
  const [busy, setBusy] = useState<'check' | 'find' | 'test' | null>(null)
  const [msg, setMsg] = useState<{ tone: 'danger' | 'success' | 'info'; text: string } | null>(null)
  const [tested, setTested] = useState(false)
  const save = useSaveChannel()

  async function run<T>(kind: 'check' | 'find' | 'test', fn: () => Promise<T>) {
    setBusy(kind)
    setMsg(null)
    try {
      return await fn()
    } catch (err) {
      setMsg({ tone: 'danger', text: (err as Error).message })
      return undefined
    } finally {
      setBusy(null)
    }
  }

  async function check() {
    const info = await run('check', () => getMe(token))
    if (info) {
      setBot(info)
      setChats(null)
    }
  }

  async function find() {
    const list = await run('find', () => findChats(token))
    if (!list) return
    setChats(list)
    if (list.length === 1) setChat(list[0])
    if (list.length === 0) setMsg({ tone: 'info', text: `Chưa thấy tin nhắn nào — mở @${bot?.username} trên Telegram, bấm Start (hoặc gửi "hi"), rồi bấm lại "Tìm chat".` })
  }

  async function test() {
    if (!chat) return
    const ok = await run('test', () => sendTestMessage(token, chat.id))
    if (ok) {
      setTested(true)
      setMsg({ tone: 'success', text: 'Đã gửi tin thử — kiểm tra Telegram nhé.' })
    }
  }

  async function saveChannel() {
    if (!chat || !bot) return
    try {
      await save.mutateAsync({ bot_token: token.trim(), bot_username: bot.username, chat_id: chat.id, chat_title: chat.title, enabled: true })
      onDone()
    } catch (err) {
      setMsg({ tone: 'danger', text: (err as Error).message })
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
          <Bot size={18} className="text-accent" /> Kết nối bot Telegram
        </h2>
        {onCancel && (
          <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={onCancel}>
            <X size={14} /> Huỷ
          </Button>
        )}
      </div>
      <ol>
        <Step n={1} title="Dán token của bot" done={!!bot}>
          <p className="mb-2 text-xs leading-relaxed text-subtle">
            Chưa có bot? Mở{' '}
            <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              @BotFather
            </a>{' '}
            → gửi <code className="rounded bg-surface-2 px-1">/newbot</code> → đặt tên → BotFather gửi lại token dạng <code className="rounded bg-surface-2 px-1">123456:ABC…</code>.
          </p>
          <div className="flex gap-2">
            <label className="relative flex-1">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => {
                  setToken(e.target.value)
                  setBot(null)
                  setTested(false)
                }}
                placeholder="123456789:AAH…"
                aria-label="Token bot"
                autoComplete="off"
                spellCheck={false}
                className={cx(inputClass, 'pr-10 font-mono')}
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                aria-label={showToken ? 'Ẩn token' : 'Hiện token'}
                className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded text-subtle hover:text-fg"
              >
                {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </label>
            <Button type="button" variant="secondary" onClick={check} disabled={!isTokenLike(token) || busy === 'check'}>
              {busy === 'check' ? <LoaderCircle size={15} className="animate-spin" /> : null} Kiểm tra
            </Button>
          </div>
          {bot && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-success">
              <CircleCheck size={15} /> Bot <b>@{bot.username}</b> ({bot.first_name})
            </p>
          )}
        </Step>

        <Step n={2} title="Chọn nơi nhận thông báo" done={!!chat && !!bot}>
          {bot ? (
            <>
              <p className="mb-2 text-xs leading-relaxed text-subtle">
                Mở{' '}
                <a href={`https://t.me/${bot.username}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-accent hover:underline">
                  @{bot.username} <ExternalLink size={11} />
                </a>{' '}
                trên Telegram, bấm <b>Start</b> (muốn nhận trong nhóm thì thêm bot vào nhóm và gửi 1 tin), rồi bấm "Tìm chat".
              </p>
              <Button type="button" variant="secondary" className="h-9" onClick={find} disabled={busy === 'find'}>
                {busy === 'find' ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCw size={14} />} Tìm chat
              </Button>
              {chats && chats.length > 0 && (
                <div className="mt-2 space-y-1" role="radiogroup" aria-label="Chat nhận thông báo">
                  {chats.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={chat?.id === c.id}
                      onClick={() => {
                        setChat(c)
                        setTested(false)
                      }}
                      className={cx(
                        'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm',
                        chat?.id === c.id ? 'border-accent bg-accent-soft/40' : 'border-line hover:bg-surface-2',
                      )}
                    >
                      <MessageSquare size={14} className="text-muted" />
                      <span className="flex-1 font-medium text-fg">{c.title}</span>
                      <span className="text-xs text-subtle">{c.type === 'private' ? 'Chat riêng' : c.type === 'channel' ? 'Kênh' : 'Nhóm'} · {c.id}</span>
                    </button>
                  ))}
                </div>
              )}
              <details className="mt-2 text-xs text-subtle">
                <summary className="cursor-pointer hover:text-fg">Nhập Chat ID bằng tay</summary>
                <div className="mt-2 flex gap-2">
                  <input value={manualId} onChange={(e) => setManualId(e.target.value)} placeholder="vd 123456789 hoặc -100…" aria-label="Chat ID" className={cx(inputClass, 'h-9 font-mono')} />
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9"
                    disabled={!/^-?\d+$/.test(manualId.trim())}
                    onClick={() => {
                      setChat({ id: manualId.trim(), title: manualId.trim(), type: 'private' })
                      setTested(false)
                    }}
                  >
                    Dùng
                  </Button>
                </div>
              </details>
              {chat && <p className="mt-2 text-sm text-fg">Gửi tới: <b>{chat.title}</b></p>}
            </>
          ) : (
            <p className="text-xs text-subtle">Kiểm tra token trước.</p>
          )}
        </Step>

        <Step n={3} title="Gửi thử rồi lưu" done={tested}>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={test} disabled={!bot || !chat || busy === 'test'}>
              {busy === 'test' ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={14} />} Gửi tin thử
            </Button>
            <Button type="button" onClick={saveChannel} disabled={!bot || !chat || save.isPending}>
              {save.isPending ? 'Đang lưu…' : 'Lưu kết nối'}
            </Button>
          </div>
        </Step>
      </ol>
      {msg && <Notice tone={msg.tone === 'danger' ? 'danger' : msg.tone === 'success' ? 'success' : 'info'}>{msg.text}</Notice>}
    </Card>
  )
}

function ConnectedCard({ channel, onChange }: { channel: TelegramChannel; onChange: () => void }) {
  const del = useDeleteChannel()
  const [confirm, setConfirm] = useState(false)
  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <span className="grid size-10 place-items-center rounded-full bg-info-soft text-info">
        <Bot size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg">
          {channel.bot_username ? (
            <a href={`https://t.me/${channel.bot_username}`} target="_blank" rel="noreferrer" className="hover:text-accent">
              @{channel.bot_username}
            </a>
          ) : (
            'Bot Telegram'
          )}{' '}
          <span className="font-normal text-muted">→ {channel.chat_title ?? channel.chat_id}</span>
        </p>
        <p className="text-xs text-subtle">
          Múi giờ gửi: {browserTimezone()} ({offsetText(browserOffsetMin())})
        </p>
      </div>
      {confirm ? (
        <>
          <span className="text-sm text-danger">Ngắt kết nối bot?</span>
          <Button variant="ghost" className="h-8" onClick={() => setConfirm(false)}>
            Không
          </Button>
          <Button variant="destructive" className="h-8" onClick={() => del.mutate()} disabled={del.isPending}>
            Ngắt
          </Button>
        </>
      ) : (
        <>
          <Button variant="ghost" className="h-8 px-2.5" onClick={onChange}>
            Đổi bot / chat
          </Button>
          <Button variant="ghost" className="h-8 px-2.5 text-danger" onClick={() => setConfirm(true)}>
            <Unplug size={14} /> Ngắt kết nối
          </Button>
        </>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Lịch thông báo
// ---------------------------------------------------------------------------
type Schedule = Pick<
  TelegramChannel,
  'enabled' | 'digests' | 'digest_days' | 'skip_empty' | 'remind_before_due_min' | 'remind_at_start' | 'include_habits'
>
const pickSchedule = (c: TelegramChannel): Schedule => ({
  enabled: c.enabled,
  digests: c.digests ?? [],
  digest_days: c.digest_days ?? [1, 2, 3, 4, 5, 6, 7],
  skip_empty: c.skip_empty,
  remind_before_due_min: c.remind_before_due_min,
  remind_at_start: c.remind_at_start,
  // Chỉ có khi đã chạy migration 0019 — không gửi cột chưa tồn tại
  ...('include_habits' in c ? { include_habits: c.include_habits } : {}),
})

function Row({ icon: Icon, title, hint, children }: { icon: typeof BellRing; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-t border-line py-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 gap-3">
        <Icon size={17} className="mt-0.5 shrink-0 text-accent" />
        <div>
          <p className="text-sm font-medium text-fg">{title}</p>
          {hint && <p className="mt-0.5 text-xs leading-relaxed text-subtle">{hint}</p>}
        </div>
      </div>
      <div className="sm:max-w-[330px] sm:shrink-0">{children}</div>
    </div>
  )
}

function ScheduleCard({ channel }: { channel: TelegramChannel }) {
  const base = useMemo(() => pickSchedule(channel), [channel])
  const [s, setS] = useState<Schedule>(base)
  const [saved, setSaved] = useState(false)
  const save = useSaveChannel()
  useEffect(() => setS(base), [base])
  const dirty = JSON.stringify(s) !== JSON.stringify(base)
  const set = (patch: Partial<Schedule>) => {
    setSaved(false)
    setS((p) => ({ ...p, ...patch }))
  }
  const setDigest = (i: number, patch: Partial<Digest>) => set({ digests: s.digests.map((d, j) => (j === i ? { ...d, ...patch } : d)) })

  async function submit() {
    const digests = [...s.digests].filter((d) => /^\d{2}:\d{2}$/.test(d.time)).sort((a, b) => a.time.localeCompare(b.time))
    await save.mutateAsync({ ...s, digests })
    setSaved(true)
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
          <BellRing size={18} className="text-accent" /> Lịch thông báo
        </h2>
        <label className="flex items-center gap-2 text-sm text-muted">
          {s.enabled ? 'Đang bật' : 'Đang tắt'}
          <Switch checked={s.enabled} onChange={(enabled) => set({ enabled })} label="Bật thông báo" />
        </label>
      </div>

      <div className={cx(!s.enabled && 'pointer-events-none opacity-50')}>
        <Row icon={CalendarDays} title="Tóm tắt theo giờ" hint="Danh sách task gửi vào giờ đã đặt. “Việc hôm nay” gồm cả việc quá hạn.">
          <div className="space-y-2">
            {s.digests.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="time"
                  value={d.time}
                  onChange={(e) => setDigest(i, { time: e.target.value })}
                  aria-label={`Giờ gửi ${i + 1}`}
                  className={cx(inputClass, 'h-9 w-28 tabular-nums')}
                />
                <select
                  value={d.scope}
                  onChange={(e) => setDigest(i, { scope: e.target.value as Digest['scope'] })}
                  aria-label={`Nội dung ${i + 1}`}
                  className={cx(inputClass, 'h-9 w-40')}
                >
                  <option value="today">Việc hôm nay</option>
                  <option value="tomorrow">Việc ngày mai</option>
                </select>
                <button
                  type="button"
                  aria-label={`Xoá giờ ${d.time}`}
                  onClick={() => set({ digests: s.digests.filter((_, j) => j !== i) })}
                  className="grid size-8 place-items-center rounded-md text-subtle hover:bg-surface-2 hover:text-danger"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => set({ digests: [...s.digests, s.digests.length ? { time: '21:00', scope: 'tomorrow' } : { time: '07:30', scope: 'today' }] })}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted hover:bg-surface-2 hover:text-fg"
            >
              <Plus size={13} /> Thêm giờ gửi
            </button>
            <div className="flex flex-wrap gap-1 pt-1" role="group" aria-label="Ngày gửi tóm tắt">
              {dayNames.map((name, i) => {
                const day = i + 1
                const on = s.digest_days.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ digest_days: on ? s.digest_days.filter((x) => x !== day) : [...s.digest_days, day].sort() })}
                    className={cx('h-8 w-9 rounded-md border text-xs font-medium', on ? 'border-transparent bg-accent-soft text-accent' : 'border-line text-subtle hover:bg-surface-2')}
                  >
                    {name}
                  </button>
                )
              })}
            </div>
            <label className="flex items-center gap-2 pt-1 text-xs text-muted">
              <input type="checkbox" checked={s.skip_empty} onChange={(e) => set({ skip_empty: e.target.checked })} className="accent-[var(--accent)]" />
              Không gửi khi không có task nào
            </label>
          </div>
        </Row>

        <Row icon={AlarmClock} title="Nhắc trước hạn" hint="Chỉ cho task có giờ hạn cụ thể (không phải hạn “cả ngày” 23:59).">
          <select
            value={s.remind_before_due_min ?? ''}
            onChange={(e) => set({ remind_before_due_min: e.target.value === '' ? null : Number(e.target.value) })}
            aria-label="Nhắc trước hạn"
            className={cx(inputClass, 'h-9 w-44')}
          >
            {remindOptions.map(([v, l]) => (
              <option key={l} value={v ?? ''}>
                {v ? `Trước ${l}` : l}
              </option>
            ))}
          </select>
        </Row>

        <Row icon={Play} title="Tới giờ bắt đầu" hint="Nhắc đúng giờ bắt đầu của task (bỏ qua task vừa tạo bằng “Làm ngay”).">
          <Switch checked={s.remind_at_start} onChange={(remind_at_start) => set({ remind_at_start })} label="Nhắc khi tới giờ bắt đầu" />
        </Row>

        {'include_habits' in s && (
          <Row icon={Repeat} title="Kèm thói quen" hint="Bản tóm tắt “Việc hôm nay” liệt kê thói quen hôm nay (✅ đã làm / ⬜ chưa).">
            <Switch checked={s.include_habits ?? true} onChange={(include_habits) => set({ include_habits })} label="Kèm thói quen trong tóm tắt" />
          </Row>
        )}

        <Row icon={BellRing} title="Nhắc lúc (từng task)" hint={<>Mở 1 task → trường <b>Nhắc lúc</b> → chọn ngày giờ. Bot nhắc đúng giờ đó.</>}>
          <span className="text-xs text-subtle">Luôn bật</span>
        </Row>
      </div>

      <div className="mt-2 flex items-center justify-end gap-2 border-t border-line pt-4">
        {save.error && <span className="mr-auto text-sm text-danger">{(save.error as Error).message}</span>}
        {saved && !dirty && <span className="mr-auto flex items-center gap-1 text-sm text-success"><Check size={14} /> Đã lưu</span>}
        {dirty && (
          <Button variant="ghost" onClick={() => setS(base)}>
            Huỷ
          </Button>
        )}
        <Button onClick={submit} disabled={!dirty || save.isPending}>
          {save.isPending ? 'Đang lưu…' : 'Lưu lịch'}
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Nhật ký gửi
// ---------------------------------------------------------------------------
const kindLabel: Record<LogRow['kind'], string> = {
  digest: 'Tóm tắt',
  due: 'Sắp tới hạn',
  start: 'Bắt đầu',
  remind: 'Nhắc lúc',
  test: 'Gửi ngay',
}
const plain = (html: string | null) => (html ?? '').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

function LogCard() {
  const { data: rows = [], error, refetch, isFetching } = useRecentLog(true)
  const sendNow = useSendDigestNow()
  const [open, setOpen] = useState<number | null>(null)
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-fg">
          <MessageSquare size={18} className="text-accent" /> Đã gửi gần đây
        </h2>
        <div className="flex gap-2">
          <Button variant="ghost" className="h-8 px-2.5" onClick={() => void refetch()} aria-label="Tải lại">
            <RefreshCw size={14} className={cx(isFetching && 'animate-spin')} />
          </Button>
          <Button variant="secondary" className="h-8 px-3" onClick={() => sendNow.mutate('today')} disabled={sendNow.isPending}>
            <Send size={14} /> {sendNow.isPending ? 'Đang gửi…' : 'Gửi tóm tắt hôm nay ngay'}
          </Button>
        </div>
      </div>
      {sendNow.error && (
        <div className="mb-3">
          <Notice tone="danger">{(sendNow.error as Error).message}</Notice>
        </div>
      )}
      {sendNow.isSuccess && (
        <div className="mb-3">
          <Notice tone="success">Supabase đã gửi — kiểm tra Telegram. Kết quả hiện ở danh sách dưới sau vài giây.</Notice>
        </div>
      )}
      {error && <Notice tone="danger">{(error as Error).message}</Notice>}
      {rows.length === 0 && !error && <p className="py-4 text-center text-sm text-subtle">Chưa gửi thông báo nào.</p>}
      <ul className="divide-y divide-line">
        {rows.map((r, i) => {
          const ok = r.status_code != null && r.status_code < 300
          const failed = (r.status_code != null && r.status_code >= 300) || !!r.error
          const text = plain(r.message)
          return (
            <li key={i}>
              <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-start gap-3 py-2.5 text-left">
                <span className={cx('mt-1 size-2 shrink-0 rounded-full', ok ? 'bg-success' : failed ? 'bg-danger' : 'bg-line-strong')} title={ok ? 'Đã tới Telegram' : failed ? 'Lỗi' : 'Đang gửi / chưa rõ'} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-xs text-subtle">
                    <b className="font-medium text-muted">{kindLabel[r.kind]}</b>
                    {format(new Date(r.created_at), 'HH:mm dd/MM')}
                    {failed && <span className="text-danger">· lỗi {r.status_code ?? ''}</span>}
                  </span>
                  <span className={cx('mt-0.5 block text-sm text-fg', open === i ? 'whitespace-pre-wrap' : 'truncate')}>{open === i ? text : text.split('\n').filter((l) => l.trim()).slice(0, 3).join(' · ')}</span>
                  {open === i && failed && r.error && <span className="mt-1 block break-all text-xs text-danger">{r.error}</span>}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
