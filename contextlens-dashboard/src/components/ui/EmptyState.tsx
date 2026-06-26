import { type ReactNode } from 'react'
import { Inbox, FolderOpen, Zap, Search, GitBranch, type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  ctaLabel?: string
  ctaHref?: string
  ctaOnClick?: () => void
  icon?: LucideIcon
  variant?: 'default' | 'projects' | 'episodes' | 'search' | 'branches'
  children?: ReactNode
}

const VARIANT_ICONS: Record<string, LucideIcon> = {
  default: Inbox,
  projects: FolderOpen,
  episodes: Zap,
  search: Search,
  branches: GitBranch,
}

const VARIANT_HINTS: Record<string, string[]> = {
  projects: [
    '1. Install the ContextLens VS Code extension',
    '2. Open any git project in VS Code',
    '3. ContextLens auto-detects and creates a project',
  ],
  episodes: [
    'Episodes are created automatically when you:',
    '• Switch branches in VS Code',
    '• Make git commits',
    '• Start a new coding session',
  ],
  search: [
    'Try different keywords or remove filters',
  ],
}

export function EmptyState({
  title,
  description,
  ctaLabel,
  ctaHref,
  ctaOnClick,
  icon,
  variant = 'default',
  children,
}: EmptyStateProps) {
  const Icon = icon || VARIANT_ICONS[variant] || Inbox
  const hints = VARIANT_HINTS[variant]

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fadeIn">
      {/* Animated icon container */}
      <div className="relative mb-6">
        <div className="absolute inset-0 rounded-2xl bg-primary/10 blur-xl animate-pulse" />
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/15 flex items-center justify-center">
          <Icon className="w-7 h-7 text-primary/70" />
        </div>
      </div>

      <h3 className="text-base font-semibold text-textPrimary mb-2">{title}</h3>

      {description && (
        <p className="text-sm text-textMuted max-w-sm leading-relaxed mb-3">{description}</p>
      )}

      {/* Step-by-step hints for specific variants */}
      {hints && (
        <div className="mt-2 mb-4 text-left max-w-xs">
          {hints.map((hint, i) => (
            <p key={i} className="text-xs text-textMuted/70 leading-relaxed py-0.5">
              {hint}
            </p>
          ))}
        </div>
      )}

      {children}

      {ctaLabel && (ctaHref || ctaOnClick) && (
        ctaHref ? (
          <a
            href={ctaHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-bold
                       hover:brightness-110 active:scale-[0.97]
                       transition-all duration-150 shadow-lg shadow-primary/20"
          >
            {ctaLabel}
          </a>
        ) : (
          <button
            onClick={ctaOnClick}
            className="mt-4 inline-flex items-center px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-bold
                       hover:brightness-110 active:scale-[0.97]
                       transition-all duration-150 shadow-lg shadow-primary/20"
          >
            {ctaLabel}
          </button>
        )
      )}
    </div>
  )
}
