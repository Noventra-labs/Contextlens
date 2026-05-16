import { memo } from 'react'
import { Link } from 'react-router-dom'
import { GitBranch } from 'lucide-react'
import type { RecentEpisode } from '../../lib/firestoreHooks'
import { Badge } from '../ui/Badge'
import { timeAgo } from '../../lib/utils'

interface RecentEpisodeItemProps {
  episode: RecentEpisode
  isFirst: boolean
}

export const RecentEpisodeItem = memo(function RecentEpisodeItem({ episode, isFirst }: RecentEpisodeItemProps) {
  return (
    <Link
      to={`/dashboard/${episode.projectId}/episodes/${episode.id}`}
      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-800/20 transition-colors ${
        !isFirst ? 'border-t border-cardBorder' : ''
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-textPrimary truncate">{episode.label}</p>
        <p className="text-xs text-textMuted">{episode.projectName}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1 text-xs text-textMuted">
          <GitBranch className="w-3 h-3" />
          <span>{episode.branchName}</span>
        </div>
        <Badge text={episode.status} variant={episode.status === 'active' ? 'status-active' : 'status-closed'} />
        <span className="text-xs text-textMuted">{timeAgo(episode.startedAt)}</span>
      </div>
    </Link>
  )
})
