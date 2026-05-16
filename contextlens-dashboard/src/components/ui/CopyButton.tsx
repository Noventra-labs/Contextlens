import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { copyToClipboard } from '../../lib/utils'
import { useToast } from '../../context/ToastContext'

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
}

export function CopyButton({ text, label, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  const { addToast } = useToast()

  const handleCopy = async () => {
    try {
      await copyToClipboard(text)
      setCopied(true)
      addToast('Copied to clipboard', 'success', 2000)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      addToast('Failed to copy', 'error')
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-cardBorder text-textMuted hover:text-textPrimary hover:border-primary/50 transition-all ${className}`}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-green-400" />
          <span className="text-green-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          {label && <span>{label}</span>}
        </>
      )}
    </button>
  )
}
