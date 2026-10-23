# Invokyr Save Editor

Editor web de saves do **Invokyr** (Ludogram, Steam AppID `3883570`). Roda 100% no navegador: o `.sav` é lido, editado e gravado localmente e **nunca é enviado a servidor algum** (a página é estática e o CSP bloqueia qualquer requisição de rede).

> Projeto de fã, **não afiliado à Ludogram**. Edite saves por sua conta e risco e **faça backup antes**. Feche o jogo ao editar: ele regrava o save ao sair, e o Steam Cloud pode sobrescrever o arquivo.

## O que edita

| Tela | Campos |
| :-- | :-- |
| Sessão & Heróis | dono (SteamID64) de cada um dos 8 heróis, cor da roupa, `playerCount` e inventários alinhados |
| Status & Upgrades | níveis de Saúde (8), Estamina (7), Agilidade (5), Pochete (2) e Pulo duplo por herói |
| Inventários & Itens | itens e carga da bateria por jogador e na bancada do hub, com catálogo de 135 itens do jogo |
| Hub & Mobílias | skin do salão (6), portas com chave (2) e as 8 mobílias |
| Troféus & Coleção | as 17 figuras do bestiário, dificuldade dos tabuleiros, ranque Endless |
| Trainer Presets | saldo do cofre, modo supremo, resetar run, abrir passagens |

Toda edição passa por **desfazer/refazer** (Ctrl+Z / Ctrl+Y), e o salvar mostra um **diff** do que mudou. O app abre qualquer `*.sav`, detecta o sistema operacional e mostra o caminho padrão da pasta de saves:

- Windows: `%USERPROFILE%\AppData\LocalLow\Ludogram\Invokyr\saves\`
- Linux/Steam Deck (Proton): `~/.local/share/Steam/steamapps/compatdata/3883570/pfx/drive_c/users/steamuser/AppData/LocalLow/Ludogram/Invokyr/saves/`

No Chromium (Chrome, Edge, Brave) o app grava no próprio arquivo, com backup `.bak_<data>` ao lado. Em Firefox e Safari o save editado é baixado e você o copia para a pasta do jogo.

## Fonte da verdade: o jogo

O formato do save e os catálogos vêm da análise do jogo instalado (build Steam **26154962**), não de documentação de terceiros. Veja [`docs/SCHEMA_VERIFIED.md`](docs/SCHEMA_VERIFIED.md) e [`docs/SCHEMA_ITEMS.md`](docs/SCHEMA_ITEMS.md), com o status de cada afirmação (verificado no binário, no save real, hipótese). Itens ainda em hipótese estão listados ali, e o app valida invariantes antes de salvar.

O codec preserva o formato binário original de cada número (o serializer do jogo, GameDevWare, usa larguras de inteiro fixas e `float32`), então o que você não toca sai idêntico.

## Desenvolvimento

```bash
npm ci
npm run dev        # servidor local
npm test           # testes unitários (Vitest)
npm run e2e        # testes ponta a ponta (Playwright; usa o Chromium do sistema, ou PLAYWRIGHT_CHROMIUM_PATH)
npm run lint       # Biome
npm run typecheck  # TypeScript
npm run build      # build estático em dist/
node scripts/gen-catalog.mjs   # regera o catálogo de itens a partir de docs/schema-items.json
```

Estrutura: `src/codec` (MessagePack e ZIP sem perdas), `src/schema` (enums, tipos e validação), `src/state` (documento, ações, undo/redo), `src/catalog`, `src/platform` (SO e arquivos), `src/ui`. O plano e as decisões estão em [`docs/PLAN.md`](docs/PLAN.md); o design das telas em [`docs/design/`](docs/design/). `docs/legacy/` guarda a documentação herdada, não verificada.

## Dependências e segurança

Sempre a versão mais recente de cada dependência e **zero vulnerabilidades conhecidas** (`npm audit` no CI; sem regras de ignore no Dependabot). Ações do GitHub fixadas por SHA. Relato de vulnerabilidades: veja [`SECURITY.md`](SECURITY.md). Os `.sav` estão no `.gitignore`, pois contêm SteamID64 de outros jogadores.
