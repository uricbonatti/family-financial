// Valores em centavos inteiros (RNF04).
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export const formatarBRL = (centavos: number): string => brl.format(centavos / 100).replace(/ /g, ' ')

/** "1.234,56" ou "R$ 1.234,56" -> 123456. Retorna null se não for número. */
export const lerBRL = (texto: string): number | null => {
  const limpo = texto.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  if (limpo === '' || limpo === '-') return null
  const n = Number(limpo)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}
