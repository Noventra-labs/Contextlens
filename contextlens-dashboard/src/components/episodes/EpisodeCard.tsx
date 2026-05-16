import { useState, memo, useCallback } from 'react'
import { ChevronDown, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Episode } from '../../types'
import { Badge } from '../ui/Badge'
import { SkeletonCard } from '../ui/SkeletonCard'
import { ErrorMessage } from '../ui/ErrorMessage'
import { CallItem } from './CallItem'
import { ExplainDiffCard } from '../ai/ExplainDiffCard'
import { useCalls } from '../../lib/firestoreHooks'
import { timeAgo, formatDate } from '../../lib/utils'

interface EpisodeCardProps {
  episode: Episode
  projectId: string
  uid: string
}

export const EpisodeCard = memo(function EpisodeCard({ episode, projectId, uid }: EpisodeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [fetchEnabled, setFetchEnabled] = useState(false)
  const navigate = useNavigate()

  const { data: calls, loading: callsLoading, error: callsError } = useCalls(
    uid,
    projectId,
    episode.id,
    fetchEnabled,
  )

  const handleToggle = useCallback(() => {
    if (!isExpanded && !fetchEnabled) setFetchEnabled(true)
    setIsExpanded((p) => !p)
  }, [isExpanded, fetchEnabled])

  const handleOpenDetail = useCallback(() => {
    navigate(`/dashboard/${projectId}/episodes/${episode.id}`)
  }, [navigate, projectId, episode.id])

  const statusVariant = episode.status === 'active' ? 'status-active' : 'status-closed'

  return (
    <div className="rounded-lg bg-card border border-cardBorder hover:border-primary/30 transition-colors overflow-hidden">
      {/* Collapsed header — always visible */}
      <button
        onClick={handleToggle}
        className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-800/20 transition-colors"
        aria-expanded={isExpanded}
      >
        <ChevronDown
          className={`w-4 h-4 text-textMuted mt-0.5 flex-shrink-0 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-textPrimary truncate">{episode.label}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <Badge text={episode.branchName} variant="branch" />
            <Badge text={episode.status} variant={statusVariant} />
            <span className="text-xs text-textMuted">{episode.callCount} calls</span>
            {episode.changedFiles.length > 0 && (
              <span className="text-xs text-textMuted">
                · {episode.changedFiles.length} file{episode.changedFiles.length !== 1 ? 's' : ''} changed
              </span>
            )}
          </div>
        </div>
        <div className="text-xs text-textMuted flex-shrink-0 text-right">
          <p>{timeAgo(episode.startedAt)}</p>
          {episode.endedAt && (
            <p className="text-[10px] mt-0.5">
              {formatDate(episode.startedAt).split(',')[0]}
            </p>
          )}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-cardBorder">
          {/* ExplainDiff if already cached */}
          {episode.explainDiffSummary && (
            <div className="px-4 py-3 border-b border-cardBorder">
              <ExplainDiffCard
                result={{
                  summary: episode.explainDiffSummary,
                  risks: episode.explainDiffRisks,
                  checks: episode.explainDiffChecks,
                }}
                loading={false}
                error={null}
              />
            </div>
          )}

          {/* AI Calls */}
          <div className="px-4 py-3">
            <p className="text-[10px] font-semibold text-textMuted uppercase tracking-wider mb-2">
              AI Calls
            </p>
            {callsLoading && (
              <div className="space-y-2">
                <SkeletonCard lines={2} />
                <SkeletonCard lines={2} />
              </div>
            )}
            {callsError && <ErrorMessage message={callsError} />}
            {!callsLoading && !callsError && calls.length === 0 && (
              <p className="text-xs text-textMuted">No calls recorded yet.</p>
            )}
            {!callsLoading && calls.length > 0 && (
              <div className="space-y-2">
                {calls.map((call) => (
                  <CallItem key={call.id} call={call} />
                ))}
              </div>
            )}
          </div>

          {/* Open full detail link */}
          <div className="px-4 pb-3">
            <button
              onClick={handleOpenDetail}
              className="flex items-center gap-1 text-xs text-primary hover:text-primaryLight transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Full Detail
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
