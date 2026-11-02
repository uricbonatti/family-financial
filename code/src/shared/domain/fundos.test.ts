import { describe, expect, it } from 'vitest'
import { validarFaixas, valorPorFesta } from './fundos'
import { FUNDOS_PADRAO } from './tipos'

const faixas = FUNDOS_PADRAO.faixas // até 6.000 → 150 · até 10.000 → 200 · acima → 300

describe('contribuição por Festa', () => {
  it('modo faixa escolhe a faixa pela renda fixa mensal (limite inclusivo)', () => {
    const cfg = { ...FUNDOS_PADRAO, modo: 'faixa' as const }
    expect(valorPorFesta(cfg, 500000)).toBe(15000)
    expect(valorPorFesta(cfg, 600000)).toBe(15000)
    expect(valorPorFesta(cfg, 600001)).toBe(20000)
    expect(valorPorFesta(cfg, 980000)).toBe(20000)
    expect(valorPorFesta(cfg, 1000001)).toBe(30000)
  })

  it('modo % da renda e valor fixo', () => {
    expect(valorPorFesta({ ...FUNDOS_PADRAO, modo: 'pctRenda', pctRenda: 2 }, 980000)).toBe(19600)
    expect(valorPorFesta({ ...FUNDOS_PADRAO, modo: 'pctRenda', pctRenda: null }, 980000)).toBe(0)
    expect(valorPorFesta({ ...FUNDOS_PADRAO, modo: 'fixo', valorFestaCentavos: 25000 }, 980000)).toBe(25000)
  })

  it('valida as faixas', () => {
    expect(validarFaixas(faixas)).toBeNull()
    expect(validarFaixas([])).toMatch(/ao menos uma/)
    expect(validarFaixas([{ ateCentavos: 100, valorCentavos: 10 }])).toMatch(/última faixa/)
    expect(validarFaixas([{ ateCentavos: null, valorCentavos: 0 }])).toMatch(/maior que zero/)
    expect(validarFaixas([{ ateCentavos: 1000, valorCentavos: 10 }, { ateCentavos: 500, valorCentavos: 20 }, { ateCentavos: null, valorCentavos: 30 }])).toMatch(/crescentes/)
    expect(validarFaixas([{ ateCentavos: null, valorCentavos: 10 }, { ateCentavos: null, valorCentavos: 30 }])).toMatch(/limite/)
  })
})
