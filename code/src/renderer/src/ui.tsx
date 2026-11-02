import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { formatarBRL, lerBRL } from '@shared/domain/dinheiro'

export type Tom = 'ok' | 'warn' | 'danger' | 'prim' | 'teal' | 'purple' | ''

export const Chip = ({ tom = '', children }: { tom?: Tom; children: ReactNode }) => <span className={`chip ${tom}`}>{children}</span>

export const Btn = ({ v, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { v?: 'p' | 'd' | 'link' }) => (
  <button type="button" {...p} className={`btn ${v ?? ''} ${p.className ?? ''}`} />
)

export function Card({ titulo, sub, acoes, children }: { titulo?: string; sub?: string; acoes?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      {(titulo || acoes) && (
        <div className="topo">
          <div>
            {titulo && <h2>{titulo}</h2>}
            {sub && <div className="sub">{sub}</div>}
          </div>
          {acoes}
        </div>
      )}
      {children}
    </section>
  )
}

export const Stat = ({ l, v, s, tom, estilo }: { l: string; v: ReactNode; s?: ReactNode; tom?: string; estilo?: 'dest' | 'teal' }) => (
  <div className={`stat ${estilo ?? ''}`}>
    <div className="l">{l}</div>
    <div className={`v ${tom ? 'tom-' + tom : ''}`}>{v}</div>
    {s && <div className="s">{s}</div>}
  </div>
)

export const Nota = ({ tom = '', children }: { tom?: 'teal' | 'warn' | 'cinza' | 'ok' | 'danger' | ''; children: ReactNode }) => <div className={`nota ${tom}`}>{children}</div>

export const Campo = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="campo">
    <span>{label}</span>
    {children}
  </label>
)

export function Seg<T extends string>({ opcoes, valor, onChange }: { opcoes: { v: T; r: string }[]; valor: T; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group">
      {opcoes.map((o) => (
        <button key={o.v} type="button" aria-pressed={valor === o.v} onClick={() => onChange(o.v)}>
          {o.r}
        </button>
      ))}
    </div>
  )
}

export const Check = ({ label, valor, onChange }: { label: string; valor: boolean; onChange: (v: boolean) => void }) => (
  <label className="check">
    <input type="checkbox" checked={valor} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
)

/** Campo de dinheiro: edita como texto e entrega centavos ao sair do campo. */
export function InputBRL({ valor, onChange, placeholder }: { valor: number | null; onChange: (c: number | null) => void; placeholder?: string }) {
  const [txt, setTxt] = useState(valor == null ? '' : formatarBRL(valor))
  useEffect(() => setTxt(valor == null ? '' : formatarBRL(valor)), [valor])
  return (
    <input
      inputMode="decimal"
      value={txt}
      placeholder={placeholder ?? 'R$ 0,00'}
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => {
        const c = lerBRL(txt)
        onChange(c)
        setTxt(c == null ? '' : formatarBRL(c))
      }}
    />
  )
}

export function Modal({ titulo, sub, onClose, children }: { titulo: string; sub?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onClose])
  return (
    <div className="fundo" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{titulo}</h2>
          {sub && <div className="sub">{sub}</div>}
        </div>
        {children}
      </div>
    </div>
  )
}

export const Vazio = ({ children }: { children: ReactNode }) => <div className="vazio">{children}</div>
