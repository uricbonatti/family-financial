import type { Iso } from './datas'

export type Natureza = 'essencial' | 'flexivel' | 'protegida'
export type Periodicidade = 'mensal' | 'anual' | 'badi19'
export type StatusDespesa = 'planejada' | 'ativa' | 'encerrada' | 'cancelada'

export interface Membro { id: number; nome: string }

export interface Categoria {
  id: number
  nome: string
  cor: string
  natureza: Natureza
  /** Corte máximo no plano de redução, em % (RN04). */
  cortePct: number
}

/** Valor líquido mensal; cada reajuste vale a partir de `desde` (AAAA-MM) e não muda o passado (RN06). */
export interface RendaFixa {
  id: number
  tipo: 'fixa'
  membroId?: number | null
  descricao: string
  diaRecebimento: number
  inicio: Iso
  fim?: Iso | null
  valores: { desde: string; valorCentavos: number }[]
  /** VR/VA: só abate despesas marcadas como mercado; o que sobra no mês não vira saldo livre (RN16). */
  vale?: boolean
  /** Recebimento em parcelas (ex.: adiantamento dia 20 + salário no 5º dia útil). Vazio = uma parcela no `diaRecebimento` (RN18). */
  parcelas?: ParcelaRenda[]
}

/** `dia`: dia fixo do mês (31 cai no último dia de mês curto); `util`: n-ésimo dia útil (seg–sex). `pct`: % do valor do mês. */
export interface ParcelaRenda { tipo: 'dia' | 'util'; n: number; pct: number }

export type ClasseRenda = '13o' | 'ferias' | 'bico' | 'freelance' | 'outro'

/** Entrada pontual (13º, 1/3 de férias, bico...). Conta só no mês da data (RN08). */
export interface RendaPontual {
  id: number
  tipo: 'pontual'
  membroId?: number | null
  descricao: string
  classe: ClasseRenda
  valorCentavos: number
  data: Iso
  situacao: 'prevista' | 'recebida'
  repeteAnual: boolean
  valorRealCentavos?: number | null
}

export type Renda = RendaFixa | RendaPontual

export interface Despesa {
  id: number
  descricao: string
  categoriaId: number
  membroId?: number | null
  tipo: 'pontual' | 'recorrente' | 'parcelada'
  /** Valor de cada ocorrência (a parcela, no tipo parcelada). */
  valorCentavos: number
  nParcelas?: number
  periodicidade?: Periodicidade
  inicio: Iso
  fim?: Iso | null
  natureza: Natureza
  status: StatusDespesa
  /** Valor irredutível: nunca entra no corte do plano de redução (RN14). */
  irredutivel?: boolean
  /** Compra de mercado: pode ser paga com VR/VA (RN16). */
  mercado?: boolean
  /** Forma de pagamento; só "cartão" muda a data em que o gasto pesa no caixa (RN17). Ausente = à vista. */
  pagamento?: Pagamento
}

export type Pagamento = 'avista' | 'boleto' | 'cartao'

/** Janela da fatura do cartão: compra feita depois do fechamento entra na fatura seguinte (RN17). */
export interface CartaoConfig { diaFechamento: number; diaVencimento: number }

/** Ajuste do valor real de uma ocorrência gerada por projeção (RN02). */
export interface OcorrenciaReal {
  id: number
  despesaId: number
  data: Iso
  valorRealCentavos: number
  paga: boolean
}

export interface Plano {
  id: number
  nome: string
  metaMensalCentavos: number
  prazo: string
  criadoEm: Iso
  /** Corte por categoria em % do gasto reduzível (o que não é irredutível), aplicado mês a mês (RN07, RN14). */
  cortesPct: Record<number, number>
  ativo: boolean
}

export interface FundosConfig {
  modo: 'fixo' | 'pctRenda' | 'faixa'
  valorFestaCentavos: number
  /** % da renda fixa mensal por Festa (modo pctRenda). */
  pctRenda: number | null
  /** Modo faixa: valor por Festa conforme a renda fixa mensal; a última faixa não tem limite. */
  faixas: { ateCentavos: number | null; valorCentavos: number }[]
  distribuicao: { fundo: string; pct: number }[]
  avisarDiasAntes: number
  extraSobrePontuaisPct: number | null
  reservaAyyamIHaCentavos: number | null
  modoPrivado: boolean
  despesaId?: number | null
}

export interface Dados {
  membros: Membro[]
  categorias: Categoria[]
  rendas: Renda[]
  despesas: Despesa[]
  reais: OcorrenciaReal[]
  planos: Plano[]
  fundos: FundosConfig
  /** Sem janela configurada, despesas no cartão contam na própria data. */
  cartao?: CartaoConfig | null
  /** O mês financeiro começa no 1º recebimento da renda fixa e vai até a véspera do 1º do mês seguinte (RN18). Falso = mês do calendário. */
  janelaRecebimento?: boolean
}

export const FUNDOS_PADRAO: FundosConfig = {
  modo: 'fixo',
  valorFestaCentavos: 20000,
  pctRenda: null,
  faixas: [
    { ateCentavos: 600000, valorCentavos: 15000 },
    { ateCentavos: 1000000, valorCentavos: 20000 },
    { ateCentavos: null, valorCentavos: 30000 }
  ],
  distribuicao: [
    { fundo: 'Local', pct: 40 },
    { fundo: 'Nacional', pct: 30 },
    { fundo: 'Continental', pct: 15 },
    { fundo: 'Internacional', pct: 15 }
  ],
  avisarDiasAntes: 2,
  extraSobrePontuaisPct: null,
  reservaAyyamIHaCentavos: null,
  modoPrivado: false
}
