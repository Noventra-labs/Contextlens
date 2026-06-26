import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Sparkles, Clock, FileCode, Zap, Download, Coins } from 'lucide-react'
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

  // ENH-009: Aggregate token usage across all calls
  const tokenStats = useMemo(() => {
    if (!calls.length) return null
    let totalInput = 0
    let totalOutput = 0
    for (const call of calls) {
      totalInput += call.tokenUsage?.input || 0
      totalOutput += call.tokenUsage?.output || 0
    }
    const total = totalInput + totalOutput
    // Rough cost estimate: Gemini 1.5 Pro pricing ~$1.25/1M input, ~$5/1M output
    const estimatedCost = (totalInput / 1_000_000) * 1.25 + (totalOutput / 1_000_000) * 5
    return { totalInput, totalOutput, total, estimatedCost }
  }, [calls])

  // ENH-010: Export episode to Markdown
  const handleExport = () => {
    if (!episode) return
    const lines: string[] = [
      `# Episode: ${episode.label}`,
      '',
      `**Branch:** ${episode.branchName}`,
      `**Status:** ${episode.status}`,
      `**Started:** ${formatDate(episode.startedAt)}`,
      episode.endedAt ? `**Ended:** ${formatDate(episode.endedAt)}` : '**Ended:** Still active',
      episode.endedAt ? `**Duration:** ${timeDuration(episode.startedAt, episode.endedAt)}` : '',
      `**AI Calls:** ${episode.callCount}`,
      '',
    ]

    if (episode.changedFiles.length > 0) {
      lines.push('## Changed Files', '', ...episode.changedFiles.map(f => `- \`${f}\``), '')
    }

    if (episode.manualNotes) {
      lines.push('## Notes', '', episode.manualNotes, '')
    }

    if (calls.length > 0) {
      lines.push('## AI Calls', '')
      for (const call of calls) {
        lines.push(`### ${call.intentTag || call.source || 'Call'} — ${formatDate(call.createdAt)}`)
        lines.push('')
        if (call.promptText) lines.push('**Prompt:**', '```', call.promptText, '```', '')
        if (call.modelResponse) lines.push('**Response:**', '```', call.modelResponse, '```', '')
        if (call.diffSnapshot) lines.push('**Diff:**', '```diff', call.diffSnapshot, '```', '')
        lines.push(`*Model: ${call.modelName} · ${call.latencyMs}ms · ${call.tokenUsage?.input || 0} in / ${call.tokenUsage?.output || 0} out*`, '')
        lines.push('---', '')
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `episode-${episode.label?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || episodeId}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (epLoading) {
    return (
      <div className="max-w-3xl space-y-3 page-enter">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
      </div>
    )
  }

  if (epError) return <ErrorMessage message={epError} />
  if (!episode) return <ErrorMessage message="Episode not found." />

  const cachedExplain = episode.explainDiffSummary
    ? {
        summary: episode.explainDiffSummary,
        risks: episode.explainDiffRisks,
        checks: episode.explainDiffChecks,
      }
    : null

  const activeResult = explainResult ?? cachedExplain

  return (
    <div className="max-w-3xl page-enter">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-textPrimary mb-3">{episode.label}</h1>
          {/* ENH-010: Export to Markdown */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cardBorder text-xs text-textMuted/60 font-semibold
                       hover:text-primary hover:border-primary/30 hover:bg-primary/5
                       active:scale-[0.97] transition-all duration-150"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge text={episode.branchName} variant="branch" />
          <Badge
            text={episode.status}
            variant={episode.status === 'active' ? 'status-active' : 'status-closed'}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-textMuted/50">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            <span className="tabular-nums">{episode.callCount}</span> call{episode.callCount !== 1 ? 's' : ''}
          </span>
          <div className="w-1 h-1 rounded-full bg-textMuted/20" />
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(episode.startedAt)}
          </span>
          {episode.endedAt && (
            <>
              <div className="w-1 h-1 rounded-full bg-textMuted/20" />
              <span>{timeDuration(episode.startedAt, episode.endedAt)}</span>
            </>
          )}
          {!episode.endedAt && (
            <>
              <div className="w-1 h-1 rounded-full bg-textMuted/20" />
              <span>Active {timeAgo(episode.startedAt)}</span>
            </>
          )}
          {/* ENH-009: Token usage stats */}
          {tokenStats && tokenStats.total > 0 && (
            <>
              <div className="w-1 h-1 rounded-full bg-textMuted/20" />
              <span className="flex items-center gap-1">
                <Coins className="w-3 h-3" />
                <span className="tabular-nums">{tokenStats.total.toLocaleString()}</span> tokens
                {tokenStats.estimatedCost > 0.001 && (
                  <span className="text-primary/60">~${tokenStats.estimatedCost.toFixed(3)}</span>
                )}
              </span>
            </>
          )}
        </div>

        {episode.manualNotes && (
          <p className="mt-3 text-sm text-textMuted/60 italic border-l-2 border-primary/30 pl-3">
            {episode.manualNotes}
          </p>
        )}

        {/* Changed files */}
        {episode.changedFiles.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-1.5 mb-2">
              <FileCode className="w-3 h-3 text-textMuted/40" />
              <span className="text-[10px] font-semibold text-textMuted/40 uppercase tracking-wider">
                Changed Files
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {episode.changedFiles.map((f) => (
                <Badge key={f} text={f} variant="file" />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Explain Diff section */}
      <section className="mb-8 animate-fadeIn" style={{ animationDelay: '60ms' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-semibold text-textMuted/50 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Explain Diff
          </h2>
          {!activeResult && !explainLoading && (
            <button
              id="explain-diff-btn"
              onClick={handleExplainDiff}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-black text-xs font-bold
                         hover:brightness-110 active:scale-[0.97]
                         transition-all duration-150 shadow-lg shadow-primary/20"
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
          <p className="text-xs text-textMuted/40">
            Click "Explain Diff" to get an AI-powered analysis of this episode's changes.
          </p>
        )}
      </section>

      {/* AI Calls section */}
      <section className="animate-fadeIn" style={{ animationDelay: '120ms' }}>
        <h2 className="text-[11px] font-semibold text-textMuted/50 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          AI Calls
          <span className="text-textMuted/30 tabular-nums">({episode.callCount})</span>
        </h2>

        {callsLoading ? (
          <div className="space-y-2">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </div>
        ) : calls.length === 0 ? (
          <p className="text-xs text-textMuted/40 py-4">No calls recorded for this episode.</p>
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
            <span className="text-xs text-textMuted/40">Analyzing…</span>
          </div>
        )}
      </section>
    </div>
  )
}
