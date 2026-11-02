import { useState } from 'react'
import { ultimoAno, ultimoDiaCoberto } from '@shared/domain/calendario-badi'
import { dataBr } from '@shared/domain/datas'
import type { Categoria, Natureza } from '@shared/domain/tipos'
import { Btn, Campo, Card, Check, Chip, Modal, Nota, Seg, type Tom } from '../ui'
import { useDados } from '../store'

const TOM: Record<Natureza, Tom> = { essencial: '', flexivel: 'warn', protegida: '' }
const ROTULO: Record<Natureza, string> = { essencial: 'Essencial', flexivel: 'Flexível', protegida: 'Protegida' }
const CORTE_PADRAO: Record<Natureza, number> = { essencial: 10, flexivel: 50, protegida: 0 }

function EditarCategoria({ inicial, onClose }: { inicial: Partial<Categoria>; onClose: () => void }) {
  const { salvar, dados } = useDados()
  const [c, setC] = useState<Partial<Categoria>>({ cor: '#4f46e5', natureza: 'flexivel', cortePct: 50, ...inicial })
  const duplicada = dados.categorias.some((x) => x.id !== c.id && x.nome.trim().toLowerCase() === (c.nome ?? '').trim().toLowerCase())
  const ok = !!c.nome?.trim() && !duplicada
  return (
    <Modal titulo={c.id ? 'Editar categoria' : 'Nova categoria'} onClose={onClose}>
      <Campo label="Nome"><input value={c.nome ?? ''} onChange={(e) => setC({ ...c, nome: e.target.value })} autoFocus /></Campo>
      {duplicada && <span className="erro">Já existe uma categoria com esse nome.</span>}
      <div className="linha">
        <Campo label="Cor"><input type="color" value={c.cor} onChange={(e) => setC({ ...c, cor: e.target.value })} /></Campo>
        <Campo label="Corte máximo no plano (%)">
          <input type="number" min={0} max={100} value={c.cortePct} onChange={(e) => setC({ ...c, cortePct: Math.min(100, Math.max(0, Number(e.target.value))) })} />
        </Campo>
      </div>
      <Campo label="Natureza">
        <Seg valor={c.natureza as Natureza} onChange={(n) => setC({ ...c, natureza: n, cortePct: CORTE_PADRAO[n] })} opcoes={(['essencial', 'flexivel', 'protegida'] as Natureza[]).map((v) => ({ v, r: ROTULO[v] }))} />
      </Campo>
      {c.natureza === 'protegida' && <Nota tom="teal">Categorias protegidas nunca são sugeridas para corte no plano de redução.</Nota>}
      <div className="acoes">
        <Btn onClick={onClose}>Cancelar</Btn>
        <Btn v="p" disabled={!ok} onClick={async () => { await salvar('categoria', { ...c, nome: c.nome!.trim() }); onClose() }}>Salvar</Btn>
      </div>
    </Modal>
  )
}

function JanelaCartao() {
  const { dados, salvarCartao } = useDados()
  const [fech, setFech] = useState(dados.cartao?.diaFechamento ?? 25)
  const [venc, setVenc] = useState(dados.cartao?.diaVencimento ?? 5)
  const dia = (n: number) => n >= 1 && n <= 31
  return (
    <Card titulo="Cartão de crédito" sub="Despesas marcadas como “cartão” pesam no mês do vencimento da fatura, não no da compra">
      <div className="linha">
        <Campo label="Dia de fechamento"><input type="number" min={1} max={31} value={fech} onChange={(e) => setFech(Number(e.target.value))} /></Campo>
        <Campo label="Dia de vencimento"><input type="number" min={1} max={31} value={venc} onChange={(e) => setVenc(Number(e.target.value))} /></Campo>
      </div>
      {dia(fech) && dia(venc) && <Nota tom="cinza">Compras até o dia {fech} entram na fatura que vence no dia {venc}{venc > fech ? ' do mesmo mês' : ' do mês seguinte'}; compras depois do dia {fech} vão para a fatura seguinte.</Nota>}
      {!dados.cartao && <Nota tom="warn">Sem janela configurada, compras no cartão contam na própria data.</Nota>}
      <div className="acoes">
        {dados.cartao && <Btn v="d" onClick={() => salvarCartao(null)}>Remover janela</Btn>}
        <Btn v="p" disabled={!dia(fech) || !dia(venc)} onClick={() => salvarCartao({ diaFechamento: fech, diaVencimento: venc })}>Salvar</Btn>
      </div>
    </Card>
  )
}

