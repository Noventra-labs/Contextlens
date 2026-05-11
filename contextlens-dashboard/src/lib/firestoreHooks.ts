import { useState, useEffect } from 'react'
import {
  collection,
  doc,
  query,
  orderBy,
  where,
  onSnapshot,
  getDocs,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Project, Episode, Call } from '../types'

// All data access requires a real authenticated UID.
// The hooks guard against empty/null UIDs and return empty results.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toDate = (ts: any): Date => ts?.toDate?.() ?? new Date(ts)

// ─── useProjects ─────────────────────────────────────────────────────────────

export function useProjects(uid: string) {
  const [data, setData] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) { setLoading(false); return }
    setLoading(true)
    let completed = false
    const timeoutId = setTimeout(() => {
      if (!completed) {
        setLoading(false)
      }
    }, 3000)

    const q = query(
      collection(db, `users/${uid}/projects`),
      orderBy('updatedAt', 'desc'),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        completed = true
        clearTimeout(timeoutId)
        const projects = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            name: data.name,
            repoUrl: data.repoUrl ?? '',
            localWorkspaceName: data.localWorkspaceName ?? '',
            defaultBranch: data.defaultBranch ?? 'main',
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
            settings: data.settings ?? {
              preferredModel: 'gemini-1.5-pro',
              redactionEnabled: false,
              autoSummariesEnabled: false,
            },
          } as Project
        })
        setData(projects)
        setError(null)
        setLoading(false)
      },
      (err) => {
        completed = true
        clearTimeout(timeoutId)
        setError(err.message)
        setLoading(false)
      },
    )
    return () => {
      unsub()
      completed = true
      clearTimeout(timeoutId)
    }
  }, [uid])

  return { data, loading, error }
}

// ─── useEpisodes ──────────────────────────────────────────────────────────────

export function useEpisodes(uid: string, projectId: string) {
  const [data, setData] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || !uid) { setLoading(false); return }
    setLoading(true)
    let completed = false
    const timeoutId = setTimeout(() => {
      if (!completed) {
        setLoading(false)
      }
    }, 3000)

    const q = query(
      collection(db, `users/${uid}/projects/${projectId}/episodes`),
      orderBy('startedAt', 'desc'),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        completed = true
        clearTimeout(timeoutId)
        const episodes = snap.docs.map((d) => mapEpisode(d))
        setData(episodes)
        setError(null)
        setLoading(false)
      },
      (err) => {
        completed = true
        clearTimeout(timeoutId)
        setError(err.message)
        setLoading(false)
      },
    )
    return () => {
      unsub()
      completed = true
      clearTimeout(timeoutId)
    }
  }, [uid, projectId])

  return { data, loading, error }
}

// ─── useEpisodesByBranch ──────────────────────────────────────────────────────

export function useEpisodesByBranch(uid: string, projectId: string, branchName: string) {
  const [data, setData] = useState<Episode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || !branchName || !uid) { setLoading(false); return }
    setLoading(true)
    let completed = false
    const timeoutId = setTimeout(() => {
      if (!completed) {
        setLoading(false)
      }
    }, 3000)

    const q = query(
      collection(db, `users/${uid}/projects/${projectId}/episodes`),
      where('branchName', '==', branchName),
      orderBy('startedAt', 'asc'),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        completed = true
        clearTimeout(timeoutId)
        const episodes = snap.docs.map((d) => mapEpisode(d))
        setData(episodes)
        setError(null)
        setLoading(false)
      },
      (err) => {
        completed = true
        clearTimeout(timeoutId)
        setError(err.message)
        setLoading(false)
      },
    )
    return () => {
      unsub()
      completed = true
      clearTimeout(timeoutId)
    }
  }, [uid, projectId, branchName])

  return { data, loading, error }
}

// ─── useEpisode ───────────────────────────────────────────────────────────────

