import type { CartaoConfig, Dados, FundosConfig } from './domain/tipos'

/** Entidades gravadas no banco; `ocorrencia` guarda os valores reais (Dados.reais). */
export type Kind = 'membro' | 'categoria' | 'renda' | 'despesa' | 'ocorrencia' | 'plano'

/** O que vai para a IA: só valores e rótulos das despesas, sem nomes de pessoas. Valores em centavos por mês (média dos próximos 12). */
export interface EntradaIA {
  metaMensalCentavos: number
  valeMensalCentavos: number
  mercadoMensalCentavos: number
  saldoMensalCentavos: number
  despesas: {
    id: number; descricao: string; categoria: string; tipo: string; natureza: string
    mediaMensalCentavos: number; irredutivel: boolean; protegida: boolean; mercado: boolean; pagamento: string; ocorrenciasNoAno: number
  }[]
}
export interface SaidaIA {
  resumo: string
  sugestoes: { despesaId: number; cortePct: number; motivo: string }[]
}

/** Contrato entre a interface (renderer) e o processo principal, exposto em `window.api`. */
export interface Api {
  carregar(): Promise<Dados>
  /** Cria (sem `id`) ou atualiza (com `id`); devolve o id. */
  salvar(kind: Kind, obj: object): Promise<number>
  excluir(kind: Kind, id: number): Promise<void>
  salvarFundos(f: FundosConfig): Promise<void>
  /** Janela da fatura do cartão; null remove. */
  salvarCartao(c: CartaoConfig | null): Promise<void>
  /** Liga/desliga o mês financeiro que começa no 1º recebimento. */
  salvarJanela(ativa: boolean): Promise<void>
  /** Pede ao Claude Code instalado (login do usuário, sem chave de API) cortes sugeridos por despesa. */
  iaGerar(entrada: EntradaIA): Promise<SaidaIA>
  carregarExemplo(): Promise<void>
  limparTudo(): Promise<void>
  /** Abre o diálogo de salvar; devolve o caminho ou null se cancelado. */
  exportarJson(): Promise<string | null>
  importarJson(): Promise<boolean>
  backup(): Promise<string>
}
