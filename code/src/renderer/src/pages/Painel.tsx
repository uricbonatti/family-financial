import { useMemo, useState } from 'react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { addMeses, rotuloMes, ultimoDiaDoMes } from '@shared/domain/datas'
import { cartaoRestante, ocorrencias } from '@shared/domain/projecao'
import { Btn, Card, Stat, Vazio } from '../ui'
import { useDados } from '../store'

export default function Painel() {
  const { dados, hoje, mesAtual, projecao12, categoria, brl , proj } = useDados()
  const [mes, setMes] = useState(mesAtual)

  const m = useMemo(() => proj(dados, mes, 1).meses[0], [dados, mes])
  const parcelas = useMemo(() => {
    const ocs = dados.despesas.filter((d) => d.tipo === 'parcelada').flatMap((d) => ocorrencias(d, mes + '-01', ultimoDiaDoMes(mes), dados.reais))
    return { valor: ocs.reduce((s, o) => s + o.valorCentavos, 0), n: ocs.length }
  }, [dados, mes])
  const restanteCartao = useMemo(() => cartaoRestante(dados, hoje), [dados, hoje])
  const p12 = useMemo(() => projecao12(), [projecao12])
  const pontuais12 = p12.meses.reduce((s, x) => s + x.pontuais, 0)
  const serie = useMemo(
    () =>
      proj(dados, addMeses(mesAtual + '-01', -3).slice(0, 7), 12).meses.map((x) => ({
        rot: rotuloMes(x.mes),
        mes: x.mes,
        renda: (x.rendaFixa + x.pontuais) / 100,
        despesas: x.despesas / 100
      })),
    [dados, mesAtual]
  )

  const renda = m.rendaFixa + m.pontuais
  const categorias = Object.entries(m.porCategoria)
    .map(([id, v]) => ({ id: Number(id), v, ...categoria(Number(id)) }))
    .sort((a, b) => b.v - a.v)
  const maior = categorias[0]?.v || 1
  const vazio = dados.rendas.length === 0 && dados.despesas.length === 0

  return (
    <>
      <header className="cab">
        <h1>Painel</h1>
        <label className="campo" style={{ flex: 'none' }}>
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mês" />
        </label>
      </header>

      {vazio && (
        <Card>
          <Vazio>
            <div>Ainda não há rendas nem despesas. Cadastre em Renda e Despesas, ou veja o app com dados de exemplo.</div>
            <Btn v="p" onClick={async () => { await window.api.carregarExemplo(); location.reload() }}>Carregar dados de exemplo</Btn>
          </Vazio>
        </Card>
      )}

      <div className="linha">
        <Stat l="Renda" v={brl(renda)} s={m.pontuais ? `${brl(m.rendaFixa)} fixa + ${brl(m.pontuais)} pontual` : `${dados.rendas.filter((r) => r.tipo === 'fixa').length} rendas fixas`} />
        <Stat l="Despesas" v={brl(m.despesas)} s={renda ? `${Math.round((m.despesas / renda) * 100)}% da renda` : '—'} />
        <Stat l="Saldo do mês" v={brl(m.saldo)} tom={m.saldo >= 0 ? 'ok' : 'danger'} s={m.pontuais ? 'Inclui entradas pontuais' : 'Sem entradas pontuais'} />
        <Stat l="Parcelas no mês" v={brl(parcelas.valor)} tom="warn" s={`${parcelas.n} parcelamentos ativos`} />
        <Stat l="Cartão no mês" v={brl(m.cartao)} tom="warn" s={dados.cartao ? `fatura que vence em ${rotuloMes(mes)}` : 'sem janela do cartão configurada'} />
        <Stat l="Cartão restante" v={brl(restanteCartao.centavos)} tom="warn" s={restanteCartao.semFim ? `parcelas e compras futuras · fora ${restanteCartao.semFim} recorrente(s) sem fim` : 'parcelas e compras futuras'} />
        <Stat estilo="dest" l="Saldo projetado · 12 meses" v={brl(p12.total)} s={`Inclui ${brl(pontuais12)} de entradas pontuais`} />
      </div>
      <div className="linha" style={{ flex: 1 }}>
        <Card titulo="Despesas por categoria" sub={`${rotuloMes(mes)}/${mes.slice(0, 4)}`}>
          {categorias.length === 0 && <Vazio>Sem despesas neste mês.</Vazio>}
          {categorias.map((c) => (
            <div className="barra" key={c.id}>
              <div className="t">{c.nome} · {brl(c.v, c.nome.startsWith('Fundos'))}</div>
              <div className="trilho"><i style={{ width: `${(c.v / maior) * 100}%`, background: c.cor }} /></div>
            </div>
          ))}
        </Card>
        <Card titulo="Evolução mensal" sub={`Renda (claro) × despesas (escuro) · meses depois de ${rotuloMes(mesAtual)} são projeção`}>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} barGap={4}>
                <XAxis dataKey="rot" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis width={56} tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => brl(Math.round(Number(v) * 100))} contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 8 }} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="renda" name="Renda" fill="var(--bar-soft)" radius={4} />
                <Bar dataKey="despesas" name="Despesas" radius={4}>
                  {serie.map((x) => <Cell key={x.mes} fill={x.mes > mesAtual ? 'var(--bar-proj)' : 'var(--primary)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </>
  )
}
