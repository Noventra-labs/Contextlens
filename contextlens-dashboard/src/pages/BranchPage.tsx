import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { GitBranch, Sparkles } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useEpisodesByBranch } from '../lib/firestoreHooks'
import { branchSummary } from '../lib/api'
import { BranchSummaryCard } from '../components/ai/BranchSummaryCard'
import { EpisodeTimeline } from '../components/episodes/EpisodeTimeline'
import { SkeletonCard } from '../components/ui/SkeletonCard'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import type { BranchSummaryResult } from '../types'

export function BranchPage() {
  const { projectId, branchName } = useParams<{ projectId: string; branchName: string }>()
  const { user } = useAuth()

  const decodedBranch = decodeURIComponent(branchName ?? '')

  const {
    data: episodes,
    loading: epLoading,
    error: epError,
  } = useEpisodesByBranch(user?.uid ?? '', projectId ?? '', decodedBranch)

  const [summaryResult, setSummaryResult] = useState<BranchSummaryResult | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  const handleSummarizeBranch = async () => {
    if (!projectId || !decodedBranch) return
    setSummaryLoading(true)
    setSummaryError(null)
    try {
      const result = await branchSummary(projectId, decodedBranch)
      setSummaryResult(result)
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSummaryLoading(false)
    }
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <GitBranch className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-textPrimary font-mono">{decodedBranch}</h1>
        </div>
        <p className="text-xs text-textMuted">
          {episodes.length} episode{episodes.length !== 1 ? 's' : ''} on this branch
        </p>
      </div>

      {/* Summarize Branch button */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-semibold text-textMuted uppercase tracking-wider">
            Branch Summary
          </h2>
          {!summaryResult && !summaryLoading && (
            <button
              id="summarize-branch-btn"
              onClick={handleSummarizeBranch}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary hover:bg-primaryLight text-white text-sm font-medium transition-colors shadow-lg shadow-primary/20"
            >
              <Sparkles className="w-4 h-4" />
              Summarize Branch
            </button>
          )}
          {summaryLoading && !summaryResult && (
            <button
              disabled
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary/60 text-white text-sm font-medium cursor-not-allowed"
            >
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating...
            </button>
          )}
        </div>

        {(summaryResult || summaryLoading || summaryError) && (
          <BranchSummaryCard
            result={summaryResult}
            loading={summaryLoading}
            error={summaryError}
            onRetry={handleSummarizeBranch}
          />
        )}

        {!summaryResult && !summaryLoading && !summaryError && (
          <p className="text-xs text-textMuted">
            Generate an AI-powered PR summary for all episodes on this branch.
          </p>
        )}
      </section>

      {/* Episodes on branch */}
      <section>
        <h2 className="text-[11px] font-semibold text-textMuted uppercase tracking-wider mb-3">
          Episodes on this branch
        </h2>

        {epLoading ? (
          <div className="space-y-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : epError ? (
          <ErrorMessage message={epError} />
        ) : episodes.length === 0 ? (
          <EmptyState
            title="No episodes on this branch"
            description="Episodes will appear here as you code on this branch."
          />
        ) : (
          <EpisodeTimeline
            episodes={episodes}
            projectId={projectId ?? ''}
            uid={user?.uid ?? ''}
          />
        )}
      </section>
    </div>
  )
}
