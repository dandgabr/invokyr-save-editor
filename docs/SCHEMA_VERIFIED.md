# Schema do save do Invokyr: verificado contra o jogo instalado

Build Steam: **26154962** (`appmanifest_3883570.acf`). Unity 6000.3.14f1, IL2CPP, metadata v39.
`GameAssembly.dll` sha256 `48dc0f4d3f3e15f58159274af9536bdc7fbf750dbf70553a342822e712f90a0b`.
Dados estruturados: `docs/schema.json`. Itens, loja, skins, portas e house rules estão em [`SCHEMA_ITEMS.md`](SCHEMA_ITEMS.md) (que resolve várias pendências deste documento). O que não foi confirmado está marcado como hipótese e listado em §8.

**Termos.** *Spec herdada*: um documento anterior (de terceiros, removido do repositório) que descrevia o formato do save a partir de suposições; a tag **[mudou]** marca onde a análise do jogo o contradiz, e o jogo é que vale. Para quem vai contribuir: *ScriptableObject*, *MonoBehaviour*, *typetree* e *PathID* são termos do Unity (assets serializados), e *VA* é o endereço virtual do `GameAssembly.dll` com base `0x180000000`.

Legenda de status (as afirmações sobre o formato levam uma tag quando há incerteza): **[bin]** verificado no binário/metadata; **[save]** verificado no save real (`Natural.sav`, só leitura, sem valores pessoais); **[hip]** hipótese; **[mudou]** diverge da spec herdada.

## Método e limitações (importante)

- O MCP `rea` abriu o `GameAssembly.dll` (Ghidra 12.1.4), mas a análise automática de um binário de 75 MB estoura o timeout de 330 s em toda chamada (`binary_overview`, `procedure_pseudo_code`, `procedure_info`, `read_bytes`). Uma tentativa pelo CLI `rea decompile` com timeout estendido também não terminou a tempo. **Fallback usado (read-only):** parser próprio Python do `global-metadata.dat` v39 + tabelas de registro do PE (`MetadataRegistration`, `CodeGenModule`) para resolver tipos/campos/enums/constantes, `capstone` para desmontar funções do `GameAssembly.dll`, e UnityPy para ler ScriptableObjects das bundles Addressables. Os scripts de análise foram exploratórios (caminhos fixos, sem documentação) e **não estão versionados**; o que importa para o repo são os resultados (`schema.json`, `schema-items.json`) e este texto. Nada na pasta do jogo foi alterado; o save real só foi lido (cópia temporária).
- Evidência "[bin]" significa: nome/tipo de campo e valores de enum vêm do metadata + tabela de tipos do binário; constantes vêm de instruções x86-64 em endereços citados (VA com base 0x180000000).

## 1. Serializador e contêiner

| Item | Status | Detalhe |
|---|---|---|
| Biblioteca | **[bin] [mudou]** | **GameDevWare.Serialization** (biblioteca de serialização usada pelo jogo) (`MsgPackReader`, `MsgPackWriter`, `ObjectSerializer`, `EnumNumberSerializer`), serialização por reflexão do nome do campo. **Não** é MessagePack-CSharp; a spec herdada (`ContractlessStandardResolver`, `[Key]`) estava errada quanto à biblioteca. Não há tipos MessagePack-CSharp no metadata. |
| Chaves | **[save]** | Chave = nome do campo C# (inclusive privado `_color`). Mapas com chave string. |
| Contêiner | **[save]** | ZIP, método 8 (deflate), 3 entradas planas `meta`, `save`, `collection` (sem pasta). Nomes dos literais no binário: pendente. |
| Largura dos inteiros | **[save]** | O jogo grava inteiros com sinal em largura fixa assinada quando >127: `int16` (0xd1) para 2157/3575, `int32` (0xd2) para a seed, `int64` (0xd3) para ticks, fixint para pequenos, `uint16` (0xcd) para `uint` e `uint64` (0xcf)/fixint para `ulong`. O leitor aceita qualquer largura (hipótese); ao regravar, preservar a tag original do campo. **O editor faz isso:** o codec guarda o formato de cada número lido e, para valores novos ou que não cabem mais, segue a regra do tipo C# (`int` → int16/int32/int64, `uint` → uint16, `ulong` → uint64, `float` → float32; ver `src/schema/cstypes.ts`). Que o jogo aceite outras larguras continua sendo hipótese. |
| float32 vs float64 | **[save]** | Só `save.playTimeSeconds` e `itemBatteryLevels[]` são float32 (0xca) no save real. Nenhum float64. |
| "Expected Single, got Double" | **[hip] [mudou]** | Essa exceção é de MessagePack-CSharp; o leitor GameDevWare não foi decompilado aqui. Tratar float32 como obrigatório por segurança, mas sem evidência de que float64 quebre. |