export function useEpisode(uid: string, projectId: string, episodeId: string) {
  const [data, setData] = useState<Episode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || !episodeId || !uid) { setLoading(false); return }
    setLoading(true)
    let completed = false
    const timeoutId = setTimeout(() => {
      if (!completed) {
        setLoading(false)
      }
    }, 3000)

    const ref = doc(db, `users/${uid}/projects/${projectId}/episodes/${episodeId}`)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        completed = true
        clearTimeout(timeoutId)
        if (snap.exists()) {
          setData(mapEpisode(snap))
        } else {
          setData(null)
        }
        setError(null)
        setLoading(false)
      },
      (err) => {
        completed = true
        clearTimeout(timeoutId)
        setError(err.message)
        setLoading(false)
      },
    )
    return () => {
      unsub()
      completed = true
      clearTimeout(timeoutId)
    }
  }, [uid, projectId, episodeId])

  return { data, loading, error }
}

// ─── useCalls ─────────────────────────────────────────────────────────────────

export function useCalls(
  uid: string,
  projectId: string,
  episodeId: string,
  enabled: boolean,
) {
  const [data, setData] = useState<Call[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !projectId || !episodeId || !uid) { setLoading(false); return }
    setLoading(true)

    let completed = false
    const timeoutId = setTimeout(() => {
      if (!completed) {
        setLoading(false)
      }
    }, 3000)

    const q = query(
      collection(db, `users/${uid}/projects/${projectId}/episodes/${episodeId}/calls`),
      orderBy('createdAt', 'asc'),
    )
    getDocs(q)
      .then((snap) => {
        completed = true
        clearTimeout(timeoutId)
        const calls = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            episodeId,
            createdAt: toDate(data.createdAt),
            source: data.source ?? 'extension_chat',
            intentTag: data.intentTag ?? '',
            promptText: data.promptText ?? '',
            modelName: data.modelName ?? '',
            modelResponse: data.modelResponse ?? '',
            branchName: data.branchName ?? '',
            activeFilePath: data.activeFilePath ?? '',
            relatedFiles: data.relatedFiles ?? [],
            diffSnapshot: data.diffSnapshot ?? '',
            diffHash: data.diffHash ?? '',
            todoMatches: data.todoMatches ?? [],
            latencyMs: data.latencyMs ?? 0,
            tokenUsage: data.tokenUsage ?? { input: 0, output: 0 },
            status: data.status ?? 'success',
          } as Call
        })
        setData(calls)
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        completed = true
        clearTimeout(timeoutId)
        setError(err.message)
        setLoading(false)
      })
    
    return () => {
      completed = true
      clearTimeout(timeoutId)
    }
  }, [enabled, uid, projectId, episodeId])

  return { data, loading, error }
}

// ─── useMigrateDemoData (DEPRECATED) ──────────────────────────────────────────
// No longer needed — all data is now written under real authenticated UIDs.
// Kept as a no-op stub to avoid breaking any existing imports.
export function useMigrateDemoData() {
  return {
    migrate: async (_targetUid: string) => false,
    migrating: false,
    error: null as string | null,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEpisode(d: any): Episode {
  const data = d.data()
  return {
    id: d.id,
    projectId: data.projectId ?? '',
    label: data.label ?? 'Untitled Episode',
    branchName: data.branchName ?? 'main',
    status: data.status ?? 'closed',
    startedAt: toDate(data.startedAt),
    endedAt: data.endedAt ? toDate(data.endedAt) : null,
    callCount: data.callCount ?? 0,
    changedFiles: data.changedFiles ?? [],
    latestDiffHash: data.latestDiffHash ?? '',
    manualNotes: data.manualNotes ?? '',
    episodeSummary: data.episodeSummary ?? null,
    explainDiffSummary: data.explainDiffSummary ?? null,
    explainDiffRisks: data.explainDiffRisks ?? [],
    explainDiffChecks: data.explainDiffChecks ?? [],
  }
}
