# Schema de itens, loja, skins, portas e house rules (Fase 1, continuação)

Build Steam **26154962**. Dados completos e legíveis por máquina: `docs/schema-items.json` (163 itens, 32 itens de loja, 6 skins, 37 house rules, upgrades, nomes pt-BR/en). Não substitui `SCHEMA_VERIFIED.md`/`schema.json`; complementa.

Legenda: **[bin]** metadata/GameAssembly (offsets VA com base 0x180000000); **[asset]** typetree UnityPy de ScriptableObject/MonoBehaviour nas bundles Addressables (`Invokyr_Data/StreamingAssets/aa/StandaloneWindows64/<hash>.bundle`, PathID de 64 bits) ou em `resources.assets`; **[save]** save real (só leitura, sem valores pessoais); **[hip]** hipótese.

Método: o `rea` não foi usado (timeout em `GameAssembly.dll`). Todos os `MonoBehaviour` das 830 bundles foram indexados (112.663 objetos), agrupados pelo PathID do script e deserializados com `read_typetree`. As classes foram identificadas por nome de campo no `global-metadata.dat` (parser em `scratchpad/tools/meta.py`). Ferramentas novas em `scratchpad/tools/`: `rawscan.py`, `ttscripts.py`, `ttdump2.py`, `i2parse.py`, `bat.py`, `doors.py`, `build.py`.

## 1. Catálogo de itens

### 1.1 Correção importante do modelo [bin][asset]

- O ScriptableObject de item **não se chama `ItemData`**. É `Items.SOTool` (base) com as subclasses `SODiceTool` (99 assets), `SOKeyTool` (2) e `SOScoreTool` (os tesouros `Data-Treasure-*`, 21 assets, serializados com o script de `SOScoreTool`), mais 41 `SOTool` simples; no total **163 assets** [asset].
- `_200_Dev.Database.Item.ItemData` é um wrapper **de runtime** `{ int itemId; SOTool tool; bool canBeSpawnedByEvent; float eventSpawnChance; string itemAlias; }` [bin: metadata classe 2534]. Não existe como asset. O `itemId` int é gerado em runtime (hipótese: índice em `ItemManager.availableTools`) [hip].
- O catálogo "oficial" é `ItemManager.availableTools` (`List<SOTool>`): **155 entradas** (bundle `9c8f02f7bbee5f55e513726bee96ad7c.bundle`, MonoBehaviour PathID 14421; lista completa e ordem em `availableToolsIndex` no JSON). 143 dos 163 assets estão na lista; os 20 que ficam de fora são `CheatCard_*`, `CheatObject`, `Club`, `Teddy`, `Nintendo-Switch`, `PadLock`, `EMFReader`, `AlarmClock`, `RubberDuck`, `CollectionFigurine`, `RuleBook_CustomMode`, `RuleBook_SaveInfo`, `Dice_Blursed_24` e 4 variantes duplicadas de dado (`Data-Dice_AntiGravGather`, `Data-Dice_AntigravityScanner`, `Data-Dice_RezGather`, `Data-Dice_TeleGather`) [asset].

### 1.2 O que vira `itemStringIds` no save

- **[save + asset] É o `itemAlias` do `SOTool`**, não o `m_Name`. Evidência: os 6 ids do save real (`dice_tp`, `dice_gather`, `ice`, `dice_boomheal`, `dice_cocoon`, `k_corridor`) são exatamente `itemAlias` de `Data-Dice_Teleport`, `Data-Dice_Gather`, `Data-IceCube`, `Data-Dice_BoomHeal`, `Data-Dice_Cocoon` e `SO-CorridorKey`; nenhum é `m_Name`.
- **[bin]** `ItemManager.GetToolSaveId` (0x18330e120) e `NormalizeItemId` (0x18330e7c0; remove o sufixo de 7 caracteres `(Clone)` e depois `Trim`) existem; `TryResolveTool` (0x183310000) e `FuzzyMatch` (0x18330da60) fazem o caminho inverso. O ramo exato quando `itemAlias` é vazio **não foi decompilado [hip]**: provável fallback para o nome normalizado do objeto. Por isso o editor deve **só gravar aliases não vazios**.
- **Aliases não são únicos [asset]**: `dice_tp` = `Data-Dice_Teleport` e `Data-Dice_TeleGather`; `dice_gather` = `Data-Dice_Gather` e `Data-Dice_RezGather`; `dice_scanner` (2); `dice_antigravity` (2); `rulebook` (5 assets). Os duplicados problemáticos fora de `availableTools` não são o alvo da resolução (o alias resolve para o que está em `availableTools`) [hip].
- 20 assets têm `itemAlias` vazio; 8 deles estão em `availableTools` (`BoardGameTool`, `BoardGameTool_MissingPiece`, `BoardNeutralShopTool`, `DeadPlayerTool`, `HauntedTv`, `HeadLamp`, `PenguinTool`, `Lantern`). São itens de cena/evento, não de inventário; **não oferecer no catálogo editável**.

