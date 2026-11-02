import { useMemo, useState } from 'react'
import { dataBr, mesDe, rotuloMesAno } from '@shared/domain/datas'
import { formatarBRL } from '@shared/domain/dinheiro'
import { parcelasDaRenda, pontuaisDoMes, valorRendaFixa } from '@shared/domain/projecao'
import { MODELOS_RENDA, sugerirValor } from '@shared/domain/sugestoes'
import type { ClasseRenda, ParcelaRenda, Renda, RendaFixa, RendaPontual } from '@shared/domain/tipos'
import { Btn, Campo, Card, Check, Chip, InputBRL, Modal, Nota, Seg } from '../ui'
import { ROTULO_CLASSE, SelectMembro } from '../comuns'
import { useDados } from '../store'

type Modo = 'fixa' | 'pontual' | 'anual'

function FormRenda({ inicial, modoInicial, onClose }: { inicial?: Renda; modoInicial: Modo; onClose: () => void }) {
  const { dados, hoje, mesAtual, mesBase, salvar, excluir, membro , proj } = useDados()
  const fx = inicial?.tipo === 'fixa' ? inicial : undefined
  const pt = inicial?.tipo === 'pontual' ? inicial : undefined
  const [modo, setModo] = useState<Modo>(inicial ? (pt?.repeteAnual ? 'anual' : (inicial.tipo as Modo)) : modoInicial)
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '')
  const [membroId, setMembroId] = useState<number | null>(inicial?.membroId ?? null)
  const atual = fx ? valorRendaFixa(fx, mesAtual) || fx.valores.at(-1)?.valorCentavos || 0 : 0
  const [valor, setValor] = useState<number | null>(fx ? atual : (pt?.valorCentavos ?? null))
  const [desde, setDesde] = useState(mesAtual)
  const [fim, setFim] = useState(fx?.fim ?? '')
  const [classe, setClasse] = useState<ClasseRenda>(pt?.classe ?? 'bico')
  const [data, setData] = useState(pt?.data ?? hoje)
  const [situacao, setSituacao] = useState<'prevista' | 'recebida'>(pt?.situacao ?? 'prevista')
  const [valorReal, setValorReal] = useState<number | null>(pt?.valorRealCentavos ?? null)
  const [vale, setVale] = useState(!!fx?.vale)
  const [parcelas, setParcelas] = useState<ParcelaRenda[]>(fx ? parcelasDaRenda(fx).map((p) => ({ ...p })) : [{ tipo: 'dia', n: 5, pct: 100 }])
  const somaPct = parcelas.reduce((s, p) => s + (Number(p.pct) || 0), 0)
  const mudaParcela = (i: number, p: Partial<ParcelaRenda>) => setParcelas(parcelas.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const [erro, setErro] = useState<string | null>(null)

  const salario = useMemo(
    () => dados.rendas.filter((r): r is RendaFixa => r.tipo === 'fixa' && (!membroId || r.membroId === membroId)).reduce((s, r) => s + valorRendaFixa(r, mesAtual), 0),
    [dados.rendas, membroId, mesAtual]
  )
  const escolherModelo = (i: number) => {
    const m = MODELOS_RENDA[i]
    setClasse(m.classe)
    setDescricao(m.descricao)
    const s = sugerirValor(m.classe, salario)
    if (s) setValor(s)
  }

  const eFixa = modo === 'fixa'
  const parcelasOk = parcelas.length > 0 && Math.abs(somaPct - 100) < 0.001 && parcelas.every((p) => p.n >= 1 && p.n <= 31 && p.pct > 0)
  const valido = !!descricao.trim() && (valor ?? 0) > 0 && (eFixa ? parcelasOk : !!data)

  const montarPontual = (): RendaPontual => ({
    id: inicial?.id ?? 0, tipo: 'pontual', descricao: descricao.trim(), membroId, classe, valorCentavos: valor ?? 0, data, situacao,
    repeteAnual: modo === 'anual', valorRealCentavos: situacao === 'recebida' ? valorReal : null
  })

  const impacto = useMemo(() => {
    if (eFixa || !valido) return null
    const sem = dados.rendas.filter((r) => r.id !== inicial?.id)
    const com = [...sem, { ...montarPontual(), id: -1 }]
    const base = proj({ ...dados, rendas: sem }, mesBase)
    const novo = proj({ ...dados, rendas: com }, mesBase)
    const noMes = novo.meses.find((m) => m.mes === mesDe(data))
    const antes = base.meses.find((m) => m.mes === mesDe(data))
    return { delta12: novo.total - base.total, deltaMes: noMes && antes ? noMes.saldo - antes.saldo : null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, mesBase, eFixa, valido, valor, data, modo, situacao, valorReal])

  const gravar = async () => {
    try {
      if (eFixa) {
        const valores = [...(fx?.valores ?? [])]
        if (!fx || valor !== atual) {
          const i = valores.findIndex((v) => v.desde === desde)
          const novo = { desde, valorCentavos: valor! }
          if (i >= 0) valores[i] = novo
          else valores.push(novo)
        }
        const r: Omit<RendaFixa, 'id'> & { id?: number } = {
          ...(fx ? { id: fx.id } : {}), tipo: 'fixa', membroId, descricao: descricao.trim(), diaRecebimento: parcelas.find((p) => p.tipo === 'dia')?.n ?? 5, parcelas,
          inicio: fx?.inicio ?? desde + '-01', fim: fim || null, vale, valores: valores.sort((a, b) => a.desde.localeCompare(b.desde))
        }
        await salvar('renda', r)
      } else {
        const { id, ...p } = montarPontual()
        await salvar('renda', inicial ? { id, ...p } : p)
      }
      onClose()
    } catch (e) {
      setErro(String(e))
    }
  }

  return (
    <Modal titulo={inicial ? `Editar renda · ${inicial.descricao}` : 'Nova renda'} sub="O tipo define a periodicidade" onClose={onClose}>
      {!inicial && <Seg valor={modo} onChange={setModo} opcoes={[{ v: 'fixa', r: 'Fixa mensal' }, { v: 'pontual', r: 'Pontual' }, { v: 'anual', r: 'Anual (13º, férias)' }]} />}
      {!eFixa && (
        <Campo label="Modelo rápido">
          <div className="chips">
            {MODELOS_RENDA.map((m, i) => <button key={m.rotulo} type="button" aria-pressed={m.classe === classe && (m.descricao === descricao || m.descricao === '')} onClick={() => escolherModelo(i)}>{m.rotulo}</button>)}
          </div>
        </Campo>
      )}
      <Campo label="Descrição"><input value={descricao} onChange={(e) => setDescricao(e.target.value)} autoFocus /></Campo>
      <div className="linha">
        <Campo label={eFixa ? 'Valor líquido mensal' : 'Valor'}><InputBRL valor={valor} onChange={setValor} /></Campo>
        {eFixa ? null
          : <Campo label="Data de recebimento"><input type="date" value={data} onChange={(e) => setData(e.target.value)} /></Campo>}
        <SelectMembro valor={membroId} onChange={setMembroId} />
      </div>
      {!eFixa && salario > 0 && sugerirValor(classe, salario) && <Nota>Sugestão: {classe === '13o' ? '50%' : '1/3'} do salário {membroId ? `de ${membro(membroId)}` : 'da família'} ({formatarBRL(salario)}) = {formatarBRL(sugerirValor(classe, salario)!)}.</Nota>}
      {eFixa && (
        <div className="linha">
          <Campo label={fx ? 'O novo valor vale a partir de' : 'Recebe desde'}><input type="month" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
          <Campo label="Encerrar em (opcional)"><input type="date" value={fim ?? ''} onChange={(e) => setFim(e.target.value)} /></Campo>
        </div>
      )}
      {eFixa && (
        <Campo label="Recebimento (parcelas)">
          {parcelas.map((p, i) => (
            <div className="acoes" key={i} style={{ justifyContent: 'flex-start' }}>
              <select className="btn" aria-label="Tipo de dia" value={p.tipo} onChange={(e) => mudaParcela(i, { tipo: e.target.value as ParcelaRenda['tipo'] })}>
                <option value="dia">Dia fixo do mês</option><option value="util">Nº dia útil</option>
              </select>
              <input type="number" min={1} max={31} aria-label="Dia" value={p.n} onChange={(e) => mudaParcela(i, { n: Number(e.target.value) })} style={{ width: 70 }} />
              <span className="sub">{p.tipo === 'dia' ? 'dia' : 'º dia útil'}</span>
              <input type="number" min={1} max={100} step="any" aria-label="Percentual do valor" value={p.pct} onChange={(e) => mudaParcela(i, { pct: Number(e.target.value) })} style={{ width: 80 }} />
              <span className="sub">%{valor ? ` = ${formatarBRL(Math.round((valor * p.pct) / 100))}` : ''}</span>
              {parcelas.length > 1 && <Btn v="link" onClick={() => setParcelas(parcelas.filter((_, j) => j !== i))}>Remover</Btn>}
            </div>
          ))}
          <div className="acoes" style={{ justifyContent: 'flex-start' }}>
            <Btn v="link" onClick={() => setParcelas([...parcelas, { tipo: 'dia', n: 20, pct: Math.max(1, Math.round(100 - somaPct)) }])}>+ Adicionar parcela</Btn>
            {!parcelasOk && <span className="erro">As parcelas devem somar 100% (hoje {somaPct}%).</span>}
          </div>
        </Campo>
      )}
      {eFixa && <Check label="VR/VA: só pode ser usado no mercado" valor={vale} onChange={setVale} />}
      {eFixa && vale && <Nota>Entra no saldo apenas até o valor gasto em despesas marcadas como mercado; o que sobrar no mês não é contado como dinheiro livre.</Nota>}
      {fx && valor != null && valor !== atual && <Nota>Reajuste de {formatarBRL(atual)} para {formatarBRL(valor)} a partir de {desde.split('-').reverse().join('/')}. Meses anteriores não mudam e o histórico é mantido.</Nota>}
      {fx && (
        <div className="nota cinza">
          <b>Histórico de valores</b>
          {[...fx.valores].reverse().map((v) => <div key={v.desde}>{formatarBRL(v.valorCentavos)} · desde {v.desde.split('-').reverse().join('/')}</div>)}
        </div>
      )}
      {!eFixa && (
        <>
          <Campo label="Situação"><Seg valor={situacao} onChange={setSituacao} opcoes={[{ v: 'prevista', r: 'Prevista' }, { v: 'recebida', r: 'Recebida' }]} /></Campo>
          {situacao === 'recebida' && <Campo label="Valor realmente recebido (se diferente)"><InputBRL valor={valorReal} onChange={setValorReal} /></Campo>}
          <Check label="Repetir todo ano (13º e férias)" valor={modo === 'anual'} onChange={(v) => setModo(v ? 'anual' : 'pontual')} />
          {impacto && (
            <Nota>
              <b>Prévia do impacto</b><br />
              Entra em {rotuloMesAno(mesDe(data))}{impacto.deltaMes != null ? ` · ${impacto.deltaMes >= 0 ? '+' : ''}${formatarBRL(impacto.deltaMes)} no saldo do mês` : ' · fora da janela de 12 meses'}<br />
              Saldo projetado em 12 meses: {impacto.delta12 >= 0 ? '+' : ''}{formatarBRL(impacto.delta12)}
            </Nota>
          )}
        </>
      )}
      {erro && <span className="erro">{erro}</span>}
      <div className="acoes" style={{ justifyContent: 'space-between' }}>
        <div className="acoes">
          {inicial && fx && !fx.fim && <Btn onClick={async () => { await salvar('renda', { ...fx, fim: hoje }); onClose() }}>Encerrar renda</Btn>}
          {inicial && <Btn v="d" onClick={async () => { if (confirm(`Excluir "${inicial.descricao}"?`)) { await excluir('renda', inicial.id); onClose() } }}>Excluir</Btn>}
        </div>
        <div className="acoes">
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn v="p" disabled={!valido} onClick={gravar}>{inicial ? 'Salvar alterações' : 'Salvar renda'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

export default function RendaPagina() {
  const { dados, mesAtual, mesBase, salvar, membro, brl , proj } = useDados()
  const [form, setForm] = useState<{ inicial?: Renda; modo: Modo } | null>(null)
  const fixas = dados.rendas.filter((r): r is RendaFixa => r.tipo === 'fixa')
  const pontuais = dados.rendas.filter((r): r is RendaPontual => r.tipo === 'pontual').sort((a, b) => a.data.localeCompare(b.data))
  const totalFixa = fixas.filter((r) => !r.vale).reduce((s, r) => s + valorRendaFixa(r, mesAtual), 0)
  const totalVale = fixas.filter((r) => r.vale).reduce((s, r) => s + valorRendaFixa(r, mesAtual), 0)
  const previsto12 = useMemo(() => {
    const meses = proj(dados, mesBase).meses.map((m) => m.mes)
    return meses.reduce((s, ym) => s + pontuaisDoMes(dados.rendas, ym).filter((p) => p.renda.situacao === 'prevista').reduce((t, p) => t + p.valorCentavos, 0), 0)
  }, [dados, mesBase])

  return (
    <>
      <header className="cab"><h1>Renda</h1></header>
      <Card titulo="Rendas fixas" sub="Valor líquido mensal" acoes={<Btn v="p" onClick={() => setForm({ modo: 'fixa' })}>+ Nova renda</Btn>}>
        {fixas.length === 0 ? <div className="sub">Nenhuma renda fixa cadastrada.</div> : (
          <table>
            <thead><tr><th>Descrição</th><th>Membro</th><th className="n">Valor líquido</th><th>Recebe</th><th>Vigência</th><th>Status</th><th /></tr></thead>
            <tbody>
              {fixas.map((r) => (
                <tr key={r.id}>
                  <td>{r.descricao}{r.vale ? <> <Chip tom="teal">Só mercado</Chip></> : null}</td><td>{membro(r.membroId)}</td>
                  <td className="n">{brl(valorRendaFixa(r, mesAtual) || r.valores.at(-1)?.valorCentavos || 0)}</td>
                  <td>{parcelasDaRenda(r).map((p) => `${p.tipo === 'dia' ? `dia ${p.n}` : `${p.n}º dia útil`}${r.parcelas?.length ? ` (${p.pct}%)` : ''}`).join(' + ')}</td>
                  <td>desde {rotuloMesAno(mesDe(r.inicio))}{r.fim ? ` até ${dataBr(r.fim)}` : ''}</td>
                  <td><Chip tom={r.fim && mesDe(r.fim) < mesAtual ? '' : 'ok'}>{r.fim && mesDe(r.fim) < mesAtual ? 'Encerrada' : 'Ativa'}</Chip></td>
                  <td className="n"><Btn v="link" onClick={() => setForm({ inicial: r, modo: 'fixa' })}>Editar</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="total"><span>Renda fixa mensal (livre)</span><b>{brl(totalFixa)}</b></div>
        {totalVale > 0 && <div className="total"><span>VR/VA mensal (só mercado)</span><b>{brl(totalVale)}</b></div>}
      </Card>

      <Card titulo="Entradas pontuais e sazonais" sub="13º, 1/3 de férias, bicos e freelances · entram só no mês em que ocorrem" acoes={<Btn v="p" onClick={() => setForm({ modo: 'pontual' })}>+ Entrada pontual</Btn>}>
        {pontuais.length === 0 ? <div className="sub">Nenhuma entrada pontual cadastrada.</div> : (
          <table>
            <thead><tr><th>Descrição</th><th>Tipo</th><th>Membro</th><th className="n">Valor</th><th>Data</th><th>Situação</th><th /></tr></thead>
            <tbody>
              {pontuais.map((r) => (
                <tr key={r.id}>
                  <td>{r.descricao}{r.repeteAnual && <span className="sub"> · todo ano</span>}</td>
                  <td><Chip tom={ROTULO_CLASSE[r.classe].tom}>{ROTULO_CLASSE[r.classe].r}</Chip></td>
                  <td>{membro(r.membroId)}</td>
                  <td className="n">{brl(r.valorRealCentavos ?? r.valorCentavos)}</td>
                  <td>{dataBr(r.data)}</td>
                  <td><Chip tom={r.situacao === 'recebida' ? 'ok' : 'warn'}>{r.situacao === 'recebida' ? 'Recebida' : 'Prevista'}</Chip></td>
                  <td className="n">
                    {r.situacao === 'prevista' && <Btn v="link" onClick={() => salvar('renda', { ...r, situacao: 'recebida' })}>Marcar recebida</Btn>}
                    <Btn v="link" onClick={() => setForm({ inicial: r, modo: 'pontual' })}>Editar</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="total"><span>Previstas nos próximos 12 meses</span><b>{brl(previsto12)}</b></div>
      </Card>
      {form && <FormRenda inicial={form.inicial} modoInicial={form.modo} onClose={() => setForm(null)} />}
    </>
  )
}
