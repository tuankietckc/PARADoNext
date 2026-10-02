import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SupabaseConfig = {
  url: string
  anonKey: string
}

type SupabaseConfigState = {
  config: SupabaseConfig | null
  setConfig: (config: SupabaseConfig) => void
  clearConfig: () => void
}

// Lưu Project URL + anon key của Supabase do người dùng nhập trong màn hình Settings.
// Đây là 2 giá trị *public* theo thiết kế của Supabase (anon key luôn lộ ra client,
// bảo mật thật sự nằm ở RLS policies — xem supabase/migrations/0001_init.sql),
// nên lưu localStorage là an toàn, không cần mã hoá thêm.
export const useSupabaseConfigStore = create<SupabaseConfigState>()(
  persist(
    (set) => ({
      config: null,
      setConfig: (config) => set({ config }),
      clearConfig: () => set({ config: null }),
    }),
    { name: 'paradonext-supabase-config' },
  ),
)
