import { describe, expect, it } from 'vitest'
import { dadosExemplo } from './exemplo'
import { categoriasParaPlano, cortesPctDoPlano, gerarPlano } from './plano'
import { cartaoRestante, dataDoPagamentoCartao, dataParcela, janelaDoMes, ocorrencias, projetar, proximoMes, valorRendaFixa } from './projecao'
import { sugerirValor } from './sugestoes'

const dados = dadosExemplo()

describe('projeção (números idênticos ao protótipo)', () => {
  const p = projetar(dados, '2026-11')

  it('saldo projetado de 12 meses = R$ 51.236,67 com 19 Festas', () => {
    expect(p.total).toBe(5123667)
    expect(p.meses.reduce((s, m) => s + m.festas, 0)).toBe(19)
  })

  it('mês a mês: dez dobra o 13º, jan tem a viagem e o 1/3 de férias', () => {
    const [nov, dez, jan] = p.meses
    expect(nov.pontuais).toBe(490000)
    expect(nov.despesas).toBe(745000)
    expect(nov.saldo).toBe(725000)
    expect(dez.acumulado).toBe(1450000)
    expect(jan.despesas).toBe(1089000)
    expect(jan.saldo).toBe(97667)
  })

  it('RN08: pontual conta só no mês em que ocorre', () => {
    expect(p.meses.filter((m) => m.pontuais > 0).map((m) => m.mes)).toEqual(['2026-11', '2026-12', '2027-01', '2027-03'])
  })

  it('RF38: uma entrada extraordinária (loteria) muda o acumulado só a partir do mês recebido', () => {
    const loteria = { ...dados, rendas: [...dados.rendas, { id: 99, tipo: 'pontual' as const, descricao: 'Loteria', classe: 'outro' as const, valorCentavos: 10000000, data: '2027-02-10', situacao: 'prevista' as const, repeteAnual: false }] }
    const q = projetar(loteria, '2026-11')
    expect(q.total - p.total).toBe(10000000)
    expect(q.meses[2].acumulado).toBe(p.meses[2].acumulado)
    expect(q.meses[3].acumulado - p.meses[3].acumulado).toBe(10000000)
  })

  it('RF35: 2% das entradas pontuais vira contribuição extra no mês em que entram', () => {
    const q = projetar(dados, '2026-11', 12, { fundosExtra: { categoriaId: 6, pct: 2 } })
    expect(q.meses[0].porCategoria[6]).toBe(p.meses[0].porCategoria[6] + 9800)
    expect(p.total - q.total).toBe(Math.round(0.02 * 1306667))
  })

  it('plano: compras pontuais e planejadas entram no corte (viagem em Lazer)', () => {
    const cats = categoriasParaPlano(dados, '2026-11')
    const lazer = cats.find((c) => c.nome === 'Lazer')!
    expect(lazer.atualCentavos).toBe(52000 + 37500) // 520/mês + viagem de 4.500 ÷ 12
    const plano = gerarPlano(48000, cats)
    expect(plano.economiaCentavos).toBe(48000)
    expect(plano.linhas.find((l) => l.nome === 'Lazer')?.corteCentavos).toBe(44750) // 50% do reduzível
    expect(plano.linhas.find((l) => l.nome === 'Transporte')?.corteCentavos).toBe(3250)
    expect(plano.linhas.filter((l) => l.protegida).every((l) => l.corteCentavos === 0)).toBe(true)
    // economia mensal × 12 aparece no saldo projetado (RN12) e a viagem de janeiro encolhe 50%
    const com = projetar(dados, '2026-11', 12, { cortesPct: cortesPctDoPlano(plano.linhas) })
    expect(com.total - p.total).toBe(12 * 48000)
    expect(p.meses[2].porCategoria[4] - com.meses[2].porCategoria[4]).toBe(251000)
  })

  it('RN14: despesa marcada como valor irredutível fica fora do corte', () => {
    const travada = { ...dados, despesas: dados.despesas.map((d) => (d.id === 11 ? { ...d, irredutivel: true } : d)) }
    const cats = categoriasParaPlano(travada, '2026-11')
    expect(cats.find((c) => c.nome === 'Lazer')!.irredutivelCentavos).toBe(37500)
    const plano = gerarPlano(48000, cats)
    // sem a viagem, Lazer pesa menos que Transporte: Transporte corta até o limite (50%) e Lazer cobre o resto
    expect(plano.linhas.find((l) => l.nome === 'Transporte')?.corteCentavos).toBe(32500)
    expect(plano.linhas.find((l) => l.nome === 'Lazer')?.corteCentavos).toBe(15500)
    expect(plano.economiaCentavos).toBe(48000)
    const com = projetar(travada, '2026-11', 12, { cortesPct: cortesPctDoPlano(plano.linhas) })
    expect(com.meses[2].porCategoria[4]).toBe(52000 + 450000 - 15500) // só o gasto recorrente encolhe; a viagem fica intacta
    expect(com.total - projetar(travada, '2026-11').total).toBe(12 * 48000)
  })

  it('meta maior que o possível: mostra o que falta e nunca corta categoria protegida', () => {
    const cats = [
      { id: 1, nome: 'A', natureza: 'flexivel' as const, cortePct: 50, atualCentavos: 10000, irredutivelCentavos: 0 },
      { id: 2, nome: 'Fundos', natureza: 'protegida' as const, cortePct: 0, atualCentavos: 50000, irredutivelCentavos: 0 }
    ]
    const r = gerarPlano(100000, cats)
    expect(r.economiaCentavos).toBe(5000)
    expect(r.faltanteCentavos).toBe(95000)
  })
})

