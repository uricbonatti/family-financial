// Dados de exemplo (os mesmos do protótipo no FigCraft): usados para demonstração e como referência nos testes.
import { FUNDOS_PADRAO, type Dados, type Despesa, type Renda } from './tipos'

const parcelada = (id: number, descricao: string, valor: number, n: number, inicio: string, natureza: Despesa['natureza']): Despesa => ({
  id, descricao, categoriaId: 5, tipo: 'parcelada', valorCentavos: valor, nParcelas: n, inicio, natureza, status: 'ativa'
})
const recorrente = (id: number, descricao: string, categoriaId: number, valor: number, natureza: Despesa['natureza']): Despesa => ({
  id, descricao, categoriaId, tipo: 'recorrente', periodicidade: 'mensal', valorCentavos: valor, inicio: '2026-01-10', natureza, status: 'ativa'
})
const pontual = (id: number, descricao: string, classe: '13o' | 'ferias' | 'bico', membroId: number, valor: number, data: string, situacao: 'prevista' | 'recebida'): Renda => ({
  id, tipo: 'pontual', descricao, classe, membroId, valorCentavos: valor, data, situacao, repeteAnual: false
})

export function dadosExemplo(): Dados {
  return {
    membros: [{ id: 1, nome: 'Maria' }, { id: 2, nome: 'João' }],
    categorias: [
      { id: 1, nome: 'Moradia', cor: '#4F46E5', natureza: 'essencial', cortePct: 10 },
      { id: 2, nome: 'Alimentação', cor: '#4F46E5', natureza: 'essencial', cortePct: 10 },
      { id: 3, nome: 'Transporte', cor: '#4F46E5', natureza: 'flexivel', cortePct: 50 },
      { id: 4, nome: 'Lazer', cor: '#4F46E5', natureza: 'flexivel', cortePct: 50 },
      { id: 5, nome: 'Parcelas', cor: '#F59E0B', natureza: 'protegida', cortePct: 0 },
      { id: 6, nome: 'Fundos Bahá’ís', cor: '#0D9488', natureza: 'protegida', cortePct: 0 },
      { id: 7, nome: 'Outros', cor: '#6B7280', natureza: 'flexivel', cortePct: 50 }
    ],
    rendas: [
      { id: 1, tipo: 'fixa', membroId: 1, descricao: 'Salário Maria', diaRecebimento: 5, inicio: '2026-03-01', valores: [{ desde: '2026-03', valorCentavos: 620000 }] },
      { id: 2, tipo: 'fixa', membroId: 2, descricao: 'Salário João', diaRecebimento: 10, inicio: '2025-01-01', valores: [{ desde: '2025-01', valorCentavos: 360000 }] },
      pontual(3, 'Bico – manutenção de site', 'bico', 2, 80000, '2026-09-15', 'recebida'),
      pontual(4, '13º salário – 1ª parcela', '13o', 1, 310000, '2026-11-30', 'prevista'),
      pontual(5, '13º salário – 1ª parcela', '13o', 2, 180000, '2026-11-30', 'prevista'),
      pontual(6, '13º salário – 2ª parcela', '13o', 1, 310000, '2026-12-20', 'prevista'),
      pontual(7, '13º salário – 2ª parcela', '13o', 2, 180000, '2026-12-20', 'prevista'),
      pontual(8, '1/3 de férias', 'ferias', 1, 206667, '2027-01-15', 'prevista'),
      pontual(9, '1/3 de férias', 'ferias', 2, 120000, '2027-03-15', 'prevista')
    ],
    despesas: [
      { ...recorrente(1, 'Aluguel', 1, 240000, 'essencial'), inicio: '2026-01-05' },
      recorrente(2, 'Supermercado', 2, 150000, 'essencial'),
      recorrente(3, 'Combustível e transporte', 3, 65000, 'flexivel'),
      recorrente(4, 'Lazer e restaurantes', 4, 52000, 'flexivel'),
      { id: 5, descricao: 'Fundos Bahá’ís', categoriaId: 6, tipo: 'recorrente', periodicidade: 'badi19', valorCentavos: 20000, inicio: '2026-09-08', natureza: 'protegida', status: 'ativa' },
      parcelada(6, 'Notebook', 39000, 12, '2026-06-15', 'essencial'),
      parcelada(7, 'Geladeira', 52000, 10, '2026-03-15', 'essencial'),
      parcelada(8, 'Sofá', 73000, 10, '2026-09-15', 'flexivel'),
      parcelada(9, 'Curso de inglês', 34000, 6, '2026-07-15', 'flexivel'),
      { id: 10, descricao: 'Presente de aniversário', categoriaId: 7, tipo: 'pontual', valorCentavos: 30000, inicio: '2026-10-18', natureza: 'flexivel', status: 'ativa' },
      { id: 11, descricao: 'Viagem de férias', categoriaId: 4, tipo: 'pontual', valorCentavos: 450000, inicio: '2027-01-20', natureza: 'flexivel', status: 'planejada' }
    ],
    reais: [],
    planos: [],
    fundos: { ...FUNDOS_PADRAO, despesaId: 5 }
  }
}
