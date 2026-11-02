import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { EntradaIA, Kind } from '../shared/api'
import { gerarPlanoIA } from './ia'
import { dadosExemplo } from '../shared/domain/exemplo'
import type { CartaoConfig, Dados, FundosConfig } from '../shared/domain/tipos'
import { abrirBanco, type Banco } from './db'

let banco: Banco
let janela: BrowserWindow | null = null

function criarJanela() {
  janela = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Family Financial',
    autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  const dev = process.env['ELECTRON_RENDERER_URL']
  if (dev) void janela.loadURL(dev)
  else void janela.loadFile(join(__dirname, '../renderer/index.html'))
}

function registrarIpc() {
  ipcMain.handle('db:carregar', () => banco.carregar())
  ipcMain.handle('db:salvar', (_e, kind: Kind, obj: object) => banco.salvar(kind, obj))
  ipcMain.handle('db:excluir', (_e, kind: Kind, id: number) => banco.excluir(kind, id))
  ipcMain.handle('db:salvarFundos', (_e, f: FundosConfig) => banco.gravarFundos(f))
  ipcMain.handle('db:salvarCartao', (_e, c: CartaoConfig | null) => banco.gravarCartao(c))
  ipcMain.handle('db:salvarJanela', (_e, ativa: boolean) => banco.gravarJanela(ativa))
  ipcMain.handle('ia:gerar', (_e, entrada: EntradaIA) => gerarPlanoIA(entrada))
  ipcMain.handle('db:exemplo', () => banco.substituir(dadosExemplo()))
  ipcMain.handle('db:limpar', () => {
    banco.substituir({ membros: [], categorias: [], rendas: [], despesas: [], reais: [], planos: [], fundos: dadosExemplo().fundos })
    banco.categoriasPadrao()
  })
  ipcMain.handle('db:backup', () => banco.backup())
  ipcMain.handle('db:exportar', async () => {
    const r = await dialog.showSaveDialog({ defaultPath: 'family-financial.json', filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (r.canceled || !r.filePath) return null
    writeFileSync(r.filePath, JSON.stringify(banco.carregar(), null, 2), 'utf8')
    return r.filePath
  })
  ipcMain.handle('db:importar', async () => {
    const r = await dialog.showOpenDialog({ properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] })
    if (r.canceled || !r.filePaths[0]) return false
    const d = JSON.parse(readFileSync(r.filePaths[0], 'utf8')) as Dados
    if (!Array.isArray(d.categorias) || !Array.isArray(d.despesas) || !Array.isArray(d.rendas)) throw new Error('Arquivo inválido: faltam categorias, rendas ou despesas.')
    banco.backup() // protege os dados atuais antes de substituir
    banco.substituir({ ...d, membros: d.membros ?? [], reais: d.reais ?? [], planos: d.planos ?? [] })
    return true
  })
}

// Uma só instância: duas janelas gravando no mesmo banco SQLite corromperiam a ordem das escritas.
if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => {
  if (janela?.isMinimized()) janela.restore()
  janela?.focus()
})

void app.whenReady().then(() => {
  if (!app.hasSingleInstanceLock()) return
  banco = abrirBanco(join(app.getPath('userData'), 'family-financial.db'), join(app.getPath('userData'), 'backups'))
  try {
    banco.backupAutomatico()
  } catch (e) {
    console.error('backup automático falhou', e)
  }
  registrarIpc()
  criarJanela()
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && criarJanela())
})

app.on('window-all-closed', () => {
  banco?.fechar()
  if (process.platform !== 'darwin') app.quit()
})
