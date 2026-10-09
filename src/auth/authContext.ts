import { createContext } from 'react'
import type { AuthUser } from './api'

export type AuthContextValue = {
  status: 'loading' | 'authenticated' | 'anonymous' | 'error'
  user: AuthUser | null
  error: string
  signIn: (action: 'login' | 'register', username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
