export type AuthUser = { id: string; username: string }

type AuthResponse = { user: AuthUser }
type ErrorResponse = { error: string }

async function request<T>(path: string, body?: Record<string, string>): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Server di autenticazione non raggiungibile. Avvia frontend e backend con “npm run dev”.')
  }

  let result: AuthResponse | ErrorResponse
  try {
    result = await response.json()
  } catch {
    const message = response.status >= 500
      ? 'Server di autenticazione non disponibile. Avvia frontend e backend con “npm run dev”.'
      : 'Il server ha restituito una risposta non valida.'
    throw new AuthApiError(message, response.status)
  }
  if (!response.ok) {
    throw new AuthApiError('error' in result ? result.error : 'Richiesta non riuscita.', response.status)
  }
  return result as T
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const result = await request<AuthResponse>('/api/me')
    return result.user
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) return null
    throw error
  }
}

export async function authenticate(
  action: 'login' | 'register',
  username: string,
  password: string,
): Promise<AuthUser> {
  const result = await request<AuthResponse>(`/api/${action}`, { username, password })
  return result.user
}

export async function endSession(): Promise<void> {
  await request<{ ok: true }>('/api/logout', {})
}

class AuthApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}
