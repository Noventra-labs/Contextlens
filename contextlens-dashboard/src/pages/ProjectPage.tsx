import { useState, useMemo, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { GitBranch, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSearch } from '../context/SearchContext'
import { useProjects, useEpisodes } from '../lib/firestoreHooks'
import { useProjectSearch } from '../hooks/useProjectSearch'
import { EpisodeTimeline } from '../components/episodes/EpisodeTimeline'
import { SkeletonCard } from '../components/ui/SkeletonCard'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { Badge } from '../components/ui/Badge'

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const { searchQuery, setSearchQuery } = useSearch()

  // Clear search query when switching projects
  useEffect(() => {
    setSearchQuery('')
  }, [projectId, setSearchQuery])
  
  const { data: projects, loading: projectsLoading, error: projectsError } = useProjects(user?.uid ?? '')
  const {
    data: episodes,
    loading: episodesLoading,
    error: episodesError,
  } = useEpisodes(user?.uid ?? '', projectId ?? '')

  const project = projects.find((p) => p.id === projectId)

  const [branchFilter, setBranchFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { searchResults, searchLoading } = useProjectSearch(
    projectId ?? '',
    episodes,
    searchQuery,
    branchFilter
  )

  const branches = useMemo(
    () => Array.from(new Set(episodes.map((e) => e.branchName))),
    [episodes]
  )

  const hasFilters = branchFilter !== '' || statusFilter !== 'all' || searchQuery !== ''

  const filteredEpisodes = useMemo(() => {
    const base = searchResults !== null ? searchResults : episodes
    return base.filter((e) => {
      if (branchFilter && e.branchName !== branchFilter) return false
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      return true
    })
  }, [searchResults, episodes, branchFilter, statusFilter])

  const totalCalls = useMemo(
    () => episodes.reduce((sum, e) => sum + e.callCount, 0),
    [episodes]
  )

  const handleClearFilters = () => {
    setBranchFilter('')
    setStatusFilter('all')
    setSearchQuery('')
  }

  if (projectsError || episodesError) {
    return <ErrorMessage message={episodesError || projectsError || 'An error occurred'} />
  }

  const isLoading = episodesLoading || projectsLoading || searchLoading

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-textPrimary">
          {project?.name ?? 'Project'}
        </h1>
        {project?.repoUrl && (
          <a
            href={project.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-textMuted hover:text-primary font-mono transition-colors"
          >
            {project.repoUrl}
          </a>
        )}
        <div className="flex items-center gap-4 mt-2">
          <span className="text-xs text-textMuted">
            {episodes.length} episode{episodes.length !== 1 ? 's' : ''}
          </span>
          <span className="text-xs text-textMuted">{totalCalls} AI calls</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="sticky top-0 z-10 bg-surface py-3 mb-4 flex items-center gap-2 flex-wrap border-b border-cardBorder -mx-6 px-6">
        <div className="flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5 text-textMuted" />
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="bg-card border border-cardBorder rounded-md px-2 py-1.5 text-sm text-textPrimary focus:outline-none focus:border-primary/60 transition-colors"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-card border border-cardBorder rounded-md px-2 py-1.5 text-sm text-textPrimary focus:outline-none focus:border-primary/60 transition-colors"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>

        {hasFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1 text-xs text-textMuted hover:text-red-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        )}

        {branchFilter && <Badge text={branchFilter} variant="branch" />}
      </div>

      {/* Timeline */}
      {isLoading && !episodes.length ? (
        <div className="space-y-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filteredEpisodes.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'No episodes match your filters' : 'No episodes yet'}
          description={
            hasFilters
              ? 'Try clearing your filters to see all episodes.'
              : 'Episodes are created automatically when you code with AI in VS Code.'
          }
        />
      ) : (
        <EpisodeTimeline
          episodes={filteredEpisodes}
          projectId={projectId ?? ''}
          uid={user?.uid ?? ''}
        />
      )}
    </div>
  )
}