describe('RN16: VR/VA só abate mercado', () => {
  const base = {
    rendas: [{ id: 1, tipo: 'fixa' as const, descricao: 'VR', diaRecebimento: 1, inicio: '2026-01-01', vale: true, valores: [{ desde: '2026-01', valorCentavos: 100000 }] }],
    despesas: [{ id: 1, descricao: 'Supermercado', categoriaId: 1, tipo: 'recorrente' as const, periodicidade: 'mensal' as const, valorCentavos: 70000, inicio: '2026-01-05', natureza: 'essencial' as const, status: 'ativa' as const, mercado: true }],
    reais: []
  }
  it('vale maior que o mercado: só o gasto é abatido, a sobra não vira saldo', () => {
    const m = projetar(base, '2026-11', 1).meses[0]
    expect(m).toMatchObject({ rendaFixa: 0, vale: 100000, mercado: 70000, valeUsado: 70000, saldo: 0 })
  })
  it('vale menor que o mercado: o resto sai do bolso; sem marcação o vale não abate nada', () => {
    expect(projetar({ ...base, rendas: [{ ...base.rendas[0], valores: [{ desde: '2026-01', valorCentavos: 30000 }] }] }, '2026-11', 1).meses[0].saldo).toBe(-40000)
    expect(projetar({ ...base, despesas: [{ ...base.despesas[0], mercado: false }] }, '2026-11', 1).meses[0].saldo).toBe(-70000)
  })
})

describe('RN17: janela do cartão', () => {
  const c = { diaFechamento: 25, diaVencimento: 5 }
  it('compra até o fechamento vence no mês seguinte; depois dele, só no outro', () => {
    expect(dataDoPagamentoCartao('2026-10-25', c)).toBe('2026-11-05')
    expect(dataDoPagamentoCartao('2026-10-26', c)).toBe('2026-12-05')
    expect(dataDoPagamentoCartao('2026-12-30', c)).toBe('2027-02-05')
  })
  it('vencimento depois do fechamento fica no mesmo mês; dia 31 cai no último dia do mês curto', () => {
    expect(dataDoPagamentoCartao('2026-10-05', { diaFechamento: 3, diaVencimento: 10 })).toBe('2026-11-10')
    expect(dataDoPagamentoCartao('2026-10-02', { diaFechamento: 3, diaVencimento: 10 })).toBe('2026-10-10')
    expect(dataDoPagamentoCartao('2026-01-20', { diaFechamento: 25, diaVencimento: 31 })).toBe('2026-01-31')
    expect(dataDoPagamentoCartao('2026-01-26', { diaFechamento: 25, diaVencimento: 31 })).toBe('2026-02-28')
  })
  it('na projeção, a compra do cartão pesa no mês do vencimento; sem janela ou sem marcar cartão, na própria data', () => {
    const d = { id: 1, descricao: 'TV', categoriaId: 1, tipo: 'pontual' as const, valorCentavos: 50000, inicio: '2026-10-28', natureza: 'flexivel' as const, status: 'ativa' as const, pagamento: 'cartao' as const }
    const mes = (dados: object, ym: string) => projetar({ rendas: [], despesas: [d], reais: [], ...dados }, ym, 1).meses[0].despesas
    expect(mes({ cartao: c }, '2026-10')).toBe(0)
    expect(mes({ cartao: c }, '2026-12')).toBe(50000)
    expect(mes({}, '2026-10')).toBe(50000)
    expect(mes({ cartao: c, despesas: [{ ...d, pagamento: 'boleto' }] }, '2026-10')).toBe(50000)
  })
})

