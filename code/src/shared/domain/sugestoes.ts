import type { ClasseRenda } from './tipos'

export interface Modelo { classe: ClasseRenda; rotulo: string; descricao: string }

export const MODELOS_RENDA: Modelo[] = [
  { classe: '13o', rotulo: '13º – 1ª parcela', descricao: '13º salário – 1ª parcela' },
  { classe: '13o', rotulo: '13º – 2ª parcela', descricao: '13º salário – 2ª parcela' },
  { classe: 'ferias', rotulo: '1/3 de férias', descricao: '1/3 de férias' },
  { classe: 'bico', rotulo: 'Bico', descricao: 'Bico' },
  { classe: 'freelance', rotulo: 'Freelance', descricao: 'Freelance' },
  { classe: 'outro', rotulo: 'Outro', descricao: '' }
]

/** RN09: parcela do 13º = 50% do salário; 1/3 de férias = salário ÷ 3. Bico/freelance/outro não têm sugestão. */
export function sugerirValor(classe: ClasseRenda, salarioCentavos: number): number | null {
  if (classe === '13o') return Math.round(salarioCentavos / 2)
  if (classe === 'ferias') return Math.round(salarioCentavos / 3)
  return null
}
