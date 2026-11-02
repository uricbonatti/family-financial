import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Kind } from '@shared/api'
import { hojeIso, mesDe } from '@shared/domain/datas'
import { formatarBRL } from '@shared/domain/dinheiro'
import { projetar, proximoMes, type OpcoesProjecao } from '@shared/domain/projecao'
import type { CartaoConfig, Dados, FundosConfig } from '@shared/domain/tipos'

type Tema = 'claro' | 'escuro' | 'sistema'

interface Ctx {
  dados: Dados
  hoje: string
  mesAtual: string
  /** Primeiro mês da janela de 12 meses (o mês seguinte a hoje). */
  mesBase: string
  salvar: (kind: Kind, obj: object) => Promise<number>
  excluir: (kind: Kind, id: number) => Promise<void>
  salvarFundos: (f: FundosConfig) => Promise<void>
  salvarCartao: (c: CartaoConfig | null) => Promise<void>
  salvarJanela: (ativa: boolean) => Promise<void>
  recarregar: () => Promise<void>
  projecao12: (opcoes?: OpcoesProjecao) => ReturnType<typeof projetar>
  /** Projeção que já considera a contribuição extra sobre rendas pontuais configurada em Fundos (RF35). */
  proj: (d: Pick<Dados, "rendas" | "despesas" | "reais" | "cartao" | "janelaRecebimento">, mesInicial: string, n?: number, opcoes?: OpcoesProjecao) => ReturnType<typeof projetar>
  categoria: (id: number) => { nome: string; cor: string }
  membro: (id?: number | null) => string
  /** Formata dinheiro; valores dos Fundos viram "R$ ••••" no modo privado (RF36). */
  brl: (centavos: number, fundos?: boolean) => string
  tema: Tema
  setTema: (t: Tema) => void
}

const DadosCtx = createContext<Ctx>(null as never)
export const useDados = () => useContext(DadosCtx)

const lerTema = (): Tema => {
  try {
    return (localStorage.getItem('tema') as Tema) || 'sistema'
  } catch {
    return 'sistema'
  }
}

export function DadosProvider({ children }: { children: ReactNode }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [tema, setTemaEstado] = useState<Tema>(lerTema)

  const recarregar = useCallback(async () => setDados(await window.api.carregar()), [])
  useEffect(() => {
    recarregar().catch((e) => setErro(String(e)))
  }, [recarregar])

  useEffect(() => {
    const escuro = tema === 'escuro' || (tema === 'sistema' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.tema = escuro ? 'escuro' : 'claro'
  }, [tema])

  const setTema = (t: Tema) => {
    setTemaEstado(t)
    try {
      localStorage.setItem('tema', t)
    } catch {
      /* sem armazenamento: vale só nesta sessão */
    }
  }

  const ctx = useMemo<Ctx | null>(() => {
    if (!dados) return null
    const hoje = hojeIso()
    const mesBase = proximoMes(hoje)
    const catFundos = dados.categorias.find((c) => c.nome.startsWith("Fundos"))
    const extra = dados.fundos.extraSobrePontuaisPct && catFundos ? { categoriaId: catFundos.id, pct: dados.fundos.extraSobrePontuaisPct } : undefined
    const proj: Ctx["proj"] = (d, mes, n = 12, op = {}) => projetar(d, mes, n, { fundosExtra: extra, ...op })
    return {
      dados,
      hoje,
      mesAtual: mesDe(hoje),
      mesBase,
      salvar: async (k, o) => {
        const id = await window.api.salvar(k, o)
        await recarregar()
        return id
      },
      excluir: async (k, id) => {
        await window.api.excluir(k, id)
        await recarregar()
      },
      salvarFundos: async (f) => {
        await window.api.salvarFundos(f)
        await recarregar()
      },
      salvarCartao: async (c) => {
        await window.api.salvarCartao(c)
        await recarregar()
      },
      salvarJanela: async (a) => {
        await window.api.salvarJanela(a)
        await recarregar()
      },
      recarregar,
      proj,
      projecao12: (op) => proj(dados, mesBase, 12, op),
      categoria: (id) => dados.categorias.find((c) => c.id === id) ?? { nome: '—', cor: '#9ca3af' },
      membro: (id) => dados.membros.find((m) => m.id === id)?.nome ?? 'Família',
      brl: (c, fundos) => (fundos && dados.fundos.modoPrivado ? 'R$ ••••' : formatarBRL(c)),
      tema,
      setTema
    }
  }, [dados, recarregar, tema])

  if (erro) return <p className="erro" style={{ padding: 24 }}>Não foi possível abrir os dados: {erro}</p>
  if (!ctx) return <p style={{ padding: 24 }}>Carregando…</p>
  return <DadosCtx.Provider value={ctx}>{children}</DadosCtx.Provider>
}
