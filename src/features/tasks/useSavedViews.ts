import { useQuery } from '@tanstack/react-query'
import { getSupabaseClient } from '../../lib/supabaseClient'
import type { SavedView } from '../../lib/taskViewTypes'

export function useSavedViews() {
  return useQuery({
    queryKey: ['saved_views'],
    queryFn: async (): Promise<SavedView[]> => {
      const client = getSupabaseClient()
      if (!client) throw new Error('Chưa kết nối Supabase.')

      const { data, error } = await client
        .from('saved_views')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) throw new Error(error.message)
      return (data ?? []) as SavedView[]
    },
  })
}
