# Arquitetura e decisões

Editor web estático e 100% client-side de saves do Invokyr. Este documento descreve o que **existe**; o formato do save e os catálogos estão em [`SCHEMA_VERIFIED.md`](SCHEMA_VERIFIED.md) e [`SCHEMA_ITEMS.md`](SCHEMA_ITEMS.md).

## Princípios

1. **A fonte da verdade é o jogo instalado.** Nome de campo, tipo, enum, UID e limite vêm do binário e dos assets (build Steam registrada em `docs/schema.json`), nunca de documentação de terceiros. As afirmações sobre o formato nos documentos de schema levam um status quando há incerteza: verificado no binário, no save real ou hipótese.
2. **O save nunca sai da máquina.** Página estática, sem backend, com CSP que bloqueia rede (`connect-src 'none'`, injetada no build).
3. **Round-trip sem perdas.** O conteúdo dos três streams (`meta`, `save`, `collection`) que a pessoa não toca sai idêntico, byte a byte, no formato que o jogo escreve. O contêiner ZIP em si é regravado (compressão e datas podem diferir).
4. **Nada de gravar um save inválido.** A validação roda antes de salvar e erros bloqueiam a gravação.

## Estrutura

| Pasta | Responsabilidade |
| :-- | :-- |
| `src/codec/msgpack.ts` | MessagePack sem perdas (decode com dicas de formato, encode que as reaplica) |
| `src/codec/zip.ts` | Contêiner ZIP `meta`/`save`/`collection`, com limites e CRC |
| `src/schema/` | Enums verificados (`enums.ts`, `skins.ts`), tipos do save (`types.ts`), tipo C# por campo (`cstypes.ts`) e invariantes (`validate.ts`) |
| `src/state/` | `document.ts` (abrir, serializar, diff), `actions.ts` (edições puras), `store.ts` (Zustand + Immer, desfazer/refazer) |
| `src/catalog/` | Catálogo de itens: `items.generated.ts` (gerado) e `catalog.ts` (busca, rótulos) |
| `src/platform/` | `os.ts` (detecção de SO e caminho padrão), `files.ts` (File System Access e fallback) |
| `src/ui/` | App, tela de boas-vindas, diálogos, as 6 telas (`screens/`) e o catálogo (um diálogo aberto a partir do inventário; é a tela 7 do design) |
| `scripts/` | `gen-catalog.mjs` (gera o catálogo), `check-game-build.mjs` (compara o build do jogo) |
| `tests/`, `e2e/` | Vitest (unitário, propriedade, cruzado com Python) e Playwright (fluxos e acessibilidade) |
| `reference/save_codec.py` | Codec Python de referência, oráculo do teste cruzado (não é para editar saves reais) |
| `docs/design/` | Design das telas (`invokyr.pen` e capturas); veja o `README.md` da pasta |

## Codec

- **Formato numérico preservado por campo.** O decoder anota o formato binário de cada número, por caminho com curingas (`save.upgrades.redUpgrades[*].x`). Se o caminho tem um formato único, guarda-o; se tem vários, guarda a sequência em ordem de visita, para que um `0` gravado como `uint64` não contamine um `fixint` vizinho.
- **Valores novos ou editados** seguem a largura do serializer do jogo para o tipo C# (`src/schema/cstypes.ts`): `int` → int16/int32/int64, `uint` → uint16, `ulong` → uint64, `float` → float32. Um valor que não cabe mais no formato original alarga dentro da mesma família. Valor fora da faixa do tipo, `NaN` e fração em campo inteiro são erro.
- **Valores JS:** inteiros viram `number` até 2^53−1 e `bigint` acima (SteamID64, ticks); mapas viram objetos de protótipo nulo, que neutraliza `__proto__`.
- **Limites** (entrada hostil): profundidade 64, 5 milhões de itens, 64 MB por payload, chave de mapa de até 256 bytes, caminho de até 2048 caracteres. Chaves numéricas ou duplicadas são rejeitadas.
- **ZIP:** o diretório central é lido por código próprio para conferir **CRC32 e tamanho** de cada entrada (o `fflate` não confere); rejeita nomes duplicados, criptografia, ZIP64 e entradas acima de 64 MB (128 MB no total). Streams extras e a ordem original são preservados; a data das entradas é fixa, para o ZIP ser determinístico.
- **Cabeçalhos** de string, array, mapa e bin são sempre emitidos no tamanho mínimo, como o serializer do jogo faz. O decode→encode do save real reproduz os três streams byte a byte.