### 1.3 Campos por item (todos em `schema-items.json`, `items[]`)

`m_Name`, `itemAlias`, `id_u64` (campo `id`, ulong estável no asset; string no JSON), `soClass`, `availableToolsIndex`, `canBeSpawnedByEvent`, `eventSpawnChance`, `holdSlot`, `useMode`, `isTogglable`, `name`/`desc` (termos I2 + texto en/pt-BR), `bundle`, `pathId`, e por classe: `keyName` (SOKeyTool), `scoreBasePoint` (tesouros), `diceValueOverride`/`useCustomScore` (dados), `battery` (ver 1.4). Não há "categoria", "tamanho de pilha" nem "bateria máxima" no próprio SOTool: categoria = `soClass` (dado, tesouro, chave, gadget/outros) e pilha não existe (inventário guarda um alias por slot) [asset].
`canBeSpawnedByEvent = true` em 63 dos 163. Ícone: `icon`/`iconUsed` são PPtr de Sprite (não extraídos).

Tabela resumida dos grupos (lista completa no JSON):
- Dados (`SODiceTool`, 99): `dice1..6`, `dice12`, `dice123`, `dice16`, `dice24`, `dice34`, `dice456`, `dice56`, `dice99`, `dice-1`, `dice1b`, `dice_tp`, `dice_gather`, `dice_cocoon`, `dice_boom`, `dice_boomheal`, `dice_heal*`, `dice_fire*`, `dice_freeze`, `dice_lightning*`, `dice_revive*`, `dice_scanner`, `dice_smoke`, `dice_push`, `dice_chaos*`, `haz1`, `haz16`, mais as variantes `normal*`, `blessed*`, `blursed*`, `cursed*`.
- Cubos: `ice` (`Data-IceCube`), `iceb`, `playcube`, `playcubeb`.
- Gadgets (alias `g_*`): `g_guitar`, `g_hgun`, `g_mask`, `g_mobradar`, `g_xray`, `g_compass`, `g_skull`, `g_megaphone`, `g_fire`, `g_camera`, `g_screambox`, `g_trap`.
- Tesouros (`tr_*`, 21): `tr_score`, `tr_blind`, `tr_camera`, `tr_flame`, `tr_heavy`, etc.
- Chaves: `k_henry` (`SO-HenryKey`, `keyName` 1) e `k_corridor` (`SO-CorridorKey`, `keyName` 2).
- Outros: `flashlight`, `lantern`, `rulebook`, `hrtablet`, `mpiece`, `l_article`.

### 1.4 `itemBatteryLevels`

- **[asset]** Só 6 itens têm componente `Items.BatteryTool` no prefab: `g_xray` (capacidade 45), `g_hgun` (5), `g_mobradar` (120), `g_fire` (15), `g_megaphone` (90), `g_mask` (30). `batteryDrainPerSecond` = 1.0 e `batteryStartLevel01` = 1.0 em todos (bundle/PathID em `scratchpad/bat.json`; script `BatteryTool`, campos `batteryCapacity`, `batteryDrainPerSecond`, `batteryStartLevel01`, `batteryLevel` float [bin]). Não é preciso um "tipo de carga": só a capacidade em segundos.
- `PlayerInventorySaveState.itemBatteryLevels` é `List<float>` paralela a `itemStringIds` [bin][save].
- **[save]** No save real todos os 8 itens (3 + 5) têm `-1.0` e nenhum é item de bateria. Semântica adotada **[hip]**: `-1.0` = "item sem bateria / sem estado" (sentinela); `0.0..1.0` = `batteryLevel` normalizado (`BatteryTool.BatteryLevel01`, 1.0 = cheio) apenas para os 6 itens acima. Para um item de bateria recém-colocado use `1.0`; para os demais mantenha `-1.0`. Confirmação por decompilação de `SrvCaptureGameRoomTools` (0x18330ea00) continua pendente.

