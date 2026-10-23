# Especificação Técnica de Engenharia Reversa: Arquitetura de Saves do Invokyr

## 1. Visão Geral do Sistema de Saves
O jogo **Invokyr** (Steam AppID: `3883570`), desenvolvido pela Ludogram na engine **Unity 6** com compilação **IL2CPP (Metadata v39)**, armazena seus dados de progresso no padrão binário serializado por **MessagePack** encapsulado em contêineres comprimidos **ZIP (Deflate)**.

### 1.1 Localização Física do Save no Linux (Steam Proton)
Quando executado via Proton/Wine, o caminho relativo ao prefixo do Proton é:
```text
<SteamLibrary>/steamapps/compatdata/3883570/pfx/drive_c/users/steamuser/AppData/LocalLow/Ludogram/Invokyr/saves/
```
Caminho absoluto típico no sistema:
```text
/home/daniel/.local/share/Steam/steamapps/compatdata/3883570/pfx/drive_c/users/steamuser/AppData/LocalLow/Ludogram/Invokyr/saves/save <N>.sav
```
Arquivos de suporte presentes no diretório:
- `save <N>.sav`: Arquivo de save individual (onde `N` é o índice do slot, ex.: `save 1.sav`).
- `steam_autocloud.vdf`: Manifesto de sincronização do Steam Cloud.
- `../GameOption.ini`: Configurações de exibição e áudio.
- `../Player.log`: Log de depuração do Unity em tempo de execução.

---

## 2. Anatomia do Contêiner ZIP
O arquivo `.sav` não é um arquivo proprietário encriptado; trata-se de um contêiner `.NET ZipArchive` contendo três arquivos planos gravados na raiz (sem pastas internas):

```text
save 1.sav (ZIP Deflate)
├── meta       (Payload binário MessagePack - Gerenciamento de Slot e Sessão)
├── save       (Payload binário MessagePack - Estado Persistente da Partida v15)
└── collection (Payload binário MessagePack - Perfil, Conquistas e Colecionáveis)
```

### Regras de Compactação e Integridade
1. **Compressão**: Padrão `DEFLATE` (`CompressionLevel.Optimal` ou `zipfile.ZIP_DEFLATED`).
2. **Nomes dos Streams**: Devem ser estritamente `meta`, `save` e `collection` (sem extensão, case-sensitive).
3. **Escrita Atômica**: O jogo salva utilizando escrita temporária e substituição atômica (`File.Replace`). Softwares externos devem gravar primeiro em `.tmp` e usar `os.replace` após testar o zip via `ZipFile.testzip()`.

---

## 3. Especificação do Formato de Serialização (MessagePack-CSharp)
O motor do jogo utiliza a biblioteca `MessagePack-CSharp` compilada sob o resolver `ContractlessStandardResolver` (ou atributos explícitos `[Key("nome")]`).

### Invariantes Estritas de Tipagem
> [!IMPORTANT]
> **Single vs Double Precision (Floats)**:
> O deserializador do Unity espera o tipo nativo C# `System.Single` (`float32` IEEE 754 de 4 bytes) para todos os campos fracionários (ex.: `itemBatteryLevels`, `playTimeSeconds`). Se forem serializados como `double` (`float64` de 8 bytes), o jogo disparará:
> `MessagePackSerializationException: Expected Single, but got Double`
> Em Python, é obrigatório utilizar `msgpack.packb(..., use_single_float=True)`.

> [!NOTE]
> **Inteiros de 64 bits**:
> Campos como `savedAtUtcTicks` e os IDs em `characterOwners` são do tipo `System.Int64` / `System.UInt64`. Devem ser codificados como inteiros de 64 bits (marcadores `0xd3` para int64 ou `0xcf` para uint64).

---

## 4. Dicionário de Estrutura dos Arquivos

### 4.1 Arquivo `meta` (Cabeçalho de Slot e Sessão)
Mapeia a classe `SaveMetadata`. Utilizado pelo menu do jogo para renderizar o cartão do save antes de carregar o mundo:

