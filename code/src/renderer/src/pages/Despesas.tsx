import { useMemo, useState } from 'react'
import { festasEntre } from '@shared/domain/calendario-badi'
import { addDias, dataBr, ultimoDiaDoMes } from '@shared/domain/datas'
import { formatarBRL } from '@shared/domain/dinheiro'
import { ocorrencias } from '@shared/domain/projecao'
import type { Despesa, Natureza, Pagamento, Periodicidade } from '@shared/domain/tipos'
import { Btn, Campo, Card, Check, Chip, InputBRL, Modal, Nota, Seg, type Tom } from '../ui'
import { ChipNatureza, SelectCategoria, SelectMembro } from '../comuns'
import { useDados } from '../store'

type Tipo = Despesa['tipo']

function FormDespesa({ inicial, onClose }: { inicial?: Despesa; onClose: () => void }) {
  const { dados, hoje, mesBase, salvar, excluir , proj } = useDados()
  const [tipo, setTipo] = useState<Tipo>(inicial?.tipo ?? 'recorrente')
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '')
  const [categoriaId, setCategoriaId] = useState<number | undefined>(inicial?.categoriaId)
  const [membroId, setMembroId] = useState<number | null>(inicial?.membroId ?? null)
  const [valor, setValor] = useState<number | null>(inicial ? (inicial.tipo === 'parcelada' ? inicial.valorCentavos * (inicial.nParcelas ?? 1) : inicial.valorCentavos) : null)
  const [n, setN] = useState(inicial?.nParcelas ?? 12)
  const [period, setPeriod] = useState<Periodicidade>(inicial?.periodicidade ?? 'mensal')
  const [inicio, setInicio] = useState(inicial?.inicio ?? hoje)
  const [fim, setFim] = useState(inicial?.fim ?? '')
  const [natureza, setNatureza] = useState<Natureza>(inicial?.natureza ?? 'flexivel')
  const [planejada, setPlanejada] = useState(inicial?.status === 'planejada')
  const [irredutivel, setIrredutivel] = useState(!!inicial?.irredutivel)
  const [mercado, setMercado] = useState(!!inicial?.mercado)
  const [pagamento, setPagamento] = useState<Pagamento>(inicial?.pagamento ?? 'avista')

  const festas = useMemo(() => festasEntre(addDias(hoje, -120), addDias(hoje, 420)), [hoje])
  const badi = tipo === 'recorrente' && period === 'badi19'
  const valorOcorrencia = valor == null ? 0 : tipo === 'parcelada' ? Math.round(valor / Math.max(1, n)) : valor
  const valido = !!descricao.trim() && !!categoriaId && valorOcorrencia > 0 && !!inicio && (tipo !== 'parcelada' || n >= 1) && (!fim || fim >= inicio)

  const montar = (): Despesa => ({
    id: inicial?.id ?? -1, descricao: descricao.trim(), categoriaId: categoriaId!, membroId, tipo, valorCentavos: valorOcorrencia,
    ...(tipo === 'parcelada' ? { nParcelas: n } : {}), ...(tipo === 'recorrente' ? { periodicidade: period } : {}),
    inicio, fim: tipo === 'recorrente' && fim ? fim : null, natureza, irredutivel, mercado, pagamento,
    status: planejada ? 'planejada' : inicial?.status === 'encerrada' ? 'encerrada' : 'ativa'
  })

  const impacto = useMemo(() => {
    if (!valido) return null
    const sem = dados.despesas.filter((d) => d.id !== inicial?.id)
    const base = proj({ ...dados, despesas: sem }, mesBase)
    const novo = proj({ ...dados, despesas: [...sem, montar()] }, mesBase)
    const d = montar()
    const oc = ocorrencias(d, mesBase + '-01', ultimoDiaDoMes(novo.meses[11].mes))
    return { n: oc.length, total: oc.reduce((s, o) => s + o.valorCentavos, 0), delta: novo.total - base.total, media: Math.round(oc.reduce((s, o) => s + o.valorCentavos, 0) / 12) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados, mesBase, valido, tipo, valor, n, period, inicio, fim, planejada, categoriaId, natureza, irredutivel, mercado, pagamento])

  return (
    <Modal titulo={inicial ? `Editar despesa · ${inicial.descricao}` : 'Nova despesa'} sub="Escolha o tipo e preencha os dados" onClose={onClose}>
      <Seg valor={tipo} onChange={setTipo} opcoes={[{ v: 'pontual', r: 'Pontual' }, { v: 'recorrente', r: 'Recorrente' }, { v: 'parcelada', r: 'Parcelada' }]} />
      <Campo label="Descrição"><input value={descricao} onChange={(e) => setDescricao(e.target.value)} autoFocus /></Campo>
      <div className="linha">
        <Campo label={tipo === 'parcelada' ? 'Valor total' : 'Valor'}><InputBRL valor={valor} onChange={setValor} /></Campo>
        <SelectCategoria valor={categoriaId} onChange={(id) => { setCategoriaId(id); setNatureza(dados.categorias.find((c) => c.id === id)!.natureza) }} />
        <SelectMembro valor={membroId} onChange={setMembroId} />
      </div>
      {tipo === 'parcelada' && (
        <div className="linha">
          <Campo label="Número de parcelas"><input type="number" min={1} max={120} value={n} onChange={(e) => setN(Number(e.target.value))} /></Campo>
          <Campo label="Primeira parcela"><input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo>
        </div>
      )}
      {tipo === 'parcelada' && valor != null && <Nota>{n} parcelas de {formatarBRL(valorOcorrencia)}{valorOcorrencia * n !== valor ? ` (arredondado: total ${formatarBRL(valorOcorrencia * n)})` : ''}.</Nota>}
      {tipo === 'pontual' && <Campo label="Data"><input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo>}
      {tipo === 'recorrente' && (
        <>
          <Campo label="Periodicidade"><Seg valor={period} onChange={setPeriod} opcoes={[{ v: 'mensal', r: 'Mensal' }, { v: 'anual', r: 'Anual' }, { v: 'badi19', r: 'A cada 19 dias (Badí’)' }]} /></Campo>
          <div className="linha">
            {badi ? (
              <Campo label="Primeira ocorrência">
                <select value={inicio} onChange={(e) => setInicio(e.target.value)}>
                  {!festas.some((f) => f.data === inicio) && <option value={inicio}>{dataBr(inicio)}</option>}
                  {festas.map((f) => <option key={f.data} value={f.data}>Festa de {dataBr(f.data)} · {f.nome}</option>)}
                </select>
              </Campo>
            ) : <Campo label="Primeira ocorrência"><input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo>}
            <Campo label="Termina em (opcional)"><input type="date" value={fim ?? ''} onChange={(e) => setFim(e.target.value)} /></Campo>
          </div>
          {badi && <Nota tom="teal">Segue as datas das Festas dos 19 Dias do calendário Badí’ (tabela da Casa Universal de Justiça). Alguns meses têm 2 ocorrências.</Nota>}
        </>
      )}
      <Campo label="Natureza"><Seg valor={natureza} onChange={setNatureza} opcoes={[{ v: 'essencial', r: 'Essencial' }, { v: 'flexivel', r: 'Flexível' }, { v: 'protegida', r: 'Protegida' }]} /></Campo>
      <Check label="Planejada (a despesa começa no futuro)" valor={planejada} onChange={setPlanejada} />
      <Campo label="Pagamento"><Seg valor={pagamento} onChange={setPagamento} opcoes={[{ v: 'avista', r: 'À vista' }, { v: 'boleto', r: 'Boleto' }, { v: 'cartao', r: 'Cartão' }]} /></Campo>
      {pagamento === 'cartao' && !dados.cartao && <Nota tom="warn">Configure o fechamento e o vencimento em Configurações → Cartão de crédito; até lá a despesa conta na própria data.</Nota>}
      <Check label="Mercado (pode ser pago com VR/VA)" valor={mercado} onChange={setMercado} />
      <Check label="Valor irredutível (nunca entra no corte do plano de redução)" valor={irredutivel} onChange={setIrredutivel} />
      {impacto && (
        <Nota>
          <b>Prévia do impacto</b><br />
          {impacto.n} {impacto.n === 1 ? 'ocorrência' : 'ocorrências'} nos próximos 12 meses · {formatarBRL(impacto.total)}{impacto.n > 1 ? ` · média de ${formatarBRL(impacto.media)} por mês` : ''}<br />
          Saldo projetado em 12 meses: {impacto.delta >= 0 ? '+' : ''}{formatarBRL(impacto.delta)}
        </Nota>
      )}
      <div className="acoes" style={{ justifyContent: 'space-between' }}>
        <div className="acoes">
          {inicial && tipo !== 'pontual' && inicial.status !== 'encerrada' && <Btn onClick={async () => { await salvar('despesa', { ...inicial, fim: hoje, status: 'encerrada' }); onClose() }}>Encerrar</Btn>}
          {inicial && <Btn v="d" onClick={async () => { if (confirm(`Excluir "${inicial.descricao}" e seus lançamentos?`)) { await excluir('despesa', inicial.id); onClose() } }}>Excluir</Btn>}
        </div>
        <div className="acoes">
          <Btn onClick={onClose}>Cancelar</Btn>
          <Btn v="p" disabled={!valido} onClick={async () => { const { id, ...d } = montar(); await salvar('despesa', inicial ? { id, ...d } : d); onClose() }}>Salvar despesa</Btn>
        </div>
      </div>
    </Modal>
  )
}

