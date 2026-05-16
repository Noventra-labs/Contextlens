import { memo } from 'react'
import { Link } from 'react-router-dom'
import { Folder, ExternalLink } from 'lucide-react'
import type { Project } from '../../types'
import { Badge } from '../ui/Badge'
import { timeAgo } from '../../lib/utils'

interface ProjectCardProps {
  project: Project
}

export const ProjectCard = memo(function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      to={`/dashboard/${project.id}`}
      className="block bg-card border border-cardBorder rounded-lg p-4 hover:border-primary/50 hover:bg-gray-800/20 transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-primary flex-shrink-0" />
          <h3 className="text-sm font-semibold text-textPrimary group-hover:text-primary transition-colors">
            {project.name}
          </h3>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-textMuted opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      {project.repoUrl && (
        <p className="text-xs text-textMuted font-mono truncate mb-2">
          {project.repoUrl.replace('https://github.com/', '')}
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge text={project.defaultBranch} variant="branch" />
        <span className="text-xs text-textMuted">
          Updated {timeAgo(project.updatedAt)}
        </span>
      </div>
    </Link>
  )
})
