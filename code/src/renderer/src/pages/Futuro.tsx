import { useMemo } from 'react'
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dataBr, rotuloMes, rotuloMesAno, ultimoDiaDoMes } from '@shared/domain/datas'
import { ocorrencias } from '@shared/domain/projecao'
import type { Despesa } from '@shared/domain/tipos'
import { Card, Nota } from '../ui'
import { useDados } from '../store'

const GRUPOS = [
  { k: 'recorrentes', r: 'Recorrentes', cor: 'var(--primary)' },
  { k: 'parcelas', r: 'Parcelas', cor: '#f59e0b' },
  { k: 'fundos', r: 'Fundos Bahá’ís', cor: 'var(--teal)' },
  { k: 'pontuais', r: 'Pontuais', cor: '#9ca3af' },
  { k: 'planejadas', r: 'Planejadas', cor: '#f9a8d4' }
] as const
type Grupo = (typeof GRUPOS)[number]['k']

const grupoDe = (d: Despesa): Grupo =>
  d.status === 'planejada' ? 'planejadas' : d.periodicidade === 'badi19' ? 'fundos' : d.tipo === 'parcelada' ? 'parcelas' : d.tipo === 'recorrente' ? 'recorrentes' : 'pontuais'

export default function Futuro() {
  const { dados, hoje, projecao12, brl } = useDados()
  const p = useMemo(() => projecao12(), [projecao12])

  const serie = useMemo(
    () =>
      p.meses.map((m) => {
        const linha: Record<string, number | string> = { rot: rotuloMes(m.mes), recorrentes: 0, parcelas: 0, fundos: 0, pontuais: 0, planejadas: 0 }
        for (const d of dados.despesas) {
          const v = ocorrencias(d, m.mes + '-01', ultimoDiaDoMes(m.mes), dados.reais).reduce((s, o) => s + o.valorCentavos, 0)
          linha[grupoDe(d)] = (linha[grupoDe(d)] as number) + v / 100
        }
        return linha
      }),
    [dados, p]
  )

  const parcelamentos = useMemo(
    () =>
      dados.despesas
        .filter((d) => d.tipo === 'parcelada' && d.status !== 'cancelada')
        .map((d) => {
          const todas = ocorrencias(d, '1900-01-01', '2200-12-31')
          const feitas = todas.filter((o) => o.data <= hoje).length
          return { d, total: todas.length, feitas, restam: todas.length - feitas, termina: todas.at(-1)?.data ?? d.inicio }
        })
        .filter((x) => x.restam > 0)
        .sort((a, b) => a.termina.localeCompare(b.termina)),
    [dados, hoje]
  )

  return (
    <>
      <header className="cab"><h1>Futuro</h1></header>
      <Card titulo="Compromissos futuros" sub={`Próximos 12 meses · ${rotuloMesAno(p.meses[0].mes)} a ${rotuloMesAno(p.meses[11].mes)}`}>
        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={serie}>
              <XAxis dataKey="rot" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis width={56} tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => brl(Math.round(Number(v) * 100))} contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8 }} cursor={{ fill: 'transparent' }} />
              <Legend iconType="square" />
              {GRUPOS.map((g) => <Bar key={g.k} dataKey={g.k} name={g.r} stackId="a" fill={g.cor} />)}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card titulo="Saldo projetado mês a mês" sub={`Renda fixa + entradas pontuais − despesas · acumulado de ${brl(p.total)} em 12 meses`}>
        <table>
          <thead><tr><th>Mês</th><th className="n">Renda fixa</th><th className="n">Entradas pontuais</th><th className="n">Despesas</th><th className="n">Saldo do mês</th><th className="n">Acumulado</th></tr></thead>
          <tbody>
            {p.meses.map((m) => (
              <tr key={m.mes}>
                <td>{rotuloMesAno(m.mes)}</td>
                <td className="n">{brl(m.rendaFixa)}</td>
                <td className="n">{m.pontuais ? `+ ${brl(m.pontuais)}` : '—'}</td>
                <td className="n">{brl(m.despesas)}{m.festas ? <span className="sub"> · {m.festas} {m.festas > 1 ? 'Festas' : 'Festa'}</span> : null}</td>
                <td className={`n ${m.saldo < 0 ? 'tom-danger' : ''}`}>{brl(m.saldo)}</td>
                <td className={`n ${m.acumulado < 0 ? 'tom-danger' : ''}`}>{brl(m.acumulado)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="total"><span>Saldo projetado em 12 meses</span><b>{brl(p.total)}</b></div>
        <Nota tom="cinza">Uma entrada extraordinária (ex.: prêmio de loteria) entra como renda pontual e muda o acumulado a partir do mês em que é recebida.</Nota>
      </Card>

      <Card titulo="Quando as parcelas terminam" sub="O alívio mensal aparece no saldo projetado">
        {parcelamentos.length === 0 ? <div className="sub">Nenhum parcelamento em andamento.</div> : (
          <table>
            <thead><tr><th>Parcelamento</th><th>Progresso</th><th className="n">Restam</th><th>Termina em</th><th className="n">Alívio mensal</th></tr></thead>
            <tbody>
              {parcelamentos.map(({ d, total, feitas, restam, termina }) => (
                <tr key={d.id}>
                  <td>{d.descricao}</td>
                  <td style={{ width: 220 }}><div className="trilho"><i style={{ width: `${(feitas / total) * 100}%`, background: '#f59e0b' }} /></div></td>
                  <td className="n">{restam} {restam > 1 ? 'parcelas' : 'parcela'}</td>
                  <td>{dataBr(termina).slice(3)}</td>
                  <td className="n">{brl(d.valorCentavos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}