## Estado e edição

- O estado é um documento imutável (Immer). Cada edição gera patches, que alimentam **desfazer/refazer**; edições contínuas da mesma chave (slider, ranque) dentro de 1 s viram um único passo.
- O **diff** do salvamento compara os valores abertos com os atuais, folha a folha.
- `markSaved` recebe o **snapshot que foi gravado** (valores e bytes). Assim, desfazer durante a gravação não marca o estado errado, e o backup do salvamento seguinte é o conteúdo realmente gravado.
- As ações (`src/state/actions.ts`) recusam entrada inválida (NaN, fração, fora de faixa, SteamID fora da faixa pública da Steam ou duplicado, item não oferecido pelo catálogo) e mantêm as invariantes: `playerCount` ↔ `playerInventories`, `itemStringIds` ↔ `itemBatteryLevels`, níveis de upgrade dentro do máximo. Itens novos respeitam 3 slots mais até 2 níveis da Pochete quando o vínculo com o herói é certo; em partidas com vários jogadores, sem vínculo comprovado, novas adições ficam limitadas a 3 e os itens existentes são preservados. A validação bloqueia capacidade excedida apenas quando a associação é certa ou o inventário excede o teto universal de 5.

## Arquivos e pasta padrão

O navegador não abre um caminho absoluto: `showDirectoryPicker` só aceita pastas conhecidas ou um handle salvo. Por isso o app **detecta o SO** (Windows, Linux/Proton, Steam Deck, macOS), mostra o **caminho padrão com botão de copiar** e o passo a passo (colar o caminho no seletor de arquivos, mostrar arquivos ocultos), e oferece:

- **Chromium:** `showOpenFilePicker` e `showDirectoryPicker`. Abrindo pela pasta, o backup `.bak_<data>` é gravado ao lado; abrindo só o arquivo, o backup é baixado. A escrita usa `createWritable` e `abort` em falha, então o original não é corrompido por uma gravação interrompida. Antes de gravar, o app compara data e tamanho com os da abertura e, se o arquivo mudou no disco (Steam Cloud, jogo), faz backup **desse** conteúdo e avisa.
- **Firefox e Safari:** `<input type=file>` e arrastar-e-soltar; o save editado é baixado, e o backup do original é um botão separado.

Arquivos acima de 128 MB são recusados antes de serem lidos.

## Nomes na interface

A interface se chama **Invokyr Archive Studio** (o repositório é `invokyr-save-editor`); "Tomo" é o save aberto. Os nomes pt-BR de itens, upgrades, mobílias e monstros são os textos do próprio jogo sempre que existem; os de skins e os rótulos de `None`, `Demo` e `Mimic` são do editor.

## Segurança e dependências

- CSP estrita no build: `default-src 'self'`, sem `unsafe-inline` em estilos, `connect-src 'none'`. Fontes (Cinzel, Inter) são auto-hospedadas.
- **Dependências:** sempre a versão mais recente, versões exatas, **zero vulnerabilidades** (`npm audit --audit-level=low` no CI e no deploy), sem regras de `ignore` no Dependabot. Dependência sem versão compatível ou vulnerável é **substituída**, não congelada. Exemplos: o `typescript-eslint` não suporta TypeScript 7, então o lint usa o **Biome**; o `markdownlint-cli2` traz uma cadeia com vulnerabilidade (`katex`) sem correção, então a documentação usa o **rumdl**. Dependências sem uso são removidas.
- **CI** (`.github/workflows/ci.yml`): `verify` (audit, árvore de dependências, lint, typecheck, testes, build, lint da documentação), `e2e` (Playwright) e `dependency-review` nos PRs. Ações do GitHub fixadas por SHA; permissões mínimas. A `main` exige os checks `verify` e `e2e`, histórico linear e sem force-push.
- **Deploy** (`pages.yml`): GitHub Pages a partir da `main`, em <https://dan.seg.br/invokyr-save-editor/> (o `base` do Vite é `/invokyr-save-editor/` no CI).
- Política de vulnerabilidades em [`SECURITY.md`](../SECURITY.md).

## Qualidade

