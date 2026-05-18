import { useState, useEffect, useRef } from 'react'
import {
  collection,
  doc,
  query,
  orderBy,
  where,
  onSnapshot,
  getDocs,
  limit,
  DocumentSnapshot,
  QuerySnapshot,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Project, Episode, Call, UserSettings } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toDate = (ts: any): Date => ts?.toDate?.() ?? new Date(ts)

/**
 * Helper to handle the common loading/error/snapshot logic for Firestore queries.
 */
function useFirestoreQuery<T>(
  queryKey: string,
  queryFn: () => any,
  mapFn: (snap: any) => T,
  dependencies: any[]
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const prevKeyRef = useRef<string>('')

  useEffect(() => {
    // Reset loading state if the query identity changes
    if (prevKeyRef.current !== queryKey) {
      setLoading(true)
      prevKeyRef.current = queryKey
    }

    if (dependencies.some(d => !d)) {
      setLoading(false)
      return
    }

    let completed = false
    const timeoutId = setTimeout(() => {
      if (!completed) setLoading(false)
    }, 3000)

    try {
      const q = queryFn()
      const unsub = onSnapshot(
        q,
        (snap: any) => {
          completed = true
          clearTimeout(timeoutId)
          setData(mapFn(snap))
          setError(null)
          setLoading(false)
        },
        (err) => {
          completed = true
          clearTimeout(timeoutId)
          setError(err.message)
          setLoading(false)
        }
      )
      return () => {
        unsub()
        completed = true
        clearTimeout(timeoutId)
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
      return
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)

  return { data, loading, error }
}

// ─── useProjects ─────────────────────────────────────────────────────────────

export function useProjects(uid: string) {
  const { data, loading, error } = useFirestoreQuery<Project[]>(
    `projects-${uid}`,
    () => query(collection(db, `users/${uid}/projects`), orderBy('updatedAt', 'desc')),
    (snap: QuerySnapshot) => snap.docs.map((d) => {
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
    }),
    [uid]
  )

  return { data: data ?? [], loading, error }
}

// ─── useUserSettings ─────────────────────────────────────────────────────────

export function useUserSettings(uid: string) {
  const { data, loading, error } = useFirestoreQuery<UserSettings | null>(
    `user-settings-${uid}`,
    () => doc(db, `users/${uid}/settings/global`),
    (snap: DocumentSnapshot) => {
      if (!snap.exists()) {
        return { aiProvider: 'none' } as UserSettings
      }
      const data = snap.data()
      return {
        id: snap.id,
        aiProvider: data.aiProvider ?? 'none',
        geminiApiKey: data.geminiApiKey ?? '',
        openaiApiKey: data.openaiApiKey ?? '',
        anthropicApiKey: data.anthropicApiKey ?? '',
      } as UserSettings
    },
    [uid]
  )

  return { data, loading, error }
}

// ─── useEpisodes ──────────────────────────────────────────────────────────────

export function useEpisodes(uid: string, projectId: string) {
  const { data, loading, error } = useFirestoreQuery<Episode[]>(
    `episodes-${uid}-${projectId}`,
    () => query(collection(db, `users/${uid}/projects/${projectId}/episodes`), orderBy('startedAt', 'desc')),
    (snap: QuerySnapshot) => snap.docs.map(mapEpisode),
    [uid, projectId]
  )

  return { data: data ?? [], loading, error }
}

// ─── useEpisodesByBranch ──────────────────────────────────────────────────────

export function useEpisodesByBranch(uid: string, projectId: string, branchName: string) {
  const { data, loading, error } = useFirestoreQuery<Episode[]>(
    `episodes-branch-${uid}-${projectId}-${branchName}`,
    () => query(
      collection(db, `users/${uid}/projects/${projectId}/episodes`),
      where('branchName', '==', branchName),
      orderBy('startedAt', 'asc')
    ),
    (snap: QuerySnapshot) => snap.docs.map(mapEpisode),
    [uid, projectId, branchName]
  )

  return { data: data ?? [], loading, error }
}

// ─── useEpisode ───────────────────────────────────────────────────────────────

export function useEpisode(uid: string, projectId: string, episodeId: string) {
  const { data, loading, error } = useFirestoreQuery<Episode | null>(
    `episode-${uid}-${projectId}-${episodeId}`,
    () => doc(db, `users/${uid}/projects/${projectId}/episodes/${episodeId}`),
    (snap: DocumentSnapshot) => snap.exists() ? mapEpisode(snap) : null,
    [uid, projectId, episodeId]
  )

  return { data, loading, error }
}

// ─── useRecentEpisodes ────────────────────────────────────────────────────────
export interface RecentEpisode extends Episode {
  projectName: string
}

export function useRecentEpisodes(uid: string, limitCount: number = 5) {
  const [data, setData] = useState<RecentEpisode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const lastUpdateRef = useRef<number>(0)

  useEffect(() => {
    if (!uid) { setLoading(false); return }

    // Optimization: Listen to projects to know when to re-fetch episodes
    const projectsRef = collection(db, `users/${uid}/projects`)
    const unsub = onSnapshot(projectsRef, async (projectsSnap) => {
      // Avoid excessive re-fetches if nothing meaningful changed
      const now = Date.now()
      if (now - lastUpdateRef.current < 500) return
      lastUpdateRef.current = now

      try {
        const projects = projectsSnap.docs.map(d => ({ id: d.id, name: d.data().name }))
        if (projects.length === 0) {
          setData([])
          setLoading(false)
          return
        }

        const results = await Promise.allSettled(
          projects.map(async (project) => {
            const q = query(
              collection(db, `users/${uid}/projects/${project.id}/episodes`),
              orderBy('startedAt', 'desc'),
              limit(limitCount)
            )
            const snap = await getDocs(q)
            return snap.docs.map((d) => ({
              ...mapEpisode(d),
              projectName: project.name,
              projectId: project.id
            }))
          })
        )

        const all: RecentEpisode[] = []
        for (const result of results) {
          if (result.status === 'fulfilled') {
            all.push(...(result.value as RecentEpisode[]))
          }
        }

        all.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        setData(all.slice(0, limitCount))
        setError(null)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })

    return unsub
  }, [uid, limitCount])

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
    if (!enabled || !projectId || !episodeId || !uid) { 
      if (data.length > 0) setData([])
      setLoading(false)
      return 
    }
    setLoading(true)

    let completed = false
    const timeoutId = setTimeout(() => {
      if (!completed) setLoading(false)
    }, 3000)

    const q = query(
      collection(db, `users/${uid}/projects/${projectId}/episodes/${episodeId}/calls`),
      orderBy('createdAt', 'asc')
    )
    
    // Using onSnapshot here for better UX (live updates during a session)
    const unsub = onSnapshot(q, (snap) => {
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
    }, (err) => {
      completed = true
      clearTimeout(timeoutId)
      setError(err.message)
      setLoading(false)
    })
    
    return () => {
      unsub()
      completed = true
      clearTimeout(timeoutId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, uid, projectId, episodeId])

  return { data, loading, error }
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
