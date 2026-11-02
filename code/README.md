# Family Financial

App desktop (Electron + React + TypeScript) de planejamento financeiro familiar: renda fixa e pontual, despesas
(pontuais, recorrentes, parceladas, planejadas), saldo projetado de 12 meses, plano de redução e contribuição aos
Fundos Bahá’ís pelo calendário Badí’. Dados locais em SQLite relacional (`node:sqlite`, sem módulo nativo): tabelas
tipadas, chaves estrangeiras, restrições `CHECK`/`UNIQUE` e migrações versionadas.

```
npm install
npm run dev        # abre o app em desenvolvimento
npm test           # domínio (projeção, plano, calendário Badí’, fundos) e banco
npm run typecheck
npm run build      # gera out/
npm run pack       # app em pasta (release/win-unpacked), para testar o empacotamento
npm run dist       # instalador do Windows: release/Family-Financial-Setup-<versão>.exe
npm run icon       # regenera build/icon.png a partir de build/icon.svg
```

- `src/shared/domain`: regras puras (centavos inteiros), com testes. A projeção reproduz os números do protótipo.
- `src/main`: janela, SQLite (esquema em `db.ts`, migrações por `PRAGMA user_version`, backup diário automático) e IPC.
- `src/preload`: API segura exposta ao renderer (`window.api`).
- `src/renderer`: telas React.
- Requisitos e diagramas: `../docs`. Protótipo no FigCraft: `../prototype`.

## Instalador (Windows)

`npm run dist` gera um instalador NSIS x64 (~116 MB, ~360 MB instalado), por usuário: não pede administrador, instala em
`%LOCALAPPDATA%\Programs\Family Financial`, cria atalho no menu Iniciar e entrada em “Aplicativos”. O assistente permite
escolher a pasta e está em português do Brasil. O app só abre uma instância por vez.

- **Dados:** `%APPDATA%\family-financial` (banco `family-financial.db` e `backups/`). O app instalado e o `npm run dev` usam a
  mesma pasta. **Desinstalar não apaga os dados.**
- **Atualizar:** rodar o instalador de uma versão maior por cima mantém os dados; o banco migra sozinho e faz um backup
  `pre-migracao-*` antes.
- **Versão:** altere `version` em `package.json` antes de gerar um novo instalador.
- **Sem assinatura digital:** o Windows SmartScreen mostra “Windows protegeu o computador” na primeira execução
  (Mais informações → Executar assim mesmo). Para remover o aviso é preciso um certificado de assinatura de código
  (`win.certificateFile` / `CSC_LINK` no electron-builder).
- **Sem atualização automática:** novas versões são instaladas manualmente.
- **Ícone:** `build/icon.svg` (fonte) → `build/icon.png`.
