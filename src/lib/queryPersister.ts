import { get, set, del } from 'idb-keyval'
import type { PersistedClient, Persister } from '@tanstack/react-query-persist-client'

const IDB_KEY = 'PARADONEXT_REACT_QUERY_OFFLINE_CACHE'

/**
 * Persister lưu toàn bộ query cache vào IndexedDB của trình duyệt (Safari iOS, Chrome, Edge,...).
 * Khi offline ngoài trời hoặc mở lại app, dữ liệu từ IndexedDB sẽ được khôi phục ngay tức thì.
 */
export function createIDBPersister(idbKey: IDBValidKey = IDB_KEY): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        await set(idbKey, client)
      } catch (err) {
        console.warn('Không thể lưu cache vào IndexedDB:', err)
      }
    },
    restoreClient: async () => {
      try {
        return await get<PersistedClient>(idbKey)
      } catch (err) {
        console.warn('Không thể khôi phục cache từ IndexedDB:', err)
        return undefined
      }
    },
    removeClient: async () => {
      try {
        await del(idbKey)
      } catch (err) {
        console.warn('Không thể xóa cache khỏi IndexedDB:', err)
      }
    },
  }
}
