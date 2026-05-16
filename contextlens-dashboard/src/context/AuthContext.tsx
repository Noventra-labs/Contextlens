import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  signOut as firebaseSignOut,
  fetchSignInMethodsForEmail,
  linkWithCredential,
  type User,
  type AuthCredential,
} from 'firebase/auth'
import { auth } from '../lib/firebase'


interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<any>
  signInWithGithub: () => Promise<any>
  signOut: () => Promise<void>
  fetchProviders: (email: string) => Promise<string[]>
  linkAccount: (credential: AuthCredential) => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider()
    return await signInWithPopup(auth, provider)
  }, [])

  const signInWithGithub = useCallback(async () => {
    const provider = new GithubAuthProvider()
    return await signInWithPopup(auth, provider)
  }, [])

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth)
  }, [])

  const fetchProviders = useCallback(async (email: string) => {
    return await fetchSignInMethodsForEmail(auth, email)
  }, [])

  const linkAccount = useCallback(async (credential: AuthCredential) => {
    if (!auth.currentUser) throw new Error('No user signed in to link account to')
    await linkWithCredential(auth.currentUser, credential)
  }, [])

  // Memoize value to prevent unnecessary re-renders of all auth consumers
  const value = useMemo(
    () => ({ user, loading, signInWithGoogle, signInWithGithub, signOut, fetchProviders, linkAccount }),
    [user, loading, signInWithGoogle, signInWithGithub, signOut, fetchProviders, linkAccount]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
