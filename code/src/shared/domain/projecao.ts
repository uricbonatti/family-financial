// Projeção de saldo (RN01, RN02, RN06, RN08, RN12). Tudo em centavos; sem estado, recebe os dados.
import { festasEntre } from './calendario-badi'
import { addDias, addMeses, mesDe, mesesAPartir, ultimoDiaDoMes, type Iso } from './datas'
import type { CartaoConfig, Despesa, OcorrenciaReal, ParcelaRenda, Renda, RendaFixa, RendaPontual } from './tipos'

export interface Ocorrencia { data: Iso; valorCentavos: number; real: boolean; paga: boolean }

const chaveReal = (despesaId: number, data: Iso) => `${despesaId}|${data}`

/** Ocorrências de uma despesa entre `de` e `ate`, já com o valor real quando houver (RN02). */
export function ocorrencias(d: Despesa, de: Iso, ate: Iso, reais: OcorrenciaReal[] = []): Ocorrencia[] {
  if (d.status === 'cancelada') return []
  const fim = d.fim && d.fim < ate ? d.fim : ate
  const datas: Iso[] = []
  if (d.tipo === 'pontual') datas.push(d.inicio)
  else if (d.tipo === 'parcelada') for (let i = 0; i < (d.nParcelas ?? 1); i++) datas.push(addMeses(d.inicio, i))
  else if (d.periodicidade === 'badi19') datas.push(...festasEntre(d.inicio, fim).map((f) => f.data))
  else {
    const passo = d.periodicidade === 'anual' ? 12 : 1
    for (let i = 0; ; i++) {
      const dt = addMeses(d.inicio, i * passo)
      if (dt > fim) break
      datas.push(dt)
    }
  }
  const mapa = new Map(reais.filter((r) => r.despesaId === d.id).map((r) => [chaveReal(r.despesaId, r.data), r]))
  return datas
    .filter((dt) => dt >= de && dt <= fim)
    .map((dt) => {
      const r = mapa.get(chaveReal(d.id, dt))
      return { data: dt, valorCentavos: r ? r.valorRealCentavos : d.valorCentavos, real: !!r, paga: r?.paga ?? false }
    })
}

/** Data em que a compra no cartão sai do caixa: vencimento da fatura em que ela cai (compra no dia do fechamento ainda entra nessa fatura). */
export function dataDoPagamentoCartao(data: Iso, c: CartaoConfig): Iso {
  const dia = Number(data.slice(8, 10))
  const meses = (dia > c.diaFechamento ? 1 : 0) + (c.diaVencimento > c.diaFechamento ? 0 : 1)
  return addMeses(data.slice(0, 8) + String(c.diaVencimento).padStart(2, '0'), meses)
}

/** Data de uma parcela de recebimento no mês `ym`. Dia útil = seg–sex, sem feriados (ponytail: feriados nacionais ficam de fora). */
export function dataParcela(p: ParcelaRenda, ym: string): Iso {
  const ultimo = ultimoDiaDoMes(ym)
  if (p.tipo === 'dia') return ym + '-' + String(Math.min(p.n, Number(ultimo.slice(8)))).padStart(2, '0')
  let achado: Iso = ym + '-01'
  for (let i = 1, n = 0; i <= Number(ultimo.slice(8)); i++) {
    const dt = ym + '-' + String(i).padStart(2, '0')
    const sem = new Date(dt + 'T00:00:00Z').getUTCDay()
    if (sem === 0 || sem === 6) continue
    achado = dt
    if (++n === p.n) break
  }
  return achado
}

export const parcelasDaRenda = (r: RendaFixa): ParcelaRenda[] => (r.parcelas?.length ? r.parcelas : [{ tipo: 'dia', n: r.diaRecebimento, pct: 100 }])

/** Primeiro recebimento do mês entre as rendas fixas ativas (VR/VA fica de fora); sem renda, o dia 1. */
export function inicioDoMesFinanceiro(rendas: Renda[], ym: string): Iso {
  const datas = rendas.flatMap((r) => (r.tipo === 'fixa' && !r.vale && valorRendaFixa(r, ym) > 0 ? parcelasDaRenda(r).map((p) => dataParcela(p, ym)) : []))
  return datas.length ? datas.sort()[0] : ym + '-01'
}

