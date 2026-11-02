// Datas como texto ISO (AAAA-MM-DD) e meses como AAAA-MM; cálculo em UTC para não depender do fuso.
export type Iso = string

const toDate = (iso: Iso): Date => new Date(iso + 'T00:00:00Z')
const fmt = (d: Date): Iso => d.toISOString().slice(0, 10)

export const addDias = (iso: Iso, dias: number): Iso => {
  const d = toDate(iso)
  d.setUTCDate(d.getUTCDate() + dias)
  return fmt(d)
}

export const diasEntre = (a: Iso, b: Iso): number => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 864e5)

export const mesDe = (iso: Iso): string => iso.slice(0, 7)

/** Soma meses mantendo o dia de `iso`; em mês curto usa o último dia (31/01 + 1 mês = 28/02). */
export const addMeses = (iso: Iso, n: number): Iso => {
  const [y, m, d] = iso.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  const ano = Math.floor(total / 12)
  const mes = (total % 12) + 1
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
  return `${ano}-${String(mes).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`
}

/** `n` meses (AAAA-MM) a partir de `ym`. */
export const mesesAPartir = (ym: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => addMeses(ym + '-01', i).slice(0, 7))

export const ultimoDiaDoMes = (ym: string): Iso => addDias(addMeses(ym + '-01', 1), -1)

export const hojeIso = (): Iso => new Date().toLocaleDateString('sv-SE')

const NOMES_MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
export const rotuloMes = (ym: string): string => NOMES_MES[Number(ym.slice(5, 7)) - 1]
export const rotuloMesAno = (ym: string): string => `${rotuloMes(ym)}/${ym.slice(2, 4)}`

export const dataBr = (iso: Iso): string => iso.split('-').reverse().join('/')
