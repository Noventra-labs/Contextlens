import { useMemo } from 'react'
import { Link, useParams, useMatches } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useSearch } from '../../context/SearchContext'
import { useAuth } from '../../context/AuthContext'
import { useProjects } from '../../lib/firestoreHooks'

export function TopBar() {
  const { user } = useAuth()
  const { searchQuery, setSearchQuery } = useSearch()
  const { projectId, episodeId, branchName } = useParams()
  const { data: projects } = useProjects(user?.uid ?? '')
  const matches = useMatches()

  const isSearchablePage = useMemo(() => {
    return !matches.some((m) => {
      const path = m.pathname as string
      return path.includes('settings') || path.includes('setup')
    })
  }, [matches])

  const currentProject = projects.find((p) => p.id === projectId)

  const crumbs = useMemo(() => {
    const c: { label: string; href: string }[] = [
      { label: 'Home', href: '/dashboard' },
    ]
    if (currentProject) {
      c.push({ label: currentProject.name, href: `/dashboard/${projectId}` })
    }
    if (episodeId) {
      c.push({
        label: 'Episode',
        href: `/dashboard/${projectId}/episodes/${episodeId}`,
      })
    }
    if (branchName) {
      c.push({
        label: decodeURIComponent(branchName),
        href: `/dashboard/${projectId}/branch/${branchName}`,
      })
    }
    const isSettings = matches.some((m) => (m.pathname as string).includes('settings'))
    if (isSettings) {
      c.push({ label: 'Settings', href: '/dashboard/settings' })
    }
    return c
  }, [currentProject, projectId, episodeId, branchName, matches])

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
        {isSearchablePage && (
          <div className="relative group">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-textMuted group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Search episodes, branches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-48 bg-gray-900/50 border border-cardBorder rounded-md pl-8 pr-8 py-1.5 text-xs text-textPrimary focus:outline-none focus:border-primary/50 focus:w-64 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-textMuted hover:text-primary transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
