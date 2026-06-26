import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Episode } from '../../types'
import { formatDateShort, timeDuration } from '../../lib/utils'

interface EpisodeTimelineProps {
  episodes: Episode[]
  projectId: string
}

/**
 * ENH-007: Gantt-style visual timeline of episodes per branch.
 * Shows branches as swim lanes, episodes as bars colored by status.
 */
export function EpisodeTimeline({ episodes, projectId }: EpisodeTimelineProps) {
  const { timeRange, lanes } = useMemo(() => {
    if (episodes.length === 0) return { branches: [], timeRange: { min: 0, max: 1 }, lanes: [] }

    const branchMap = new Map<string, Episode[]>()
    for (const ep of episodes) {
      const branch = ep.branchName || 'unknown'
      if (!branchMap.has(branch)) branchMap.set(branch, [])
      branchMap.get(branch)!.push(ep)
    }

    const branches = Array.from(branchMap.keys())

    // Global time range
    const allStarts = episodes.map(e => e.startedAt.getTime())
    const allEnds = episodes.map(e => (e.endedAt || new Date()).getTime())
    const min = Math.min(...allStarts)
    const max = Math.max(...allEnds)
    const range = max - min || 1

    const lanes = branches.map(branch => ({
      branch,
      episodes: branchMap.get(branch)!.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime()),
    }))

    return { timeRange: { min, max, range }, lanes }
  }, [episodes])

  if (episodes.length === 0) return null

  const range = (timeRange as any).range || 1

  return (
    <div className="bg-card border border-cardBorder rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-cardBorder/50 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-textPrimary">Episode Timeline</h3>
        <div className="flex items-center gap-4 text-[10px] text-textMuted/50">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
            Active
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-textMuted/30" />
            Closed
          </span>
        </div>
      </div>

      {/* Lanes */}
      <div className="divide-y divide-cardBorder/30">
        {lanes.map(({ branch, episodes: branchEps }) => (
          <div key={branch} className="flex min-h-[52px]">
            {/* Branch label */}
            <div className="w-36 flex-shrink-0 px-3 py-2 flex items-center border-r border-cardBorder/30">
              <span className="text-xs text-textMuted font-mono truncate" title={branch}>
                {branch}
              </span>
            </div>

            {/* Timeline bar area */}
            <div className="flex-1 relative py-2 px-2">
              {branchEps.map((ep) => {
                const start = ep.startedAt.getTime()
                const end = (ep.endedAt || new Date()).getTime()
                const left = ((start - timeRange.min) / range) * 100
                const width = Math.max(((end - start) / range) * 100, 1.5) // min 1.5% visible

                const isOpen = ep.status === 'active'
                const duration = timeDuration(ep.startedAt, ep.endedAt || new Date())

                return (
                  <Link
                    key={ep.id}
                    to={`/dashboard/${projectId}/episodes/${ep.id}`}
                    className="absolute top-2 h-7 rounded-md group cursor-pointer transition-all duration-150 hover:brightness-125 hover:z-10"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${ep.label || 'Untitled'}\n${formatDateShort(ep.startedAt)} — ${duration}`}
                  >
                    <div
                      className={`w-full h-full rounded-md border ${
                        isOpen
                          ? 'bg-emerald-500/20 border-emerald-500/40'
                          : 'bg-textMuted/10 border-textMuted/20'
                      }`}
                    />
                    {/* Label on hover */}
                    <div className="absolute left-0 -top-6 hidden group-hover:block bg-card border border-cardBorder rounded px-2 py-0.5 text-[10px] text-textPrimary whitespace-nowrap shadow-lg z-20">
                      {ep.label || 'Untitled'} · {duration}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
