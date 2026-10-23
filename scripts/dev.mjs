import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'

export async function waitForApi(baseUrl, { signal, timeout = 30000, interval = 100 } = {}) {
  const deadline = AbortSignal.timeout(timeout)
  const cancelled = signal ? AbortSignal.any([signal, deadline]) : deadline
  while (!cancelled.aborted) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.any([cancelled, AbortSignal.timeout(1000)]),
      })
      const health = response.ok ? await response.json() : null
      if (health?.service === 'dev-and-dice' && health.status === 'ready') return
    } catch {
      // Connection refusal is expected while Node loads the backend and its TypeScript modules.
    }
    try { await delay(interval, undefined, { signal: cancelled }) } catch { break }
  }
  if (signal?.aborted) throw signal.reason
  throw new Error(`Il backend non è pronto su ${baseUrl} entro ${timeout / 1000} secondi. Controlla gli errori del server e la porta PORT.`)
}

async function startDevelopment() {
  const children = []
  const controller = new AbortController()
  let stopping = false

  function stop(exitCode = 0) {
    if (stopping) return
    stopping = true
    controller.abort()
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill()
    }
    process.exitCode = exitCode
  }

  function start(args) {
    const child = spawn(process.execPath, args, { stdio: 'inherit' })
    children.push(child)
    child.on('error', (error) => {
      console.error('Impossibile avviare un processo di sviluppo:', error)
      stop(1)
    })
    child.on('exit', (code, signal) => {
      if (!stopping) {
        console.error(`Un processo di sviluppo è terminato (${signal ?? code}).`)
        stop(code ?? 1)
      }
    })
  }

  process.on('SIGINT', () => stop())
  process.on('SIGTERM', () => stop())
  start(['--watch', 'server/index.mjs'])
  try {
    await waitForApi(`http://127.0.0.1:${process.env.PORT ?? 3001}`, { signal: controller.signal })
    if (!stopping) start([resolve('node_modules/vite/bin/vite.js')])
  } catch (error) {
    if (!stopping) { console.error(error.message); stop(1) }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await startDevelopment()
}
