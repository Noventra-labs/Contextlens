import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { GithubAuthProvider, GoogleAuthProvider, type AuthCredential } from 'firebase/auth'

export function LoginPage() {
  const { user, signInWithGoogle, signInWithGithub, fetchProviders, linkAccount } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'github' | null>(null)
  const [pendingCred, setPendingCred] = useState<AuthCredential | null>(null)
  const [suggestedProvider, setSuggestedProvider] = useState<string | null>(null)

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  const handleGoogleSignIn = async () => {
    setLoadingProvider('google')
    setError(null)
    try {
      await signInWithGoogle()
      if (pendingCred) {
        await linkAccount(pendingCred)
        setPendingCred(null)
        setSuggestedProvider(null)
      }
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      if (err.code !== 'auth/account-exists-with-different-credential') {
        console.error('Google Sign-In Error:', err)
      }
      if (err.code === 'auth/popup-blocked') {
        setError('Sign-in popup was blocked by your browser. Please allow popups for this site.')
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        const cred = GoogleAuthProvider.credentialFromError(err)
        if (cred) setPendingCred(cred)
        const email = err.customData?.email
        if (email) {
          const providers = await fetchProviders(email)
          if (providers.length > 0) setSuggestedProvider(providers[0])
        }
        setError('An account already exists with this email. Please sign in with your other provider to link them.')
      } else {
        setError(err.message || 'Google sign-in failed. Please try again.')
      }
    } finally {
      setLoadingProvider(null)
    }
  }

  const handleGithubSignIn = async () => {
    setLoadingProvider('github')
    setError(null)
    try {
      await signInWithGithub()
      if (pendingCred) {
        await linkAccount(pendingCred)
        setPendingCred(null)
        setSuggestedProvider(null)
      }
      navigate('/dashboard', { replace: true })
    } catch (err: any) {
      if (err.code !== 'auth/account-exists-with-different-credential') {
        console.error('GitHub Sign-In Error:', err)
      }
      if (err.code === 'auth/operation-not-allowed') {
        setError('GitHub sign-in is not enabled in Firebase Console. Please enable it under Authentication > Sign-in method.')
      } else if (err.code === 'auth/account-exists-with-different-credential') {
        const cred = GithubAuthProvider.credentialFromError(err)
        if (cred) setPendingCred(cred)
        const email = err.customData?.email
        if (email) {
          const providers = await fetchProviders(email)
          if (providers.length > 0) setSuggestedProvider(providers[0])
        }
        setError('An account already exists with this email via another provider. Sign in with your existing provider to link your GitHub account.')
      } else if (err.code === 'auth/popup-blocked') {
        setError('Sign-in popup was blocked by your browser. Please allow popups for this site.')
      } else {
        setError(err.message || 'GitHub sign-in failed. Please try again.')
      }
    } finally {
      setLoadingProvider(null)
    }
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-4">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-sm w-full">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="16" cy="16" r="15" fill="#161b22" stroke="#4f98a3" strokeWidth="1.5" />
              <ellipse cx="16" cy="16" rx="10" ry="6" stroke="#4f98a3" strokeWidth="1.5" />
              <circle cx="16" cy="16" r="3.5" fill="#4f98a3" />
              <circle cx="16" cy="16" r="1.5" fill="#0d1117" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-textPrimary">ContextLens</h1>
            <p className="text-sm text-textMuted">AI workflow memory for developers</p>
          </div>
        </div>

        {/* Card */}
        <div className="w-full bg-card border border-cardBorder rounded-xl p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-textPrimary mb-2 text-center">
            Sign in to continue
          </h2>
          <p className="text-sm text-textMuted text-center mb-6">
            Access your coding sessions, episodes, and AI-powered insights.
          </p>

          <div className="space-y-3">
            <button
              id="google-sign-in"
              onClick={handleGoogleSignIn}
              disabled={loadingProvider !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg bg-[#fff] hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed text-[#1f1f1f] font-medium transition-all text-sm shadow-md"
            >
              {loadingProvider === 'google' ? (
                <div className="w-4 h-4 border-2 border-[#4285F4] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              {loadingProvider === 'google' ? 'Signing in...' : 'Sign in with Google'}
            </button>

            <button
              id="github-sign-in"
              onClick={handleGithubSignIn}
              disabled={loadingProvider !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg bg-[#24292e] hover:bg-[#2c3238] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium transition-all text-sm shadow-md"
            >
              {loadingProvider === 'github' ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
              )}
              {loadingProvider === 'github' ? 'Signing in...' : 'Sign in with GitHub'}
            </button>

          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-400/10 border border-red-400/20 rounded-lg">
              <p className="text-xs text-red-400 text-center">{error}</p>
              {suggestedProvider && (
                <p className="mt-2 text-[10px] text-textMuted text-center uppercase tracking-wider font-semibold">
                  Suggested: Sign in with {suggestedProvider.split('.')[0]}
                </p>
              )}
            </div>
          )}

          <p className="mt-6 text-xs text-textMuted text-center">
            Your data is private. Only you can see your episodes.
          </p>
        </div>
      </div>
    </div>
  )
}
