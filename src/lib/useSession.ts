import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getSupabaseClient } from './supabaseClient'
import { useSupabaseConfigStore } from './supabaseConfigStore'

type SessionState = {
  session: Session | null
  loading: boolean
}

/**
 * Theo dõi session đăng nhập hiện tại (Supabase Auth).
 * loading = true trong lúc đang xác định trạng thái ban đầu.
 * Tự re-subscribe khi config Supabase (URL/anon key) thay đổi.
 */
export function useSession(): SessionState {
  const config = useSupabaseConfigStore((s) => s.config)
  const [state, setState] = useState<SessionState>({ session: null, loading: true })

  useEffect(() => {
    const client = getSupabaseClient()
    if (!client) {
      setState({ session: null, loading: false })
      return
    }

    let isMounted = true

    client.auth.getSession().then(({ data }) => {
      if (isMounted) setState({ session: data.session, loading: false })
    })

    const { data: subscription } = client.auth.onAuthStateChange((_event, session) => {
      if (isMounted) setState({ session, loading: false })
    })

    return () => {
      isMounted = false
      subscription.subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.url, config?.anonKey])

  return state
}
