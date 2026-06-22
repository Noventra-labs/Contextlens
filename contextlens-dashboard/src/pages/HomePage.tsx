import { memo, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Plus, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSearch } from '../context/SearchContext'
import { useProjects, useRecentEpisodes } from '../lib/firestoreHooks'
import { SkeletonCard } from '../components/ui/SkeletonCard'
import { EmptyState } from '../components/ui/EmptyState'
import { ProjectCard } from '../components/projects/ProjectCard'
import { RecentEpisodeItem } from '../components/episodes/RecentEpisodeItem'

export const HomePage = memo(function HomePage() {
  const { user } = useAuth()
  const { searchQuery } = useSearch()
  const navigate = useNavigate()

  const {
    data: projects,
    loading: projectsLoading,
    error: projectsError,
  } = useProjects(user?.uid ?? '')

  const {
    data: recentEpisodes,
    loading: episodesLoading,
    error: episodesError,
  } = useRecentEpisodes(user?.uid ?? '', 10)

  const filteredProjects = useMemo(
    () => projects.filter((p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.repoUrl && p.repoUrl.toLowerCase().includes(searchQuery.toLowerCase()))
    ),
    [projects, searchQuery]
  )

  const filteredEpisodes = useMemo(
    () => recentEpisodes.filter((ep) =>
      ep.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.branchName.toLowerCase().includes(searchQuery.toLowerCase())
    ),
    [recentEpisodes, searchQuery]
  )

  return (
    <div className="max-w-5xl page-enter">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-textPrimary">
            Welcome back, {user?.displayName?.split(' ')[0] ?? 'Developer'}
          </h1>
          <p className="text-sm text-textMuted/50 mt-1">Here's what's happening across your projects.</p>
        </div>
        <button
          onClick={() => navigate('/dashboard/setup')}
          className="flex items-center gap-2 bg-primary hover:brightness-110 text-black px-4 py-2.5 rounded-xl text-sm font-bold
                     transition-all duration-150 active:scale-[0.97]
                     shadow-lg shadow-primary/20"
        >
          <Plus className="w-4 h-4" />
          Connect Project
        </button>
      </div>

      {/* Projects section */}
      <section className="mb-10 animate-fadeIn" style={{ animationDelay: '60ms' }}>
        <div className="flex items-center gap-2 mb-4">
          <FolderOpen className="w-4 h-4 text-textMuted/40" />
          <h2 className="text-[11px] font-semibold text-textMuted/50 uppercase tracking-wider">
            Your Projects
          </h2>
          {!projectsLoading && projects.length > 0 && (
            <span className="text-[10px] text-textMuted/30 tabular-nums">{projects.length}</span>
          )}
        </div>

        {projectsLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} lines={4} />
            ))}
          </div>
        )}

        {projectsError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-400">{projectsError}</p>
          </div>
        )}

        {!projectsLoading && projects.length === 0 && (
          <EmptyState
            title="No projects yet"
            description="Install the VS Code extension to start capturing AI coding sessions."
            variant="projects"
            ctaLabel="Get Started"
            ctaOnClick={() => navigate('/dashboard/setup')}
          />
        )}

        {!projectsLoading && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredProjects.map((project, i) => (
              <div key={project.id} className="animate-fadeIn" style={{ animationDelay: `${80 + i * 50}ms` }}>
                <ProjectCard project={project} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent Episodes section */}
      <section className="animate-fadeIn" style={{ animationDelay: '180ms' }}>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-textMuted/40" />
          <h2 className="text-[11px] font-semibold text-textMuted/50 uppercase tracking-wider">
            Recent Episodes
          </h2>
          {!episodesLoading && recentEpisodes.length > 0 && (
            <span className="text-[10px] text-textMuted/30 tabular-nums">{recentEpisodes.length}</span>
          )}
        </div>

        {episodesLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={2} />)}
          </div>
        )}

        {episodesError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-400">{episodesError}</p>
          </div>
        )}

        {!episodesLoading && recentEpisodes.length === 0 && (
          <EmptyState
            title="No episodes yet"
            description="Episodes are created automatically when you use AI in VS Code with ContextLens."
            variant="episodes"
          />
        )}

        {!episodesLoading && recentEpisodes.length > 0 && (
          <div className="bg-card border border-cardBorder rounded-xl overflow-hidden">
            {filteredEpisodes.map((ep, i) => (
              <RecentEpisodeItem key={ep.id} episode={ep} isFirst={i === 0} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
})
