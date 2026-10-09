import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthPage } from './auth/AuthPage'
import { useAuth } from './auth/useAuth'
import { TurnsTracker } from './components/TurnsTracker'
import './App.css'
import './auth.css'

function ProtectedTrackers() {
  const { status, user, error, refreshUser, logout: endUserSession } = useAuth()
  const [logoutError, setLogoutError] = useState('')

  if (status === 'loading') {
    return <p className="auth-status" role="status">Verifica della sessione…</p>
  }

  if (status === 'error') {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>Sessione non disponibile</h1>
          <p role="alert">{error || 'Non è stato possibile verificare l’accesso al server.'}</p>
          <button className="auth-submit" type="button" onClick={() => void refreshUser()}>
            Riprova
          </button>
        </section>
      </main>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  async function logout() {
    setLogoutError('')
    try {
      await endUserSession()
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Uscita non riuscita.')
    }
  }

  return (
    <>
      <header className="user-bar">
        <span>Accesso effettuato come <strong>{user.username}</strong></span>
        <button type="button" onClick={() => void logout()}>Esci</button>
      </header>
      {logoutError && <p className="auth-inline-error" role="alert">{logoutError}</p>}
      <TurnsTracker />
    </>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/trackers" replace />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/trackers" element={<ProtectedTrackers />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
