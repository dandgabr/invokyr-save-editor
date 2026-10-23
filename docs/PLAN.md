# Plano — Invokyr Save Editor (web estática)

## Contexto

A sessão do Antigravity `b4353edc…` fez a engenharia reversa do save do Invokyr (AppID 3883570, Unity 6/IL2CPP), gerou a documentação em `/home/daniel/Code/Temp` (`INVOKYR_SAVE_SPECIFICATION.md`, `PLAYER_STATUS_AND_INVENTORY_GUIDE.md`, `LOBBY_SECRETS_TROPHIES_AND_DOORS_GUIDE.md`, `CUSTOM_SAVE_TEMPLATE.json`, `save_codec.py`) e homologou 7 telas no Pencil (`~/.pencil/documents/ac181022-…/invokyr.pen`, tema "Archive Studio / biblioteca anos 20"). O próximo passo previsto por lá era um app em Python. A decisão agora é outra: **uma aplicação web estática, 100% client-side**, em que a pessoa abre o próprio `.sav`, edita e baixa/grava de volta. O save nunca sai da máquina dela.

Decisões já tomadas: só web estática (sem PWA nem desktop), repositório **público** `dandgabr/invokyr-save-editor` clonado em `/home/daniel/Code/invokyr-save-editor`, e MVP com **as 7 telas**.

## Fonte da verdade: o jogo

A documentação herdada do Antigravity é ponto de partida, não autoridade. **A fonte da verdade é o jogo instalado em `/home/daniel/.local/share/Steam/steamapps/common/Invokyr`.** Diante de qualquer dúvida (nome de campo, tipo, enum, UID, limite) a resposta vem do binário, analisado com o **MCP `rea`** (skill `reverse-engineer-anything`): o `GameAssembly.dll` e o `global-metadata.dat` do IL2CPP, mais `resources.assets` para catálogos de itens e upgrades. A documentação é corrigida a partir do que o binário mostrar, nunca o contrário.

**O jogo acabou de ser atualizado.** Antes de qualquer código de codec, é preciso confirmar se as estruturas do save continuam iguais: `version` (era 15), classes `SaveMetadata`/`SaveData`/`CollectionSaveData` e seus campos e tipos, enums (`EPlayerCharacter`, `EGameRoomFurniture`) e a contagem de portas e monstros. Essa checagem é a primeira tarefa da Fase 1 e bloqueia as fases seguintes. Cada afirmação em `docs/SCHEMA_VERIFIED.md` registra a build do jogo (Steam buildid em `appmanifest_3883570.acf`) e a evidência do `rea` que a sustenta.

## Fatos verificados nesta sessão (e divergências da documentação)

- O save real em `~/.local/share/Steam/steamapps/compatdata/3883570/pfx/drive_c/users/steamuser/AppData/LocalLow/Ludogram/Invokyr/saves/` se chama **`Natural.sav`** (mais `steam_autocloud.vdf`), e não `save <N>.sav` como diz a spec. O nome do slot é livre, então o editor aceita qualquer `*.sav`.
- O `.pen` tem 7 frames de 1180×780: `S8CnS` Sessão & Heróis, `C0wuh` Status & Upgrades, `FTMkj` Inventários, `KWcCH` Hub & Mobílias, `BOPqO` Troféus, `I1n59` Trainer Presets, `YCAZW` Catálogo de Itens. Os tokens estão no `walkthrough.md` da sessão.
- O MCP do Pencil falhou ao conectar (ENOENT no AppImage). O `.pen` é JSON e dá para ler direto; para usar o MCP é preciso reabrir o Pencil.
- O `gh` está autenticado como `dandgabr`.
- **Não verificado** na documentação (tratar como hipótese até testar no jogo): o total de 31 monstros e o `0x7FFFFFFF`; as portas válidas 0–4; os valores de `gameRoomSkinIndex`; a semântica de cada bit do bitmask; as UIDs de upgrade (`upgrades.*Upgrades` estão vazios no template, então ainda não sabemos que inteiro representa "Health nível 3").

