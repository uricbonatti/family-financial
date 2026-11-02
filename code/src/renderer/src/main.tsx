import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { DadosProvider } from './store'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DadosProvider>
      <App />
    </DadosProvider>
  </StrictMode>
)
