import { lazy, Suspense, useState } from 'react'
import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { AuthPage } from './auth/AuthPage'
import { useAuth } from './auth/useAuth'
import { MasterViewSettings } from './components/MasterViewSettings'
import { ThemeSettings } from './components/ThemeSettings'
import { useMasterView } from './utils/MasterView'
import './App.css'
import './auth.css'

const BarbarianCharacterSheet = lazy(() => import('./barbarian/CharacterSheet'))
const BarbarianSheet = lazy(() => import('./barbarian/BarbarianSheet'))
const TurnsTracker=lazy(()=>import('./components/TurnsTracker').then(module=>({default:module.TurnsTracker})))
const AccountLayout=lazy(()=>import('./components/PlayPages').then(module=>({default:module.AccountLayout})))
const HomePage=lazy(()=>import('./components/PlayPages').then(module=>({default:module.HomePage})))
const CharacterPage=lazy(()=>import('./components/PlayPages').then(module=>({default:module.CharacterPage})))
const InvitePage=lazy(()=>import('./components/PlayPages').then(module=>({default:module.InvitePage})))
const GamePage=lazy(()=>import('./components/PlayPages').then(module=>({default:module.GamePage})))

function ProtectedTrackers() {
  const { status, user, error, refreshUser, logout: endUserSession } = useAuth()
  const [logoutError, setLogoutError] = useState('')
  const masterView = useMasterView(user?.id)
  const [language, setLanguage] = useState<'it' | 'en'>(() => {
    try { return localStorage.getItem('dev-and-dice.spell-language') === 'en' ? 'en' : 'it' } catch { return 'it' }
  })
  const [languageError, setLanguageError] = useState('')

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

  function changeLanguage(value: string) {
    if (value !== 'it' && value !== 'en') return
    setLanguage(value)
    try { localStorage.setItem('dev-and-dice.spell-language', value); setLanguageError('') }
    catch { setLanguageError('La lingua è cambiata, ma la preferenza non è stata salvata nel browser.') }
  }

  return (
    <>
      <header className="user-bar">
        <Link to="/">Il mio tavolo</Link>
        <ThemeSettings compact/>
        <span>Accesso effettuato come <strong>{user.username}</strong></span>
        <MasterViewSettings view={masterView.view} onChange={masterView.changeView} error={masterView.error}/>
        <Link to="/schede/barbaro">Scheda Barbaro</Link>
        <label>Lingua <select value={language} onChange={(event) => changeLanguage(event.target.value)}>
          <option value="it">Italiano</option><option value="en">English</option>
        </select></label>
        <button type="button" onClick={() => void logout()}>Esci</button>
      </header>
      {logoutError && <p className="auth-inline-error" role="alert">{logoutError}</p>}
      {languageError && <p className="auth-inline-error" role="status">{languageError}</p>}
      <TurnsTracker language={language} view={masterView.view} />
    </>
  )
}

function App() {
  return (
    <Suspense fallback={<p className="auth-status" role="status">Caricamento di Dev &amp; Dice…</p>}><Routes>
      <Route path="/" element={<AccountLayout><HomePage/></AccountLayout>} />
      <Route path="/characters/new" element={<AccountLayout><CharacterPage/></AccountLayout>} />
      <Route path="/characters/:id" element={<AccountLayout><CharacterPage/></AccountLayout>} />
      <Route path="/join/:token" element={<AccountLayout><InvitePage/></AccountLayout>} />
      <Route path="/games/:id" element={<AccountLayout><GamePage/></AccountLayout>} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/trackers" element={<ProtectedTrackers />} />
      <Route path="/schede/barbaro" element={<Suspense fallback={<p role="status">Caricamento della scheda…</p>}><BarbarianCharacterSheet /></Suspense>} />
      <Route path="/schede/barbaro/pdf" element={<Suspense fallback={<p role="status">Caricamento della scheda…</p>}><BarbarianSheet /></Suspense>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></Suspense>
  )
}

export default App
