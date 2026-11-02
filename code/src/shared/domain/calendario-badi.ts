// Calendário Badí’: 19 meses de 19 dias, com Ayyám-i-Há entre o 18º e o 19º (RN11).
// Dados: tabela da Casa Universal de Justiça (172 a 221 B.E.). Os dias de Ayyám-i-Há vêm da tabela e batem com
// a fórmula (intervalo entre dois Naw-Rúz − 361), validada em calendario-badi.test.ts.
import tabela from './calendario-badi-uhj.json'
import { addDias, type Iso } from './datas'

interface AnoBadi { nawRuz: Iso; ayyamInicio: Iso; ayyamFim: Iso; ayyamDias: number }
const ANOS = tabela.anos as unknown as Record<string, AnoBadi>
const LISTA = Object.keys(ANOS).map(Number).sort((a, b) => a - b)

export const MESES_BADI = ['Bahá', 'Jalál', 'Jamál', 'Azamat', 'Núr', 'Rahmat', 'Kalimát', 'Kamál', 'Asmá', 'Izzat', 'Mashíyyat', 'Ilm', 'Qudrat', 'Qawl', "Masá'il", 'Sharaf', 'Sultán', 'Mulk', 'Alá'] as const

export interface Festa { ano: number; n: number; nome: string; data: Iso }

export const primeiroAno = LISTA[0]
export const ultimoAno = LISTA[LISTA.length - 1]
export const anoBadi = (ano: number): AnoBadi | undefined => ANOS[ano]

/** As 19 Festas do ano badí; a data é a do dia listado (a Festa começa ao pôr do sol da véspera, RN11). */
export function festasDoAno(ano: number): Festa[] {
  const a = ANOS[ano]
  if (!a) return []
  return MESES_BADI.map((nome, i) => ({
    ano,
    n: i + 1,
    nome,
    data: i < 18 ? addDias(a.nawRuz, i * 19) : addDias(a.ayyamFim, 1)
  }))
}

/** Festas entre duas datas (inclusive), em ordem. */
export function festasEntre(de: Iso, ate: Iso): Festa[] {
  const out: Festa[] = []
  for (const ano of LISTA) {
    if (ANOS[ano].nawRuz > ate) break
    for (const f of festasDoAno(ano)) if (f.data >= de && f.data <= ate) out.push(f)
  }
  return out
}

/** Último dia coberto pela tabela (fim do mês de Alá do último ano). */
export const ultimoDiaCoberto = (): Iso => addDias(ANOS[ultimoAno].ayyamFim, 19)

/** A tabela cobre o período todo? Se não, a projeção de Festas fica incompleta e o app deve avisar. */
export const calendarioCobre = (ate: Iso): boolean => ate <= ultimoDiaCoberto()

export const proximaFesta = (apartirDe: Iso): Festa | undefined => festasEntre(apartirDe, addDias(apartirDe, 400))[0]

export const ayyamIHa = (ano: number) =>
  ANOS[ano] ? { inicio: ANOS[ano].ayyamInicio, fim: ANOS[ano].ayyamFim, dias: ANOS[ano].ayyamDias } : undefined
export const nawRuz = (ano: number): Iso | undefined => ANOS[ano]?.nawRuz
