import { useState, memo } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Call } from '../../types'
import { Badge } from '../ui/Badge'
import { DiffViewer } from './DiffViewer'
import { timeAgo } from '../../lib/utils'

interface CallItemProps {
  call: Call
}

const CollapsibleText = memo(function CollapsibleText({
  text,
  label,
}: {
  text: string
  label: string
}) {
  const [expanded, setExpanded] = useState(false)
  const lines = text.split('\n')
  const isLong = lines.length > 3 || text.length > 300

  return (
    <div>
      <p className="text-[10px] font-semibold text-textMuted uppercase tracking-wider mb-1">
        {label}
      </p>
      <div
        className={`font-mono text-xs text-textMuted bg-surface rounded p-2 ${
          !expanded && isLong ? 'max-h-16 overflow-hidden' : ''
        }`}
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      >
        {text || <span className="italic">empty</span>}
      </div>
      {isLong && (
        <button
          onClick={() => setExpanded((p) => !p)}
          className="text-[11px] text-primary hover:text-primaryLight mt-1 transition-colors"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
})

export const CallItem = memo(function CallItem({ call }: CallItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const statusColor =
    call.status === 'success'
      ? 'bg-green-400'
      : call.status === 'failed'
      ? 'bg-red-400'
      : 'bg-gray-500'

  return (
    <div className="rounded-md border border-cardBorder bg-surface overflow-hidden">
      {/* Collapsed row */}
      <button
        onClick={() => setIsExpanded((p) => !p)}
        className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-gray-800/20 transition-colors"
        aria-expanded={isExpanded}
      >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${statusColor}`} />
        <ChevronDown
          className={`w-3.5 h-3.5 text-textMuted flex-shrink-0 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
        <span className="text-xs font-semibold text-textPrimary truncate flex-1">
          {call.intentTag || <span className="text-textMuted italic">No intent</span>}
        </span>
        {call.activeFilePath && (
          <Badge text={call.activeFilePath.split('/').pop() ?? call.activeFilePath} variant="file" />
        )}
        <span className="text-[11px] text-textMuted flex-shrink-0">{timeAgo(call.createdAt)}</span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-cardBorder px-3 py-3 space-y-3">
          {/* Files row */}
          <div className="flex flex-wrap gap-1.5">
            {call.activeFilePath && (
              <Badge text={call.activeFilePath} variant="file" />
            )}
            {call.relatedFiles.map((f) => (
              <span
                key={f}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-gray-800/40 text-gray-400 border border-gray-700/30"
              >
                {f}
              </span>
            ))}
          </div>

          {/* TODOs */}
          {call.todoMatches.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {call.todoMatches.map((todo, i) => (
                <span
                  key={i}
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-orange-900/40 text-orange-300 border border-orange-700/40"
                >
                  TODO: {todo}
                </span>
              ))}
            </div>
          )}

          {/* Prompt */}
          {call.promptText && (
            <CollapsibleText text={call.promptText} label="Prompt" />
          )}

          {/* Response */}
          {call.modelResponse && (
            <CollapsibleText text={call.modelResponse} label="Response" />
          )}

          {/* Diff */}
          {call.diffSnapshot && (
            <DiffViewer diff={call.diffSnapshot} />
          )}

          {/* Metadata footer */}
          <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-cardBorder/50">
            <span className="text-[11px] text-textMuted font-mono">
              {call.latencyMs}ms
            </span>
            <span className="text-[11px] text-textMuted font-mono">
              {call.tokenUsage.input} in · {call.tokenUsage.output} out
            </span>
            <span className="text-[11px] text-textMuted font-mono">
              {call.modelName}
            </span>
          </div>
        </div>
      )}
    </div>
  )
})
