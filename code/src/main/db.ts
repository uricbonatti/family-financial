// SQLite local (RNF01) pelo módulo nativo do Node (node:sqlite): sem dependência para compilar.
// Modelo relacional com chaves estrangeiras e restrições (CHECK/UNIQUE); a interface continua recebendo `Dados`.
import { copyFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import type { Kind } from '../shared/api'
import { dadosExemplo } from '../shared/domain/exemplo'
import { FUNDOS_PADRAO, type CartaoConfig, type Dados, type Despesa, type FundosConfig, type Plano, type Renda } from '../shared/domain/tipos'

const TABELA: Record<Kind, string> = { membro: 'membro', categoria: 'categoria', renda: 'renda', despesa: 'despesa', ocorrencia: 'ocorrencia_real', plano: 'plano' }

// Ordem segura para apagar (filhas antes das mães).
const APAGAR = ['config_geral', 'config_cartao', 'fundos_faixa', 'fundos_destino', 'fundos_config', 'plano_item', 'plano', 'ocorrencia_real', 'despesa', 'renda_parcela', 'renda_valor', 'renda', 'categoria', 'membro']

const ESQUEMA = `
CREATE TABLE membro (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(nome)) > 0)
);
CREATE TABLE categoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(trim(nome)) > 0),
  cor TEXT NOT NULL,
  natureza TEXT NOT NULL CHECK (natureza IN ('essencial','flexivel','protegida')),
  corte_pct INTEGER NOT NULL CHECK (corte_pct BETWEEN 0 AND 100)
);
CREATE TABLE renda (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL CHECK (tipo IN ('fixa','pontual')),
  membro_id INTEGER REFERENCES membro(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL CHECK (length(trim(descricao)) > 0),
  dia_recebimento INTEGER, inicio TEXT, fim TEXT,
  classe TEXT CHECK (classe IN ('13o','ferias','bico','freelance','outro')),
  valor_centavos INTEGER CHECK (valor_centavos > 0),
  data TEXT, situacao TEXT CHECK (situacao IN ('prevista','recebida')),
  repete_anual INTEGER NOT NULL DEFAULT 0 CHECK (repete_anual IN (0,1)),
  valor_real_centavos INTEGER CHECK (valor_real_centavos >= 0),
  vale INTEGER NOT NULL DEFAULT 0 CHECK (vale IN (0,1)),
  CHECK (
    (tipo = 'fixa' AND dia_recebimento BETWEEN 1 AND 31 AND inicio IS NOT NULL)
    OR (tipo = 'pontual' AND classe IS NOT NULL AND valor_centavos IS NOT NULL AND data IS NOT NULL AND situacao IS NOT NULL)
  )
);
CREATE TABLE renda_valor (
  renda_id INTEGER NOT NULL REFERENCES renda(id) ON DELETE CASCADE,
  desde TEXT NOT NULL CHECK (desde GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  PRIMARY KEY (renda_id, desde)
);
CREATE TABLE renda_parcela (
  renda_id INTEGER NOT NULL REFERENCES renda(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('dia','util')),
  n INTEGER NOT NULL CHECK (n BETWEEN 1 AND 31),
  pct REAL NOT NULL CHECK (pct > 0 AND pct <= 100),
  PRIMARY KEY (renda_id, ordem)
);
CREATE TABLE config_geral (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  janela_recebimento INTEGER NOT NULL DEFAULT 0 CHECK (janela_recebimento IN (0,1))
);
CREATE TABLE despesa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao TEXT NOT NULL CHECK (length(trim(descricao)) > 0),
  categoria_id INTEGER NOT NULL REFERENCES categoria(id) ON DELETE RESTRICT,
  membro_id INTEGER REFERENCES membro(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('pontual','recorrente','parcelada')),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0),
  n_parcelas INTEGER CHECK (n_parcelas >= 1),
  periodicidade TEXT CHECK (periodicidade IN ('mensal','anual','badi19')),
  inicio TEXT NOT NULL, fim TEXT,
  natureza TEXT NOT NULL CHECK (natureza IN ('essencial','flexivel','protegida')),
  status TEXT NOT NULL CHECK (status IN ('planejada','ativa','encerrada','cancelada')),
  irredutivel INTEGER NOT NULL DEFAULT 0 CHECK (irredutivel IN (0,1)),
  mercado INTEGER NOT NULL DEFAULT 0 CHECK (mercado IN (0,1)),
  pagamento TEXT NOT NULL DEFAULT 'avista' CHECK (pagamento IN ('avista','boleto','cartao')),
  CHECK (tipo <> 'parcelada' OR n_parcelas IS NOT NULL),
  CHECK (tipo <> 'recorrente' OR periodicidade IS NOT NULL)
);
CREATE INDEX despesa_categoria ON despesa(categoria_id);
CREATE TABLE ocorrencia_real (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  despesa_id INTEGER NOT NULL REFERENCES despesa(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  valor_real_centavos INTEGER NOT NULL CHECK (valor_real_centavos >= 0),
  paga INTEGER NOT NULL DEFAULT 0 CHECK (paga IN (0,1)),
  UNIQUE (despesa_id, data)
);
CREATE TABLE plano (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  meta_mensal_centavos INTEGER NOT NULL CHECK (meta_mensal_centavos >= 0),
  prazo TEXT NOT NULL, criado_em TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 0 CHECK (ativo IN (0,1))
);
CREATE UNIQUE INDEX plano_um_ativo ON plano(ativo) WHERE ativo = 1;
CREATE TABLE plano_item (
  plano_id INTEGER NOT NULL REFERENCES plano(id) ON DELETE CASCADE,
  categoria_id INTEGER NOT NULL REFERENCES categoria(id) ON DELETE CASCADE,
  corte_pct REAL NOT NULL CHECK (corte_pct BETWEEN 0 AND 100),
  PRIMARY KEY (plano_id, categoria_id)
);
CREATE TABLE fundos_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  modo TEXT NOT NULL CHECK (modo IN ('fixo','pctRenda','faixa')),
  valor_festa_centavos INTEGER NOT NULL CHECK (valor_festa_centavos >= 0),
  avisar_dias_antes INTEGER NOT NULL CHECK (avisar_dias_antes >= 0),
  pct_renda REAL CHECK (pct_renda BETWEEN 0 AND 100),
  extra_pontuais_pct REAL CHECK (extra_pontuais_pct BETWEEN 0 AND 100),
  reserva_ayyam_centavos INTEGER CHECK (reserva_ayyam_centavos >= 0),
  modo_privado INTEGER NOT NULL DEFAULT 0 CHECK (modo_privado IN (0,1)),
  despesa_id INTEGER REFERENCES despesa(id) ON DELETE SET NULL
);
CREATE TABLE config_cartao (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  dia_fechamento INTEGER NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31),
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31)
);
CREATE TABLE fundos_faixa (
  ordem INTEGER PRIMARY KEY,
  ate_centavos INTEGER CHECK (ate_centavos > 0),
  valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0)
);
CREATE TABLE fundos_destino (
  fundo TEXT PRIMARY KEY,
  pct INTEGER NOT NULL CHECK (pct BETWEEN 0 AND 100),
  ordem INTEGER NOT NULL
);
`

type Linha = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
const nulo = (v: unknown) => (v === undefined ? null : v)
const bool = (v: unknown) => (v ? 1 : 0)

/** Leitura e escrita de cada entidade; recebe a conexão para servir tanto ao app quanto às migrações. */
function repo(db: DatabaseSync) {
  const todas = (sql: string): Linha[] => db.prepare(sql).all() as Linha[]

  const upsert = (tabela: string, linha: Record<string, unknown>, chave = 'id'): number => {
    const cols = Object.keys(linha)
    const sql = `INSERT INTO ${tabela} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})` +
      ` ON CONFLICT(${chave}) DO UPDATE SET ${cols.filter((c) => c !== chave).map((c) => `${c}=excluded.${c}`).join(',')}`
    const r = db.prepare(sql).run(...cols.map((c) => nulo(linha[c]) as SQLInputValue))
    return linha.id ? Number(linha.id) : Number(r.lastInsertRowid)
  }

  const salvarRenda = (r: Renda): number => {
    const comum = { id: nulo(r.id) || null, tipo: r.tipo, membro_id: nulo(r.membroId), descricao: r.descricao.trim() }
    if (r.tipo === 'fixa') {
      const id = upsert('renda', { ...comum, dia_recebimento: r.diaRecebimento, inicio: r.inicio, fim: nulo(r.fim), repete_anual: 0, vale: bool(r.vale) })
      db.prepare('DELETE FROM renda_valor WHERE renda_id = ?').run(id)
      for (const v of r.valores) db.prepare('INSERT INTO renda_valor (renda_id, desde, valor_centavos) VALUES (?,?,?)').run(id, v.desde, v.valorCentavos)
      db.prepare('DELETE FROM renda_parcela WHERE renda_id = ?').run(id)
      if (r.parcelas?.length && Math.abs(r.parcelas.reduce((s, p) => s + p.pct, 0) - 100) > 0.001) throw new Error('As parcelas da renda devem somar 100%.')
      ;(r.parcelas ?? []).forEach((p, i) => db.prepare('INSERT INTO renda_parcela (renda_id, ordem, tipo, n, pct) VALUES (?,?,?,?,?)').run(id, i, p.tipo, p.n, p.pct))
      return id
    }
    return upsert('renda', {
      ...comum, classe: r.classe, valor_centavos: r.valorCentavos, data: r.data, situacao: r.situacao, repete_anual: bool(r.repeteAnual), valor_real_centavos: nulo(r.valorRealCentavos)
    })
  }

  const salvarDespesa = (d: Despesa): number =>
    upsert('despesa', {
      id: nulo(d.id) || null, descricao: d.descricao.trim(), categoria_id: d.categoriaId, membro_id: nulo(d.membroId), tipo: d.tipo, valor_centavos: d.valorCentavos,
      n_parcelas: nulo(d.nParcelas), periodicidade: nulo(d.periodicidade), inicio: d.inicio, fim: nulo(d.fim), natureza: d.natureza, status: d.status, irredutivel: bool(d.irredutivel), mercado: bool(d.mercado), pagamento: d.pagamento ?? 'avista'
    })

  const salvarJanela = (ativa: boolean) => {
    upsert('config_geral', { id: 1, janela_recebimento: bool(ativa) })
  }

  const salvarCartao = (c: CartaoConfig | null | undefined) => {
    db.exec('DELETE FROM config_cartao')
    if (c) db.prepare('INSERT INTO config_cartao (id, dia_fechamento, dia_vencimento) VALUES (1,?,?)').run(c.diaFechamento, c.diaVencimento)
  }

  const salvarPlano = (p: Plano): number => {
    const id = upsert('plano', { id: nulo(p.id) || null, nome: p.nome, meta_mensal_centavos: p.metaMensalCentavos, prazo: p.prazo, criado_em: p.criadoEm, ativo: bool(p.ativo) })
    db.prepare('DELETE FROM plano_item WHERE plano_id = ?').run(id)
    for (const [cat, pct] of Object.entries(p.cortesPct ?? {})) {
      db.prepare('INSERT INTO plano_item (plano_id, categoria_id, corte_pct) VALUES (?,?,?)').run(id, Number(cat), pct)
    }
    return id
  }

  const salvarFundos = (f: FundosConfig) => {
    upsert('fundos_config', {
      id: 1, modo: f.modo, valor_festa_centavos: f.valorFestaCentavos, pct_renda: nulo(f.pctRenda), avisar_dias_antes: f.avisarDiasAntes, extra_pontuais_pct: nulo(f.extraSobrePontuaisPct),
      reserva_ayyam_centavos: nulo(f.reservaAyyamIHaCentavos), modo_privado: bool(f.modoPrivado), despesa_id: nulo(f.despesaId)
    })
    db.exec('DELETE FROM fundos_destino')
    f.distribuicao.forEach((d, i) => db.prepare('INSERT INTO fundos_destino (fundo, pct, ordem) VALUES (?,?,?)').run(d.fundo, d.pct, i))
    db.exec('DELETE FROM fundos_faixa')
    ;(f.faixas ?? []).forEach((x, i) => db.prepare('INSERT INTO fundos_faixa (ordem, ate_centavos, valor_centavos) VALUES (?,?,?)').run(i, nulo(x.ateCentavos) as SQLInputValue, x.valorCentavos))
  }

  const salvar = (kind: Kind, o: object): number => {
    const x = o as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    switch (kind) {
      case 'membro': return upsert('membro', { id: nulo(x.id) || null, nome: x.nome.trim() })
      case 'categoria': return upsert('categoria', { id: nulo(x.id) || null, nome: x.nome.trim(), cor: x.cor, natureza: x.natureza, corte_pct: x.cortePct })
      case 'renda': return salvarRenda(x as Renda)
      case 'despesa': return salvarDespesa(x as Despesa)
      case 'ocorrencia': return upsert('ocorrencia_real', { id: nulo(x.id) || null, despesa_id: x.despesaId, data: x.data, valor_real_centavos: x.valorRealCentavos, paga: bool(x.paga) })
      case 'plano': return salvarPlano(x as Plano)
    }
  }

  const carregar = (): Dados => {
    const valores = todas('SELECT * FROM renda_valor ORDER BY renda_id, desde')
    const itens = todas('SELECT * FROM plano_item')
    const parcelas = todas('SELECT * FROM renda_parcela ORDER BY renda_id, ordem')
    const cfg = (todas('SELECT * FROM fundos_config')[0] as Linha | undefined)
    const dist = todas('SELECT fundo, pct FROM fundos_destino ORDER BY ordem')
    const faixas = todas('SELECT ate_centavos, valor_centavos FROM fundos_faixa ORDER BY ordem').map((x) => ({ ateCentavos: x.ate_centavos as number | null, valorCentavos: x.valor_centavos as number }))
    return {
      membros: todas('SELECT id, nome FROM membro ORDER BY id').map((r) => ({ id: r.id, nome: r.nome })),
      categorias: todas('SELECT * FROM categoria ORDER BY id').map((r) => ({ id: r.id, nome: r.nome, cor: r.cor, natureza: r.natureza, cortePct: r.corte_pct })),
      rendas: todas('SELECT * FROM renda ORDER BY id').map((r): Renda =>
        r.tipo === 'fixa'
          ? {
              id: r.id, tipo: 'fixa', membroId: r.membro_id, descricao: r.descricao, diaRecebimento: r.dia_recebimento, inicio: r.inicio, fim: r.fim, vale: !!r.vale,
              parcelas: parcelas.filter((p) => p.renda_id === r.id).map((p) => ({ tipo: p.tipo, n: p.n, pct: p.pct })),
              valores: valores.filter((v) => v.renda_id === r.id).map((v) => ({ desde: v.desde, valorCentavos: v.valor_centavos }))
            }
          : {
              id: r.id, tipo: 'pontual', membroId: r.membro_id, descricao: r.descricao, classe: r.classe, valorCentavos: r.valor_centavos, data: r.data,
              situacao: r.situacao, repeteAnual: !!r.repete_anual, valorRealCentavos: r.valor_real_centavos
            }
      ),
      despesas: todas('SELECT * FROM despesa ORDER BY id').map((r): Despesa => ({
        id: r.id, descricao: r.descricao, categoriaId: r.categoria_id, membroId: r.membro_id, tipo: r.tipo, valorCentavos: r.valor_centavos,
        ...(r.n_parcelas != null ? { nParcelas: r.n_parcelas } : {}), ...(r.periodicidade ? { periodicidade: r.periodicidade } : {}),
        inicio: r.inicio, fim: r.fim, natureza: r.natureza, status: r.status, irredutivel: !!r.irredutivel, mercado: !!r.mercado, pagamento: r.pagamento
      })),
      janelaRecebimento: !!todas('SELECT janela_recebimento FROM config_geral')[0]?.janela_recebimento,
      cartao: ((c) => (c ? { diaFechamento: c.dia_fechamento, diaVencimento: c.dia_vencimento } : null))(todas('SELECT * FROM config_cartao')[0]),
      reais: todas('SELECT * FROM ocorrencia_real ORDER BY id').map((r) => ({ id: r.id, despesaId: r.despesa_id, data: r.data, valorRealCentavos: r.valor_real_centavos, paga: !!r.paga })),
      planos: todas('SELECT * FROM plano ORDER BY id').map((r): Plano => {
        const meus = itens.filter((i) => i.plano_id === r.id)
        return {
          id: r.id, nome: r.nome, metaMensalCentavos: r.meta_mensal_centavos, prazo: r.prazo, criadoEm: r.criado_em, ativo: !!r.ativo,
          cortesPct: Object.fromEntries(meus.map((i) => [i.categoria_id, i.corte_pct]))
        }
      }),
      fundos: cfg
        ? {
            modo: cfg.modo, valorFestaCentavos: cfg.valor_festa_centavos, pctRenda: cfg.pct_renda, faixas: faixas.length ? faixas : FUNDOS_PADRAO.faixas, distribuicao: dist.length ? (dist as FundosConfig['distribuicao']) : FUNDOS_PADRAO.distribuicao,
            avisarDiasAntes: cfg.avisar_dias_antes, extraSobrePontuaisPct: cfg.extra_pontuais_pct, reservaAyyamIHaCentavos: cfg.reserva_ayyam_centavos,
            modoPrivado: !!cfg.modo_privado, despesaId: cfg.despesa_id
          }
        : FUNDOS_PADRAO
    }
  }

  /** Grava um conjunto completo preservando ids; a ordem respeita as chaves estrangeiras. */
  const inserirTudo = (d: Dados) => {
    for (const m of d.membros) salvar('membro', m)
    for (const c of d.categorias) salvar('categoria', c)
    for (const x of d.despesas) salvar('despesa', x)
    for (const r of d.rendas) salvar('renda', r)
    for (const o of d.reais) salvar('ocorrencia', o)
    for (const p of d.planos) salvar('plano', p)
    salvarFundos({ ...FUNDOS_PADRAO, ...d.fundos })
    salvarCartao(d.cartao)
    salvarJanela(!!d.janelaRecebimento)
  }

  return { salvar, salvarFundos, salvarCartao, salvarJanela, carregar, inserirTudo }
}

// RNF06: migrações versionadas (PRAGMA user_version). Acrescente novas ao fim; nunca altere as antigas.
const MIGRACOES: ((db: DatabaseSync) => void)[] = [
  // v1: primeira versão guardava cada registro como JSON.
  (db) => {
    for (const k of ['membro', 'categoria', 'renda', 'despesa', 'ocorrencia', 'plano']) db.exec(`CREATE TABLE ${k} (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL)`)
    db.exec('CREATE TABLE config (chave TEXT PRIMARY KEY, data TEXT NOT NULL)')
  },
  // v2: modelo relacional; converte os registros JSON da v1 e apaga as tabelas antigas.
  (db) => {
    const velho = (k: string) => (db.prepare(`SELECT id, data FROM ${k} ORDER BY id`).all() as { id: number; data: string }[]).map((l) => ({ id: l.id, ...JSON.parse(l.data) }))
    const fundos = db.prepare("SELECT data FROM config WHERE chave = 'fundos'").get() as { data: string } | undefined
    const dados = {
      membros: velho('membro'), categorias: velho('categoria'), rendas: velho('renda'), despesas: velho('despesa'), reais: velho('ocorrencia'), planos: velho('plano'),
      fundos: { ...FUNDOS_PADRAO, ...(fundos ? JSON.parse(fundos.data) : {}) }
    } as Dados
    // planos da v1 guardavam corte e alvo em centavos: vira % do gasto (alvo + corte)
    dados.planos = dados.planos.map((p) => {
      const v1 = p as unknown as { cortes?: Record<number, number>; alvos?: Record<number, number> }
      const cortesPct = Object.fromEntries(Object.entries(v1.cortes ?? {}).map(([c, corte]) => [c, (corte / ((v1.alvos?.[Number(c)] ?? 0) + corte)) * 100]))
      return { ...p, cortesPct }
    })
    for (const k of ['membro', 'categoria', 'renda', 'despesa', 'ocorrencia', 'plano', 'config']) db.exec(`DROP TABLE ${k}`)
    db.exec(ESQUEMA)
    repo(db).inserirTudo(dados)
  },
  // v3: modo de contribuição por faixa. Bancos v2 criados antes desta mudança ganham a coluna e a tabela; os novos já nascem com elas.
  (db) => {
    if (db.prepare("SELECT 1 FROM pragma_table_info('fundos_config') WHERE name = 'pct_renda'").get()) return
    db.exec('ALTER TABLE fundos_config ADD COLUMN pct_renda REAL CHECK (pct_renda BETWEEN 0 AND 100)')
    db.exec('CREATE TABLE fundos_faixa (ordem INTEGER PRIMARY KEY, ate_centavos INTEGER CHECK (ate_centavos > 0), valor_centavos INTEGER NOT NULL CHECK (valor_centavos > 0))')
  },
  // v4: VR/VA (renda.vale) e marcação de mercado (despesa.mercado). Só acrescenta colunas com padrão 0: os dados gravados ficam intactos.
  (db) => {
    const tem = (t: string, c: string) => db.prepare(`SELECT 1 FROM pragma_table_info('${t}') WHERE name = ?`).get(c)
    if (!tem('renda', 'vale')) db.exec('ALTER TABLE renda ADD COLUMN vale INTEGER NOT NULL DEFAULT 0 CHECK (vale IN (0,1))')
    if (!tem('despesa', 'mercado')) db.exec('ALTER TABLE despesa ADD COLUMN mercado INTEGER NOT NULL DEFAULT 0 CHECK (mercado IN (0,1))')
    // e a forma de pagamento (despesas antigas = à vista) mais a janela do cartão
    if (!tem('despesa', 'pagamento')) db.exec("ALTER TABLE despesa ADD COLUMN pagamento TEXT NOT NULL DEFAULT 'avista' CHECK (pagamento IN ('avista','boleto','cartao'))")
    db.exec('CREATE TABLE IF NOT EXISTS config_cartao (id INTEGER PRIMARY KEY CHECK (id = 1), dia_fechamento INTEGER NOT NULL CHECK (dia_fechamento BETWEEN 1 AND 31), dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31))')
  },
  // v5: recebimento em parcelas (renda_parcela) e janela do mês pelo 1º recebimento (config_geral, desligada por padrão). Só cria tabelas: nada existente muda.
  (db) => {
    db.exec('CREATE TABLE IF NOT EXISTS renda_parcela (renda_id INTEGER NOT NULL REFERENCES renda(id) ON DELETE CASCADE, ordem INTEGER NOT NULL, tipo TEXT NOT NULL CHECK (tipo IN (\'dia\',\'util\')), n INTEGER NOT NULL CHECK (n BETWEEN 1 AND 31), pct REAL NOT NULL CHECK (pct > 0 AND pct <= 100), PRIMARY KEY (renda_id, ordem))')
    db.exec('CREATE TABLE IF NOT EXISTS config_geral (id INTEGER PRIMARY KEY CHECK (id = 1), janela_recebimento INTEGER NOT NULL DEFAULT 0 CHECK (janela_recebimento IN (0,1)))')
  }
]

export function abrirBanco(arquivo: string, pastaBackup: string) {
  const existia = existsSync(arquivo)
  const db = new DatabaseSync(arquivo)
  db.exec('PRAGMA foreign_keys = ON')
  const versao = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version
  if (existia && versao < MIGRACOES.length) {
    mkdirSync(pastaBackup, { recursive: true })
    copyFileSync(arquivo, join(pastaBackup, `pre-migracao-v${versao}.db`))
  }
  for (let v = versao; v < MIGRACOES.length; v++) {
    db.exec('BEGIN')
    try {
      MIGRACOES[v](db)
      db.exec(`PRAGMA user_version = ${v + 1}`)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }

  const r = repo(db)
  const transacao = <T>(fn: () => T): T => {
    db.exec('BEGIN')
    try {
      const x = fn()
      db.exec('COMMIT')
      return x
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
  }
  const amigavel = (e: unknown): never => {
    const msg = e instanceof Error ? e.message : String(e)
    if (/FOREIGN KEY/i.test(msg)) throw new Error('Não é possível concluir: há lançamentos ligados a este item.')
    if (/UNIQUE constraint failed: (membro|categoria)\.nome/i.test(msg)) throw new Error('Já existe um item com esse nome.')
    if (/UNIQUE constraint failed: plano\.ativo/i.test(msg)) throw new Error('Só pode haver um plano ativo.')
    throw e instanceof Error ? e : new Error(msg)
  }

  const salvar = (kind: Kind, obj: object): number => {
    try {
      return transacao(() => r.salvar(kind, obj))
    } catch (e) {
      return amigavel(e)
    }
  }
  const excluir = (kind: Kind, id: number) => {
    try {
      db.prepare(`DELETE FROM ${TABELA[kind]} WHERE id = ?`).run(id)
    } catch (e) {
      amigavel(e)
    }
  }
  const gravarFundos = (f: FundosConfig) => transacao(() => r.salvarFundos(f))
  const gravarCartao = (c: CartaoConfig | null) => transacao(() => r.salvarCartao(c))
  const gravarJanela = (ativa: boolean) => transacao(() => r.salvarJanela(ativa))

  /** Substitui todo o conteúdo (importação e dados de exemplo), preservando os ids. */
  const substituir = (d: Dados) =>
    transacao(() => {
      for (const t of APAGAR) db.exec(`DELETE FROM ${t}`)
      db.exec("DELETE FROM sqlite_sequence WHERE name IN ('" + Object.values(TABELA).join("','") + "')")
      r.inserirTudo(d)
    })

  const categoriasPadrao = () => {
    if ((db.prepare('SELECT count(*) AS n FROM categoria').get() as { n: number }).n === 0) {
      for (const { id: _id, ...c } of dadosExemplo().categorias) r.salvar('categoria', c)
    }
  }
  categoriasPadrao()

  const backup = (pasta: string, nome?: string): string => {
    mkdirSync(pasta, { recursive: true })
    const destino = join(pasta, nome ?? `family-financial-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.db`)
    if (existsSync(destino)) unlinkSync(destino)
    db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`)
    return destino
  }

  /** RF24: um backup por dia, mantendo os 10 mais recentes. */
  const backupAutomatico = () => {
    const hoje = new Date().toLocaleDateString('sv-SE')
    backup(pastaBackup, `auto-${hoje}.db`)
    for (const f of readdirSync(pastaBackup).filter((x) => x.startsWith('auto-')).sort().reverse().slice(10)) unlinkSync(join(pastaBackup, f))
  }

  return { carregar: r.carregar, salvar, excluir, gravarFundos, gravarCartao, gravarJanela, substituir, backup: () => backup(pastaBackup), backupAutomatico, categoriasPadrao, fechar: () => db.close() }
}

export type Banco = ReturnType<typeof abrirBanco>
