import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/api'

const api: Api = {
  carregar: () => ipcRenderer.invoke('db:carregar'),
  salvar: (kind, obj) => ipcRenderer.invoke('db:salvar', kind, obj),
  excluir: (kind, id) => ipcRenderer.invoke('db:excluir', kind, id),
  salvarFundos: (f) => ipcRenderer.invoke('db:salvarFundos', f),
  salvarCartao: (c) => ipcRenderer.invoke('db:salvarCartao', c),
  salvarJanela: (a) => ipcRenderer.invoke('db:salvarJanela', a),
  iaGerar: (e) => ipcRenderer.invoke('ia:gerar', e),
  carregarExemplo: () => ipcRenderer.invoke('db:exemplo'),
  limparTudo: () => ipcRenderer.invoke('db:limpar'),
  exportarJson: () => ipcRenderer.invoke('db:exportar'),
  importarJson: () => ipcRenderer.invoke('db:importar'),
  backup: () => ipcRenderer.invoke('db:backup')
}

contextBridge.exposeInMainWorld('api', api)