## Restrição central: "sugerir a pasta padrão" no navegador

O navegador não consegue abrir um caminho absoluto. `showDirectoryPicker({startIn})` só aceita pastas conhecidas (`documents`, `downloads`, `desktop`…) ou um handle salvo antes, e o Chromium bloqueia algumas pastas de sistema (verificar no spike se `AppData` e `~/.local/share` estão nessa lista). Isso vira três coisas no app:

1. **Detecção de SO** (`navigator.userAgentData.platform`, com fallback para `navigator.userAgent`): Windows, Linux (Proton), Steam Deck (SteamOS) ou macOS (sem suporte nativo do jogo: mostrar aviso).
2. **Tela de boas-vindas** com o caminho padrão daquele SO, botão "copiar caminho" e um passo a passo: colar o caminho na barra do diálogo de arquivo (funciona no Windows e no GTK com Ctrl+L) e mostrar arquivos ocultos.
   - Windows: `%USERPROFILE%\AppData\LocalLow\Ludogram\Invokyr\saves\`
   - Linux/Deck: `~/.local/share/Steam/steamapps/compatdata/3883570/pfx/drive_c/users/steamuser/AppData/LocalLow/Ludogram/Invokyr/saves/` (com nota sobre bibliotecas Steam em outro disco e Flatpak `~/.var/app/com.valvesoftware.Steam/…`)
3. **Abertura em camadas** (progressive enhancement):
   - Chromium: `showOpenFilePicker`/`showDirectoryPicker`; o handle fica guardado no IndexedDB para "reabrir a última pasta" e para gravar de volta no mesmo arquivo com `createWritable()`, depois de baixar um backup.
   - Firefox/Safari: `<input type=file>` e drag-and-drop, salvando por download (`Natural.sav`) com instrução de onde colocar o arquivo.

**Aviso de Steam Cloud** antes de salvar: fechar o jogo e saber que a nuvem pode sobrescrever o arquivo. O conteúdo exato do aviso sai do spike.

## Arquitetura

```
invokyr-save-editor/
  docs/              ← spec + guias migrados de Code/Temp, corrigidos (Natural.sav etc.)
  docs/design/       ← cópia de invokyr.pen + screenshots das 7 telas
  reference/         ← save_codec.py (oráculo Python para testes cruzados)
  src/codec/         ← núcleo puro TS, sem dependência de UI
     zip.ts          ← fflate: ler/escrever meta/save/collection (DEFLATE)
     msgpack.ts      ← decode preservando tipos; encode com float32 + int64
     schema.ts       ← tipos TS de SaveMetadata/SaveData/CollectionSaveData + validação
     invariants.ts   ← regras da spec §5 (playerCount ↔ inventories, ids ↔ batteries, 8 owners, version 15)
  src/catalog/       ← heróis, itens, mobílias, biomas/monstros, upgrades (dados + nomes pt-BR)
  src/platform/      ← detecção de SO, caminhos, File System Access + fallbacks
  src/ui/            ← telas 1–7, tokens do .pen como CSS variables
  tests/fixtures/    ← saves de exemplo (template JSON → .sav; Natural.sav só local, gitignored)
