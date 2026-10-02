import { useEffect, useState } from 'react'
import { WifiOff, Wifi } from 'lucide-react'

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true))
  const [showReconnected, setShowReconnected] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setShowReconnected(true)
      const timer = setTimeout(() => setShowReconnected(false), 3000)
      return () => clearTimeout(timer)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowReconnected(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline && !showReconnected) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium shadow-lg transition-all duration-300 ${
        isOnline
          ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
      } backdrop-blur-md`}
    >
      {isOnline ? (
        <>
          <Wifi size={14} className="text-emerald-500" />
          <span>Đã kết nối lại mạng & đang đồng bộ</span>
        </>
      ) : (
        <>
          <WifiOff size={14} className="text-amber-500" />
          <span>Chế độ ngoại tuyến (Offline)</span>
        </>
      )}
    </div>
  )
}
