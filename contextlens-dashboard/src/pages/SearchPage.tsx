import { useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Search as SearchIcon, Filter, X, Zap, MessageSquare, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProjects } from '../lib/firestoreHooks'
import { search, type SearchResult, type SearchFilters } from '../lib/api'
import { EmptyState } from '../components/ui/EmptyState'
import { Badge } from '../components/ui/Badge'

export function SearchPage() {
  const { user } = useAuth()
  const { data: projects } = useProjects(user?.uid ?? '')

  const [query, setQuery] = useState('')
  const [selectedProject, setSelectedProject] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const handleSearch = useCallback(async () => {
    if (!selectedProject || !query.trim()) return
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const filters: SearchFilters = {}
      if (branchFilter) filters.branchName = branchFilter
      const data = await search(selectedProject, query.trim(), filters)
      setResults(data)
    } catch (err: any) {
      setError(err.message || 'Search failed')
    } finally {
      setLoading(false)
    }
  }, [selectedProject, query, branchFilter])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }, [handleSearch])

  const clearFilters = () => {
    setBranchFilter('')
    setSourceFilter('')
  }

  const filteredCalls = useMemo(() => {
    if (!results?.calls) return []
    if (!sourceFilter) return results.calls
    return results.calls.filter(c => (c as any).source === sourceFilter)
  }, [results, sourceFilter])

  const hasFilters = branchFilter || sourceFilter

  return (
    <div className="max-w-4xl page-enter">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-textPrimary">Search</h1>
        <p className="text-sm text-textMuted/50 mt-1">Search across all episodes and AI calls within a project.</p>
      </div>

      {/* Search bar */}
      <div className="flex gap-3 mb-4">
        <select
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="appearance-none bg-card border border-cardBorder rounded-xl px-4 py-2.5 text-sm text-textPrimary
                     focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40
                     transition-all duration-150 cursor-pointer min-w-[180px]"
        >
          <option value="">Select project…</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="flex-1 relative group">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textMuted/40 group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Search episodes, calls, diffs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-card border border-cardBorder rounded-xl pl-10 pr-4 py-2.5 text-sm text-textPrimary
                       placeholder:text-textMuted/30
                       focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40
                       transition-all duration-200"
          />
        </div>

        <button
          onClick={handleSearch}
          disabled={!selectedProject || !query.trim() || loading}
          className="flex items-center gap-2 bg-primary hover:brightness-110 text-black px-5 py-2.5 rounded-xl text-sm font-bold
                     transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed
                     shadow-lg shadow-primary/20"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SearchIcon className="w-4 h-4" />}
          Search
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-3.5 h-3.5 text-textMuted/30" />
        <input
          type="text"
          placeholder="Branch filter…"
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="bg-white/[0.03] border border-cardBorder/50 rounded-lg px-3 py-1.5 text-xs text-textPrimary
                     placeholder:text-textMuted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 w-40
                     transition-all duration-150"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="appearance-none bg-white/[0.03] border border-cardBorder/50 rounded-lg px-3 py-1.5 text-xs text-textPrimary
                     focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-150 cursor-pointer"
        >
          <option value="">All sources</option>
          <option value="extension">Extension</option>
          <option value="git_commit">Git Commit</option>
          <option value="manual_log">Manual</option>
        </select>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-textMuted/50 hover:text-red-400 hover:bg-red-500/5 transition-all"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Results */}
      {!searched && !loading && (
        <EmptyState
          title="Search your project history"
          description="Enter a search term and select a project to find episodes, AI calls, diffs, and more."
          variant="search"
        />
      )}

      {searched && !loading && results && (
        <div className="space-y-6 animate-fadeIn">
          {/* Episodes */}
          {results.episodes.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-textMuted/40" />
                <h2 className="text-xs font-semibold text-textMuted/50 uppercase tracking-wider">
                  Episodes ({results.episodes.length})
                </h2>
              </div>
              <div className="bg-card border border-cardBorder rounded-xl overflow-hidden divide-y divide-cardBorder/30">
                {results.episodes.map((ep: any) => (
                  <Link
                    key={ep.id || ep.episodeId}
                    to={`/dashboard/${selectedProject}/episodes/${ep.id || ep.episodeId}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ep.status === 'open' ? 'bg-emerald-400' : 'bg-textMuted/30'}`} />
                      <div className="min-w-0">
                        <p className="text-sm text-textPrimary font-medium truncate group-hover:text-primary transition-colors">
                          {ep.label || 'Untitled Episode'}
                        </p>
                        <p className="text-[11px] text-textMuted/50 mt-0.5">
                          {ep.branchName} · {ep.callCount ?? 0} calls
                        </p>
                      </div>
                    </div>
                    {ep.branchName && <Badge text={ep.branchName} variant="branch" />}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Calls */}
          {filteredCalls.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-textMuted/40" />
                <h2 className="text-xs font-semibold text-textMuted/50 uppercase tracking-wider">
                  AI Calls ({filteredCalls.length})
                </h2>
              </div>
              <div className="bg-card border border-cardBorder rounded-xl overflow-hidden divide-y divide-cardBorder/30">
                {filteredCalls.map((call: any) => (
                  <Link
                    key={call.id || call.callId}
                    to={`/dashboard/${selectedProject}/episodes/${call.episodeId}`}
                    className="block px-4 py-3 hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs text-primary/80 font-mono">{call.intentTag || call.source || 'call'}</p>
                      {call.activeFilePath && (
                        <span className="text-[10px] text-textMuted/40 font-mono truncate">{call.activeFilePath}</span>
                      )}
                    </div>
                    <p className="text-sm text-textMuted truncate group-hover:text-textPrimary transition-colors">
                      {call.promptText?.slice(0, 120) || 'No prompt text'}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* No results */}
          {results.episodes.length === 0 && filteredCalls.length === 0 && (
            <EmptyState
              title="No results found"
              description={`No episodes or calls matching "${query}" were found in this project.`}
              variant="search"
            />
          )}
        </div>
      )}
    </div>
  )
}
