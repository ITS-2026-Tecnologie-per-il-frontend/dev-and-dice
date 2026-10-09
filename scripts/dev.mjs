import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const children = [
  spawn(process.execPath, ['--watch', 'server/index.mjs'], { stdio: 'inherit' }),
  spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js')], { stdio: 'inherit' }),
]

let stopping = false

function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill()
  }
  process.exitCode = exitCode
}

for (const child of children) {
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