## 2. Nomes para a UI (localização)

- **Existem.** Plugin I2 Localization: `MonoBehaviour` "I2Languages" em `resources.assets` (PathID 1510, 588.624 bytes), **949 termos × 13 idiomas** [asset]. Ordem dos idiomas: 0 English, 1 French, **2 Portuguese_brazil (pt-BR)**, 3 Simplified_chinese, 4 Spanish, 5 Polish, 6 Russian, 7 Korean, 8 German, 9 Italian, 10 Japanese, 11 Ukrainian, 12 Traditional_chinese. Parser: `scratchpad/tools/i2parse.py`; dump completo `scratchpad/i2terms.json` (não vai ao repo; o JSON do repo já embute en/pt-BR dos termos usados).
- Itens: `elementNameTerm`/`elementDescription` do SOTool (`UI/die/die` = Die/Dado, `Item/desc/dice5`…). **59 dos 163 itens não têm nome localizado** (campo vazio ou termo ausente, ex.: `ice`, `dice_smoke`, os `tr_*`, `rulebook`); a UI precisa de rótulo próprio (derivar do alias). 7 gadgets sem nome no SOTool herdam o nome do item de loja equivalente (`source: "shopItem"`).
- Loja/upgrades/mobílias: termos `Item/shopitem/*` (ex.: `upgrade_health`, `furniture_oldclock`, `consumable_fannypack`, `gadget_mob_radar`) mapeados em `shopItems[].name/desc`. Há também `Item/shopitem/gadget_key_henry` e `..._key_corridor`.
- House rules: `HouseRules/houserules/name/*` e `desc/*` (nome/descrição por regra em `houseRules[]`).
- Monstros: `BoardConfig/boardconfig/featured_monster_name/<id>` (19 termos: plant, horsemen, yeti, croco, hunter, ultimate, weeping, cursedplayer, penguin, moneyguy, snowman, alpinist, pharaoh, sandworm, tvghost, doormonster, spider, Bees, all) em `monsterNames`.
- **Skins de sala: não existem nomes localizados** (`GameRoomSkin_*` não têm campo de termo; só aparece o termo genérico `Item/shopitem/gmskin/actif_skin`). Usar os nomes dos assets (Default, Blue, Red, Vegetation, White_Yellow, Yellow_Stone).
- Cores de roupa (`ClothColor`) e heróis: não extraídos aqui.

## 3. Loja

Classes `ShopItemData` (base: `_uid int`, `_alias`, `_category`, `_minQuantity`, `_basePrice`, `_boughtCountInflationOverride`, `_roundInflation`, `_growth`, `_curve`, `_maxInflationRound`, + prefab/`_gameplayElement`/evento FMOD). **Não existe campo de "quantidade máxima" nem "stack limit" em `ShopItemData`** [asset]; o limite de compra é o `MaxLevel` do upgrade ou o limite do inventário (textos `Item/shopitem/max_reached`, `inventory_full`). `_minQuantity` é a quantidade mínima em estoque/compra (leitura: 0 = sem mínimo, 1/2 = mínimo da categoria) [hip na semântica; valores [asset]]. Categoria: 1 Upgrade, 2 Furniture, 3 Gadget, 4 Consumable. Inflação: `preço = base` quando `_boughtCountInflationOverride`=0; só `fur_clock` usa inflação (`roundInflation` 1, `growth` 125, `maxInflationRound` 9) [asset].

`ShopManager` (MonoBehaviour no bundle `828abe809ac22229bac47b587fa1c2fa.bundle`, PathID 7800408310054073254): listas exatas dos itens oferecidos (4 upgrades, 7 mobílias, 11 gadgets, 10 consumíveis) em `shopManagerLists`; slots físicos: 8 upgrade, 4 mobília, 6 gadget, 11 consumível.

