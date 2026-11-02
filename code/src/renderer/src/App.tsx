import { useState, type ReactNode } from 'react'
import Acompanhamento from './pages/Acompanhamento'
import Config from './pages/Config'
import Despesas from './pages/Despesas'
import Fundos from './pages/Fundos'
import Futuro from './pages/Futuro'
import Painel from './pages/Painel'
import Plano from './pages/Plano'
import Renda from './pages/Renda'

const PAGINAS: { id: string; rotulo: string; tela: () => ReactNode }[] = [
  { id: 'painel', rotulo: 'Painel', tela: () => <Painel /> },
  { id: 'renda', rotulo: 'Renda', tela: () => <Renda /> },
  { id: 'despesas', rotulo: 'Despesas', tela: () => <Despesas /> },
  { id: 'futuro', rotulo: 'Futuro', tela: () => <Futuro /> },
  { id: 'plano', rotulo: 'Plano de redução', tela: () => <Plano /> },
  { id: 'acompanhamento', rotulo: 'Acompanhamento', tela: () => <Acompanhamento /> },
  { id: 'fundos', rotulo: 'Fundos Bahá’ís', tela: () => <Fundos /> },
  { id: 'config', rotulo: 'Configurações', tela: () => <Config /> }
]

export default function App() {
  const [pagina, setPagina] = useState('painel')
  const atual = PAGINAS.find((p) => p.id === pagina) ?? PAGINAS[0]
  return (
    <div className="app">
      <nav className="side" aria-label="Principal">
        <div className="logo">Family Financial</div>
        {PAGINAS.map((p) => (
          <button key={p.id} className="nav" aria-current={p.id === atual.id ? 'page' : undefined} onClick={() => setPagina(p.id)}>
            {p.rotulo}
          </button>
        ))}
      </nav>
      <main className="main">{atual.tela()}</main>
    </div>
  )
}
