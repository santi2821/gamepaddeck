import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './types/native'
import App from './App.tsx'

window.onServerDiscovered = (host, port) => {
  window.__gamepadDeckServer = { host, port }
  window.dispatchEvent(
    new CustomEvent('gamepaddeck-server-discovered', { detail: { host, port } }),
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