## 2. Versão do schema

- `SaveData.version = 15` **[bin]**: `Save.TryCaptureSaveData` (0x183074680) grava `mov dword ptr [rbx+0x10], 0xf`.
- Guard de versão **[hip]**: nenhuma comparação com 15 em `Save.Load` (0x1830705d0), `TryReadEntries` (0x183075010), `TryReadMetadata` (0x183075580); a versão lida só é passada a uma chamada de formatação (log). Provavelmente o jogo não recusa versões diferentes; por isso o editor **avisa, sem recusar** (ao abrir e na revisão antes de salvar). **[save]** `version` = 15 no save real.
- Resumo do que mudou: nenhuma mudança na constante (15 continua).

## 3. Classes de save (namespace `_200_Dev.Utility`) [bin]

Ordem dos campos = ordem em `schema.json`. Tipos C# do metadata; tipos msgpack observados em [save].

**SaveMetadata** (`meta`): `savedAtUtcTicks long`, `roundIndex int`, `endlessRank int`, **`playTimeSeconds int`** [mudou: spec dizia Single; no save é int16], `score int`, `playerCount int`, `characterOwners ulong[]` (8).

**SaveData** (`save`): `version int`, `bank BankSaveState`, `shop ShopSaveState`, `upgrades UpgradesSaveState`, `furnitures FurnituresSaveState`, `playerInventories List<PlayerInventorySaveState>`, `playerColors List<PlayerClothColorSaveState>`, `gameRoomSkinIndex int`, `gameRoomTools PlayerInventorySaveState`, `playTimeSeconds float`, **`unlockedKeyDoors List<KeyName>`** [mudou: enum, não índice livre].

**CollectionSaveData** (`collection`): `bestEndlessRank int`, **`monsterFigurines uint`**, `completedBoardKeys List<string>`, `completedHouseRuleIds List<string>`, `bestBoardDifficulties List<CollectionBoardBestDifficulty{boardKey string, difficulty int}>`.

**BankSaveState**: `currentTotalScore int`.

**ShopSaveState** [mudou: a spec herdada só citava parte]: `visitCount int`, `completedBoardsAnchorIndexes List<int>`, `completedBoardsConfigurations List<SerializedBoardConfiguration{biome BiomeChoice, difficulty EBoardDifficulty, featuredMonster EBoardFeaturedMonster}>`, `boardOffersSeed int`, `boardOffersSolo bool`, `completedMonsterRounds Dictionary<EBoardFeaturedMonster,int>` (no save real aparece como **array de pares `[monstro, n]`**, não mapa), `shopItemsUIDs List<int>`, `shopItemInfos List<ShopItemInfo{boughtCount int}>`.

**UpgradesSaveState**: 8 listas `redUpgrades, specsUpgrades, tankUpgrades, ziggyUpgrades, carlUpgrades, bobbyUpgrades, susanUpgrades, lilyUpgrades`, cada uma `List<SerializedVector2Int{x int, y int}>` [mudou: não são "UIDs int"].

