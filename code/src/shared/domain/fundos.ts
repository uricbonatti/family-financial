// Valor da contribuição por Festa conforme o modo escolhido (RF30).
import type { FundosConfig } from './tipos'

/**
 * - fixo: o valor informado;
 * - pctRenda: % da renda fixa mensal;
 * - faixa: valor da primeira faixa cuja renda fixa mensal é menor ou igual ao limite (a última faixa, sem limite, vale para o resto).
 */
export function valorPorFesta(cfg: Pick<FundosConfig, 'modo' | 'valorFestaCentavos' | 'pctRenda' | 'faixas'>, rendaFixaCentavos: number): number {
  if (cfg.modo === 'pctRenda') return Math.round((rendaFixaCentavos * (cfg.pctRenda ?? 0)) / 100)
  if (cfg.modo === 'faixa') {
    const f = cfg.faixas.find((x) => x.ateCentavos == null || rendaFixaCentavos <= x.ateCentavos)
    return f ? f.valorCentavos : 0
  }
  return cfg.valorFestaCentavos
}

/** Faixas válidas: limites crescentes, valores positivos e a última sem limite. Devolve a mensagem do problema, ou null. */
export function validarFaixas(faixas: FundosConfig['faixas']): string | null {
  if (faixas.length === 0) return 'Inclua ao menos uma faixa.'
  for (let i = 0; i < faixas.length; i++) {
    const f = faixas[i]
    const ultima = i === faixas.length - 1
    if (f.valorCentavos <= 0) return 'Todo valor por Festa deve ser maior que zero.'
    if (ultima && f.ateCentavos != null) return 'A última faixa deve valer para qualquer renda acima da anterior (sem limite).'
    if (!ultima) {
      if (f.ateCentavos == null || f.ateCentavos <= 0) return 'Informe o limite de renda de cada faixa, exceto a última.'
      if (i > 0 && f.ateCentavos <= (faixas[i - 1].ateCentavos ?? 0)) return 'Os limites de renda devem ser crescentes.'
    }
  }
  return null
}