const FILTROS: { v: string; r: string }[] = [{ v: 'todas', r: 'Todas' }, { v: 'pontual', r: 'Pontual' }, { v: 'recorrente', r: 'Recorrente' }, { v: 'parcelada', r: 'Parcelada' }, { v: 'planejada', r: 'Planejada' }]

export default function Despesas() {
  const { dados, hoje, mesAtual, salvar, excluir, categoria, membro, brl , proj } = useDados()
  const [form, setForm] = useState<{ inicial?: Despesa } | null>(null)
  const [filtro, setFiltro] = useState('todas')
  const [cat, setCat] = useState(0)
  const [mem, setMem] = useState(-1)
  const [mes, setMes] = useState(mesAtual)
  // Período (RF16): só despesas com alguma ocorrência entre os dois meses; vazio = sem limite naquele lado.
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const periodoInvertido = !!de && !!ate && de > ate
  const ini = de ? de + '-01' : '1900-01-01'
  const fimPeriodo = ate ? ultimoDiaDoMes(ate) : '2200-12-31'
  const comPeriodo = (!!de || !!ate) && !periodoInvertido

  const base = dados.despesas.filter((d) =>
    (filtro === 'todas' || (filtro === 'planejada' ? d.status === 'planejada' : d.tipo === filtro)) && (!cat || d.categoriaId === cat) && (mem === -1 || (d.membroId ?? null) === (mem === 0 ? null : mem))
  )
  const noPeriodo = useMemo(
    () => (comPeriodo ? base.map((d) => ({ d, oc: ocorrencias(d, ini, fimPeriodo, dados.reais) })).filter((x) => x.oc.length > 0) : base.map((d) => ({ d, oc: [] as ReturnType<typeof ocorrencias> }))),
    [base, comPeriodo, ini, fimPeriodo, dados.reais]
  )
  const lista = noPeriodo.map((x) => x.d)
  const totalPeriodo = noPeriodo.reduce((s, x) => s + x.oc.reduce((t, o) => t + o.valorCentavos, 0), 0)
  const nOcorrenciasPeriodo = noPeriodo.reduce((s, x) => s + x.oc.length, 0)

  const situacao = (d: Despesa): string => {
    const todas = ocorrencias(d, '1900-01-01', '2200-12-31')
    const feitas = todas.filter((o) => o.data <= hoje).length
    if (d.tipo === 'parcelada') return feitas === 0 ? `começa em ${dataBr(d.inicio)}` : feitas >= todas.length ? 'quitada' : `parcela ${feitas}/${todas.length} · faltam ${todas.length - feitas}`
    if (d.tipo === 'pontual') return d.inicio <= hoje ? `em ${dataBr(d.inicio)}` : `prevista para ${dataBr(d.inicio)}`
    const prox = ocorrencias(d, hoje, addDias(hoje, 400))[0]
    return d.status === 'encerrada' || (d.fim && d.fim < hoje) ? 'encerrada' : prox ? `próxima ${dataBr(prox.data).slice(0, 5)}` : 'sem próximas'
  }
  const chipTipo = (d: Despesa): [string, Tom] =>
    d.status === 'planejada' ? ['Planejada', 'warn'] : d.tipo === 'parcelada' ? ['Parcelada', 'purple'] : d.tipo === 'pontual' ? ['Pontual', ''] : d.periodicidade === 'badi19' ? ['A cada 19 dias', 'teal'] : [d.periodicidade === 'anual' ? 'Anual' : 'Recorrente', 'prim']

  const lanc = useMemo(
    () =>
      dados.despesas
        .flatMap((d) => ocorrencias(d, mes + '-01', ultimoDiaDoMes(mes), dados.reais).map((o) => ({ d, o })))
        .sort((a, b) => a.o.data.localeCompare(b.o.data)),
    [dados, mes]
  )
  const totalMes = lanc.reduce((s, x) => s + x.o.valorCentavos, 0)
  const atualizar = async (d: Despesa, data: string, mudanca: { valor?: number | null; paga?: boolean }) => {
    const existente = dados.reais.find((r) => r.despesaId === d.id && r.data === data)
    const valorReal = mudanca.valor ?? existente?.valorRealCentavos ?? d.valorCentavos
    const paga = mudanca.paga ?? existente?.paga ?? false
    if (valorReal === d.valorCentavos && !paga) { if (existente) await excluir('ocorrencia', existente.id); return }
    await salvar('ocorrencia', { ...(existente ? { id: existente.id } : {}), despesaId: d.id, data, valorRealCentavos: valorReal, paga })
  }

  return (
    <>
      <header className="cab"><h1>Despesas</h1></header>
      <Card titulo="Despesas" sub="Pontuais, recorrentes, parceladas e planejadas" acoes={<Btn v="p" onClick={() => setForm({})}>+ Nova despesa</Btn>}>
        <div className="acoes" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div className="chips">{FILTROS.map((f) => <button key={f.v} aria-pressed={filtro === f.v} onClick={() => setFiltro(f.v)}>{f.r}</button>)}</div>
          <div className="acoes">
            <label className="campo" style={{ flex: 'none' }}><span>De</span><input type="month" value={de} onChange={(e) => setDe(e.target.value)} aria-label="Período: de" /></label>
            <label className="campo" style={{ flex: 'none' }}><span>Até</span><input type="month" value={ate} onChange={(e) => setAte(e.target.value)} aria-label="Período: até" /></label>
            {(de || ate) && <Btn v="link" onClick={() => { setDe(''); setAte('') }}>Limpar período</Btn>}
          </div>
          <div className="acoes">
            <select aria-label="Categoria" value={cat} onChange={(e) => setCat(Number(e.target.value))} className="btn"><option value={0}>Todas as categorias</option>{dados.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
            <select aria-label="Membro" value={mem} onChange={(e) => setMem(Number(e.target.value))} className="btn"><option value={-1}>Todos os membros</option><option value={0}>Família</option>{dados.membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</select>
          </div>
        </div>
        {periodoInvertido && <Nota tom="danger">O mês inicial é depois do final. Ajuste o período.</Nota>}
        {lista.length === 0 ? <div className="sub">Nenhuma despesa encontrada.</div> : (
          <table>
            <thead><tr><th>Descrição</th><th>Categoria</th><th>Tipo</th><th className="n">Valor</th><th>Situação</th><th>Natureza</th><th /></tr></thead>
            <tbody>
              {lista.map((d) => {
                const [r, tom] = chipTipo(d)
                const fundos = categoria(d.categoriaId).nome.startsWith('Fundos')
                return (
                  <tr key={d.id}>
                    <td>{d.descricao}{d.membroId ? <span className="sub"> · {membro(d.membroId)}</span> : null}{d.irredutivel ? <> <Chip tom="teal">Irredutível</Chip></> : null}{d.mercado ? <> <Chip tom="ok">Mercado</Chip></> : null}{d.pagamento === 'cartao' ? <> <Chip tom="purple">Cartão</Chip></> : d.pagamento === 'boleto' ? <> <Chip>Boleto</Chip></> : null}</td>
                    <td>{categoria(d.categoriaId).nome}</td>
                    <td><Chip tom={tom}>{r}</Chip></td>
                    <td className="n">{brl(d.valorCentavos, fundos)}</td>
                    <td>{situacao(d)}</td>
                    <td><ChipNatureza n={d.natureza} /></td>
                    <td className="n"><Btn v="link" onClick={() => setForm({ inicial: d })}>Editar</Btn></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {comPeriodo && lista.length > 0 && <div className="total"><span>Total no período · {nOcorrenciasPeriodo} {nOcorrenciasPeriodo === 1 ? 'ocorrência' : 'ocorrências'} (inclui planejadas)</span><b>{brl(totalPeriodo)}</b></div>}
      </Card>

      <Card titulo="Lançamentos do mês" sub="Marque como pago e ajuste o valor real quando for diferente do previsto"
        acoes={<label className="campo" style={{ flex: 'none' }}><input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mês dos lançamentos" /></label>}>
        {lanc.length === 0 ? <div className="sub">Nenhum lançamento neste mês.</div> : (
          <table>
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="n">Previsto</th><th>Realizado</th><th>Pago</th></tr></thead>
            <tbody>
              {lanc.map(({ d, o }) => (
                <tr key={`${d.id}|${o.data}`}>
                  <td>{dataBr(o.data).slice(0, 5)}</td><td>{d.descricao}</td><td>{categoria(d.categoriaId).nome}</td>
                  <td className="n">{brl(d.valorCentavos, categoria(d.categoriaId).nome.startsWith('Fundos'))}</td>
                  <td style={{ width: 150 }}><InputBRL valor={o.valorCentavos} onChange={(v) => v != null && v !== o.valorCentavos && atualizar(d, o.data, { valor: v })} /></td>
                  <td><input type="checkbox" aria-label="Pago" checked={o.paga} onChange={(e) => atualizar(d, o.data, { paga: e.target.checked })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="total"><span>Total do mês</span><b>{brl(totalMes)}</b></div>
      </Card>
      {form && <FormDespesa inicial={form.inicial} onClose={() => setForm(null)} />}
    </>
  )
}
