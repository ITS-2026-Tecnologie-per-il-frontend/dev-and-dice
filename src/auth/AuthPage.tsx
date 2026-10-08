import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'

type Props = { mode: 'login' | 'register' }

export function AuthPage({ mode }: Props) {
  const { status, signIn } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const registering = mode === 'register'

  useEffect(() => {
    if (status === 'authenticated') navigate('/trackers', { replace: true })
  }, [status, navigate])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await signIn(mode, username.trim(), password)
      navigate('/trackers', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Operazione non riuscita.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="auth-eyebrow">DEV &amp; DICE</p>
        <h1 id="auth-title">{registering ? 'Crea un account' : 'Bentornato'}</h1>
        <p className="auth-intro">
          {registering
            ? 'Registrati per accedere ai tracker.'
            : 'Accedi per continuare ai tracker.'}
        </p>

        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label>
            <span>Nome utente</span>
            <input
              autoComplete="username"
              autoFocus
              maxLength={24}
              minLength={3}
              pattern="[A-Za-z0-9._-]{3,24}"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            {registering && <small>Da 3 a 24 caratteri: lettere, numeri, punto, trattino o underscore.</small>}
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete={registering ? 'new-password' : 'current-password'}
              maxLength={128}
              minLength={registering ? 8 : 1}
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {registering && <small>Usa almeno 8 caratteri.</small>}
          </label>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button className="auth-submit" type="submit" disabled={submitting || status === 'loading'}>
            {submitting ? 'Attendi…' : registering ? 'Registrati' : 'Accedi'}
          </button>
        </form>

        <p className="auth-switch">
          {registering ? 'Hai già un account?' : 'Non hai ancora un account?'}
          {' '}
          <Link to={registering ? '/login' : '/register'}>
            {registering ? 'Accedi' : 'Registrati'}
          </Link>
        </p>
      </section>
    </main>
  )
}