| Campo | Tipo C# | Tipo Python / JSON | Descrição |
| :--- | :--- | :--- | :--- |
| `savedAtUtcTicks` | `Int64` | `int` | Timestamp de salvamento em Ticks do .NET (100 nanos desde 01/01/0001). |
| `roundIndex` | `Int32` | `int` | Índice da rodada atual na partida ativa (0-indexed). |
| `endlessRank` | `Int32` | `int` | Ranque alcançado no modo Endless (0 para campanha normal). |
| `playTimeSeconds` | `Single` | `float` | Tempo total de jogo acumulado na run em segundos. |
| `score` | `Int32` | `int` | Pontuação atual acumulada na partida ativa. |
| `playerCount` | `Int32` | `int` | Número de jogadores humanos ativos na sessão (`1 <= playerCount <= 8`). |
| `characterOwners` | `UInt64[8]` | `list[int]` | Array fixo de 8 posições mapeando cada herói ao seu SteamID64 (`0` para vago). |

### 4.2 Arquivo `save` (Estado Completo da Partida)
Mapeia a classe principal `SaveData`. Estrutura central da run:

| Chave de Topo | Tipo | Descrição |
| :--- | :--- | :--- |
| `version` | `int` | Versão do esquema de dados (Schema Guard). Atualmente `15`. |
| `bank` | `object` | `BankSaveState`: Contém `currentTotalScore` (saldo total de moedas de meta-progresso). |
| `shop` | `object` | `ShopSaveState`: Estado da loja, tabuleiros concluídos e semente de ofertas. |
| `upgrades` | `object` | `UpgradesSaveState`: 8 listas de UIDs de upgrades comprados por herói. |
| `furnitures` | `object` | `FurnituresSaveState`: Mobílias desbloqueadas no hub (enum `EGameRoomFurniture`). |
| `playerInventories` | `list` | Lista de `PlayerInventorySaveState` com itens e baterias de cada jogador. |
| `playerColors` | `list` | Lista de `PlayerClothColorSaveState` com as cores dos heróis na sessão. |
| `gameRoomSkinIndex` | `int` | Índice estético da skin do Lobby/GameRoom (0 = Padrão). |
| `gameRoomTools` | `object` | Ferramentas e itens depositados nas bancadas/chão da sala de espera. |
| `playTimeSeconds` | `float` | Tempo de jogo persistido com precisão de ponto flutuante. |
| `unlockedKeyDoors` | `list[int]` | Índices ordinais das portas destravadas na GameRoom. |

### 4.3 Arquivo `collection` (Troféus e Conquistas Perenes)
Mapeia a classe `CollectionSaveData`. Persistência do perfil do usuário:

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `bestEndlessRank` | `int` | Recorde máximo de sobrevivência no modo Endless. |
| `monsterFigurines` | `int` | **Bitmask inteira**: Cada bit $k$ ativa a estatueta do monstro $k$ na `CollectionRoom`. |
| `completedBoardKeys` | `list[str]` | Chaves no formato `"{biome}:{featuredMonster}"` de mapas completados. |
| `completedHouseRuleIds` | `list[str]` | Identificadores de mutadores/regras da casa superados. |
| `bestBoardDifficulties` | `list[obj]` | Registros `{"boardKey": str, "difficulty": int}` com a maior dificuldade batida. |

---

## 5. Regras para Geração de Saves Customizados
1. Mantenha sempre `version: 15`.
2. Em `characterOwners`, o array deve conter exatamente 8 posições. Insira o seu `SteamID64` no slot do herói que deseja controlar.
3. Garanta que o comprimento de `playerInventories` seja igual a `playerCount`.
4. Em cada inventário, a lista `itemStringIds` deve possuir exatamente a mesma quantidade de elementos que `itemBatteryLevels`.
5. Ao empacotar, utilize o script utilitário `save_codec.py` para garantir conformidade de tipo `Single` em floats.
