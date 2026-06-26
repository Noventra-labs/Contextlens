import { memo, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Plus, Zap, Terminal, BookOpen, ArrowRight, Database } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSearch } from '../context/SearchContext'
import { useProjects, useRecentEpisodes } from '../lib/firestoreHooks'
import { SkeletonCard } from '../components/ui/SkeletonCard'
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
    <div className="max-w-6xl mx-auto page-enter space-y-8 pb-12 w-full">
      {/* Header (Only show here if projects exist, otherwise show inside centered empty state) */}
      {projects.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-textPrimary tracking-tight">
              Welcome back, {user?.displayName?.split(' ')[0] ?? 'Developer'}
            </h1>
            <p className="text-sm text-textMuted mt-1">Here's what's happening across your projects.</p>
          </div>
          <button
            onClick={() => navigate('/dashboard/setup')}
            className="flex items-center gap-2 bg-primary hover:brightness-110 text-black px-4 py-2.5 rounded-xl text-sm font-bold
                       self-start md:self-auto transition-all duration-150 active:scale-[0.97]
                       shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            Connect Project
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {projectsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} lines={4} />
          ))}
        </div>
      ) : projectsError ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm text-red-400">{projectsError}</p>
        </div>
      ) : projects.length === 0 ? (
        /* Bento Grid Empty State (Centered in Viewport for 1920x1080) */
        <div className="flex flex-col justify-center min-h-[calc(100vh-140px)] animate-fadeIn">
          {/* Welcome back inside viewport */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-textPrimary tracking-tight">
              Welcome back, {user?.displayName?.split(' ')[0] ?? 'Developer'}
            </h1>
            <p className="text-sm text-textMuted mt-1">Here's what's happening across your projects.</p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Empty State Hero */}
            <div className="col-span-12 lg:col-span-8 flex flex-col justify-center bg-card/40 backdrop-blur-md border border-cardBorder p-8 rounded-2xl relative overflow-hidden">
              <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
              <div className="max-w-md space-y-6 relative">
                <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                  <Terminal className="text-primary w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-textPrimary tracking-tight">No projects yet</h2>
                <p className="text-sm text-textMuted leading-relaxed">
                  Install the VS Code extension to start capturing AI coding sessions. ContextLens will automatically index your reasoning steps and architectural decisions.
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => navigate('/dashboard/setup')}
                    className="px-5 py-2.5 bg-primary text-black rounded-xl font-bold text-sm hover:brightness-110 hover:shadow-[0_0_15px_rgba(79,152,163,0.3)] active:scale-[0.97] transition-all"
                  >
                    Get Started
                  </button>
                  <a
                    href="https://github.com/89Aman/Contextlens#readme"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 bg-white/[0.03] hover:bg-white/[0.08] border border-cardBorder text-textPrimary rounded-xl font-medium text-sm flex items-center gap-2 active:scale-[0.97] transition-all"
                  >
                    <BookOpen className="w-4 h-4 text-textMuted" />
                    View Docs
                  </a>
                </div>
              </div>
            </div>

            {/* Instructions Bento */}
            <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
              <div className="bg-card/40 backdrop-blur-md border border-cardBorder p-6 rounded-2xl flex-1 border-l-2 border-l-primary/40 flex flex-col justify-between">
                <div>
                  <h3 className="font-mono text-primary uppercase text-[10px] tracking-widest mb-6 font-semibold">
                    Setup Guide
                  </h3>
                  <ul className="space-y-6">
                    <li className="flex gap-4 group cursor-default">
                      <span className="font-mono text-primary/40 font-bold text-base group-hover:text-primary transition-colors">
                        01
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-textPrimary">Install Extension</p>
                        <p className="text-xs text-textMuted mt-0.5">Search for "ContextLens" in VS Code marketplace.</p>
                      </div>
                    </li>
                    <li className="flex gap-4 group cursor-default">
                      <span className="font-mono text-primary/40 font-bold text-base group-hover:text-primary transition-colors">
                        02
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-textPrimary">Open Git Project</p>
                        <p className="text-xs text-textMuted mt-0.5">Any project with a .git root folder is compatible.</p>
                      </div>
                    </li>
                    <li className="flex gap-4 group cursor-default">
                      <span className="font-mono text-primary/40 font-bold text-base group-hover:text-primary transition-colors">
                        03
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-textPrimary">Auto Capture</p>
                        <p className="text-xs text-textMuted mt-0.5">Sessions stream real-time to your dashboard.</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>

              <div
                onClick={() => navigate('/dashboard/setup')}
                className="bg-card/40 backdrop-blur-md border border-cardBorder p-5 rounded-2xl flex items-center justify-between group cursor-pointer hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-primary" />
                  <span className="text-sm font-semibold text-textPrimary">Local Data Store</span>
                </div>
                <ArrowRight className="w-4 h-4 text-textMuted group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Dynamic Projects View */
        <section className="animate-fadeIn" style={{ animationDelay: '60ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen className="w-4 h-4 text-textMuted/40" />
            <h2 className="text-[11px] font-semibold text-textMuted/50 uppercase tracking-wider">
              Your Projects
            </h2>
            {filteredProjects.length > 0 && (
              <span className="text-[10px] text-textMuted/30 tabular-nums">{filteredProjects.length}</span>
            )}
          </div>

          {filteredProjects.length === 0 ? (
            <div className="bg-card/40 border border-cardBorder rounded-xl p-8 text-center">
              <p className="text-sm text-textMuted">No projects match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project, i) => (
                <div key={project.id} className="animate-fadeIn" style={{ animationDelay: `${80 + i * 50}ms` }}>
                  <ProjectCard project={project} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Recent Episodes Section */}
      {!projectsLoading && projects.length > 0 && (
        <section className="animate-fadeIn" style={{ animationDelay: '180ms' }}>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-textMuted/40" />
            <h2 className="text-[11px] font-semibold text-textMuted/50 uppercase tracking-wider">
              Recent Episodes
            </h2>
            {filteredEpisodes.length > 0 && (
              <span className="text-[10px] text-textMuted/30 tabular-nums">{filteredEpisodes.length}</span>
            )}
          </div>

          {episodesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <SkeletonCard key={i} lines={2} />)}
            </div>
          ) : episodesError ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-sm text-red-400">{episodesError}</p>
            </div>
          ) : filteredEpisodes.length === 0 ? (
            <div className="bg-card/40 border border-cardBorder rounded-xl p-8 text-center">
              <p className="text-sm text-textMuted">No episodes found.</p>
            </div>
          ) : (
            <div className="bg-card border border-cardBorder rounded-xl overflow-hidden divide-y divide-cardBorder/50">
              {filteredEpisodes.map((ep, i) => (
                <RecentEpisodeItem key={ep.id} episode={ep} isFirst={i === 0} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
})
