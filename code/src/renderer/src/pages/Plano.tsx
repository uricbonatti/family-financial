import { useMemo, useState } from 'react'
import type { EntradaIA, SaidaIA } from '@shared/api'
import { addMeses, ultimoDiaDoMes } from '@shared/domain/datas'
import { ocorrencias } from '@shared/domain/projecao'
import { formatarBRL } from '@shared/domain/dinheiro'
import { categoriasParaPlano, cortesPctDoPlano, gerarPlano } from '@shared/domain/plano'
import { Btn, Campo, Card, Chip, InputBRL, Nota, Seg } from '../ui'
import { ChipNatureza } from '../comuns'
import { useDados } from '../store'

type TipoMeta = 'valor' | 'pct' | 'saldo'
interface Ajuste { aplicar?: boolean; alvo?: number | null }

export default function Plano() {
  const { dados, hoje, mesAtual, mesBase, proj, projecao12, salvar, brl } = useDados()
  const [tipo, setTipo] = useState<TipoMeta>('valor')
  const [meta, setMeta] = useState<number | null>(48000)
  const [pct, setPct] = useState(5)
  const [prazo, setPrazo] = useState(addMeses(mesAtual + '-01', 6).slice(0, 7))
  const [ajustes, setAjustes] = useState<Record<number, Ajuste>>({})
  const [salvo, setSalvo] = useState(false)

  // Base do plano: gasto médio mensal dos próximos 12 meses, incluindo compras pontuais e planejadas (RN14).
  const gastos = useMemo(() => categoriasParaPlano(dados, mesBase), [dados, mesBase])
  const mes = useMemo(() => proj(dados, mesAtual, 1).meses[0], [dados, mesAtual, proj])
  const totalBase = gastos.reduce((s, g) => s + g.atualCentavos, 0)
  const totalIrredutivel = gastos.reduce((s, g) => s + g.irredutivelCentavos, 0)
  const metaMensal = tipo === 'valor' ? (meta ?? 0) : tipo === 'pct' ? Math.round(((totalBase - totalIrredutivel) * pct) / 100) : Math.max(0, (meta ?? 0) - mes.saldo)
  const gerado = useMemo(() => gerarPlano(metaMensal, gastos), [metaMensal, gastos])

  const efetivo = gerado.linhas.map((l) => {
    const a = ajustes[l.id] ?? {}
    const corte = l.protegida || a.aplicar === false ? 0 : a.alvo != null ? Math.min(l.reduzivelCentavos, Math.max(0, l.atualCentavos - a.alvo)) : l.corteCentavos
    const naoReduzivel = l.atualCentavos - l.reduzivelCentavos
    return {
      ...l, corte, alvo: l.atualCentavos - corte, naoReduzivel,
      cortePctAplicado: l.reduzivelCentavos ? (corte / l.reduzivelCentavos) * 100 : 0,
      aplicar: !l.protegida && a.aplicar !== false && (corte > 0 || a.aplicar === true),
      acimaDoLimite: corte > Math.floor((l.reduzivelCentavos * l.cortePct) / 100)
    }
  })
  const economia = efetivo.reduce((s, l) => s + l.corte, 0)
  const cortesPct = cortesPctDoPlano(efetivo)
  const antes = useMemo(() => projecao12().total, [projecao12])
  const depois = useMemo(() => projecao12({ cortesPct }).total, [projecao12, JSON.stringify(cortesPct)]) // eslint-disable-line react-hooks/exhaustive-deps
  const ativo = dados.planos.find((p) => p.ativo)
  const nomePlano = `Reduzir ${formatarBRL(metaMensal).replace(',00', '')}`

  // Plano com IA: manda as despesas à API e transforma os cortes por despesa em alvos por categoria (o modelo do plano guardado).
  const [ia, setIa] = useState<{ carregando?: boolean; erro?: string; saida?: SaidaIA } | null>(null)

  const gerarComIA = async () => {
    setIa({ carregando: true })
    try {
      const fim = ultimoDiaDoMes(proj(dados, mesBase).meses[11].mes)
      const entrada: EntradaIA = {
        metaMensalCentavos: metaMensal,
        valeMensalCentavos: mes.vale,
        mercadoMensalCentavos: mes.mercado,
        saldoMensalCentavos: mes.saldo,
        despesas: dados.despesas.filter((d) => d.status !== 'cancelada' && d.status !== 'encerrada').flatMap((d) => {
          const oc = ocorrencias(d, mesBase + '-01', fim, dados.reais)
          const cat = dados.categorias.find((c) => c.id === d.categoriaId)
          return oc.length === 0 ? [] : [{
            id: d.id, descricao: d.descricao, categoria: cat?.nome ?? '', tipo: d.status === 'planejada' ? 'planejada' : d.tipo, natureza: d.natureza,
            mediaMensalCentavos: Math.round(oc.reduce((s, o) => s + o.valorCentavos, 0) / 12), irredutivel: !!d.irredutivel,
            protegida: d.natureza === 'protegida' || cat?.natureza === 'protegida', mercado: !!d.mercado, pagamento: d.pagamento ?? 'avista', ocorrenciasNoAno: oc.length
          }]
        })
      }
      const saida = await window.api.iaGerar(entrada)
      const corte: Record<number, number> = {}
      for (const s of saida.sugestoes) {
        const e = entrada.despesas.find((x) => x.id === s.despesaId)!
        if (e.irredutivel || e.protegida) continue
        const d = dados.despesas.find((x) => x.id === s.despesaId)!
        corte[d.categoriaId] = (corte[d.categoriaId] ?? 0) + Math.round((e.mediaMensalCentavos * s.cortePct) / 100)
      }
      setAjustes(Object.fromEntries(gastos.map((g) => [g.id, corte[g.id] ? { aplicar: true, alvo: Math.max(0, g.atualCentavos - corte[g.id]) } : { aplicar: false }])))
      setIa({ saida })
    } catch (e) {
      setIa({ erro: e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e) })
    }
  }

  const salvarPlano = async () => {
    for (const p of dados.planos.filter((x) => x.ativo)) await salvar('plano', { ...p, ativo: false })
    await salvar('plano', { nome: nomePlano, metaMensalCentavos: metaMensal, prazo, criadoEm: hoje, cortesPct, ativo: true })
    setSalvo(true)
  }

  return (
    <>
      <header className="cab"><h1>Plano de redução</h1></header>
      {ativo && <Nota tom="ok">Plano ativo: <b>{ativo.nome}</b> (criado em {ativo.criadoEm.split('-').reverse().join('/')}, prazo {ativo.prazo.split('-').reverse().join('/')}). Acompanhe em “Acompanhamento”. Salvar um novo plano substitui o ativo.</Nota>}
      <Card titulo="Meta de redução" sub="Plano gerado por regra: corta primeiro as despesas flexíveis de maior valor">
        <Seg valor={tipo} onChange={setTipo} opcoes={[{ v: 'valor', r: 'Reduzir valor mensal' }, { v: 'pct', r: 'Reduzir %' }, { v: 'saldo', r: 'Alcançar saldo mensal' }]} />
        <div className="linha">
          {tipo === 'pct' ? <Campo label="Percentual do gasto reduzível"><input type="number" min={1} max={100} value={pct} onChange={(e) => setPct(Number(e.target.value))} /></Campo>
            : <Campo label={tipo === 'valor' ? 'Valor a reduzir por mês' : 'Saldo mensal desejado'}><InputBRL valor={meta} onChange={setMeta} /></Campo>}
          <Campo label="Prazo"><input type="month" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></Campo>
          <Campo label="Meta mensal calculada"><input readOnly value={formatarBRL(metaMensal)} /></Campo>
        </div>
      </Card>

      <Card titulo="Plano com IA (Claude)" sub="O Claude analisa cada despesa e sugere cortes com justificativa; você revisa na tabela abaixo antes de salvar">
        <div className="acoes" style={{ justifyContent: 'flex-start' }}>
          <Btn v="p" disabled={ia?.carregando || metaMensal <= 0} onClick={gerarComIA}>{ia?.carregando ? 'Gerando… (pode levar um minuto)' : 'Gerar com IA'}</Btn>
        </div>
        <Nota tom="cinza">Usa o Claude Code instalado neste computador, com o seu login (sem chave de API). Ao gerar, descrições, categorias e valores médios das despesas são enviados ao Claude, sem nomes de membros. Nada é enviado antes disso.</Nota>
        {ia?.erro && <Nota tom="danger">{ia.erro}</Nota>}
        {ia?.saida && (
          <>
            <Nota tom="ok">{ia.saida.resumo || 'Plano gerado.'}</Nota>
            <table>
              <thead><tr><th>Despesa</th><th className="n">Média mensal</th><th className="n">Corte sugerido</th><th>Motivo</th></tr></thead>
              <tbody>
                {ia.saida.sugestoes.filter((s) => s.cortePct > 0).map((s) => {
                  const d = dados.despesas.find((x) => x.id === s.despesaId)!
                  const media = Math.round(ocorrencias(d, mesBase + '-01', ultimoDiaDoMes(proj(dados, mesBase).meses[11].mes), dados.reais).reduce((t, o) => t + o.valorCentavos, 0) / 12)
                  return <tr key={s.despesaId}><td>{d.descricao}</td><td className="n">{brl(media)}</td><td className="n">−{Math.round(s.cortePct)}% ({brl(Math.round((media * s.cortePct) / 100))})</td><td>{s.motivo}</td></tr>
                })}
              </tbody>
            </table>
          </>
        )}
      </Card>

      <Card titulo="Sugestões por categoria" sub="Gasto médio mensal dos próximos 12 meses, incluindo compras pontuais e planejadas. Despesas marcadas como valor irredutível ficam de fora do corte.">
        <table>
          <thead><tr><th>Categoria</th><th className="n">Média mensal</th><th>Alvo mensal</th><th className="n">Corte</th><th>Limite</th><th>Aplicar</th></tr></thead>
          <tbody>
            {efetivo.filter((l) => l.atualCentavos > 0).map((l) => (
              <tr key={l.id}>
                <td>{l.nome}{l.naoReduzivel > 0 && !l.protegida && <div className="sub">{brl(l.naoReduzivel)} irredutível</div>}</td>
                <td className="n">{brl(l.atualCentavos, l.nome.startsWith('Fundos'))}</td>
                <td style={{ width: 160 }}>{l.protegida ? <span>{brl(l.alvo, l.nome.startsWith('Fundos'))}</span> : <InputBRL valor={l.alvo} onChange={(v) => setAjustes({ ...ajustes, [l.id]: { ...ajustes[l.id], alvo: v } })} />}</td>
                <td className="n">{l.protegida ? <span className="sub">{l.nome.startsWith('Fundos') ? 'voluntária' : 'contratadas'}</span> : l.corte > 0 ? `−${brl(l.corte)} (${Math.round(l.cortePctAplicado)}%)` : 'sem corte'}{l.acimaDoLimite && <Chip tom="danger">acima do limite</Chip>}</td>
                <td><ChipNatureza n={l.natureza} /> <span className="sub">{l.protegida ? '' : `até ${l.cortePct}%`}</span></td>
                <td><input type="checkbox" aria-label={`Aplicar em ${l.nome}`} disabled={l.protegida} checked={l.aplicar} onChange={(e) => setAjustes({ ...ajustes, [l.id]: { aplicar: e.target.checked, alvo: e.target.checked ? ajustes[l.id]?.alvo : undefined } })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="linha">
          <Card><div className="sub">Economia mensal (média)</div><b className={economia >= metaMensal ? 'tom-ok' : 'tom-warn'} style={{ fontSize: 18 }}>{brl(economia)}</b><div className="sub">{economia >= metaMensal ? 'Meta atingida' : `Faltam ${brl(metaMensal - economia)} para a meta`}</div></Card>
          <Card><div className="sub">Saldo do mês</div><b style={{ fontSize: 18 }}>{brl(mes.saldo)} → {brl(mes.saldo + economia)}</b><div className="sub">{mes.saldo > 0 ? `+${((economia / mes.saldo) * 100).toFixed(1).replace('.', ',')}% sobre o saldo atual` : ''}</div></Card>
          <Card><div className="sub">Saldo projetado 12 meses</div><b className="tom-primary" style={{ fontSize: 18 }}>{brl(antes)} → {brl(depois)}</b><div className="sub">{depois - antes >= 0 ? '+' : ''}{brl(depois - antes)} com o plano</div></Card>
        </div>
        {gerado.faltanteCentavos > 0 && <Nota tom="warn">Meta inviável com os limites atuais: o máximo alcançável é {brl(gerado.economiaCentavos)} por mês. Aumente o prazo, ajuste os limites em Configurações, libere despesas marcadas como irredutíveis ou reduza a meta.</Nota>}
        <div className="acoes">
          {salvo && <span className="tom-ok">Plano salvo.</span>}
          <Btn v="p" disabled={economia <= 0} onClick={salvarPlano}>Salvar e acompanhar</Btn>
        </div>
        <Nota tom="cinza">Parcelas e a contribuição aos Fundos Bahá’ís não são sugeridas para corte. O corte vale em % sobre o gasto reduzível de cada mês, então uma compra planejada também diminui. O alívio das parcelas que terminam aparece em “Futuro”.</Nota>
      </Card>
    </>
  )
}
