import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useEpisode, useCalls } from '../lib/firestoreHooks'
import { explainDiff } from '../lib/api'
import { ExplainDiffCard } from '../components/ai/ExplainDiffCard'
import { CallItem } from '../components/episodes/CallItem'
import { Badge } from '../components/ui/Badge'
import { SkeletonCard } from '../components/ui/SkeletonCard'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { Spinner } from '../components/ui/Spinner'
import { formatDate, timeDuration, timeAgo } from '../lib/utils'
import type { ExplainDiffResult } from '../types'

export function EpisodeDetailPage() {
  const { projectId, episodeId } = useParams<{ projectId: string; episodeId: string }>()
  const { user } = useAuth()

  const { data: episode, loading: epLoading, error: epError } = useEpisode(
    user?.uid ?? '',
    projectId ?? '',
    episodeId ?? '',
  )
  const { data: calls, loading: callsLoading } = useCalls(
    user?.uid ?? '',
    projectId ?? '',
    episodeId ?? '',
    !!episodeId,
  )

  // Explain Diff state
  const [explainResult, setExplainResult] = useState<ExplainDiffResult | null>(null)
  const [explainLoading, setExplainLoading] = useState(false)
  const [explainError, setExplainError] = useState<string | null>(null)

  const handleExplainDiff = async () => {
    if (!projectId || !episodeId) return
    setExplainLoading(true)
    setExplainError(null)
    try {
      const result = await explainDiff(projectId, episodeId)
      setExplainResult(result)
    } catch (err) {
      setExplainError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setExplainLoading(false)
    }
  }

  if (epLoading) {
    return (
      <div className="max-w-3xl space-y-3">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </div>
    )
  }

  if (epError) return <ErrorMessage message={epError} />
  if (!episode) {
    return <ErrorMessage message="Episode not found." />
  }

  // Check if explainDiff is cached in Firestore
  const cachedExplain = episode.explainDiffSummary
    ? {
        summary: episode.explainDiffSummary,
        risks: episode.explainDiffRisks,
        checks: episode.explainDiffChecks,
      }
    : null

  const activeResult = explainResult ?? cachedExplain

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-textPrimary mb-3">{episode.label}</h1>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge text={episode.branchName} variant="branch" />
          <Badge
            text={episode.status}
            variant={episode.status === 'active' ? 'status-active' : 'status-closed'}
          />
          <span className="text-xs text-textMuted">
            {episode.callCount} AI call{episode.callCount !== 1 ? 's' : ''}
          </span>
        </div>
        <p className="text-xs text-textMuted">
          Started {formatDate(episode.startedAt)}
          {episode.endedAt
            ? ` · Closed ${timeDuration(episode.startedAt, episode.endedAt)} later`
            : ` · Active since ${timeAgo(episode.startedAt)}`}
        </p>
        {episode.manualNotes && (
          <p className="mt-2 text-sm text-textMuted italic border-l-2 border-cardBorder pl-3">
            {episode.manualNotes}
          </p>
        )}

        {/* Changed files */}
        {episode.changedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {episode.changedFiles.map((f) => (
              <Badge key={f} text={f} variant="file" />
            ))}
          </div>
        )}
      </div>

      {/* Explain Diff section */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-semibold text-textMuted uppercase tracking-wider">
            Explain Diff
          </h2>
          {!activeResult && !explainLoading && (
            <button
              id="explain-diff-btn"
              onClick={handleExplainDiff}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary hover:bg-primaryLight text-white text-xs font-medium transition-colors shadow-lg shadow-primary/20"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Explain Diff
            </button>
          )}
        </div>

        {(activeResult || explainLoading || explainError) && (
          <ExplainDiffCard
            result={activeResult}
            loading={explainLoading}
            error={explainError}
            onRetry={handleExplainDiff}
          />
        )}

        {!activeResult && !explainLoading && !explainError && (
          <p className="text-xs text-textMuted">
            Click "Explain Diff" to get an AI-powered analysis of this episode's changes.
          </p>
        )}
      </section>

      {/* AI Calls section */}
      <section>
        <h2 className="text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-3">
          AI Calls ({episode.callCount})
        </h2>

        {callsLoading ? (
          <div className="space-y-2">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        ) : calls.length === 0 ? (
          <p className="text-xs text-textMuted">No calls recorded for this episode.</p>
        ) : (
          <div className="space-y-2">
            {calls.map((call) => (
              <CallItem key={call.id} call={call} />
            ))}
          </div>
        )}

        {explainLoading && (
          <div className="flex items-center gap-2 mt-4">
            <Spinner size="sm" />
            <span className="text-xs text-textMuted">Loading...</span>
          </div>
        )}
      </section>
    </div>
  )
}
