'use client'
import { useState, useEffect, useCallback } from 'react'
import { ServiceEntry } from '@/types'
import { createClient } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'

const DB_NAME = 'urubi-offline'
const DB_VERSION = 1
const STORE = 'pending_entries'

// ── Open IndexedDB ────────────────────────────────────────────
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'local_id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// ── Save entry to IndexedDB ───────────────────────────────────
export async function saveOffline(entry: ServiceEntry): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    // Use district+date as key so we can update
    const req = store.put({ ...entry, synced: false, saved_at: new Date().toISOString() })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ── Get all pending entries ───────────────────────────────────
export async function getPendingEntries(): Promise<(ServiceEntry & { local_id: number; synced: boolean })[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result.filter(e => !e.synced))
    req.onerror = () => reject(req.error)
  })
}

// ── Mark entry as synced ──────────────────────────────────────
export async function markSynced(localId: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const getReq = store.get(localId)
    getReq.onsuccess = () => {
      const entry = getReq.result
      if (entry) {
        entry.synced = true
        store.put(entry)
      }
      resolve()
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

// ── Clear all synced entries ──────────────────────────────────
export async function clearSynced(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.getAll()
    req.onsuccess = () => {
      const synced = req.result.filter(e => e.synced)
      synced.forEach(e => store.delete(e.local_id))
      resolve()
    }
    req.onerror = () => reject(req.error)
  })
}

// ── Sync pending entries to Supabase ─────────────────────────
export async function syncToSupabase(userEmail: string): Promise<number> {
  const pending = await getPendingEntries()
  if (pending.length === 0) return 0

  const supabase = createClient()
  let synced = 0

  for (const entry of pending) {
    const { local_id, synced: _, saved_at, ...data } = entry as ServiceEntry & { local_id: number; synced: boolean; saved_at: string }
    const { error } = await supabase
      .from('service_entries')
      .upsert({ ...data, submitted_by: userEmail, submitted_at: new Date().toISOString() }, { onConflict: 'district,service_date' })

    if (!error) {
      await markSynced(local_id)
      synced++
    }
  }

  return synced
}

// ── useOfflineSync hook ───────────────────────────────────────
export type SyncStatus = 'online' | 'offline' | 'syncing' | 'synced'

export function useOfflineSync(userEmail: string) {
  const [status, setStatus] = useState<SyncStatus>('online')
  const [pendingCount, setPendingCount] = useState(0)

  const checkPending = useCallback(async () => {
    const pending = await getPendingEntries()
    setPendingCount(pending.length)
  }, [])

  const sync = useCallback(async () => {
    if (!navigator.onLine) return
    setStatus('syncing')
    try {
      const count = await syncToSupabase(userEmail)
      if (count > 0) {
        toast(`${count} offline report${count > 1 ? 's' : ''} synced!`, 'success')
        await clearSynced()
      }
      await checkPending()
      setStatus('synced')
      setTimeout(() => setStatus('online'), 3000)
    } catch {
      setStatus('online')
    }
  }, [userEmail, checkPending])

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Initial status
    setStatus(navigator.onLine ? 'online' : 'offline')
    checkPending()

    // Listen for online/offline
    const goOnline = () => {
      setStatus('online')
      sync()
    }
    const goOffline = () => setStatus('offline')

    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [sync, checkPending])

  return { status, pendingCount, sync, checkPending }
}
