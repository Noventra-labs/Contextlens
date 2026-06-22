import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { GitBranch, X, ChevronDown, Zap, ExternalLink, Trash2, Loader2, LayoutList, Calendar } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSearch } from '../context/SearchContext'
import { useProjects, useEpisodes } from '../lib/firestoreHooks'
import { useProjectSearch } from '../hooks/useProjectSearch'
import { EpisodeTimeline } from '../components/episodes/EpisodeTimeline'
import { EpisodeCard } from '../components/episodes/EpisodeCard'
import { SkeletonCard } from '../components/ui/SkeletonCard'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { Badge } from '../components/ui/Badge'
import { doc, deleteDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { searchQuery, setSearchQuery } = useSearch()

  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

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
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list')

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

  const handleDelete = async () => {
    if (!user || !projectId) return
    setIsDeleting(true)
    try {
      // 1. Delete all episodes under this project
      const batchPromises = episodes.map((ep) =>
        deleteDoc(doc(db, `users/${user.uid}/projects/${projectId}/episodes/${ep.id}`))
      )
      await Promise.all(batchPromises)

      // 2. Delete the project document itself
      await deleteDoc(doc(db, `users/${user.uid}/projects/${projectId}`))

      // 3. Redirect to Home
      navigate('/')
    } catch (err) {
      console.error('Failed to delete project', err)
      alert('Failed to delete project. Please try again.')
    } finally {
      setIsDeleting(false)
      setShowConfirm(false)
    }
  }

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
    <div className="max-w-4xl page-enter">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-textPrimary">
              {project?.name ?? 'Project'}
            </h1>
            {project?.repoUrl && (
              <a
                href={project.repoUrl.startsWith('git@') ? project.repoUrl.replace(/^git@([^:]+):/, 'https://$1/') : project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-textMuted/50 hover:text-primary font-mono transition-colors duration-150 mt-1"
              >
                {project.repoUrl.replace('https://github.com/', '').replace('git@github.com:', '')}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 text-xs font-semibold
                       hover:bg-red-500/10 hover:border-red-500/40 active:scale-[0.98]
                       transition-all duration-150 ease-out flex-shrink-0"
            title="Delete Project"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Project
          </button>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-3 mt-3">
          <div className="flex items-center gap-1.5 text-xs text-textMuted/50">
            <Zap className="w-3.5 h-3.5" />
            <span className="tabular-nums">{episodes.length}</span> episode{episodes.length !== 1 ? 's' : ''}
          </div>
          <div className="w-1 h-1 rounded-full bg-textMuted/20" />
          <div className="text-xs text-textMuted/50 tabular-nums">
            {totalCalls} AI call{totalCalls !== 1 ? 's' : ''}
          </div>
          <div className="w-1 h-1 rounded-full bg-textMuted/20" />
          <div className="text-xs text-textMuted/50 tabular-nums">
            {branches.length} branch{branches.length !== 1 ? 'es' : ''}
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm py-3 mb-4 flex items-center gap-2.5 flex-wrap border-b border-cardBorder/50 -mx-6 px-6">
        <div className="relative">
          <GitBranch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-textMuted/40 pointer-events-none" />
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="appearance-none bg-white/[0.03] border border-cardBorder/50 rounded-lg pl-8 pr-8 py-1.5 text-xs text-textPrimary
                       focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40
                       transition-all duration-150 cursor-pointer"
          >
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-textMuted/30 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none bg-white/[0.03] border border-cardBorder/50 rounded-lg pl-3 pr-8 py-1.5 text-xs text-textPrimary
                       focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40
                       transition-all duration-150 cursor-pointer"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-textMuted/30 pointer-events-none" />
        </div>

        {hasFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-textMuted/50 hover:text-red-400 hover:bg-red-500/5 transition-all duration-150"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}

        {branchFilter && <Badge text={branchFilter} variant="branch" />}

        {/* View Toggle */}
        <div className="flex items-center bg-white/[0.03] border border-cardBorder/50 rounded-lg p-0.5 ml-2">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-all duration-150 flex items-center gap-1 ${
              viewMode === 'list'
                ? 'bg-primary text-black font-semibold shadow-sm'
                : 'text-textMuted/70 hover:text-textPrimary'
            }`}
            title="List View"
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className={`p-1.5 rounded-md transition-all duration-150 flex items-center gap-1 ${
              viewMode === 'timeline'
                ? 'bg-primary text-black font-semibold shadow-sm'
                : 'text-textMuted/70 hover:text-textPrimary'
            }`}
            title="Timeline View"
          >
            <Calendar className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Result count */}
        {!isLoading && (
          <span className="ml-auto text-[10px] text-textMuted/30 tabular-nums">
            {filteredEpisodes.length} result{filteredEpisodes.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Episodes Section */}
      {isLoading && !episodes.length ? (
        <div className="space-y-3">
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
      ) : viewMode === 'timeline' ? (
        <EpisodeTimeline
          episodes={filteredEpisodes}
          projectId={projectId ?? ''}
        />
      ) : (
        <div className="space-y-4">
          {filteredEpisodes.map((ep) => (
            <EpisodeCard
              key={ep.id}
              episode={ep}
              projectId={projectId ?? ''}
              uid={user?.uid ?? ''}
            />
          ))}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#161b22] border border-cardBorder rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl space-y-4 card-glow">
            <div className="flex items-center gap-3 text-red-400">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-textPrimary">Delete Project?</h3>
            </div>
            <p className="text-xs text-textMuted leading-relaxed font-sans">
              Are you sure you want to delete <span className="font-semibold text-textPrimary">"{project?.name}"</span>? 
              This action cannot be undone. All project settings, history, and episodes will be permanently deleted.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-white/[0.04] border border-cardBorder/50 text-textPrimary text-xs font-semibold
                           hover:bg-white/[0.08] active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500 text-white text-xs font-bold
                           hover:bg-red-600 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 shadow-lg shadow-red-500/10"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
