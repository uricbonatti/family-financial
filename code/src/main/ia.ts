// Plano de redução com IA: roda o Claude Code instalado (`claude -p`) com o login do próprio usuário. Sem chave de API.
// Nada é enviado até o usuário pedir; o prompt vai por stdin e as ferramentas do Claude ficam desligadas.
import { spawn } from 'node:child_process'
import type { EntradaIA, SaidaIA } from '../shared/api'

const INSTRUCOES = `Você é um consultor financeiro familiar. Abaixo há a lista de despesas de uma família (valores em centavos por mês, média dos próximos 12) e uma meta de economia mensal.
Proponha um corte percentual (0 a 100) por despesa, justificando cada um em uma frase curta, em português do Brasil.
Regras: nunca sugira corte em despesas com "irredutivel" ou "protegida" verdadeiros (use 0); dê preferência a despesas flexíveis e pontuais/planejadas adiáveis; essenciais só cortes leves (até 20%); parcelas já contratadas não podem ser cortadas.
Despesas "mercado" são pagas primeiro com o vale-alimentação (valeMensalCentavos): cortar mercado só gera economia real no que passar do vale, então prefira não cortar mercado enquanto o gasto estiver abaixo do vale.
Tente atingir a meta sem exagerar; se for inviável, diga no resumo. Responda SOMENTE com JSON, sem texto fora dele: {"resumo": string, "sugestoes": [{"despesaId": number, "cortePct": number, "motivo": string}]}.

DADOS:
`

function rodarClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // shell: true porque no Windows o `claude` é um .cmd; os argumentos são fixos e o prompt vai por stdin.
    const p = spawn('claude', ['-p', '--output-format', 'text', '--tools', '""', '--no-session-persistence'], { shell: true, windowsHide: true })
    let out = ''
    let err = ''
    const prazo = setTimeout(() => { p.kill(); reject(new Error('O Claude demorou demais para responder. Tente de novo.')) }, 120_000)
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('error', () => { clearTimeout(prazo); reject(new Error('Claude Code não encontrado. Instale-o e faça login (comando "claude").')) })
    p.on('close', (code) => {
      clearTimeout(prazo)
      if (code === 0) return resolve(out)
      const msg = /not recognized|não é reconhecido|ENOENT/i.test(err) ? 'Claude Code não encontrado. Instale-o e faça login (comando "claude").' : /login|auth/i.test(err + out) ? 'Claude Code não está logado. Rode "claude" no terminal e faça login.' : `O Claude Code falhou (código ${code}). ${err.trim().slice(0, 200)}`
      reject(new Error(msg))
    })
    p.stdin.end(prompt)
  })
}

export async function gerarPlanoIA(entrada: EntradaIA): Promise<SaidaIA> {
  const texto = await rodarClaude(INSTRUCOES + JSON.stringify(entrada))
  const json = texto.match(/\{[\s\S]*\}/)?.[0]
  if (!json) throw new Error('A IA não devolveu um plano legível. Tente de novo.')
  const bruto = JSON.parse(json) as Partial<SaidaIA>
  const ids = new Set(entrada.despesas.map((d) => d.id))
  const sugestoes = (bruto.sugestoes ?? [])
    .filter((s) => ids.has(s.despesaId) && Number.isFinite(s.cortePct))
    .map((s) => ({ despesaId: s.despesaId, cortePct: Math.min(100, Math.max(0, s.cortePct)), motivo: String(s.motivo ?? '') }))
  return { resumo: String(bruto.resumo ?? ''), sugestoes }
}