export default function Config() {
  const { dados, salvar, excluir, tema, setTema, recarregar, salvarJanela } = useDados()
  const [edit, setEdit] = useState<Partial<Categoria> | null>(null)
  const [novoMembro, setNovoMembro] = useState('')
  // Remover um membro devolve os lançamentos dele à Família: o banco faz isso (ON DELETE SET NULL).
  const removerMembro = (id: number) => excluir('membro', id)
  const [msg, setMsg] = useState<string | null>(null)
  const usada = (id: number) => dados.despesas.some((d) => d.categoriaId === id)

  const rodar = async (fn: () => Promise<string | null | void>) => {
    try {
      const r = await fn()
      await recarregar()
      setMsg(r ?? 'Pronto.')
    } catch (e) {
      setMsg(`Falhou: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <>
      <header className="cab"><h1>Configurações</h1></header>
      <Card titulo="Categorias" sub="Natureza padrão e limite de corte usados no plano de redução" acoes={<Btn onClick={() => setEdit({})}>+ Nova categoria</Btn>}>
        <table>
          <thead><tr><th>Nome</th><th>Natureza</th><th className="n">Corte máximo</th><th>Cor</th><th /></tr></thead>
          <tbody>
            {dados.categorias.map((c) => (
              <tr key={c.id}>
                <td>{c.nome}</td>
                <td><Chip tom={TOM[c.natureza]}>{ROTULO[c.natureza]}</Chip></td>
                <td className="n">{c.cortePct}%</td>
                <td><span className="chip" style={{ background: c.cor, color: '#fff' }}>{c.cor}</span></td>
                <td className="n">
                  <Btn v="link" onClick={() => setEdit(c)}>Editar</Btn>
                  <Btn v="link" disabled={usada(c.id)} title={usada(c.id) ? 'Há despesas nesta categoria' : ''} onClick={() => confirm(`Excluir a categoria "${c.nome}"?`) && excluir('categoria', c.id)}>Excluir</Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card titulo="Membros da família" sub="Opcional: serve para filtrar e para sugerir 13º e férias. Sem membro, o lançamento é da Família (compartilhada).">
        <div className="chips">
          {dados.membros.map((m) => (
            <span key={m.id} className="chip prim">
              {m.nome}{' '}
              <button type="button" className="btn link" style={{ padding: '0 4px' }} aria-label={`Remover ${m.nome}`}
                onClick={() => confirm(`Remover ${m.nome}? Os lançamentos dela passam a ser da Família.`) && removerMembro(m.id)}>×</button>
            </span>
          ))}
          {dados.membros.length === 0 && <span className="sub">Nenhum membro cadastrado.</span>}
        </div>
        <form className="acoes" style={{ justifyContent: 'flex-start' }} onSubmit={async (e) => { e.preventDefault(); const nome = novoMembro.trim(); if (nome && !dados.membros.some((m) => m.nome.toLowerCase() === nome.toLowerCase())) { await salvar('membro', { nome }); setNovoMembro('') } }}>
          <input placeholder="Nome" value={novoMembro} onChange={(e) => setNovoMembro(e.target.value)} aria-label="Nome do novo membro" />
          <Btn type="submit" disabled={!novoMembro.trim()}>Adicionar</Btn>
        </form>
      </Card>

      <JanelaCartao />

      <Card titulo="Janela do mês" sub="Quando o mês financeiro vira">
        <Check label="O mês começa no 1º recebimento da renda fixa" valor={!!dados.janelaRecebimento} onChange={salvarJanela} />
        <Nota tom="cinza">
          Ligado, o “mês” de cada tela e da projeção vai do 1º recebimento até a véspera do 1º recebimento do mês seguinte (considerando as parcelas e o nº dia útil de cada renda; VR/VA não conta). Desligado, vale o mês do calendário.
          Dia útil considera segunda a sexta, sem feriados. A lista “Lançamentos do mês” em Despesas continua pelo calendário.
        </Nota>
      </Card>

      <Card titulo="Calendário Badí’" sub="Usado nas despesas “a cada 19 dias” e nas Festas dos 19 Dias">
        <Nota tom="cinza">
          Tabela da Casa Universal de Justiça (172 a 221 B.E.), embutida. Cobre até {dataBr(ultimoDiaCoberto())} (ano {ultimoAno} B.E.); o app avisa quando um período passar disso.
        </Nota>
      </Card>

      <Card titulo="Dados e backup" sub="Tudo fica salvo neste computador">
        <div className="acoes" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
          <Btn onClick={() => rodar(async () => `Backup salvo em ${await window.api.backup()}`)}>Fazer backup agora</Btn>
          <Btn onClick={() => rodar(async () => { const p = await window.api.exportarJson(); return p ? `Exportado para ${p}` : 'Exportação cancelada.' })}>Exportar JSON</Btn>
          <Btn onClick={() => rodar(async () => ((await window.api.importarJson()) ? 'Dados importados (um backup dos dados anteriores foi feito).' : 'Importação cancelada.'))}>Importar JSON</Btn>
          <Btn onClick={() => confirm('Substituir tudo pelos dados de exemplo? Um backup é feito antes.') && rodar(async () => { await window.api.backup(); await window.api.carregarExemplo(); return 'Dados de exemplo carregados.' })}>Carregar dados de exemplo</Btn>
          <Btn v="d" onClick={() => confirm('Apagar TODOS os dados? Um backup é feito antes.') && rodar(async () => { await window.api.backup(); await window.api.limparTudo(); return 'Dados apagados (backup feito).' })}>Apagar tudo</Btn>
        </div>
        {msg && <Nota tom="cinza">{msg}</Nota>}
      </Card>

      <Card titulo="Aparência">
        <Seg valor={tema} onChange={setTema} opcoes={[{ v: 'claro', r: 'Claro' }, { v: 'escuro', r: 'Escuro' }, { v: 'sistema', r: 'Sistema' }]} />
      </Card>
      {edit && <EditarCategoria inicial={edit} onClose={() => setEdit(null)} />}
    </>
  )
}