```

**Regra de ouro do codec: round-trip sem perdas.** O editor só altera os campos que a pessoa tocou.
- Decode com `@msgpack/msgpack` usando `useBigInt64: true` (os SteamID64 e `savedAtUtcTicks` passam de 2^53).
- Floats: o jogo exige `Single`. A spec pede `use_single_float` global, mas um encoder global pode quebrar campos que no original eram float64, se existirem. A solução é um extension/encoder customizado que **guarda o tipo original de cada número** (fixint, int64, uint64, float32) e reemite no mesmo formato. Campos novos seguem o schema.
- Preservar chaves desconhecidas e a ordem das chaves (contractless serializa por nome, então ordem e chaves extras não podem sumir).
- Teste de ouro: `decode → encode` produz **bytes idênticos** por stream (antes da recompressão) para `Natural.sav` e para os fixtures.

## Escolha de stack (prós e contras, para você decidir)

O codec, as libs (`@msgpack/msgpack`, `fflate`), o Vite, o Vitest e o Playwright são iguais nas três opções; só muda a camada de UI.

| | React + TS | Vue 3 + TS | Svelte 5 + TS |
|---|---|---|---|
| **Prós** | Maior ecossistema (Radix/headless para dropdown, slider e modal acessíveis); mais exemplos e agentes treinados; fácil achar ajuda | SFC legível; reatividade fina boa para formulários grandes; Pinia é simples para um documento editável único | Menos código e bundle menor; runes deixam o estado do save quase "objeto puro"; ótimo para app estático |
| **Contras** | Mais boilerplate para estado profundo (precisa de Immer/Zustand); re-renders exigem cuidado | Ecossistema de componentes headless menor que o do React | Ecossistema menor; Svelte 5 ainda tem menos material; menos componentes acessíveis prontos |
| **Encaixe aqui** | Seguro; o estado aninhado do save vai bem com Zustand + Immer (undo/redo grátis via patches) | Muito bom para formulários; undo/redo é manual | Muito bom para o tamanho do app; undo/redo é manual |

**Recomendação: React + TS + Zustand/Immer**, porque os patches do Immer dão undo/redo e um "diff do que mudou" de graça, e esse diff é ótimo para a tela de confirmação antes de salvar. Se você preferir outra, só a Fase 3 muda.
Antes de fixar versões: resolver com o skill `version-freshness` (npm) e registrar fonte e data.

## Fases

**Fase 0 — Repositório e base** (o que você pediu agora)
- `gh repo create dandgabr/invokyr-save-editor --public --clone` em `/home/daniel/Code`, na branch `main`.
- Migrar a documentação de `Code/Temp` para `docs/legacy/` como "herdada, não verificada contra a build atual". A versão corrigida sai da Fase 1.
- **Privacidade (repo público)**: a documentação, o template e o `.pen` contêm SteamID64 reais e apelidos de amigos. Trocar por placeholders antes do primeiro commit; as screenshots com esses dados não entram. Copiar `save_codec.py` para `reference/`. Copiar o `.pen` e as screenshots para `docs/design/`.
- README, LICENSE (perguntar qual; sugestão MIT), `.gitignore` com `*.sav` (save pessoal tem SteamIDs de amigos), aviso de "não afiliado à Ludogram" e "faça backup".
- Primeiro commit em conventional commits.

**Fase 1 — Spike de verdade contra o jogo atualizado (bloqueante)**
- **Drift pós-update**: registrar o buildid atual; com o `rea`, abrir o IL2CPP de `/home/daniel/.local/share/Steam/steamapps/common/Invokyr` e extrair as definições atuais das classes de save, dos resolvers/formatters do MessagePack, dos enums e da constante de versão do schema. Comparar com a spec herdada e listar o que mudou.
- Usar o `rea` também para tirar as hipóteses da lista: UIDs de upgrade (assets `Item/shopitem/*`), `GameRoomDoorCount`, total de monstros/figurines, skins da sala e catálogo completo de `itemStringIds`.
- Rodar `save_codec.py --inspect/--export-json` numa **cópia** de `Natural.sav` e registrar o schema real: chaves, tipos msgpack por campo e se existe algum float64.
- Experimentos no jogo, um campo por vez (sempre com backup): UIDs de upgrade (comprar 1 Health e diffar), portas válidas, bits de figurines, skins e o comportamento do Steam Cloud.
- Testar no Chromium se `showDirectoryPicker` aceita a pasta `saves` no Linux e no Windows.
- Saída: `docs/SCHEMA_VERIFIED.md` com o status de cada campo (verificado no binário / verificado no jogo / hipótese), a build e a evidência. `src/catalog` passa a ser gerado ou conferido a partir desse documento.
- Se o update mudou o schema: o codec tem que tratar `version` como guarda (recusar ou avisar ao abrir uma versão desconhecida) e a documentação migrada para `docs/` reflete a versão nova.

**Fase 2 — Codec TS + testes**
- `src/codec/*` com TDD (skill `superpowers-test-driven-development`).
- Testes: round-trip byte a byte; teste cruzado (o Python gera, o TS lê, e vice-versa); invariantes; casos de borda (int64 alto, battery -1.0, listas vazias, playerCount 8).
- Validação no jogo: carregar um save regravado pelo TS **sem edição** e depois um com uma edição simples (moedas).

**Fase 3 — Shell da UI e design system**
- Tokens do `.pen` como CSS variables (mogno `#100A08`, latão `#7A6028`/`#D4AF37`, verde banqueiro, cera carmesim, Cinzel + Inter).
- Header (nome do arquivo e versão, Abrir, Salvar), abas, tela de boas-vindas com detecção de SO, estado global com undo/redo.
- Fluxo de salvar: validação de invariantes → diff do que mudou → backup → escrita/download.

**Fase 4 — As 7 telas** (fiéis ao `.pen`; ler cada frame do JSON ou pelo MCP do Pencil quando ele voltar)
1. Sessão & Heróis: `meta.characterOwners`, `playerCount`, `playerColors`. Edição de SteamID64 com validação; não dá para resolver nomes Steam sem API, então o nome vira apelido local opcional.
2. Status & Upgrades: pips por herói (Health 8, Stamina 7, Speed 5, Fanny 2, Double Jump), mapeados para UIDs. **Depende da Fase 1.**
3. Inventários: `playerInventories` e `gameRoomTools`, slider de bateria (float32), itens passivos com -1.0.
4. Hub & Mobílias: `furnitures`, `unlockedKeyDoors`, `gameRoomSkinIndex`.
5. Troféus & Coleção: bitmask, `bestEndlessRank`, `completedBoardKeys`, `bestBoardDifficulties`.
6. Trainer Presets: unlock-all, reset, liberar salão (porte de `unlock_all_features`), sempre com o diff antes de aplicar.
7. Catálogo de Itens: busca e filtros sobre `src/catalog`, com destino Mochila do jogador N ou Bancada.

Campos ainda "hipótese" aparecem na UI com um selo "experimental".

**Fase 5 — Qualidade e publicação**
- Playwright (Chromium headless) com o fluxo abrir → editar → salvar → reabrir; checagem a11y (WCAG 2.2 AA); comparação visual com as screenshots do `.pen`.
- GitHub Actions: lint, typecheck, Vitest, Playwright, build e deploy no GitHub Pages.

## Pontos em aberto para conciliar no brainstorm

- **Nome do produto**: o design usa "INVOKYR ARCHIVE STUDIO" e o repo é `invokyr-save-editor`. Manter os dois (marca × repo)?
- **Idioma**: só pt-BR ou i18n (pt-BR + en) desde o início? O público do jogo é global.
- **Ética multiplayer**: o editor mexe nos SteamIDs de outros jogadores e em saves de partidas co-op. Vale avisar e não incentivar a edição de saves alheios.
- **Licença**: MIT?

## Política de dependências

- **Sempre a versão mais recente** de cada dependência (versões exatas, resolvidas no registro npm), e **zero vulnerabilidades conhecidas** (`npm audit --audit-level=low` no CI).
- O Dependabot não ganha regras de `ignore`. Se uma dependência não tem versão compatível com o resto, ela é **substituída por uma alternativa**, nunca congelada.
- Aplicado em 2026-10-23: o `typescript-eslint` não suporta TypeScript 7 (peer `<6.1.0`, nem no canary), então o ESLint foi trocado pelo **Biome** e o projeto usa TypeScript 7.0.2.
- GitHub Actions fixadas por SHA de commit.

## Verificação

- `npm test`: round-trip byte a byte, cruzado Python↔TS e invariantes.
- `npm run build && npx vite preview`, depois o Playwright abre um fixture, edita cada tela, salva e reabre; os valores persistem e os campos não tocados ficam idênticos.
- **Teste no jogo** (manual, com backup): um save regravado sem edição carrega; cada edição por tela tem efeito visível no jogo.
- Deploy do Pages acessível; DevTools → Network sem nenhum upload do save.
