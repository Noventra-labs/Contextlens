import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useProjects } from '../lib/firestoreHooks'
import { Badge } from '../components/ui/Badge'
import { SkeletonCard } from '../components/ui/SkeletonCard'
import { EmptyState } from '../components/ui/EmptyState'
import { timeAgo } from '../lib/utils'
import type { Episode } from '../types'
import { GitBranch, ExternalLink, Folder } from 'lucide-react'

interface RecentEpisode extends Episode {
  projectName: string
}

export function HomePage() {
  const { user } = useAuth()
  const { data: projects, loading: projectsLoading, error: projectsError } = useProjects(user?.uid ?? '')
  const [recentEpisodes, setRecentEpisodes] = useState<RecentEpisode[]>([])
  const [episodesLoading, setEpisodesLoading] = useState(true)
  const [episodesError, setEpisodesError] = useState<string | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toDate = (ts: any): Date => ts?.toDate?.() ?? new Date(ts)

  useEffect(() => {
    if (projects.length === 0) {
      setEpisodesLoading(false)
      return
    }

    const fetchAll = async () => {
      setEpisodesError(null)
      try {
        const effectiveUid = user?.uid ?? ''

        // Fetch episodes from all projects in parallel
        const results = await Promise.allSettled(
          projects.map(async (project) => {
            const q = query(
              collection(db, `users/${effectiveUid}/projects/${project.id}/episodes`),
              orderBy('startedAt', 'desc'),
              limit(5),
            )
            const snap = await getDocs(q)
            return snap.docs.map((d) => {
              const data = d.data()
              return {
                id: d.id,
                projectId: project.id,
                label: data.label ?? 'Untitled',
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
                projectName: project.name,
              } as RecentEpisode
            })
          })
        )

        const all: RecentEpisode[] = []
        for (const result of results) {
          if (result.status === 'fulfilled') {
            all.push(...result.value)
          }
          // Silently skip failed projects — partial data is better than no data
        }

        all.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        setRecentEpisodes(all.slice(0, 5))
      } catch (err: any) {
        console.error('[ContextLens] Failed to fetch recent episodes:', err)
        setEpisodesError(err.message)
      } finally {
        setEpisodesLoading(false)
      }
    }

    fetchAll()
  }, [user, projects])

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-textPrimary mb-6">
        Welcome back, {user?.displayName?.split(' ')[0] ?? 'Developer'} 👋
      </h1>

      {/* Projects section */}
      <section className="mb-10">
        <h2 className="text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-3">
          Your Projects
        </h2>

        {projectsLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} lines={4} />
            ))}
          </div>
        )}

        {projectsError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-400">{projectsError}</p>
          </div>
        )}

        {!projectsLoading && projects.length === 0 && (
          <EmptyState
            title="No projects yet"
            description="Install the VS Code extension to start capturing AI coding sessions."
            ctaLabel="View docs"
            ctaHref="https://github.com"
          />
        )}

        {!projectsLoading && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                to={`/dashboard/${project.id}`}
                className="block bg-card border border-cardBorder rounded-lg p-4 hover:border-primary/50 hover:bg-gray-800/20 transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-primary flex-shrink-0" />
                    <h3 className="text-sm font-semibold text-textPrimary group-hover:text-primary transition-colors">
                      {project.name}
                    </h3>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-textMuted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {project.repoUrl && (
                  <p className="text-xs text-textMuted font-mono truncate mb-2">
                    {project.repoUrl.replace('https://github.com/', '')}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge text={project.defaultBranch} variant="branch" />
                  <span className="text-xs text-textMuted">
                    Updated {timeAgo(project.updatedAt)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent Episodes section */}
      <section>
        <h2 className="text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-3">
          Recent Episodes
        </h2>

        {episodesLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={2} />)}
          </div>
        )}

        {episodesError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-400">{episodesError}</p>
          </div>
        )}

        {!episodesLoading && recentEpisodes.length === 0 && (
          <EmptyState
            title="No episodes yet"
            description="Episodes are created automatically when you use AI in VS Code with ContextLens."
          />
        )}

        {!episodesLoading && recentEpisodes.length > 0 && (
          <div className="bg-card border border-cardBorder rounded-lg overflow-hidden">
            {recentEpisodes.map((ep, i) => (
              <Link
                key={ep.id}
                to={`/dashboard/${ep.projectId}/episodes/${ep.id}`}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-800/20 transition-colors ${
                  i > 0 ? 'border-t border-cardBorder' : ''
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-textPrimary truncate">{ep.label}</p>
                  <p className="text-xs text-textMuted">{ep.projectName}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs text-textMuted">
                    <GitBranch className="w-3 h-3" />
                    <span>{ep.branchName}</span>
                  </div>
                  <Badge text={ep.status} variant={ep.status === 'active' ? 'status-active' : 'status-closed'} />
                  <span className="text-xs text-textMuted">{timeAgo(ep.startedAt)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
