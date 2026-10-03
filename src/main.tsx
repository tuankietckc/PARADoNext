import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createIDBPersister } from './lib/queryPersister'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 ngày lưu trữ offline
      staleTime: 1000 * 60 * 2, // 2 phút
      retry: 1,
      networkMode: 'offlineFirst',
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
})

const persister = createIDBPersister()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 1000 * 60 * 60 * 24 * 7 }}
      onSuccess={() => {
        // Cache đã khôi phục xong → đẩy các mutation offline lên server,
        // sau đó invalidate toàn bộ query để lấy dữ liệu mới nhất từ Supabase.
        // Nhờ vậy thay đổi trên iPhone sẽ hiện ngay trên máy tính khi reload.
        queryClient.resumePausedMutations().then(() => {
          queryClient.invalidateQueries()
        })
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
)

