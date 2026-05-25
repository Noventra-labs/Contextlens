import { useState, useEffect, useCallback, useRef } from 'react'

type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

interface SyncStatus {
  /** Current sync state. */
  state: SyncState
  /** Last successful sync timestamp (ISO string). */
  lastSyncAt: string | null
  /** Number of pending items to sync. */
  pending: number
  /** Error message from last failed sync (null if none). */
  error: string | null
  /** Human-readable label for UI display. */
  label: string
  /** Whether a sync is actively in progress. */
  isSyncing: boolean
  /** Whether the user appears to be offline. */
  isOffline: boolean
  /** Force a re-sync. */
  retry: () => void
}

const STATE_LABELS: Record<SyncState, string> = {
  idle: 'Up to date',
  syncing: 'Syncing…',
  synced: 'All synced',
  error: 'Sync failed',
  offline: 'Offline',
}

/**
 * Custom hook that polls the backend health endpoint to track sync/connectivity status.
 * Provides state, labels, and a retry callback for dashboard components.
 *
 * Usage:
 *   const { state, label, isOffline, retry } = useSyncStatus()
 */
export function useSyncStatus(
  healthUrl = '/api/health',
  pollIntervalMs = 30_000,
): SyncStatus {
  const [state, setState] = useState<SyncState>('idle')
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null)
  const [pending, setPending] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const checkHealth = useCallback(async () => {
    // Browser offline detection
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setState('offline')
      setError(null)
      return
    }

    setState('syncing')
    try {
      const res = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })

      if (res.ok) {
        setState('synced')
        setLastSyncAt(new Date().toISOString())
        setError(null)
        setPending(0)
      } else {
        setState('error')
        setError(`Server returned ${res.status}`)
      }
    } catch (err: any) {
      if (
        err?.message?.includes('network') ||
        err?.message?.includes('Failed to fetch') ||
        err?.name === 'AbortError'
      ) {
        setState('offline')
      } else {
        setState('error')
      }
      setError(err?.message || 'Unknown error')
    }
  }, [healthUrl])

  // Initial check + polling
  useEffect(() => {
    checkHealth()
    timerRef.current = setInterval(checkHealth, pollIntervalMs)

    // Listen for online/offline events
    const goOnline = () => checkHealth()
    const goOffline = () => {
      setState('offline')
      setError(null)
    }
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [checkHealth, pollIntervalMs])

  return {
    state,
    lastSyncAt,
    pending,
    error,
    label: STATE_LABELS[state],
    isSyncing: state === 'syncing',
    isOffline: state === 'offline',
    retry: checkHealth,
  }
}
