// Plano de redução por regra determinística (RN04, RN05, RN07, RN14). Sem IA.
import { projetar } from './projecao'
import type { Dados, Natureza } from './tipos'

export interface CategoriaGasto {
  id: number
  nome: string
  natureza: Natureza
  cortePct: number
  /** Gasto mensal médio da categoria no período, em centavos (inclui compras pontuais e planejadas). */
  atualCentavos: number
  /** Parte do gasto que é valor irredutível: nunca entra no corte (RN14). */
  irredutivelCentavos: number
}

export interface LinhaPlano extends CategoriaGasto {
  /** O que pode ser cortado: gasto menos o irredutível. */
  reduzivelCentavos: number
  alvoCentavos: number
  corteCentavos: number
  /** Corte em % do gasto reduzível (é o que o plano guarda e aplica mês a mês). */
  cortePctAplicado: number
  protegida: boolean
}

export interface ResultadoPlano {
  linhas: LinhaPlano[]
  economiaCentavos: number
  /** Quanto da meta não pôde ser coberto (0 quando atingida). */
  faltanteCentavos: number
}

const FATOR: Record<Natureza, number> = { flexivel: 1, essencial: 0.2, protegida: 0 }
const reduzivel = (c: CategoriaGasto) => Math.max(0, c.atualCentavos - c.irredutivelCentavos)

/**
 * Corta primeiro a categoria de maior peso (gasto reduzível × fator) até o limite dela e passa à seguinte, até cobrir a meta.
 * Categorias protegidas (parcelas, Fundos) nunca entram (RN05, RN10); despesas irredutíveis ficam fora da base (RN14).
 */
export function gerarPlano(metaMensalCentavos: number, categorias: CategoriaGasto[]): ResultadoPlano {
  const peso = (c: CategoriaGasto) => reduzivel(c) * FATOR[c.natureza]
  const cortes = new Map<number, number>()
  let falta = metaMensalCentavos
  for (const c of [...categorias].filter((c) => peso(c) > 0).sort((a, b) => peso(b) - peso(a))) {
    if (falta <= 0) break
    const corte = Math.min(Math.floor((reduzivel(c) * c.cortePct) / 100), falta)
    cortes.set(c.id, corte)
    falta -= corte
  }
  const linhas = categorias
    .map((c): LinhaPlano => {
      const corte = cortes.get(c.id) ?? 0
      const red = reduzivel(c)
      return { ...c, reduzivelCentavos: red, alvoCentavos: c.atualCentavos - corte, corteCentavos: corte, cortePctAplicado: red ? (corte / red) * 100 : 0, protegida: c.natureza === 'protegida' }
    })
    .sort((a, b) => b.corteCentavos - a.corteCentavos || b.atualCentavos - a.atualCentavos)
  return { linhas, economiaCentavos: metaMensalCentavos - Math.max(falta, 0), faltanteCentavos: Math.max(falta, 0) }
}

/** Gasto médio mensal por categoria nos próximos 12 meses, já separando o que é irredutível. */
export function categoriasParaPlano(dados: Dados, mesBase: string): CategoriaGasto[] {
  const meses = projetar(dados, mesBase, 12).meses
  const soma = (f: (m: (typeof meses)[number]) => Record<number, number>, id: number) => Math.round(meses.reduce((s, m) => s + (f(m)[id] ?? 0), 0) / 12)
  return dados.categorias.map((c) => ({
    id: c.id, nome: c.nome, natureza: c.natureza, cortePct: c.cortePct,
    atualCentavos: soma((m) => m.porCategoria, c.id), irredutivelCentavos: soma((m) => m.irredutivelPorCategoria, c.id)
  }))
}

/** Percentual de corte por categoria (só as que têm corte), no formato que o plano guarda. */
export const cortesPctDoPlano = (linhas: Pick<LinhaPlano, 'id' | 'cortePctAplicado'>[]): Record<number, number> =>
  Object.fromEntries(linhas.filter((l) => l.cortePctAplicado > 0).map((l) => [l.id, l.cortePctAplicado]))