**FurnituresSaveState**: `furnitures List<EGameRoomFurniture>`. **PlayerInventorySaveState**: `itemStringIds List<string>`, `itemBatteryLevels List<float>`. **PlayerClothColorSaveState**: `playerCharacter EPlayerCharacter`, `_color ClothColor` (9 entradas no save real, incluindo `playerCharacter = -1`).

Invariantes da spec herdada ainda não revalidadas no binário: `len(playerInventories) == playerCount`, `len(itemStringIds) == len(itemBatteryLevels)`, 8 owners [hip, coerentes com o save real].

## 4. Enums [bin] (valores decodificados do metadata; compressão de inteiros do IL2CPP)

- `EPlayerCharacter`: None=-1, Red=0, Specs=1, Tank=2, Ziggy=3, Carl=4, Bobby=5, Susan=6, Lily=7. (Confere com a spec.)
- `EGameRoomFurniture`: NONE=0, RADIO=1, WARDROBE=2, MIRROR=3, DISCO=4, DOORBELL=5, DICEBOX_FIREWORK=6, DICEBOX_CUBE=7, OLD_CLOCK=8. (Confere; NONE=0 existe e não deve ser gravado.)
- `KeyName`: NONE=0, Henry=1, Corridor=2. **[mudou]** `unlockedKeyDoors` só admite 1 e 2 de forma significativa; a spec ("portas 0..4") não tem base. O save real tem `[2]` (Corridor). Contagem de portas: não existe `GameRoomDoorCount` como constante; só **2 portas** usam chave (Henry e Corredor), verificado em todas as bundles (ver [`SCHEMA_ITEMS.md`](SCHEMA_ITEMS.md) §5).
- `ClothColor`: PURPLE=0, DARKBLUE=1, BLUE=2, GREEN=3, YELLOW=4, RED=5, PINK=6, WHITE=7, GOLD=8.
- `BiomeChoice`: Vanilla_UnToggle=0, Frozen=1, Jungle=2, Desert=3, Abyss=4, Ash=5, Endless=6. **[mudou]** a spec dizia 1=Jungle, 2=Desert, 3=Frozen, 4=Manor; `completedBoardKeys` = `"{BiomeChoice}:{EBoardFeaturedMonster}"` (no save real `2:3` = Jungle:Croco, `1:13` = Frozen:Alpinist, coerente) **[save]**.
- `EBoardFeaturedMonster` (17): None=0, Hunter=1, Horseman=2, Croco=3, Yeti=4, Plant=5, Ultimate=6, Demo=7, Weeping=8, CursedPlayer=9, Penguin=10, Snowman=11, MoneyGuy=12, Alpinist=13, TVGhost=14, Pharaoh=15, SandWorm=16.
- `EBoardDifficulty`: Difficulty1..5 = **0..4** (base 0). A spec dizia 1 a 5. `bestBoardDifficulties.difficulty` é `int`; que seja o ordinal do enum é **[hip]** (save real tem 1 e 3).
- `MonsterCollectionId` (17), ordem dos bits: Alpinist=0, BeeSwarm=1, Crocodile=2, CursedPlayer=3, DoorMonster=4, Horseman=5, Hunter=6, Mimic=7, MoneyGuy=8, Penguin=9, Pharaoh=10, SandWorm=11, Snowman=12, Spider=13, WeepingAngel=14, Yeti=15, TVGhost=16.

### monsterFigurines [bin] [mudou]

Atenção: `MonsterCollectionId` (as 17 **figuras** do bestiário, usadas aqui) e `EBoardFeaturedMonster` (17 valores de **monstros de tabuleiro**, usados em `completedBoardKeys`) são enums diferentes, apesar de terem o mesmo tamanho. Os nomes em pt-BR de ambos são os textos do próprio jogo (termos `featured_monster_name`); `None`, `Demo` e `Mimic` não têm termo e usam rótulo próprio do editor.