`npm test` (unitários, propriedade com fast-check e o teste cruzado TS → Python), `npm run e2e` (fluxos de cada tela, teclado sem File System Access, 320 px, axe-core para WCAG 2.2 A/AA), `npm run lint`, `npm run typecheck`, `npm run docs:lint`. `tests/docs.test.ts` mantém a documentação honesta: links, caminhos e comandos citados precisam existir, e os números afirmados (itens, figuras, skins, build, nomes de monstros) precisam bater com o código e com os dados do jogo. O fluxo de contribuição está em [`CONTRIBUTING.md`](../CONTRIBUTING.md). O teste do **save real** é opcional e nunca versionado: `INVOKYR_REAL_SAVE=/caminho/Natural.sav npm test`.

## Depois de uma atualização do jogo

1. `npm run check:game` compara o `buildid` instalado com o de `docs/schema.json`. Saída 1 significa que o jogo foi atualizado; saída 2, que o manifesto da Steam não foi encontrado (defina `INVOKYR_APPMANIFEST`).
2. Reverifique no jogo (binário e assets): constante de versão do schema (`Save.TryCaptureSaveData`), classes e campos de `SaveMetadata`/`SaveData`/`CollectionSaveData`, enums (`EPlayerCharacter`, `EGameRoomFurniture`, `KeyName`, `BiomeChoice`, `EBoardFeaturedMonster`, `MonsterCollectionId`), UIDs e níveis máximos de `CharacterUpgrade_*`, o catálogo de itens e as skins.
3. Atualize `docs/schema.json`, `docs/schema-items.json` e os dois documentos de schema; regenere o catálogo com `node scripts/gen-catalog.mjs`; ajuste `src/schema/*` se algo mudou; e atualize os números afirmados nos documentos (o `tests/docs.test.ts` fixa 135 itens, 133 oficiais, 17 figuras, 6 skins e o build).
4. Rode os testes, incluindo o do save real, e teste no jogo com uma cópia do save.

O app **avisa** (banner ao abrir e aviso na revisão de salvar) quando a `version` não é 15, mas não recusa: o jogo não parece recusar versões diferentes (hipótese). Ao subir a versão suportada, atualize `SUPPORTED_SCHEMA_VERSION` em `src/schema/validate.ts`.

## Decisões

| Decisão | Motivo |
| :-- | :-- |
| Só web estática (sem PWA nem desktop) | O app é uma ferramenta de uso pontual; evita instalação e distribuição de binários |
| React + Zustand + Immer | Os patches do Immer dão desfazer/refazer e o diff do salvamento sem código extra |
| Codec próprio de MessagePack | As bibliotecas não preservam a largura de cada inteiro nem a sequência de formatos de um array; o jogo grava larguras fixas |
| `fflate` para ZIP, com leitura própria do diretório central | Precisa de CRC, tamanhos e nomes confiáveis para entrada hostil |
| Biome (lint e formato) e rumdl (Markdown) | Alternativas sem as dependências sem correção descritas acima |
| Interface em pt-BR; templates de issue em inglês | Interface para o público do autor; templates no padrão dos demais repositórios do autor |
| Licença MIT | Escolhida pelo autor; Invokyr e seus textos pertencem à Ludogram |

## Limitações e backlog

- **Hipóteses abertas** do schema: veja [`SCHEMA_VERIFIED.md`](SCHEMA_VERIFIED.md) §8. A mais relevante para o app é a **ordem de `playerInventories` em relação aos heróis**: o app assume a ordem do herói entre os ocupados (o save real só confirma a contagem). Teste no jogo ao atribuir ou liberar heróis.
- **Não verificado no jogo:** que um save regravado pelo editor carregue. Os testes cobrem o lado do editor, inclusive o save real byte a byte, mas a verificação no jogo é manual.
- **Não testado:** se o Chromium permite `showDirectoryPicker` na pasta `saves` (`AppData`, `~/.local/share`), e o comportamento do Steam Cloud ao gravar.
- **Design:** faltam ícones nas abas e nos botões, e o catálogo abre como diálogo em vez de tela cheia como no design.
- **Mobília `DOORBELL`:** é a única das 8 sem item na loja; o editor permite ativá-la, e que isso seja seguro no jogo não está confirmado.
- Regras da casa (`completedHouseRuleIds`): o app só preserva ou limpa a lista, porque o formato do id não está comprovado.
