# Invokyr Save Editor

Editor web de saves do **Invokyr** (Ludogram, Steam AppID `3883570`). Na interface ele se chama **Invokyr Archive Studio**. Roda no navegador: o `.sav` é lido, editado e gravado localmente e **não é enviado a nenhum servidor** (a página é estática, e o build publicado tem uma política de segurança, o CSP, que bloqueia requisições de rede).

**Use agora:** <https://dan.seg.br/invokyr-save-editor/>

> Projeto de fã, **não afiliado à Ludogram**. Edite saves por sua conta e risco e **faça backup antes**. Feche o jogo ao editar: ele pode regravar o save ao sair, e o Steam Cloud pode sobrescrever o arquivo com a versão da nuvem (precauções; não foram testadas aqui). O app foi validado contra o formato do save, mas **ainda não foi verificado que o jogo carrega um save regravado por ele**: teste primeiro em uma cópia.

## Como usar

1. Feche o jogo e **copie o seu `.sav`** para um lugar seguro.
2. Abra o editor. A tela inicial detecta o seu sistema e mostra a pasta onde ficam os saves, com botão de copiar o caminho.
3. Abra o arquivo (**Abrir arquivo .sav**, **Abrir pasta de saves** ou arrastando o arquivo). Edite nas abas; as mudanças ficam marcadas (•) até você salvar.
4. **Salvar (.sav)** mostra a revisão de tudo que mudou, com avisos e erros de validação (erros bloqueiam o salvamento). Confirme.
5. Abra o jogo e confira.

As pastas padrão:

