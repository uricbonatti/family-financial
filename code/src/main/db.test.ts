import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it } from 'vitest'
import { dadosExemplo } from '../shared/domain/exemplo'
import { abrirBanco } from './db'

const pastas: string[] = []
const pasta = () => {
  const p = mkdtempSync(join(tmpdir(), 'ff-'))
  pastas.push(p)
  return p
}
const novo = () => {
  const p = pasta()
  return abrirBanco(join(p, 'teste.db'), join(p, 'backups'))
}
afterEach(() => pastas.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true })))

const despesa = (extra: object = {}) => ({ descricao: 'Aluguel', categoriaId: 1, tipo: 'recorrente', periodicidade: 'mensal', valorCentavos: 100, inicio: '2026-01-05', natureza: 'essencial', status: 'ativa', ...extra })
const plano = (extra: object = {}) => ({ nome: 'A', metaMensalCentavos: 100, prazo: '2027-03', criadoEm: '2026-10-29', cortesPct: {}, ativo: false, ...extra })

describe('banco SQLite relacional', () => {
  it('primeira abertura cria as categorias padrão', () => {
    const b = novo()
    expect(b.carregar().categorias.map((c) => c.nome)).toContain('Fundos Bahá’ís')
    b.fechar()
  })

  it('cria, atualiza e exclui; excluir despesa apaga os valores reais dela (cascata)', () => {
    const b = novo()
    const id = b.salvar('despesa', despesa())
    b.salvar('ocorrencia', { despesaId: id, data: '2026-02-05', valorRealCentavos: 120, paga: true })
    expect(b.salvar('despesa', { ...despesa({ descricao: 'Aluguel 2', valorCentavos: 200 }), id })).toBe(id)
    expect(b.carregar().despesas[0]).toMatchObject({ id, descricao: 'Aluguel 2', valorCentavos: 200, irredutivel: false })
    b.excluir('despesa', id)
    expect(b.carregar().despesas).toHaveLength(0)
    expect(b.carregar().reais).toHaveLength(0)
    b.fechar()
  })

  it('guarda a marca de valor irredutível', () => {
    const b = novo()
    b.salvar('despesa', despesa({ irredutivel: true }))
    expect(b.carregar().despesas[0].irredutivel).toBe(true)
    b.fechar()
  })

  it('chaves estrangeiras: categoria em uso não é excluída; excluir membro devolve o lançamento à Família', () => {
    const b = novo()
    const m = b.salvar('membro', { nome: 'Maria' })
    b.salvar('despesa', despesa({ membroId: m }))
    expect(() => b.excluir('categoria', 1)).toThrow(/ligados/)
    expect(b.carregar().categorias.some((c) => c.id === 1)).toBe(true)
    b.excluir('membro', m)
    expect(b.carregar().despesas[0].membroId).toBeNull()
    b.fechar()
  })

  it('restrições: nome único, valores válidos e um só plano ativo', () => {
    const b = novo()
    b.salvar('membro', { nome: 'Maria' })
    expect(() => b.salvar('membro', { nome: 'maria' })).toThrow(/nome/)
    expect(() => b.salvar('despesa', despesa({ valorCentavos: 0 }))).toThrow()
    expect(() => b.salvar('despesa', despesa({ categoriaId: 999 }))).toThrow(/ligados/)
    expect(() => b.salvar('despesa', despesa({ tipo: 'parcelada' }))).toThrow() // parcelada exige nParcelas
    b.salvar('plano', plano({ cortesPct: { 3: 25.5 }, ativo: true }))
    expect(() => b.salvar('plano', plano({ nome: 'B', ativo: true }))).toThrow(/plano ativo/)
    expect(b.carregar().planos[0].cortesPct).toEqual({ 3: 25.5 })
    b.fechar()
  })

  it('renda fixa guarda o histórico de valores em tabela própria', () => {
    const b = novo()
    const id = b.salvar('renda', { tipo: 'fixa', descricao: 'Salário', diaRecebimento: 5, inicio: '2026-03-01', valores: [{ desde: '2026-03', valorCentavos: 620000 }, { desde: '2026-11', valorCentavos: 680000 }] })
    const r = b.carregar().rendas[0]
    expect(r).toMatchObject({ id, tipo: 'fixa', valores: [{ desde: '2026-03', valorCentavos: 620000 }, { desde: '2026-11', valorCentavos: 680000 }] })
    b.salvar('renda', { ...r, valores: [{ desde: '2026-03', valorCentavos: 700000 }] })
    expect((b.carregar().rendas[0] as { valores: unknown[] }).valores).toHaveLength(1)
    b.fechar()
  })

  it('substituir preserva ids, plano e fundos (exemplo e importação)', () => {
    const b = novo()
    const ex = dadosExemplo()
    b.substituir({ ...ex, planos: [{ id: 1, nome: 'P', metaMensalCentavos: 48000, prazo: '2027-03', criadoEm: '2026-10-29', cortesPct: { 4: 50, 3: 5 }, ativo: true }] })
    const d = b.carregar()
    expect(d.despesas).toHaveLength(11)
    expect(d.despesas.find((x) => x.descricao === 'Notebook')?.id).toBe(6)
    expect(d.fundos).toMatchObject({ despesaId: 5, valorFestaCentavos: 20000 })
    expect(d.fundos.distribuicao).toEqual(ex.fundos.distribuicao)
    expect(d.planos[0].cortesPct).toEqual({ 3: 5, 4: 50 })
    b.fechar()
  })

  it('fundos: modo faixa e % da renda fazem round-trip', () => {
    const b = novo()
    const f = { ...dadosExemplo().fundos, despesaId: null, modo: 'faixa' as const, pctRenda: 1.5, faixas: [{ ateCentavos: 500000, valorCentavos: 10000 }, { ateCentavos: null, valorCentavos: 25000 }] }
    b.gravarFundos(f)
    expect(b.carregar().fundos).toMatchObject({ modo: 'faixa', pctRenda: 1.5, faixas: f.faixas, valorFestaCentavos: 20000 })
    expect(() => b.gravarFundos({ ...f, faixas: [{ ateCentavos: 0, valorCentavos: 1 }] })).toThrow()
    expect(b.carregar().fundos.faixas).toEqual(f.faixas) // a falha não deixa a tabela pela metade
    b.fechar()
  })

  it('migração v3: banco v2 sem as colunas de faixa ganha a estrutura e mantém os dados', () => {
    const p = pasta()
    const arq = join(p, 'v2.db')
    const b = abrirBanco(arq, join(p, 'bk'))
    b.substituir(dadosExemplo())
    b.fechar()
    const v2 = new DatabaseSync(arq)
    v2.exec('DROP TABLE fundos_faixa; ALTER TABLE fundos_config DROP COLUMN pct_renda; PRAGMA user_version = 2')
    v2.close()
    const b2 = abrirBanco(arq, join(p, 'bk'))
    const d = b2.carregar()
    expect(d.despesas).toHaveLength(11)
    expect(d.fundos).toMatchObject({ valorFestaCentavos: 20000, despesaId: 5, pctRenda: null })
    b2.gravarFundos({ ...d.fundos, modo: 'faixa' })
    expect(b2.carregar().fundos.modo).toBe('faixa')
    b2.fechar()
  })

  it('migração v4: banco v3 ganha VR/VA e mercado sem perder nada e deixa backup', () => {
    const p = pasta()
    const arq = join(p, 'v3.db')
    const b = abrirBanco(arq, join(p, 'bk'))
    b.substituir(dadosExemplo())
    const antes = b.carregar()
    b.fechar()
    const v3 = new DatabaseSync(arq)
    v3.exec('ALTER TABLE renda DROP COLUMN vale; ALTER TABLE despesa DROP COLUMN mercado; ALTER TABLE despesa DROP COLUMN pagamento; DROP TABLE config_cartao; PRAGMA user_version = 3')
    v3.close()
    const b2 = abrirBanco(arq, join(p, 'bk'))
    const d = b2.carregar()
    expect(d).toEqual(antes) // nenhum registro mudou (vale/mercado voltam como falso)
    expect(existsSync(join(p, 'bk', 'pre-migracao-v3.db'))).toBe(true)
    expect(d.cartao).toBeNull()
    b2.gravarCartao({ diaFechamento: 25, diaVencimento: 5 })
    expect(b2.carregar().cartao).toEqual({ diaFechamento: 25, diaVencimento: 5 })
    expect(() => b2.gravarCartao({ diaFechamento: 0, diaVencimento: 5 })).toThrow()
    const id = b2.salvar('despesa', despesa({ mercado: true, pagamento: 'cartao' }))
    b2.salvar('renda', { tipo: 'fixa', descricao: 'VR', diaRecebimento: 1, inicio: '2026-01-01', vale: true, valores: [{ desde: '2026-01', valorCentavos: 100000 }] })
    const n = b2.carregar()
    expect(n.despesas.find((x) => x.id === id)).toMatchObject({ mercado: true, pagamento: 'cartao' })
    expect(n.rendas.find((x) => x.descricao === 'VR')).toMatchObject({ vale: true })
    b2.fechar()
  })

  it('migração v5: banco v4 ganha parcelas e janela sem mudar nada; parcelas somam 100%', () => {
    const p = pasta()
    const arq = join(p, 'v4.db')
    const b = abrirBanco(arq, join(p, 'bk'))
    b.substituir(dadosExemplo())
    const antes = b.carregar()
    b.fechar()
    const v4 = new DatabaseSync(arq)
    v4.exec('DROP TABLE renda_parcela; DROP TABLE config_geral; PRAGMA user_version = 4')
    v4.close()
    const b2 = abrirBanco(arq, join(p, 'bk'))
    expect(b2.carregar()).toEqual(antes)
    expect(existsSync(join(p, 'bk', 'pre-migracao-v4.db'))).toBe(true)
    const r = { tipo: 'fixa', descricao: 'Salário 2', diaRecebimento: 20, inicio: '2026-01-01', valores: [{ desde: '2026-01', valorCentavos: 100000 }] }
    expect(() => b2.salvar('renda', { ...r, parcelas: [{ tipo: 'dia', n: 20, pct: 40 }] })).toThrow(/100%/)
    b2.salvar('renda', { ...r, parcelas: [{ tipo: 'dia', n: 20, pct: 40 }, { tipo: 'util', n: 5, pct: 60 }] })
    b2.gravarJanela(true)
    const n = b2.carregar()
    expect(n.janelaRecebimento).toBe(true)
    expect(n.rendas.find((x) => x.descricao === 'Salário 2')).toMatchObject({ parcelas: [{ tipo: 'dia', n: 20, pct: 40 }, { tipo: 'util', n: 5, pct: 60 }] })
    b2.fechar()
  })

  it('importação inválida (categoria inexistente) desfaz tudo e mantém os dados anteriores', () => {
    const b = novo()
    b.substituir(dadosExemplo())
    const ruim = { ...dadosExemplo(), despesas: [{ ...dadosExemplo().despesas[0], categoriaId: 999 }] }
    expect(() => b.substituir(ruim)).toThrow()
    expect(b.carregar().despesas).toHaveLength(11)
    b.fechar()
  })

  it('backup gera arquivo e reabrir mantém os dados', () => {
    const p = pasta()
    const arq = join(p, 'a.db')
    const b = abrirBanco(arq, join(p, 'bk'))
    b.salvar('membro', { nome: 'Maria' })
    const bk = b.backup()
    b.fechar()
    const b2 = abrirBanco(arq, join(p, 'bk'))
    expect(b2.carregar().membros).toEqual([{ id: 1, nome: 'Maria' }])
    b2.fechar()
    const b3 = abrirBanco(bk, join(p, 'bk2'))
    expect(b3.carregar().membros).toHaveLength(1)
    b3.fechar()
  })

  it('migra um banco v1 (registros JSON) para o modelo relacional sem perder dados', () => {
    const p = pasta()
    const arq = join(p, 'v1.db')
    const v1 = new DatabaseSync(arq)
    for (const k of ['membro', 'categoria', 'renda', 'despesa', 'ocorrencia', 'plano']) v1.exec(`CREATE TABLE ${k} (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL)`)
    v1.exec('CREATE TABLE config (chave TEXT PRIMARY KEY, data TEXT NOT NULL)')
    const ins = (k: string, o: object) => v1.prepare(`INSERT INTO ${k} (data) VALUES (?)`).run(JSON.stringify(o))
    ins('membro', { nome: 'Maria' })
    ins('categoria', { nome: 'Lazer', cor: '#111111', natureza: 'flexivel', cortePct: 50 })
    ins('renda', { tipo: 'fixa', membroId: 1, descricao: 'Salário', diaRecebimento: 5, inicio: '2026-03-01', valores: [{ desde: '2026-03', valorCentavos: 620000 }] })
    ins('despesa', { descricao: 'Cinema', categoriaId: 1, tipo: 'pontual', valorCentavos: 5000, inicio: '2026-10-01', natureza: 'flexivel', status: 'ativa' })
    ins('ocorrencia', { despesaId: 1, data: '2026-10-01', valorRealCentavos: 6000, paga: true })
    ins('plano', { nome: 'Antigo', metaMensalCentavos: 10000, prazo: '2027-03', criadoEm: '2026-10-01', ativo: true, cortes: { 1: 10000 }, alvos: { 1: 30000 } })
    v1.prepare('INSERT INTO config (chave, data) VALUES (?, ?)').run('fundos', JSON.stringify({ modo: 'fixo', valorFestaCentavos: 15000, distribuicao: [{ fundo: 'Local', pct: 100 }], avisarDiasAntes: 2, extraSobrePontuaisPct: null, reservaAyyamIHaCentavos: null, modoPrivado: true, despesaId: 1 }))
    v1.exec('PRAGMA user_version = 1')
    v1.close()

    const b = abrirBanco(arq, join(p, 'backups'))
    const d = b.carregar()
    expect(d.membros).toEqual([{ id: 1, nome: 'Maria' }])
    expect(d.categorias[0]).toMatchObject({ nome: 'Lazer', cortePct: 50 })
    expect(d.rendas[0]).toMatchObject({ descricao: 'Salário', membroId: 1, valores: [{ desde: '2026-03', valorCentavos: 620000 }] })
    expect(d.despesas[0]).toMatchObject({ descricao: 'Cinema', valorCentavos: 5000, irredutivel: false })
    expect(d.reais[0]).toMatchObject({ valorRealCentavos: 6000, paga: true })
    expect(d.planos[0].cortesPct[1]).toBeCloseTo(25, 5) // 10.000 de corte sobre 40.000 de gasto
    expect(d.fundos).toMatchObject({ valorFestaCentavos: 15000, modoPrivado: true, despesaId: 1 })
    b.fechar()
    const verifica = new DatabaseSync(arq)
    expect(verifica.prepare("SELECT name FROM sqlite_master WHERE name = 'config'").all()).toHaveLength(0)
    verifica.close()
    const antes = new DatabaseSync(join(p, 'backups', 'pre-migracao-v1.db'))
    expect(antes.prepare('SELECT count(*) AS n FROM membro').get()).toEqual({ n: 1 })
    antes.close()
  })
})