describe('RN18: parcelas de recebimento e janela do mês', () => {
  it('dia fixo (31 cai no último dia) e n-ésimo dia útil (seg–sex)', () => {
    expect(dataParcela({ tipo: 'dia', n: 31, pct: 50 }, '2026-02')).toBe('2026-02-28')
    expect(dataParcela({ tipo: 'util', n: 5, pct: 50 }, '2026-10')).toBe('2026-10-07') // 1/10 é quinta: 1,2,5,6,7
    expect(dataParcela({ tipo: 'util', n: 1, pct: 50 }, '2026-08')).toBe('2026-08-03') // 1/8 é sábado
  })
  const rendas = [{ id: 1, tipo: 'fixa' as const, descricao: 'Salário', diaRecebimento: 20, inicio: '2026-01-01', parcelas: [{ tipo: 'dia' as const, n: 20, pct: 40 }, { tipo: 'util' as const, n: 5, pct: 60 }], valores: [{ desde: '2026-01', valorCentavos: 500000 }] }]
  it('janela começa no 1º recebimento e vai até a véspera do 1º do mês seguinte', () => {
    // outubro: dia 20 (parcela 1) vs 5º dia útil = 07/10 → começa 07/10; novembro: 5º dia útil = 06/11 vs dia 20 → 06/11
    expect(janelaDoMes({ rendas, janelaRecebimento: true }, '2026-10')).toEqual({ de: '2026-10-07', ate: '2026-11-05' })
    expect(janelaDoMes({ rendas, janelaRecebimento: false }, '2026-10')).toEqual({ de: '2026-10-01', ate: '2026-10-31' })
  })
  it('despesa e renda pontual caem no período certo; com a janela desligada nada muda', () => {
    const d = { id: 1, descricao: 'Luz', categoriaId: 1, tipo: 'pontual' as const, valorCentavos: 10000, inicio: '2026-11-03', natureza: 'essencial' as const, status: 'ativa' as const }
    const m = (janela: boolean, ym: string) => projetar({ rendas, despesas: [d], reais: [], janelaRecebimento: janela }, ym, 1).meses[0].despesas
    expect(m(false, '2026-11')).toBe(10000)
    expect(m(true, '2026-11')).toBe(0) // 03/11 pertence ao período de outubro (07/10–05/11)
    expect(m(true, '2026-10')).toBe(10000)
  })
  it('cartão restante soma parcelas futuras e avisa dos recorrentes sem fim', () => {
    const base = { descricao: 'x', categoriaId: 1, valorCentavos: 10000, inicio: '2026-09-10', natureza: 'flexivel' as const, status: 'ativa' as const, pagamento: 'cartao' as const }
    const r = cartaoRestante({ despesas: [{ ...base, id: 1, tipo: 'parcelada', nParcelas: 6 }, { ...base, id: 2, tipo: 'recorrente', periodicidade: 'mensal' }], reais: [] }, '2026-10-29')
    expect(r).toEqual({ centavos: 40000, semFim: 1 }) // 6 parcelas de set a fev: restam nov, dez, jan e fev
  })
})

describe('ocorrências e renda', () => {
  it('parcela 5/12 em outubro termina em maio/2027 (RN03)', () => {
    const notebook = dados.despesas.find((d) => d.id === 6)!
    const oc = ocorrencias(notebook, '2026-10-01', '2027-12-31')
    expect(oc).toHaveLength(8)
    expect(oc.at(-1)!.data).toBe('2027-05-15')
  })

  it('mensal no dia 31 cai no último dia do mês curto', () => {
    const d = { ...dados.despesas[0], inicio: '2026-01-31' }
    expect(ocorrencias(d, '2026-02-01', '2026-02-28').map((o) => o.data)).toEqual(['2026-02-28'])
  })

  it('valor real da ocorrência substitui o previsto (RN02)', () => {
    const aluguel = dados.despesas[0]
    const oc = ocorrencias(aluguel, '2026-11-01', '2026-11-30', [{ id: 1, despesaId: 1, data: '2026-11-05', valorRealCentavos: 250000, paga: true }])
    expect(oc[0]).toMatchObject({ valorCentavos: 250000, real: true, paga: true })
  })

  it('reajuste vale a partir da data e não muda o passado (RN06)', () => {
    const r = { ...dados.rendas[0], valores: [{ desde: '2026-03', valorCentavos: 620000 }, { desde: '2026-11', valorCentavos: 680000 }] } as typeof dados.rendas[0] & { tipo: 'fixa' }
    expect(valorRendaFixa(r as never, '2026-10')).toBe(620000)
    expect(valorRendaFixa(r as never, '2026-11')).toBe(680000)
    expect(valorRendaFixa(r as never, '2026-02')).toBe(0)
  })

  it('13º repetido todo ano entra nos anos seguintes', () => {
    const r = { ...dados, rendas: [{ ...dados.rendas[3], repeteAnual: true } as never] }
    expect(projetar(r, '2027-11', 1).meses[0].pontuais).toBe(310000)
  })

  it('sugestões RN09 e janela de 12 meses a partir do mês seguinte', () => {
    expect(sugerirValor('13o', 620000)).toBe(310000)
    expect(sugerirValor('ferias', 620000)).toBe(206667)
    expect(sugerirValor('bico', 620000)).toBeNull()
    expect(proximoMes('2026-10-29')).toBe('2026-11')
    expect(proximoMes('2026-12-31')).toBe('2027-01')
  })
})
