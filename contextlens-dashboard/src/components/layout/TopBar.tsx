import { Link, useParams, useMatches } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useProjects } from '../../lib/firestoreHooks'

export function TopBar() {
  const { user } = useAuth()
  const { projectId, episodeId, branchName } = useParams()
  const { data: projects } = useProjects(user?.uid ?? '')
  const matches = useMatches()

  const currentProject = projects.find((p) => p.id === projectId)

  const crumbs: { label: string; href: string }[] = [
    { label: 'Home', href: '/dashboard' },
  ]
  if (currentProject) {
    crumbs.push({ label: currentProject.name, href: `/dashboard/${projectId}` })
  }
  if (episodeId) {
    crumbs.push({
      label: 'Episode',
      href: `/dashboard/${projectId}/episodes/${episodeId}`,
    })
  }
  if (branchName) {
    crumbs.push({
      label: decodeURIComponent(branchName),
      href: `/dashboard/${projectId}/branch/${branchName}`,
    })
  }
  // Detect settings from matches
  const isSettings = matches.some((m) => (m.pathname as string).includes('settings'))
  if (isSettings) {
    crumbs.push({ label: 'Settings', href: '/dashboard/settings' })
  }

  return (
    <header className="h-12 flex items-center justify-between px-6 border-b border-cardBorder bg-surface flex-shrink-0">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1">
            {i > 0 && <span className="text-textMuted">/</span>}
            {i === crumbs.length - 1 ? (
              <span className="text-textPrimary font-medium">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.href}
                className="text-textMuted hover:text-textPrimary transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        <button className="p-1.5 rounded-md text-textMuted hover:text-textPrimary hover:bg-gray-800/40 transition-colors">
          <Search className="w-4 h-4" />
        </button>
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName ?? ''}
            className="w-7 h-7 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center text-xs text-primary font-bold">
            {user?.displayName?.[0] ?? 'U'}
          </div>
        )}
      </div>
    </header>
  )
}
