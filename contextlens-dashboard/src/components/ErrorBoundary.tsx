import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCcw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-card border border-cardBorder rounded-2xl p-8 shadow-2xl">
            <div className="bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-textPrimary mb-2">Something went wrong</h2>
            <p className="text-textMuted mb-8 text-sm">
              We encountered an unexpected error. Don't worry, your data is safe in the cloud.
            </p>
            <div className="bg-background/50 rounded-lg p-4 mb-8 text-left overflow-auto max-h-32 border border-cardBorder">
              <code className="text-xs text-red-400 font-mono">
                {this.state.error?.message || 'Unknown error'}
              </code>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 w-full bg-primary hover:bg-primaryHover text-black font-semibold py-3 px-4 rounded-xl transition-all"
              >
                <RefreshCcw className="w-4 h-4" />
                Reload Page
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null })
                  window.location.href = '/'
                }}
                className="flex items-center justify-center gap-2 w-full bg-card border border-cardBorder hover:border-primary/50 text-textPrimary font-semibold py-3 px-4 rounded-xl transition-all"
              >
                <Home className="w-4 h-4" />
                Go to Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