| uid (`shopItemsUIDs`) | alias | categoria | preço base | minQty | observação |
|---|---|---|---|---|---|
| 155320950 | up_health | Upgrade | 200 | 1 | -> `CharacterUpgrade_MaxHealth` uid 1 |
| 311584588 | up_stamina | Upgrade | 200 | 1 | -> uid 2 |
| -872071192 | up_speed | Upgrade | 200 | 1 | -> uid 3 |
| **1601800366** | **up_invslot** (fannypack, termo `consumable_fannypack`) | Upgrade | **400** | 2 | -> `CharacterUpgrade_InventorySlot` uid 6 |
| 920453269 | fur_radio | Mobília | 500 | 0 | `EGameRoomFurniture` 1 RADIO |
| 1772907373 | fur_closet | Mobília | 750 | 0 | 2 WARDROBE |
| -380059950 | fur_mirror | Mobília | 750 | 0 | 3 MIRROR |
| 1600172649 | fur_disco | Mobília | 1500 | 0 | 4 DISCO |
| -1462199363 | fur_dicefirework | Mobília | 500 | 0 | 6 DICEBOX_FIREWORK |
| 2045476943 | fur_dicecube | Mobília | 500 | 0 | 7 DICEBOX_CUBE |
| **-937123244** | **fur_clock** | Mobília | 1000 (+125/rodada, máx. rodada 9) | 1 | **8 OLD_CLOCK** |
| 525100419 / -211161419 / -286216635 / -2065581256 / -1705268261 / 1010844332 / -1994114511 / -1254192619 / 2086200294 / 873883547 / 1982768718 | gad_monsterbox / gad_guitar / gad_huntergun / gad_mask / gad_mobradar / gad_xray / gad_compass / gad_playerskull / gad_megaphone / gad_flamethrower / gad_camera | Gadget | 250 / 375 / 2500 / 1750 / 500 / 1250 / 1250 / 500 / 250 / 2500 / 375 | 0 | `toolToSpawn` -> SOTool |
| -1522034135 | c_milk | Consumível | 100 | 2 | destruído ao consumir |
| 1820564218, 1689476099, -1709823149, 758926474, -31383584, 1819000175, 242359013, 673790302, 893901473 | (sem alias) Cloth_Red/Blue/Gold/Yellow/DarkBlue/Purple/Pink/White/Green | Consumível | 25 (Gold 1500) | 0 | roupa; `CharacterConsumable ChangeCloth` uid 1..11 = ClothColor |

- **uid `-937123244` = `Data-ShopFurnitureItem_OldClock` (`fur_clock`), mobília `OLD_CLOCK` (8)** [asset: bundle `828abe809ac22229bac47b587fa1c2fa.bundle`, PathID 619364329214128875]. Bate com o save real (`furnitures=[8]`, `shopItemInfos=[{boughtCount:1}]`) [save].
- `shopItemsUIDs` guarda `ShopItemData._uid` e `shopItemInfos[i].boughtCount` é a contagem paralela [asset+save]. Os uids são inteiros arbitrários gravados no asset, não hashes.
- Fannypack = `up_invslot`; é um upgrade de loja (categoria 1) cujo efeito é `CharacterUpgrade_InventorySlot` uid 6 (`_maxBonusSlot` 2), portanto aparece em `upgrades.<hero>Upgrades` como `{x:6, y:nível}`.
- **Upgrade uid 4: não existe** em nenhum asset (os `CharacterUpgrade_*` são uid 1, 2, 3, 5, 6; o DoubleJump uid 5 não tem item de loja). Tratar 4 como inexistente/reservado [asset].
- Consumíveis `Character Consumable` (não vão para `shopItemsUIDs`): `CharacterConsumable_FullHeal` uid 1 (`c_fullheal`) e 9 `*_ChangeCloth_CharacterConsumable` uid 2..11 (cor em `_color`).

## 4. Skins de sala: ordem real

`GameRoomSkinManager._gameRoomSkins` (bundle `9c8f02f7bbee5f55e513726bee96ad7c.bundle`, MonoBehaviour PathID 12989) [asset]. `gameRoomSkinIndex` = índice nesta lista:

| índice | asset | `_uid` | preço | no sorteio |
|---|---|---|---|---|
| 0 | GameRoomSkin_Default | 739025691 | 0 | não |
| 1 | GameRoomSkin_Blue | -1254331890 | 200 | sim |
| 2 | GameRoomSkin_Red | 937885033 | 200 | sim |
| 3 | GameRoomSkin_Vegetation | 1138503737 | 200 | sim |
| 4 | GameRoomSkin_White_Yellow | -157839821 | 200 | sim |
| 5 | GameRoomSkin_Yellow_Stone | -1688765505 | 200 | sim |