/** Janela [de, ate] do mês `ym`: calendário, ou do 1º recebimento até a véspera do 1º recebimento do mês seguinte. */
export function janelaDoMes(dados: { rendas: Renda[]; janelaRecebimento?: boolean }, ym: string): { de: Iso; ate: Iso } {
  if (!dados.janelaRecebimento) return { de: ym + '-01', ate: ultimoDiaDoMes(ym) }
  return { de: inicioDoMesFinanceiro(dados.rendas, ym), ate: addDias(inicioDoMesFinanceiro(dados.rendas, mesDe(addMeses(ym + '-01', 1))), -1) }
}

/** Valor da renda fixa no mês `ym`, respeitando vigência e reajustes (RN06). */
export function valorRendaFixa(r: RendaFixa, ym: string): number {
  if (ym < mesDe(r.inicio) || (r.fim && ym > mesDe(r.fim))) return 0
  const vigentes = r.valores.filter((v) => v.desde <= ym).sort((a, b) => a.desde.localeCompare(b.desde))
  return vigentes.length ? vigentes[vigentes.length - 1].valorCentavos : 0
}

/** Entradas pontuais que caem no mês, incluindo as repetidas todo ano. */
export function pontuaisDoMes(rendas: Renda[], ym: string): { renda: RendaPontual; data: Iso; valorCentavos: number }[] {
  const out: { renda: RendaPontual; data: Iso; valorCentavos: number }[] = []
  for (const r of rendas) {
    if (r.tipo !== 'pontual') continue
    const valor = r.valorRealCentavos ?? r.valorCentavos
    if (mesDe(r.data) === ym) out.push({ renda: r, data: r.data, valorCentavos: valor })
    else if (r.repeteAnual && ym > mesDe(r.data) && ym.slice(5) === r.data.slice(5, 7)) {
      out.push({ renda: r, data: addMeses(r.data, (Number(ym.slice(0, 4)) - Number(r.data.slice(0, 4))) * 12), valorCentavos: r.valorCentavos })
    }
  }
  return out
}

export interface MesProjetado {
  mes: string
  /** Período do mês (calendário ou, com `janelaRecebimento`, do 1º recebimento à véspera do próximo). */
  de: Iso
  ate: Iso
  /** Quanto da fatura do cartão pesa neste mês (antes do plano de redução). */
  cartao: number
  /** Renda fixa livre (sem VR/VA). */
  rendaFixa: number
  /** VR/VA recebido no mês, gasto de mercado e a parte do vale que de fato abate o mercado; a sobra não vira saldo (RN16). */
  vale: number
  mercado: number
  valeUsado: number
  pontuais: number
  despesas: number
  saldo: number
  acumulado: number
  porCategoria: Record<number, number>
  /** Parte do gasto de cada categoria marcada como irredutível (não entra no corte). */
  irredutivelPorCategoria: Record<number, number>
  /** Quantas ocorrências de despesa "a cada 19 dias" caem no mês (Festas). */
  festas: number
}

export interface Projecao { meses: MesProjetado[]; total: number }

export interface OpcoesProjecao {
  /** RF35: contribuição extra, em % de cada entrada pontual, lançada na categoria dos Fundos no mês em que a renda entra. */
  fundosExtra?: { categoriaId: number; pct: number }
  /** Plano de redução: % de corte por categoria sobre o gasto reduzível de cada mês (RN14). */
  cortesPct?: Record<number, number>
}

