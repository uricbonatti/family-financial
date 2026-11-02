import { describe, expect, it } from 'vitest'
import { anoBadi, ayyamIHa, calendarioCobre, festasDoAno, festasEntre, primeiroAno, ultimoAno } from './calendario-badi'
import { diasEntre } from './datas'

describe('calendário Badí’', () => {
  it('datas conferidas na fonte oficial (183 B.E.)', () => {
    const f = festasDoAno(183)
    expect(f).toHaveLength(19)
    expect(f.find((x) => x.nome === 'Qudrat')?.data).toBe('2026-11-04')
    expect(f.find((x) => x.nome === 'Sharaf')?.data).toBe('2026-12-31')
    expect(f.find((x) => x.nome === 'Alá')?.data).toBe('2027-03-02')
  })

  it('Ayyám-i-Há = distância entre dois Naw-Rúz − 361, em todos os anos da tabela (RN11)', () => {
    for (let ano = primeiroAno; ano < ultimoAno; ano++) {
      const dias = diasEntre(anoBadi(ano)!.nawRuz, anoBadi(ano + 1)!.nawRuz) - 361
      expect(ayyamIHa(ano)!.dias, `ano ${ano}`).toBe(dias)
    }
    expect(ayyamIHa(182)!.dias).toBe(5)
    expect(ayyamIHa(181)!.dias).toBe(4)
  })

  it('o mês de Alá termina na véspera do Naw-Rúz seguinte', () => {
    for (let ano = primeiroAno; ano < ultimoAno; ano++) {
      const ala = festasDoAno(ano)[18].data
      expect(diasEntre(ala, anoBadi(ano + 1)!.nawRuz)).toBe(19)
    }
  })

  it('19 Festas em 12 meses (nov/2026 a out/2027), nov e dez com 2', () => {
    const f = festasEntre('2026-11-01', '2027-10-31')
    expect(f).toHaveLength(19)
    expect(f.filter((x) => x.data.startsWith('2026-11'))).toHaveLength(2)
    expect(f.filter((x) => x.data.startsWith('2026-12'))).toHaveLength(2)
  })

  it('avisa quando a tabela não cobre o período', () => {
    expect(calendarioCobre('2030-01-01')).toBe(true)
    expect(calendarioCobre('2070-01-01')).toBe(false)
  })
})
