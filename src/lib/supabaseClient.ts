import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useSupabaseConfigStore } from './supabaseConfigStore'

let cachedClient: SupabaseClient | null = null
let cachedKey = ''

/**
 * Trả về Supabase client hiện tại, khởi tạo lại nếu config (URL/anon key)
 * trong Settings vừa thay đổi. Trả về null nếu người dùng chưa kết nối.
 *
 * Không dùng import.meta.env ở đây — PARADoNext cho phép người dùng tự nhập
 * Project URL + anon key ngay trên giao diện (xem features/settings), phù hợp
 * với app cá nhân solo không muốn quản lý file .env thủ công.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const config = useSupabaseConfigStore.getState().config
  if (!config?.url || !config?.anonKey) return null

  const key = `${config.url}::${config.anonKey}`
  if (cachedClient && cachedKey === key) return cachedClient

  cachedClient = createClient(config.url, config.anonKey)
  cachedKey = key
  return cachedClient
}

/**
 * Test kết nối thật: gọi endpoint /auth/v1/settings với key đã nhập.
 * (auth.getSession() không gọi mạng nên không dùng để kiểm tra được.)
 * Chấp nhận cả publishable key mới (sb_publishable_...) lẫn anon key cũ (eyJ...).
 */
export async function testSupabaseConnection(
  url: string,
  key: string,
): Promise<{ ok: boolean; message: string }> {
  if (key.startsWith('sb_secret_')) {
    return {
      ok: false,
      message:
        'Đây là SECRET key — không được dùng trong app (nó bỏ qua toàn bộ RLS). Hãy dùng Publishable key (sb_publishable_...).',
    }
  }
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, {
      headers: { apikey: key },
    })
    if (res.ok) return { ok: true, message: 'Kết nối thành công.' }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'Key không hợp lệ cho project này.' }
    }
    return { ok: false, message: `Supabase trả về lỗi ${res.status}.` }
  } catch {
    return { ok: false, message: 'Không kết nối được — kiểm tra lại Project URL và mạng.' }
  }
}