export function projetar(
  dados: { rendas: Renda[]; despesas: Despesa[]; reais: OcorrenciaReal[]; cartao?: CartaoConfig | null; janelaRecebimento?: boolean },
  mesInicial: string,
  nMeses = 12,
  opcoes: OpcoesProjecao = {}
): Projecao {
  let acumulado = 0
  const meses = mesesAPartir(mesInicial, nMeses).map((ym): MesProjetado => {
    const { de, ate } = janelaDoMes(dados, ym)
    const rendaFixa = dados.rendas.reduce((s, r) => s + (r.tipo === 'fixa' && !r.vale ? valorRendaFixa(r, ym) : 0), 0)
    const vale = dados.rendas.reduce((s, r) => s + (r.tipo === 'fixa' && r.vale ? valorRendaFixa(r, ym) : 0), 0)
    const doPeriodo = dados.janelaRecebimento
      ? [-1, 0, 1].flatMap((k) => pontuaisDoMes(dados.rendas, mesDe(addMeses(ym + '-01', k)))).filter((p) => p.data >= de && p.data <= ate)
      : pontuaisDoMes(dados.rendas, ym)
    const pontuais = doPeriodo.reduce((s, p) => s + p.valorCentavos, 0)
    const porCategoria: Record<number, number> = {}
    const irredutivelPorCategoria: Record<number, number> = {}
    const mercadoPorCategoria: Record<number, number> = {}
    let festas = 0
    let cartao = 0
    for (const d of dados.despesas) {
      // No cartão, a compra pesa no vencimento da fatura: busca compras até 62 dias antes do mês e move a data.
      const oc = dados.cartao && d.pagamento === 'cartao'
        ? ocorrencias(d, addDias(de, -62), ate, dados.reais).map((o) => ({ ...o, data: dataDoPagamentoCartao(o.data, dados.cartao!) })).filter((o) => o.data >= de && o.data <= ate)
        : ocorrencias(d, de, ate, dados.reais)
      if (!oc.length) continue
      const valor = oc.reduce((s, o) => s + o.valorCentavos, 0)
      if (d.pagamento === 'cartao') cartao += valor
      porCategoria[d.categoriaId] = (porCategoria[d.categoriaId] ?? 0) + valor
      if (d.mercado) mercadoPorCategoria[d.categoriaId] = (mercadoPorCategoria[d.categoriaId] ?? 0) + valor
      if (d.irredutivel) irredutivelPorCategoria[d.categoriaId] = (irredutivelPorCategoria[d.categoriaId] ?? 0) + valor
      if (d.periodicidade === 'badi19') festas += oc.length
    }
    const extra = opcoes.fundosExtra
    if (extra && extra.pct > 0 && pontuais > 0) porCategoria[extra.categoriaId] = (porCategoria[extra.categoriaId] ?? 0) + Math.round((pontuais * extra.pct) / 100)
    for (const [cat, pct] of Object.entries(opcoes.cortesPct ?? {})) {
      const id = Number(cat)
      const reduzivel = (porCategoria[id] ?? 0) - (irredutivelPorCategoria[id] ?? 0)
      if (reduzivel > 0) {
        const antes = porCategoria[id]
        porCategoria[id] -= Math.min(reduzivel, Math.round((reduzivel * pct) / 100))
        if (mercadoPorCategoria[id]) mercadoPorCategoria[id] = Math.round((mercadoPorCategoria[id] * porCategoria[id]) / antes) // ponytail: o corte atinge o mercado na mesma proporção da categoria
      }
    }
    const despesas = Object.values(porCategoria).reduce((s, v) => s + v, 0)
    const mercado = Object.values(mercadoPorCategoria).reduce((s, v) => s + v, 0)
    const valeUsado = Math.min(vale, mercado)
    const saldo = rendaFixa + valeUsado + pontuais - despesas
    acumulado += saldo
    return { mes: ym, de, ate, cartao, rendaFixa, vale, valeUsado, mercado, pontuais, despesas, saldo, acumulado, porCategoria, irredutivelPorCategoria, festas }
  })
  return { meses, total: acumulado }
}

/**
 * Quanto ainda falta pagar no cartão: ocorrências cujo vencimento da fatura é depois de `hoje` (parcelas, compras pontuais e recorrentes com fim).
 * Recorrentes sem data final não entram (não têm total); `semFim` diz quantas ficaram de fora.
 */
export function cartaoRestante(dados: { despesas: Despesa[]; reais: OcorrenciaReal[]; cartao?: CartaoConfig | null }, hoje: Iso): { centavos: number; semFim: number } {
  let centavos = 0
  let semFim = 0
  for (const d of dados.despesas) {
    if (d.pagamento !== 'cartao' || d.status === 'cancelada' || d.status === 'encerrada') continue
    if (d.tipo === 'recorrente' && !d.fim) { semFim++; continue }
    for (const o of ocorrencias(d, addDias(hoje, -62), '2200-12-31', dados.reais)) {
      if ((dados.cartao ? dataDoPagamentoCartao(o.data, dados.cartao) : o.data) > hoje) centavos += o.valorCentavos
    }
  }
  return { centavos, semFim }
}

/** Primeiro dia útil para a janela de 12 meses: o mês seguinte a `hoje`. */
export const proximoMes = (hoje: Iso): string => mesDe(addDias(ultimoDiaDoMes(mesDe(hoje)), 1))