Faixa válida: 0..5 (6 skins). Não há skin na lista da loja (`ShopManager` não oferece skin; a skin é comprada/sorteada por outro fluxo) [asset].

## 5. Portas com chave

- Há **exatamente 2 portas com `keyName` != 0** entre os 436 componentes de porta (3 scripts de porta) de todas as bundles [asset]: `PF_SimpleDoor_Vanilla_Green` (`KeyName.Henry` = 1, termo `Item/shopitem/gadget_key_henry`) e `Pf_ArcDoor_Vanilla_Green` (`KeyName.Corridor` = 2, termo `..._key_corridor`), ambas na bundle `828abe809ac22229bac47b587fa1c2fa.bundle` (sala/hub). As outras 434 têm `keyName` 0.
- Relação com os itens: `KeyName.Henry` <-> `SO-HenryKey` (`k_henry`, `keyName` 1); `KeyName.Corridor` <-> `SO-CorridorKey` (`k_corridor`, `keyName` 2) [asset]. `unlockedKeyDoors` ∈ {1,2} (o save real tem `[2]`, coerente com o `k_corridor` na bancada).
- `GameRoomDoorCount`: não existe como constante achada; o equivalente prático é 2 chaves. O jogo desbloqueia pelo enum, não por índice.

## 6. Collection e shop restantes

- **`completedHouseRuleIds`**: vazio no save real (nenhuma evidência de formato em dados) [save]. Existem **37 assets `HouseRule`** (lista completa em `houseRules[]`): `HR_AshesToAshes`, `HR_BlizzardResume`, `HR_BrokenMirrors`, `HR_CrossoverResume`, `HR_Curse_Alt_LightsOut`, `HR_Curse_Alt_NearDeath`, `HR_Curse_Alt_ReducedHealing`, `HR_Curse_Alt_SharedLife`, `HR_Curse_Alt_VanishingMonsters`, `HR_Curse_LinkedDestinies`, `HR_Kidnapping`, `HR_MonsterDamage`, `HR_MonsterHealth`, `HR_MonsterSpeed`, `HR_MysteryBoard`, `HR_NoBlessing`, `HR_PoisonResume`, `HR_Possession`, `HR_SecretEvents`, `HR_TwinMonsters` e 17 `HR_Statue_<Monstro>` (campo `_monster` = `MonsterCollectionId`) [asset].
- **O formato do id gravado não está comprovado [hip]**: `HouseRule.get_Id` (0x18324b290) devolve `string.Format(fmt, obj@+0x30, boxed int@+0x48)`, ou seja uma composição (provavelmente nome/`debugName` + um inteiro), e `IsCatalogRule` retorna true [bin]. Candidatos: `m_Name` (`HR_*`) ou `debugName` (`statue_alpinist`, `mspeed`, `ralt_dk`…, também no JSON). **Recomendação:** o editor deve preservar o array como está e só oferecer remover/limpar, até um save com valor real ser observado.
- **`completedBoardsAnchorIndexes`**: `List<int>` em `ShopSaveState`; o save real tem `[0,1]` com `completedBoardsConfigurations` de 2 entradas e `completedBoardKeys` de 2 [save]. Leitura: um índice por tabuleiro concluído, 0-based, na ordem de conclusão/âncora de oferta [hip]; sem faixa máxima confirmada. Manter `len(anchorIndexes) == len(completedBoardsConfigurations)` por coerência [hip].

## 7. Pendências

- Ramo de `GetToolSaveId` quando `itemAlias` é vazio; sentinela exata `-1.0` (decompilar `SrvCaptureGameRoomTools`).
- Formato de id em `completedHouseRuleIds` (precisa de save com regra concluída ou decompilar `HouseRule.get_Id` com a string literal).
- Significado exato de `_minQuantity` e das categorias de `ShopItemData` além dos valores observados.
- Ícones (Sprites) dos itens e nomes de heróis/cores; nomes localizados para os 59 itens sem termo.
- Upgrade uid 4 (ausente nos assets das bundles; não verificado em cenas empacotadas fora das bundles).
