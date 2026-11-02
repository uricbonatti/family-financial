import { useMemo, useState } from 'react'
import { anoBadi, ayyamIHa, festasEntre, nawRuz, primeiroAno, ultimoAno } from '@shared/domain/calendario-badi'
import { addDias, dataBr } from '@shared/domain/datas'
import { formatarBRL } from '@shared/domain/dinheiro'
import { validarFaixas, valorPorFesta } from '@shared/domain/fundos'
import { valorRendaFixa } from '@shared/domain/projecao'
import type { FundosConfig } from '@shared/domain/tipos'
import { Btn, Campo, Card, Check, Chip, InputBRL, Modal, Nota, Seg, Stat } from '../ui'
import { useDados } from '../store'

const ehFundos = (nome: string) => nome.startsWith('Fundos')

function Planejar({ onClose }: { onClose: () => void }) {
  const { dados, hoje, mesAtual, salvar, salvarFundos, proj, mesBase } = useDados()
  const cfg = dados.fundos
  const despesa = dados.despesas.find((d) => d.id === cfg.despesaId) ?? dados.despesas.find((d) => d.periodicidade === 'badi19' && ehFundos(dados.categorias.find((c) => c.id === d.categoriaId)?.nome ?? ''))
  const rendaFixa = dados.rendas.reduce((s, r) => s + (r.tipo === 'fixa' ? valorRendaFixa(r, mesAtual) : 0), 0)
  const festas = useMemo(() => festasEntre(addDias(hoje, -60), addDias(hoje, 420)), [hoje])

  const [modo, setModo] = useState<FundosConfig['modo']>(cfg.modo)
  const [valorFesta, setValorFesta] = useState<number | null>(despesa?.valorCentavos ?? cfg.valorFestaCentavos)
  const [pct, setPct] = useState(cfg.pctRenda ?? (rendaFixa ? Math.round((cfg.valorFestaCentavos / rendaFixa) * 1000) / 10 : 2))
  const [faixas, setFaixas] = useState(cfg.faixas)
  const [inicio, setInicio] = useState(despesa?.inicio ?? festasEntre(hoje, addDias(hoje, 30))[0]?.data ?? hoje)
  const [fim, setFim] = useState(despesa?.fim ?? '')
  const [dist, setDist] = useState(cfg.distribuicao)
  const [extra, setExtra] = useState<number | null>(cfg.extraSobrePontuaisPct)
  const [privado, setPrivado] = useState(cfg.modoPrivado)

  const regra = { modo, valorFestaCentavos: valorFesta ?? 0, pctRenda: pct, faixas }
  const valor = valorPorFesta(regra, rendaFixa)
  const erroFaixas = modo === 'faixa' ? validarFaixas(faixas) : null
  const soma = dist.reduce((s, d) => s + d.pct, 0)
  const valido = valor > 0 && !erroFaixas && soma === 100 && !!inicio && (!fim || fim >= inicio) && (extra == null || (extra >= 0 && extra <= 100))

  const catFundos = dados.categorias.find((c) => ehFundos(c.nome))
  const previa = useMemo(() => {
    if (!valido || !catFundos) return null
    const novo = { id: despesa?.id ?? -1, descricao: 'Fundos Bahá’ís', categoriaId: catFundos.id, tipo: 'recorrente' as const, periodicidade: 'badi19' as const, valorCentavos: valor, inicio, fim: fim || null, natureza: 'protegida' as const, status: 'ativa' as const }
    const outras = dados.despesas.filter((d) => d.id !== despesa?.id)
    const op = { fundosExtra: extra ? { categoriaId: catFundos.id, pct: extra } : undefined }
    const antes = proj({ ...dados, despesas: outras }, mesBase, 12, { fundosExtra: undefined })
    const depois = proj({ ...dados, despesas: [...outras, novo] }, mesBase, 12, op)
    const meses = depois.meses.map((m) => m.festas)
    return { festas: meses.reduce((s, x) => s + x, 0), total: (antes.total - depois.total), dobro: depois.meses.filter((m) => m.festas > 1).length }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valido, valor, inicio, fim, extra, dados])

  const gravar = async () => {
    const categoriaId = catFundos?.id ?? (await salvar('categoria', { nome: 'Fundos Bahá’ís', cor: '#0D9488', natureza: 'protegida', cortePct: 0 }))
    const id = await salvar('despesa', {
      ...(despesa ? { id: despesa.id } : {}), descricao: 'Fundos Bahá’ís', categoriaId, tipo: 'recorrente', periodicidade: 'badi19',
      valorCentavos: valor, inicio, fim: fim || null, natureza: 'protegida', status: 'ativa'
    })
    const novo: FundosConfig = { ...cfg, modo, valorFestaCentavos: modo === 'fixo' ? valor : cfg.valorFestaCentavos, pctRenda: pct, faixas, distribuicao: dist, extraSobrePontuaisPct: extra, modoPrivado: privado, despesaId: id }
    await salvarFundos(novo)
    onClose()
  }

  return (
    <Modal titulo="Planejar contribuição" sub="Fundos Bahá’ís · a cada Festa dos 19 Dias (calendário Badí’)" onClose={onClose}>
      <Campo label="Como calcular"><Seg valor={modo} onChange={setModo} opcoes={[{ v: 'fixo', r: 'Valor fixo' }, { v: 'pctRenda', r: '% da renda fixa' }, { v: 'faixa', r: 'Por faixa de renda' }]} /></Campo>
      <div className="linha">
        {modo === 'fixo' && <Campo label="Valor por Festa"><InputBRL valor={valorFesta} onChange={setValorFesta} /></Campo>}
        {modo === 'pctRenda' && <Campo label={`% da renda fixa mensal (${formatarBRL(rendaFixa)}) por Festa`}><input type="number" min={0.1} max={100} step={0.1} value={pct} onChange={(e) => setPct(Number(e.target.value))} /></Campo>}
        <Campo label="Começa na Festa de">
          <select value={inicio} onChange={(e) => setInicio(e.target.value)}>
            {!festas.some((f) => f.data === inicio) && <option value={inicio}>{dataBr(inicio)}</option>}
            {festas.map((f) => <option key={f.data} value={f.data}>{dataBr(f.data)} · {f.nome}</option>)}
          </select>
        </Campo>
        <Campo label="Termina em (opcional)"><input type="date" value={fim ?? ''} onChange={(e) => setFim(e.target.value)} /></Campo>
      </div>
      {modo === 'pctRenda' && <Nota>Valor por Festa: {formatarBRL(valor)}. Se a renda mudar, o app avisa e você atualiza o valor.</Nota>}
      {modo === 'faixa' && (
        <Campo label="Faixas de renda fixa mensal">
          <table>
            <thead><tr><th>Renda fixa mensal</th><th>Valor por Festa</th><th /></tr></thead>
            <tbody>
              {faixas.map((f, i) => {
                const ultima = i === faixas.length - 1
                const atual = valor > 0 && valor === f.valorCentavos && (f.ateCentavos == null || rendaFixa <= f.ateCentavos) && (i === 0 || rendaFixa > (faixas[i - 1].ateCentavos ?? 0))
                return (
                  <tr key={i}>
                    <td>{ultima ? <span>Acima da faixa anterior</span> : <div className="acoes" style={{ justifyContent: 'flex-start' }}><span>até</span><InputBRL valor={f.ateCentavos} onChange={(v) => setFaixas(faixas.map((x, j) => (j === i ? { ...x, ateCentavos: v } : x)))} /></div>}</td>
                    <td><InputBRL valor={f.valorCentavos} onChange={(v) => setFaixas(faixas.map((x, j) => (j === i ? { ...x, valorCentavos: v ?? 0 } : x)))} /></td>
                    <td className="n">{atual && <Chip tom="teal">sua faixa</Chip>}{faixas.length > 1 && <Btn v="link" onClick={() => setFaixas(faixas.filter((_, j) => j !== i).map((x, j, a) => (j === a.length - 1 ? { ...x, ateCentavos: null } : x)))}>Remover</Btn>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="acoes" style={{ justifyContent: 'flex-start' }}>
            <Btn onClick={() => { const a = faixas.slice(0, -1); const ult = faixas[faixas.length - 1]; setFaixas([...a, { ateCentavos: (a.at(-1)?.ateCentavos ?? 0) + 200000, valorCentavos: ult.valorCentavos }, { ateCentavos: null, valorCentavos: ult.valorCentavos }]) }}>+ Adicionar faixa</Btn>
          </div>
          {erroFaixas ? <span className="erro">{erroFaixas}</span> : <span className="sub">Renda fixa atual: {formatarBRL(rendaFixa)} → {formatarBRL(valor)} por Festa.</span>}
        </Campo>
      )}
      <Campo label="Distribuição por fundo (%)">
        <div className="linha">
          {dist.map((d, i) => (
            <Campo key={d.fundo} label={d.fundo}><input type="number" min={0} max={100} value={d.pct} onChange={(e) => setDist(dist.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) } : x)))} /></Campo>
          ))}
        </div>
      </Campo>
      <Nota tom={soma === 100 ? 'ok' : 'danger'}>{soma === 100 ? `Soma 100% · ${dist.map((d) => formatarBRL(Math.round((valor * d.pct) / 100))).join(' + ')} = ${formatarBRL(valor)} por Festa.` : `A soma está em ${soma}%: ajuste para fechar 100%.`}</Nota>
      <Check label="Contribuir extra sobre entradas pontuais (13º, férias, bicos)" valor={extra != null} onChange={(v) => setExtra(v ? 2 : null)} />
      {extra != null && <Campo label="% do valor de cada entrada pontual"><input type="number" min={0} max={100} step={0.5} value={extra} onChange={(e) => setExtra(Number(e.target.value))} /></Campo>}
      <Check label="Modo privado: ocultar valores dos Fundos na tela" valor={privado} onChange={setPrivado} />
      <Check label="Avisar antes de cada Festa (em breve)" valor={false} onChange={() => undefined} />
      {previa && (
        <Nota tom="teal">
          <b>Prévia do impacto</b><br />
          {previa.festas} Festas nos próximos 12 meses · {formatarBRL(previa.total)} · provisão de {formatarBRL(Math.round(previa.total / 12))} por mês<br />
          {previa.dobro} {previa.dobro === 1 ? 'mês tem' : 'meses têm'} 2 Festas · já incluído no saldo projetado
        </Nota>
      )}
      <div className="acoes"><Btn onClick={onClose}>Cancelar</Btn><Btn v="p" disabled={!valido} onClick={gravar}>Salvar plano</Btn></div>
    </Modal>
  )
}

export default function Fundos() {
  const { dados, hoje, mesAtual, projecao12, brl, salvar } = useDados()
  const [planejando, setPlanejando] = useState(false)
  const cfg = dados.fundos
  const cat = dados.categorias.find((c) => ehFundos(c.nome))
  const despesa = dados.despesas.find((d) => d.id === cfg.despesaId) ?? dados.despesas.find((d) => d.categoriaId === cat?.id && d.periodicidade === 'badi19')
  const p = useMemo(() => projecao12(), [projecao12])
  const total12 = cat ? p.meses.reduce((s, m) => s + (m.porCategoria[cat.id] ?? 0), 0) : 0
  const festas12 = p.meses.reduce((s, m) => s + m.festas, 0)
  const rendaFixa = p.meses[0]?.rendaFixa ?? 0
  const proximas = useMemo(() => festasEntre(hoje, addDias(hoje, 420)).slice(0, 8), [hoje])
  const valor = despesa?.valorCentavos ?? cfg.valorFestaCentavos
  const rendaAtual = dados.rendas.reduce((s, r) => s + (r.tipo === 'fixa' ? valorRendaFixa(r, mesAtual) : 0), 0)
  const sugerido = valorPorFesta(cfg, rendaAtual)
  const desatualizado = !!despesa && cfg.modo !== 'fixo' && sugerido > 0 && sugerido !== despesa.valorCentavos
  const paga = (data: string) => dados.reais.some((r) => r.despesaId === despesa?.id && r.data === data && r.paga)

  const anoAtual = useMemo(() => {
    for (let a = ultimoAno; a >= primeiroAno; a--) if ((nawRuz(a) ?? '9') <= hoje) return a
    return primeiroAno
  }, [hoje])
  const ay = ayyamIHa(anoAtual)
  const marcos = ay && anoBadi(anoAtual + 1)
    ? [
        [dataBr(anoBadi(anoAtual)!.nawRuz), `Naw-Rúz · ${anoAtual} B.E.`],
        [`${dataBr(ay.inicio).slice(0, 5)} a ${dataBr(ay.fim)}`, `Ayyám-i-Há · ${ay.dias} dias${ay.dias === 5 ? ' (ano longo)' : ''}`],
        [`${dataBr(addDias(ay.fim, 1)).slice(0, 5)} a ${dataBr(addDias(ay.fim, 19))}`, 'Jejum (mês de ’Alá)'],
        [dataBr(anoBadi(anoAtual + 1)!.nawRuz), `Naw-Rúz · ${anoAtual + 1} B.E.`]
      ]
    : []

  return (
    <>
      <header className="cab"><h1>Fundos Bahá’ís</h1></header>
      {desatualizado && (
        <Nota tom="warn">
          A regra “{cfg.modo === 'faixa' ? 'por faixa de renda' : '% da renda fixa'}” dá {brl(sugerido, true)} por Festa com a renda atual, mas a contribuição planejada está em {brl(despesa!.valorCentavos, true)}.{' '}
          <Btn v="link" onClick={() => salvar('despesa', { ...despesa!, valorCentavos: sugerido })}>Atualizar para {brl(sugerido, true)}</Btn>
        </Nota>
      )}
      <div className="linha">
        <Stat l="Próxima Festa" tom="teal" v={proximas[0] ? dataBr(proximas[0].data) : '—'} s={proximas[0] ? `${proximas[0].nome} · começa ao pôr do sol de ${dataBr(addDias(proximas[0].data, -1)).slice(0, 5)}` : ''} />
        <Stat l="Contribuição por Festa" v={despesa ? brl(valor, true) : '—'} s={despesa && rendaFixa ? `${((valor / rendaFixa) * 100).toFixed(1).replace('.', ',')}% da renda fixa` : 'Planeje a contribuição'} />
        <Stat l="Provisão mensal sugerida" v={brl(Math.round(total12 / 12), true)} s={`${festas12} Festas ÷ 12 meses`} />
        <Stat estilo="teal" l="Próximos 12 meses" v={brl(total12, true)} s={`${festas12} Festas · já incluído no saldo projetado`} />
      </div>
      <div className="linha" style={{ alignItems: 'flex-start' }}>
        <Card titulo="Próximas Festas dos 19 Dias" sub="Datas do calendário Badí’ vigente · cada Festa começa ao pôr do sol da véspera" acoes={<Btn v="p" onClick={() => setPlanejando(true)}>Planejar contribuição</Btn>}>
          <table>
            <thead><tr><th>Festa</th><th>Data</th><th>Mês Badí’</th><th className="n">Valor</th><th>Situação</th></tr></thead>
            <tbody>
              {proximas.map((f, i) => (
                <tr key={f.data}>
                  <td>{f.nome}</td><td>{dataBr(f.data)}</td><td>{f.n}º mês</td>
                  <td className="n">{despesa ? brl(valor, true) : '—'}</td>
                  <td>{paga(f.data) ? <Chip tom="ok">Paga</Chip> : i === 0 ? <Chip tom="teal">Próxima</Chip> : <Chip tom="warn">{despesa ? 'Planejada' : 'Sem plano'}</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!despesa && <Nota tom="warn">Ainda não há contribuição planejada. Use “Planejar contribuição” para definir o valor e a distribuição.</Nota>}
        </Card>
        <div className="col">
          <Card titulo="Distribuição por fundo" sub="Percentual de cada contribuição">
            {cfg.distribuicao.map((d) => (
              <div className="barra" key={d.fundo}>
                <div className="t">{d.fundo} · {d.pct}% · {brl(Math.round((valor * d.pct) / 100), true)}</div>
                <div className="trilho"><i style={{ width: `${d.pct}%`, background: 'var(--teal)' }} /></div>
              </div>
            ))}
          </Card>
          <Card titulo="Calendário Badí’ vigente" sub="Fonte: tabela da Casa Universal de Justiça (172 a 221 B.E.)">
            <table><thead><tr><th>Data</th><th>Marco</th></tr></thead><tbody>{marcos.map(([d, m]) => <tr key={m}><td>{d}</td><td>{m}</td></tr>)}</tbody></table>
            <Nota tom="cinza">Ayyám-i-Há tem 4 ou 5 dias: depende da distância entre dois Naw-Rúz (365 ou 366 dias), não do ano gregoriano bissexto.</Nota>
          </Card>
          <Nota tom="teal">A contribuição é voluntária e confidencial. O plano de redução nunca a sugere para corte.</Nota>
        </div>
      </div>
      {planejando && <Planejar onClose={() => setPlanejando(false)} />}
    </>
  )
}
