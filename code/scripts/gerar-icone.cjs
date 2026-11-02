// Gera build/icon.png (1024x1024) a partir de build/icon.svg, usando o próprio Electron para renderizar.
// Uso: npm run icon
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const raiz = join(__dirname, '..')

app.disableHardwareAcceleration()
app.whenReady().then(async () => {
  const svg = readFileSync(join(raiz, 'build', 'icon.svg'), 'utf8')
  const win = new BrowserWindow({ show: false, width: 1024, height: 1024, useContentSize: true, transparent: true, frame: false, webPreferences: { offscreen: true } })
  const html = `<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 400))
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 })
  writeFileSync(join(raiz, 'build', 'icon.png'), img.toPNG())
  console.log('icon.png', img.getSize())
  app.quit()
})
