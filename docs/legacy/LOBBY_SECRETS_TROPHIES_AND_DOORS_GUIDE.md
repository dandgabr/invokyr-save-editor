# Guia de Segredos do Lobby, Destrancamento de Portas, Mobílias e Troféus (Invokyr)

## 1. Portas Trancadas do Lobby e Sistema de Chaves

A GameRoom (sala de espera / lobby entre partidas) possui diversas portas trancadas que dão acesso a corredores, salas secretas e áreas de preparação.

### 1.1 Como o Jogo Processa as Portas
1. **Contagem e Índices**:
   - A propriedade `GameRoomDoorCount` define a quantidade total de portas no cenário da sala.
   - Cada porta trancada possui um índice ordinal inteiro zero-based: `0, 1, 2, 3...`.
2. **Ciclo de Carregamento**:
   - Ao iniciar a sessão, o servidor/host chama o método autoritativo:
     ```csharp
     GameRoomFurnituresManager::SrvApplyKeyDoorsSave(List<int> unlockedKeyDoors)
     ```
   - O jogo itera sobre os índices contidos no array `unlockedKeyDoors` do save e abre as portas correspondentes.
3. **Chaves Físicas (`k_*`)**:
   - O item `k_corridor` (Chave do Corredor) e variantes são usados pelos jogadores para destrancar as portas manualmente durante a partida.
   - Assim que uma porta é destrancada, o jogo dispara `SrvNotifyKeyDoorUnlocked`, adiciona o índice a `unlockedKeyDoors` e grava o save.

### 1.2 Como Destrancar Todas as Portas pelo Save
Para liberar todas as portas da GameRoom instantaneamente sem precisar achar as chaves, basta definir o campo `unlockedKeyDoors` no arquivo `save` com a lista contígua de todos os índices válidos:
```json
"unlockedKeyDoors": [0, 1, 2, 3, 4]
```
*(No save original, apenas a porta `[2]` estava liberada).*

---

## 2. Catálogo Completo de Mobílias do Hub (`furnitures`)

O nó `furnitures.furnitures` armazena uma lista de números inteiros correspondentes ao enum:
```csharp
_200_Dev.EnvironmentElements.Furnitures.EGameRoomFurniture
```

### 2.1 Mapeamento Ordinal das Mobílias
| ID | Constante Enum | Objeto / Função no Hub |
| :---: | :--- | :--- |
| `1` | `RADIO` | Rádio tocador de músicas com trilhas da trilha sonora. |
| `2` | `WARDROBE` | **Armário / Guarda-roupa**: Customização de roupas e skins dos heróis. |
| `3` | `MIRROR` | **Espelho**: Espelho interativo de visualização cosmética e respawn. |
| `4` | `DISCO` | Globo de luzes de discoteca com efeitos de iluminação na sala. |
| `5` | `DOORBELL` | Campainha interativa com efeito sonoro no lobby. |
| `6` | `DICEBOX_FIREWORK` | Caixa de dados de fogos de artifício com efeitos visuais pirotécnicos. |
| `7` | `DICEBOX_CUBE` | Caixa de armazenamento de cubos de gelo/dados. |
| `8` | `OLD_CLOCK` | **Relógio Antigo**: Relógio funcional que emite tique-taque e pode ser desgovernado. |

### 2.2 Desbloqueio Total de Mobílias
Para habilitar todas as mobílias e aparelhos na sala de preparação, configure o nó `furnitures` como:
```json
"furnitures": {
  "furnitures": [1, 2, 3, 4, 5, 6, 7, 8]
}
```

---

## 3. Easter Eggs e Segredos da GameRoom

### 3.1 Alavanca Secreta da Sala de Coleções
- **Elemento**: `_200_Dev.EnvironmentElements.Shop.CollectionRoomLever`
- **Mecânica**: Uma alavanca física embutida no cenário da loja/sala de coleções. Ao ser puxada, ela dispara a abertura de compartimentos secretos e aciona iluminação comemorativa.

### 3.2 Eventos Interativos da Sala (`GED_*` - Game Event Directives)
- **`GED_GameRoomPenguin`**: Interação com um pinguim mascote secreto que anda pela sala.
- **`GED_GameRoomWeeping`**: Uma estátua oculta com comportamento de "Weeping Angel" (só se move ou altera sua pose quando nenhum jogador está olhando diretamente para ela).
- **`GED_GameRoomFlameThrower`**: Aciona armadilhas ou dispositivos de chamas decorativos na sala de espera.

### 3.3 Temas Estéticos do Lobby (`gameRoomSkinIndex`)
- O campo `gameRoomSkinIndex` no save altera a temática geral da sala de espera:
  - `0`: Padrão / Clássico.
  - `1+`: Variações temáticas desbloqueadas (ex.: skins festivas, retrô ou comemorativas).

### 3.4 Regras Secretas (`HR_SecretEvent` / `HouseRuleSecretEvent`)
- Permite registrar no array `completedHouseRuleIds` da `collection` a superação de mutadores e regras secretas ocultas no menu de criação de partidas customizadas.

---

## 4. Sistema de Troféus e Desbloqueios da Coleção (`collection`)

O arquivo `collection` armazena a progressão global e conquistas do perfil.

### 4.1 Bitmask de Estatuetas de Monstros (`monsterFigurines`)
As estatuetas 3D expostas nos pedestais da `CollectionRoom` (`MonsterFigurineSlot`) são controladas por uma única **máscara de bits (bitmask)** inteira:

$$\text{monsterFigurines} = \sum_{k=0}^{N-1} b_k \cdot 2^k$$

Onde $b_k = 1$ significa que a estatueta do monstro $k$ está desbloqueada e exibida no pedestal.

#### Exemplo do Save Original (`16405`):
$$16405_{10} = 0000\ 0000\ 0000\ 0000\ 0100\ 0000\ 0001\ 0101_2$$
- **Bit 0** ($2^0 = 1$): Monstro ID 0 Desbloqueado.
- **Bit 2** ($2^2 = 4$): Monstro ID 2 Desbloqueado.
- **Bit 4** ($2^4 = 16$): Monstro ID 4 Desbloqueado.
- **Bit 14** ($2^{14} = 16384$): Monstro ID 14 Desbloqueado.
- *Total*: $1 + 4 + 16 + 16384 = 16405$.

#### Para Desbloquear Todas as Estatuetas:
Basta definir `monsterFigurines` com todos os bits ativados correspondentes aos monstros existentes (por exemplo, `0xFFFFFFFF` ou `2147483647` para 31 slots completos):
```json
"monsterFigurines": 2147483647
```

### 4.2 Recordes e Troféus de Tempo (`bestEndlessRank` & `MjTimeTrophyAnchor`)
- O campo `bestEndlessRank` define o nível de troféu de metal (Bronze, Prata, Ouro, Diamante) instanciado nas âncoras `MjTimeTrophyAnchor` na sala de troféus.

### 4.3 Dificuldades Máximas por Tabuleiro (`bestBoardDifficulties`)
- Registra para cada chave `boardKey` a maior dificuldade batida (`1` a `5`).
```json
"bestBoardDifficulties": [
  { "boardKey": "1:1", "difficulty": 5 },
  { "boardKey": "1:13", "difficulty": 5 },
  { "boardKey": "2:3", "difficulty": 5 },
  { "boardKey": "3:4", "difficulty": 5 },
  { "boardKey": "4:2", "difficulty": 5 }
]
```
