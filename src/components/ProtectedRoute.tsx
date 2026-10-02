import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { LoaderCircle } from 'lucide-react'
import { useSession } from '../lib/useSession'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useSession()

  if (loading) {
    return (
      <div className="grid min-h-[50svh] place-items-center">
        <LoaderCircle size={20} className="animate-spin text-subtle" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}
