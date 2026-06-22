import { memo, useMemo } from 'react'
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { GitBranch, Settings, LogOut, FolderOpen, Plus } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useProjects, useEpisodes } from '../../lib/firestoreHooks'

const BranchList = memo(function BranchList({
  uid,
  projectId,
  activeProjectId,
}: {
  uid: string
  projectId: string
  activeProjectId: string
}) {
  const { data: episodes } = useEpisodes(uid, projectId)
  const { branchName: activeBranch } = useParams()
  const location = useLocation()

  const branches = useMemo(
    () => Array.from(new Set(episodes.map((e) => e.branchName))),
    [episodes]
  )
  const branchCounts = useMemo(
    () => Object.fromEntries(
      branches.map((b) => [b, episodes.filter((e) => e.branchName === b).length]),
    ),
    [branches, episodes]
  )

  if (projectId !== activeProjectId) return null

  return (
    <div className="mt-1 ml-3 border-l border-cardBorder/50 pl-3 space-y-0.5 animate-fadeIn" style={{ animationDuration: '0.25s' }}>
      <p className="text-[10px] font-semibold text-textMuted/50 uppercase tracking-wider px-2 py-1">
        Branches
      </p>
      {branches.map((branch) => {
        const href = `/dashboard/${projectId}/branch/${encodeURIComponent(branch)}`
        const isActive =
          location.pathname === href ||
          decodeURIComponent(activeBranch ?? '') === branch
        return (
          <Link
            key={branch}
            to={href}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all duration-150 group ${
              isActive
                ? 'text-primary bg-primary/10'
                : 'text-textMuted hover:text-textPrimary hover:bg-white/[0.03]'
            }`}
          >
            <GitBranch className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{branch}</span>
            <span className="ml-auto text-[10px] text-textMuted/40 tabular-nums">
              {branchCounts[branch]}
            </span>
          </Link>
        )
      })}
    </div>
  )
})

export function Sidebar() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { projectId: activeProjectId } = useParams()
  const { data: projects } = useProjects(user?.uid ?? '')

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside
      style={{ width: '248px', minWidth: '248px' }}
      className="flex flex-col h-full bg-card border-r border-cardBorder/60"
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-cardBorder/60">
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 flex-shrink-0 relative">
            {/* Glow behind logo on hover */}
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative">
              <circle cx="16" cy="16" r="15" fill="#111820" stroke="#4f98a3" strokeWidth="1.5" />
              <ellipse cx="16" cy="16" rx="10" ry="6" stroke="#4f98a3" strokeWidth="1.5" />
              <circle cx="16" cy="16" r="3.5" fill="#4f98a3" />
              <circle cx="16" cy="16" r="1.5" fill="var(--color-card)" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-bold text-textPrimary group-hover:text-primary transition-colors duration-200">
              ContextLens
            </span>
            <p className="text-[10px] text-textMuted/50">AI workflow memory</p>
          </div>
        </Link>
      </div>

      {/* Projects list */}
      <div className="flex-1 overflow-y-auto py-3">
        <div className="flex items-center justify-between px-4 mb-2">
          <p className="text-[10px] font-semibold text-textMuted/50 uppercase tracking-wider">
            Projects
          </p>
          <Link
            to="/dashboard/setup"
            className="p-1 rounded-md hover:bg-primary/10 text-textMuted/50 hover:text-primary transition-all duration-150"
            title="Connect Project"
          >
            <Plus className="w-3.5 h-3.5" />
          </Link>
        </div>
        <nav className="space-y-0.5 px-2">
          {projects.length === 0 ? (
            <div className="px-3 py-4 mt-2">
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-[11px] text-textPrimary font-medium mb-1">
                  No projects found
                </p>
                <p className="text-[10px] text-textMuted/60 leading-relaxed">
                  Start a project using the ContextLens VS Code extension.
                </p>
              </div>
            </div>
          ) : (
            projects.map((project) => {
              const isActive = activeProjectId === project.id
              return (
                <div key={project.id}>
                  <Link
                    to={`/dashboard/${project.id}`}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 group ${
                      isActive
                        ? 'text-textPrimary bg-primary/10 border-l-2 border-primary pl-2'
                        : 'text-textMuted hover:text-textPrimary hover:bg-white/[0.03]'
                    }`}
                  >
                    <FolderOpen
                      className={`w-4 h-4 flex-shrink-0 transition-colors duration-150 ${
                        isActive ? 'text-primary' : 'text-textMuted/40 group-hover:text-textMuted'
                      }`}
                    />
                    <span className="truncate font-medium">{project.name}</span>
                  </Link>
                  {isActive && (
                    <BranchList
                      uid={user?.uid ?? ''}
                      projectId={project.id}
                      activeProjectId={activeProjectId ?? ''}
                    />
                  )}
                </div>
              )
            })
          )}
        </nav>
      </div>

      {/* Bottom user section */}
      <div className="border-t border-cardBorder/60 p-3">
        {/* User avatar row */}
        {user && (
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-6 h-6 rounded-full ring-1 ring-cardBorder"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                {user.displayName?.[0] ?? 'U'}
              </div>
            )}
            <span className="text-xs text-textMuted/70 truncate">{user.displayName || user.email}</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Link
            to="/dashboard/settings"
            className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-textMuted/60 hover:text-textPrimary hover:bg-white/[0.03] transition-all duration-150"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-textMuted/40 hover:text-red-400 hover:bg-red-500/5 transition-all duration-150"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
