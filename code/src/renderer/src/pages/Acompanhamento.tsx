import { useMemo, useState } from 'react'
import { rotuloMesAno } from '@shared/domain/datas'
import { Card, Chip, Nota, Stat, Vazio } from '../ui'
import { useDados } from '../store'

export default function Acompanhamento() {
  const { dados, mesAtual, projecao12, proj, categoria, brl } = useDados()
  const [mes, setMes] = useState(mesAtual)
  const plano = dados.planos.find((p) => p.ativo)
  const p12 = useMemo(() => projecao12({ cortesPct: plano?.cortesPct }), [projecao12, plano])
  const negativo = p12.meses.find((x) => x.saldo < 0)

  // Realizado = projeção do mês com os valores reais lançados; previsto = o mesmo mês sem os ajustes reais e sem o corte.
  const linhas = useMemo(() => {
    if (!plano) return []
    const real = proj(dados, mes, 1).meses[0]
    const previsto = proj({ ...dados, reais: [] }, mes, 1).meses[0]
    return Object.entries(plano.cortesPct).map(([id, cortePct]) => {
      const cat = Number(id)
      const base = previsto.porCategoria[cat] ?? 0
      const irred = previsto.irredutivelPorCategoria[cat] ?? 0
      const alvo = Math.round(base - ((base - irred) * cortePct) / 100)
      const gasto = real.porCategoria[cat] ?? 0
      return { id: cat, alvo, real: gasto, base, desvio: gasto - alvo }
    })
  }, [plano, dados, mes, proj])
  const economia = linhas.reduce((s, l) => s + (l.base - l.real), 0)
  const noAlvo = linhas.filter((l) => l.desvio <= 0).length
  const pior = [...linhas].filter((l) => l.desvio > 0).sort((a, b) => b.desvio - a.desvio)[0]

  return (
    <>
      <header className="cab">
        <h1>Acompanhamento</h1>
        <label className="campo" style={{ flex: 'none' }}><input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mês" /></label>
      </header>

      {negativo && <Nota tom="danger">Atenção: o saldo projetado fica negativo em {rotuloMesAno(negativo.mes)} ({brl(negativo.saldo)}). Veja “Futuro” e o “Plano de redução”.</Nota>}

      {!plano ? (
        <Card><Vazio><div>Nenhum plano de redução ativo. Gere e salve um plano para acompanhar meta × realizado.</div></Vazio></Card>
      ) : (
        <>
          <div className="linha">
            <Stat l="Economia no mês" tom={economia >= plano.metaMensalCentavos ? 'ok' : 'warn'} v={brl(economia)} s={`de ${brl(plano.metaMensalCentavos)} (${plano.metaMensalCentavos ? Math.round((economia / plano.metaMensalCentavos) * 100) : 0}%)`} />
            <Stat l="Categorias no alvo" v={`${noAlvo} de ${linhas.length}`} s={linhas.length - noAlvo ? `${linhas.length - noAlvo} acima do alvo` : 'todas no alvo'} />
            <Stat l="Alertas" tom={linhas.length - noAlvo ? 'warn' : 'ok'} v={String(linhas.length - noAlvo + (negativo ? 1 : 0))} s={pior ? `${categoria(pior.id).nome} passou do alvo` : negativo ? 'Saldo projetado negativo' : 'Tudo certo'} />
          </div>
          <Card titulo="Meta × realizado por categoria" sub={`${rotuloMesAno(mes)} · plano “${plano.nome}”`}>
            <table>
              <thead><tr><th>Categoria</th><th className="n">Alvo do mês</th><th className="n">Realizado</th><th className="n">Desvio</th><th>Progresso</th><th>Situação</th></tr></thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id}>
                    <td>{categoria(l.id).nome}</td>
                    <td className="n">{brl(l.alvo)}</td><td className="n">{brl(l.real)}</td>
                    <td className={`n ${l.desvio > 0 ? 'tom-danger' : 'tom-ok'}`}>{l.desvio > 0 ? '+' : '−'}{brl(Math.abs(l.desvio))}</td>
                    <td style={{ width: 240 }}><div className="trilho"><i style={{ width: `${Math.min(100, l.alvo ? (l.real / l.alvo) * 100 : 100)}%`, background: l.desvio > 0 ? 'var(--danger)' : 'var(--ok)' }} /></div></td>
                    <td><Chip tom={l.desvio > 0 ? 'danger' : 'ok'}>{l.desvio > 0 ? 'Acima do alvo' : 'No alvo'}</Chip></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Nota tom="cinza">Realizado = valores lançados em “Despesas › Lançamentos do mês”. Enquanto você não ajusta o valor real, vale o previsto. O alvo do mês é o previsto da categoria menos o corte do plano sobre a parte reduzível (despesas irredutíveis não são cortadas).</Nota>
            {pior && <Nota tom="warn">Alerta: {categoria(pior.id).nome} passou do alvo em {brl(pior.desvio)}. Se continuar, o saldo projetado cai {brl(pior.desvio * 12)} em 12 meses.</Nota>}
          </Card>
        </>
      )}
    </>
  )
}
