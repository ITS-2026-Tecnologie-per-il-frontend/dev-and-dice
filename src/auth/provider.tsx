import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { authenticate, endSession, getCurrentUser, type AuthUser } from './api'
import { AuthContext } from './authContext'

type AuthState = {
  status: 'loading' | 'authenticated' | 'anonymous' | 'error'
  user: AuthUser | null
  error: string
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null, error: '' })

  const refreshUser = useCallback(async () => {
    try {
      const user = await getCurrentUser()
      setState({ status: user ? 'authenticated' : 'anonymous', user, error: '' })
    } catch (error) {
      setState({
        status: 'error',
        user: null,
        error: error instanceof Error ? error.message : 'Verifica della sessione non riuscita.',
      })
    }
  }, [])

  useEffect(() => {
    let active = true
    getCurrentUser().then((user) => {
      if (active) setState({ status: user ? 'authenticated' : 'anonymous', user, error: '' })
    }).catch((error: unknown) => {
      if (active) {
        setState({
          status: 'error',
          user: null,
          error: error instanceof Error ? error.message : 'Verifica della sessione non riuscita.',
        })
      }
    })
    return () => { active = false }
  }, [])

  async function signIn(action: 'login' | 'register', username: string, password: string) {
    const user = await authenticate(action, username, password)
    setState({ status: 'authenticated', user, error: '' })
  }

  async function logout() {
    await endSession()
    setState({ status: 'anonymous', user: null, error: '' })
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}