- Windows: `%USERPROFILE%\AppData\LocalLow\Ludogram\Invokyr\saves\`
- Linux e Steam Deck (Proton): `~/.local/share/Steam/steamapps/compatdata/3883570/pfx/drive_c/users/steamuser/AppData/LocalLow/Ludogram/Invokyr/saves/`

No Chrome e no Edge o app grava no próprio arquivo. Abrindo pelo botão **Abrir pasta de saves**, o backup `Nome.sav.bak_AAAAMMDD_HHMMSS` é gravado ao lado; abrindo só o arquivo, o backup é baixado. No Firefox e no Safari o save editado é baixado (o backup do original é um botão separado) e você o copia para a pasta do jogo.

## O que edita

| Tela | Campos |
| :-- | :-- |
| Sessão & Heróis | dono (SteamID64) de cada um dos 8 heróis, cor da roupa, número de jogadores (`playerCount`) e os inventários correspondentes |
| Status & Upgrades | níveis de Saúde (8), Estamina (7), Agilidade (5), Pochete (2, espaço extra no inventário) e Pulo duplo, por herói |
| Inventários & Itens | itens e carga da bateria por personagem e na bancada; 64 dos 135 itens catalogados podem ser adicionados (dados especiais, gadgets, tesouros e chaves). Os 133 oficiais e 2 internos continuam reconhecidos para leitura; dados numéricos, outros itens e itens internos não são oferecidos para novas adições |
| Hub & Mobílias | skin do salão (6), portas com chave (2) e as 8 mobílias |
| Troféus & Coleção | as 17 figuras do bestiário, dificuldade dos tabuleiros concluídos, ranque Endless (`bestEndlessRank`) |
| Trainer Presets | saldo do cofre, modo supremo, resetar run, abrir passagens |

**Atalhos:** `Ctrl+Z` desfaz e `Ctrl+Y` (ou `Ctrl+Shift+Z`) refaz, fora dos campos de texto; `Ctrl+S` abre a revisão para salvar. O histórico de desfazer é apagado depois de salvar.

**Glossário.** *Hub* (ou salão): a sala de espera entre partidas (`GameRoom`). *Bancada*: itens deixados no hub para qualquer herói pegar (`gameRoomTools`). *Herói*: um dos 8 personagens; *jogador*: quem o controla (um SteamID64). *Figura*: a estatueta de um monstro na sala de troféus (`monsterFigurines`). *Tomo* (na interface): o save aberto.

## Se algo der errado

Cada salvamento direto cria uma cópia `Nome.sav.bak_AAAAMMDD_HHMMSS` com o conteúdo **de antes**. O backup mais antigo guarda o seu original, então guarde-o: os seguintes guardam o resultado dos salvamentos anteriores.

Para restaurar: feche o jogo, renomeie (ou apague) o save editado, copie o backup para o mesmo lugar e **remova o sufixo `.bak_…` do nome**, deixando o nome original do save (por exemplo `Natural.sav`). Se o jogo não carregar o save editado, restaure o backup e abra uma issue (área "Save corrupted or rejected by the game"), **sem anexar o seu `.sav`**: ele contém SteamIDs de outros jogadores.

## Fonte da verdade: o jogo

O formato do save e os catálogos vêm da análise do jogo instalado (build Steam **26154962**), não de documentação de terceiros. Veja [`docs/SCHEMA_VERIFIED.md`](docs/SCHEMA_VERIFIED.md) e [`docs/SCHEMA_ITEMS.md`](docs/SCHEMA_ITEMS.md): as afirmações sobre o formato levam uma tag (verificado no binário, no save real ou hipótese) quando há incerteza. O que ainda é hipótese está listado ali, e o app valida invariantes antes de salvar. Se o jogo for atualizado, `npm run check:game` avisa e [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) descreve como reverificar.

O codec grava cada número no mesmo formato binário em que o encontrou, e valores novos no formato do serializer do jogo (a biblioteca GameDevWare, com inteiros de largura fixa e `float32`), então o conteúdo que você não toca sai idêntico.

Cada personagem tem 3 espaços para itens, mais até 2 adquiridos com a **Pochete**. O editor impede novas adições acima da capacidade. A associação entre heróis e inventários de partidas com vários jogadores ainda não foi comprovada no jogo; nesses saves, novas adições usam o limite conservador de 3, sem apagar nem bloquear os itens já existentes. As descrições dos itens vêm do jogo quando disponíveis; os demais textos são editoriais e identificados em [`docs/item-descriptions.json`](docs/item-descriptions.json).

O botão **Definir 99.999** é um preset do cofre; não há prova de que 99.999 seja o máximo do jogo. A entrada aceita inteiros de 0 a 2.147.483.647, faixa do campo gravado no save. O Relógio Antigo pode ser desbloqueado no editor, mas o estado ativo/quebrado não é inferido enquanto o formato desse estado não for confirmado no jogo.

## Desenvolvimento

Requer Node 22 ou mais recente. Mais detalhes em [`CONTRIBUTING.md`](CONTRIBUTING.md).

```bash
npm ci
npm run dev          # servidor local
npm test             # testes unitários, de propriedade e cruzado com Python (Vitest)
npm run e2e          # ponta a ponta e acessibilidade (Playwright)
npm run lint         # Biome
npm run typecheck    # TypeScript
npm run docs:lint    # Markdown (rumdl)
npm run build        # build estático em dist/
npm run check:game   # compara o build do jogo instalado com o do schema verificado
node scripts/gen-catalog.mjs   # regera o catálogo de itens a partir de docs/schema-items.json
```

A arquitetura, as decisões e os limites conhecidos estão em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md); o design das telas em [`docs/design/`](docs/design/). O teste contra um save real é opcional e nunca versionado: `INVOKYR_REAL_SAVE=/caminho/Natural.sav npm test`.

## Licença e créditos

Código sob a [licença MIT](LICENSE). **Invokyr** e os nomes, textos e itens do jogo pertencem à Ludogram; este projeto de fã não é afiliado nem endossado por ela e não distribui arquivos do jogo. Os dados do catálogo são fatos extraídos do jogo instalado para permitir a edição do save.

## Relatando problemas

Use os formulários de [bug](https://github.com/dandgabr/invokyr-save-editor/issues/new?template=bug_report.yml) e de [funcionalidade](https://github.com/dandgabr/invokyr-save-editor/issues/new?template=feature_request.yml). **Não anexe o seu `.sav` real** (contém SteamIDs de outros jogadores). Vulnerabilidades: veja [`SECURITY.md`](SECURITY.md).

## Dependências e segurança

A política do projeto é manter todas as dependências na versão mais recente e sem vulnerabilidades conhecidas (`npm audit` roda no CI), sem regras de ignorar avisos no Dependabot. Ações do GitHub fixadas por SHA. Os `.sav` estão no `.gitignore`, pois contêm SteamID64 de outros jogadores.
