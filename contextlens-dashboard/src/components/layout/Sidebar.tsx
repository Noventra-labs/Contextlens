import { Link, useNavigate, useParams, useLocation } from 'react-router-dom'
import { GitBranch, Settings, LogOut, FolderOpen, Code } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useProjects } from '../../lib/firestoreHooks'
import { useEpisodes } from '../../lib/firestoreHooks'

function BranchList({
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

  const branches = Array.from(new Set(episodes.map((e) => e.branchName)))
  const branchCounts = Object.fromEntries(
    branches.map((b) => [b, episodes.filter((e) => e.branchName === b).length]),
  )

  if (projectId !== activeProjectId) return null

  return (
    <div className="mt-1 ml-3 border-l border-cardBorder pl-3 space-y-0.5">
      <p className="text-[10px] font-semibold text-textMuted uppercase tracking-wider px-2 py-1">
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
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors group ${
              isActive
                ? 'text-primary bg-primary/10'
                : 'text-textMuted hover:text-textPrimary hover:bg-gray-800/30'
            }`}
          >
            <GitBranch className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{branch}</span>
            <span className="ml-auto text-[10px] text-textMuted">
              {branchCounts[branch]}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

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
      style={{ width: '240px', minWidth: '240px' }}
      className="flex flex-col h-full bg-surface border-r border-cardBorder"
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-cardBorder">
        <Link to="/dashboard" className="flex items-center gap-2.5 group">
          <div className="w-7 h-7 flex-shrink-0">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="15" fill="#161b22" stroke="#4f98a3" strokeWidth="1.5" />
              <ellipse cx="16" cy="16" rx="10" ry="6" stroke="#4f98a3" strokeWidth="1.5" />
              <circle cx="16" cy="16" r="3.5" fill="#4f98a3" />
              <circle cx="16" cy="16" r="1.5" fill="#0d1117" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-bold text-textPrimary group-hover:text-primary transition-colors">
              ContextLens
            </span>
            <p className="text-[10px] text-textMuted">AI workflow memory</p>
          </div>
        </Link>
      </div>

      {/* Projects list */}
      <div className="flex-1 overflow-y-auto py-3">
        <p className="px-4 text-[10px] font-semibold text-textMuted uppercase tracking-wider mb-2">
          Projects
        </p>
        <nav className="space-y-0.5 px-2">
          {projects.length === 0 ? (
            <div className="px-4 py-4 mt-2">
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-[11px] text-textPrimary font-medium mb-1">
                  No projects found
                </p>
                <p className="text-[10px] text-textMuted leading-relaxed">
                  Start a project using the ContextLens VS Code extension to see it here.
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
                    className={`flex items-center gap-2 px-2 py-2 rounded-md text-sm transition-colors group ${
                      isActive
                        ? 'text-textPrimary bg-primary/10 border-l-2 border-primary pl-[6px]'
                        : 'text-textMuted hover:text-textPrimary hover:bg-gray-800/30'
                    }`}
                  >
                    <FolderOpen
                      className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-primary' : ''}`}
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
      <div className="border-t border-cardBorder p-3 space-y-2">
        {user && (
          <div className="flex items-center gap-2 px-1">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName ?? ''}
                className="w-7 h-7 rounded-full flex-shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center text-xs text-primary font-bold flex-shrink-0">
                {user.displayName?.[0] ?? 'U'}
              </div>
            )}
            <span className="text-xs text-textMuted truncate flex-1">
              {user.email}
            </span>
          </div>
        )}
        {user && (
          <a
            href={`https://contextlens-backend-001.web.app/api/auth/login?uid=${user.uid}&callback=vscode://noventra-Labs.contextlens`}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-primary hover:bg-primary/10 transition-colors"
          >
            <Code className="w-3.5 h-3.5" />
            Connect VS Code
          </a>
        )}
        <div className="flex items-center gap-1">
          <Link
            to="/dashboard/settings"
            className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-textMuted hover:text-textPrimary hover:bg-gray-800/30 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-textMuted hover:text-red-400 hover:bg-red-900/20 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
