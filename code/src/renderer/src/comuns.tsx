import { Campo, Chip, type Tom } from './ui'
import { useDados } from './store'
import type { ClasseRenda, Natureza } from '@shared/domain/tipos'

export function SelectMembro({ valor, onChange }: { valor?: number | null; onChange: (id: number | null) => void }) {
  const { dados } = useDados()
  return (
    <Campo label="Membro (opcional)">
      <select value={valor ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}>
        <option value="">Família (compartilhada)</option>
        {dados.membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
      </select>
    </Campo>
  )
}

export function SelectCategoria({ valor, onChange }: { valor?: number; onChange: (id: number) => void }) {
  const { dados } = useDados()
  return (
    <Campo label="Categoria">
      <select value={valor ?? ''} onChange={(e) => onChange(Number(e.target.value))}>
        <option value="" disabled>Escolha…</option>
        {dados.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
    </Campo>
  )
}

export const ROTULO_NATUREZA: Record<Natureza, string> = { essencial: 'Essencial', flexivel: 'Flexível', protegida: 'Protegida' }
export const TOM_NATUREZA: Record<Natureza, Tom> = { essencial: '', flexivel: 'warn', protegida: '' }
export const ChipNatureza = ({ n }: { n: Natureza }) => <Chip tom={TOM_NATUREZA[n]}>{ROTULO_NATUREZA[n]}</Chip>

export const ROTULO_CLASSE: Record<ClasseRenda, { r: string; tom: Tom }> = {
  '13o': { r: '13º', tom: 'purple' },
  ferias: { r: 'Férias', tom: 'warn' },
  bico: { r: 'Bico', tom: 'prim' },
  freelance: { r: 'Freelance', tom: 'prim' },
  outro: { r: 'Outro', tom: '' }
}