`MonsterCollectionProgress.Unlock` faz `and edx,0x1ffff; or [rcx],edx` e `Record` só aceita id < 0x11 (17) com `bts`. Logo o bit k corresponde a `MonsterCollectionId == k`, **17 bits válidos, máscara total = 0x1FFFF = 131071** (não 31 bits / 0x7FFFFFFF). Save real: 16405 = bits {0,2,4,14} = Alpinist, Crocodile, DoorMonster, WeepingAngel (consistente com `completedBoardKeys` contendo Alpinist e Croco) **[save]**. A associação bit-id é [bin] pelas máscaras; a ordem dos nomes vem do enum lido no metadata.

## 5. Upgrades [bin]

- Elemento = `SerializedVector2Int`: **x = UID do `CharacterUpgrade`, y = nível**. Evidência: `CharacterUpgradesManager.SrvApplySavedUpgradeList` (0x182fcaad0) chama `TryGetCharacterUpgradeByUID(x)` e limita `y` ao `MaxLevel`.
- UIDs dos assets `CharacterUpgrade_*` (ScriptableObjects das bundles; typetree via UnityPy), com nível máximo: Health `uid 1` (`_healthBonuses` 20..160, **8 níveis**), Stamina `uid 2` (15..105, **7**), Speed `uid 3` (0.065..0.325, **5**), DoubleJump `uid 5` (**1**, `MaxLevel` retorna 1), InventorySlot/Fanny pack `uid 6` (`_maxBonusSlot` = **2**). `uid 4` não existe em nenhum asset (ver [`SCHEMA_ITEMS.md`](SCHEMA_ITEMS.md) §3). O bônus de vida é o total acumulado por nível (20, 40, …, 160 PV), e não "+25 por nível" como dizia a spec herdada **[mudou]**.
- Não é um hash: UIDs de upgrade são inteiros pequenos fixos no asset. **A afirmação da spec de que `shopItemsUIDs` usa hash de nome é incorreta**: `ShopItemData._uid` é um inteiro serializado no asset (valores aleatórios grandes), p. ex. Health `155320950`, Stamina `311584588`, Speed `-872071192`, MilkBottle `-1522034135`, Radio `920453269`, HidingCloset `1772907373`. O `-937123244` do save real é `Data-ShopFurnitureItem_OldClock` (`fur_clock`, mobília 8 OLD_CLOCK) **[bin] [save]**, coerente com `furnitures=[8]` e `boughtCount=1`; a tabela completa da loja está em [`SCHEMA_ITEMS.md`](SCHEMA_ITEMS.md) §3.
- Preços base: upgrades 200 (Health, Stamina, Speed), Radio 500, HidingCloset 750, MilkBottle 100 (`minQuantity` 2). O "desconto 30%" da spec não foi verificado.

## 6. Skins de sala, itens e baterias

- `gameRoomSkinIndex`: índice em `GameRoomSkinManager._gameRoomSkins` (lista de `GameRoomSkin`). Encontrados 6 assets: Default, Blue, Red, Vegetation, White_Yellow, Yellow_Stone (cada um com `_uid`, `_basePrice` 200, Default 0). A ordem da lista (índice → skin) foi extraída: 0 Default, 1 Blue, 2 Red, 3 Vegetation, 4 White_Yellow, 5 Yellow_Stone, faixa válida 0..5 ([`SCHEMA_ITEMS.md`](SCHEMA_ITEMS.md) §4). O save real tem 0.
- `itemStringIds`: o save grava o **`itemAlias`** do ScriptableObject do item (`dice_tp`, `dice_gather`, `ice`, `dice_boomheal`, `dice_cocoon`, `k_corridor` no save real), e não o nome do asset (`Data-Treasure-*`) da spec herdada **[bin] [save] [mudou]**. O catálogo completo (163 assets, 155 em `ItemManager.availableTools`) está em [`SCHEMA_ITEMS.md`](SCHEMA_ITEMS.md) §1 e `docs/schema-items.json`. `schema.json` traz também `item_alias_catalog_candidates_from_addressables_catalog` (288 nomes de asset `Data-*` do `catalog.bin`), que são só candidatos e **não** são os ids.
- Baterias: só 6 itens têm bateria (`g_xray`, `g_hgun`, `g_mobradar`, `g_fire`, `g_megaphone`, `g_mask`), e no save real todos os itens têm `-1.0` (float32). A semântica de `-1.0` como "sem bateria" e da faixa 0..1 é **[hip]** ([`SCHEMA_ITEMS.md`](SCHEMA_ITEMS.md) §1.4).

