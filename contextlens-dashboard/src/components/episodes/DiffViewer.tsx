import { useState } from 'react'
import ReactDiffViewer from 'react-diff-viewer-continued'
import { countDiffLines } from '../../lib/utils'
import { useTheme } from '../../context/ThemeContext'

interface DiffViewerProps {
  diff: string
}

function parseDiff(diff: string): { oldValue: string; newValue: string } {
  const lines = diff.split('\n')
  const oldLines: string[] = []
  const newLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) {
      continue
    }
    if (line.startsWith('-')) {
      oldLines.push(line.slice(1))
    } else if (line.startsWith('+')) {
      newLines.push(line.slice(1))
    } else {
      const content = line.startsWith(' ') ? line.slice(1) : line
      oldLines.push(content)
      newLines.push(content)
    }
  }

  return { oldValue: oldLines.join('\n'), newValue: newLines.join('\n') }
}

export function DiffViewer({ diff }: DiffViewerProps) {
  const [showDiff, setShowDiff] = useState(false)
  const { resolvedTheme } = useTheme()
  const lineCount = countDiffLines(diff)
  const isLong = lineCount > 30

  if (!diff) return null

  return (
    <div>
      <p className="text-[10px] font-semibold text-textMuted uppercase tracking-wider mb-1">
        Diff
      </p>
      <div className="rounded-md border border-cardBorder overflow-hidden">
        {isLong && !showDiff ? (
          <button
            onClick={() => setShowDiff(true)}
            className="w-full px-3 py-2 text-xs text-textMuted hover:text-primary hover:bg-gray-800/30 transition-colors text-left"
          >
            Show diff ({lineCount} lines) ↓
          </button>
        ) : (
          <div className="text-xs overflow-x-auto">
            <ReactDiffViewer
              {...parseDiff(diff)}
              splitView={false}
              useDarkTheme={resolvedTheme === 'dark'}
              hideLineNumbers={false}
              styles={{
                variables: {
                  dark: {
                    diffViewerBackground: '#161b22',
                    addedBackground: '#1a4023',
                    addedColor: '#3fb950',
                    removedBackground: '#4a1a1a',
                    removedColor: '#f85149',
                    wordAddedBackground: '#2d6a33',
                    wordRemovedBackground: '#6b2525',
                    emptyLineBackground: '#161b22',
                    gutterBackground: '#0d1117',
                    gutterBackgroundDark: '#0d1117',
                    gutterColor: '#8b949e',
                  },
                },
              }}
            />
            {isLong && (
              <button
                onClick={() => setShowDiff(false)}
                className="w-full px-3 py-1 text-[11px] text-textMuted hover:text-primary border-t border-cardBorder transition-colors"
              >
                Collapse diff
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
