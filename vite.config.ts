import react from '@vitejs/plugin-react'
import { createRequire } from 'node:module'
import { defineConfig, loadEnv, type Plugin } from 'vite'

export default defineConfig(({ command, mode }) => {
  let agentation: Plugin | undefined
  if (command === 'serve' && loadEnv(mode, process.cwd(), 'VITE_AGENTATION').VITE_AGENTATION === 'true') {
    try {
      createRequire(import.meta.url).resolve('agentation')
      agentation = {
        name: 'optional-agentation',
        apply: 'serve',
        transformIndexHtml: {
          order: 'pre',
          handler: () => [{
            tag: 'script', attrs: { type: 'module' }, injectTo: 'body',
            children: `import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { Agentation } from 'agentation'
const root = document.createElement('div')
document.body.append(root)
createRoot(root).render(createElement(Agentation, { endpoint: 'http://localhost:4747' }))`,
          }],
        },
      }
    } catch {
      console.warn('Agentation non installato: avvio senza strumenti di annotazione.')
    }
  }
  return {
    plugins: [react(), agentation],
    server: {
      proxy: {
        '/api': { target: `http://127.0.0.1:${process.env.PORT ?? 3001}`, changeOrigin: false },
      },
    },
  }
})