## 7. Diferenças em relação à spec herdada

1. Serializador é GameDevWare MsgPack, não MessagePack-CSharp (contractless/[Key] não se aplicam).
2. `meta.playTimeSeconds` é `int` (int16 no save), não Single.
3. `monsterFigurines` é `uint` com **17 bits** válidos (máscara 0x1FFFF), bit k = `MonsterCollectionId k`; a spec dizia 31 bits.
4. `unlockedKeyDoors` é `List<KeyName>` (NONE/Henry/Corridor); "0..4" não tem base.
5. `upgrades.*Upgrades` são listas de `{x=uid,y=nível}`, UIDs pequenos (1,2,3,5,6).
6. Biomas: ordem do enum difere da spec (Frozen=1, Jungle=2, Desert=3, ...; Manor não existe, há Abyss e Ash).
7. `EBoardDifficulty` é 0..4.
8. `ShopSaveState` tem 8 campos (a spec herdada citava poucos): `completedMonsterRounds` serializa como array de pares; `shopItemsUIDs` são `ShopItemData._uid` (não hash de nome).
9. O arquivo do slot não se chama `save <N>.sav`: no save real é `Natural.sav`. O nome é livre e o editor aceita qualquer `*.sav`.
10. Constante de versão continua 15; `version`, enums de herói e mobília conferem.
11. `itemStringIds` usa `itemAlias`, não `m_Name`; só 6 itens têm bateria; as chaves são `k_henry` e `k_corridor`.
12. Há 6 skins de sala (índice 0..5) e 2 portas com chave; os nomes `Manor`, `Data-Treasure-*` e os "31 monstros" da spec não existem.

## 8. Pendências (hipótese)

Consolidado, depois de [`SCHEMA_ITEMS.md`](SCHEMA_ITEMS.md) §7:

- Guard de versão real do jogo e se o leitor GameDevWare aceita larguras de inteiro e `float64` diferentes das que ele escreve.
- Nomes dos literais `meta`, `save` e `collection` no binário (confirmados só no save real).
- Sentinela `-1.0` de `itemBatteryLevels` (decompilar `SrvCaptureGameRoomTools`) e o ramo de `ItemManager.GetToolSaveId` para alias vazio.
- Formato do id em `completedHouseRuleIds` e significado/faixa de `completedBoardsAnchorIndexes`.
- Se `bestBoardDifficulties.difficulty` é o ordinal 0..4 do enum (o save real tem 1 e 3).
- Ordem de `playerInventories` em relação à ordem dos heróis (o editor assume a ordem do herói entre os ocupados; o save real só confirma a contagem).
- Se a mobília `DOORBELL` (5), que não tem item na loja (só 7 das 8 mobílias são vendidas), pode ser ativada pelo save sem efeito colateral: o editor permite ativá-la.
- Upgrade `uid 4`: não existe em nenhum asset das bundles; não foi verificado em cenas fora delas.
- Significado de `_minQuantity` e das categorias de `ShopItemData`; ícones dos itens; nomes de heróis e cores.
- Reabrir a análise no `rea` com um projeto Ghidra pré-analisado, para decompilar `MsgPackWriter` e `Save.*`.
