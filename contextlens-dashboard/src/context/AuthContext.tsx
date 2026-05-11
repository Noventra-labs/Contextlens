import { createContext, useContext, useEffect, useState } from 'react'
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

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    return await signInWithPopup(auth, provider)
  }

  const signInWithGithub = async () => {
    const provider = new GithubAuthProvider()
    return await signInWithPopup(auth, provider)
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  const fetchProviders = async (email: string) => {
    return await fetchSignInMethodsForEmail(auth, email)
  }

  const linkAccount = async (credential: AuthCredential) => {
    if (!auth.currentUser) throw new Error('No user signed in to link account to')
    await linkWithCredential(auth.currentUser, credential)
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, signInWithGoogle, signInWithGithub, signOut, fetchProviders, linkAccount }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
