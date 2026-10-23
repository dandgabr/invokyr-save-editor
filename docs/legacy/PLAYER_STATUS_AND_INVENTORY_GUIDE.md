> **Documento herdado, NÃO VERIFICADO.** Foi corrigido pela análise do jogo em [`docs/SCHEMA_VERIFIED.md`](../SCHEMA_VERIFIED.md) (build 26154962). Em caso de divergência, vale o SCHEMA_VERIFIED.

# Guia de Mecânicas de Status, Sessão Multi-Jogador, Itens e Tabuleiros (Invokyr)

## 1. Arquitetura de Status do Jogador

No **Invokyr**, a engine Unity IL2CPP divide os atributos dos heróis em duas camadas bem delimitadas:
1. **Status Voláteis (In-Run / Combate)**: Instanciados dinamicamente em tempo de execução via NetworkVariables e SyncVars durante a partida.
2. **Status Persistentes (Meta-Progressão)**: Salvos no nó `upgrades` do arquivo `.sav`, conferindo bônus permanentes aos heróis entre partidas.

---

### 1.1 Status Voláteis (Em Tempo de Execução)

#### A. Vida e Sobrevivência (Health)
- **`CurrentHealthSync` & `MaxHealthSync`**: Variáveis de rede autoritativas do host/servidor que controlam a integridade física do personagem.
- **`CliCurrentHealth` & `CliMaxHealth`**: Variáveis interpoladas de predição visual no cliente para renderização suave da barra de vida.
- **`NearDeathMaxHealth`**: Teto temporário de vida quando o jogador entra no estado de incapacitação ("downed").
- **`ScaleHealthToMax`**: Método que recalcula a vida atual proporcionalmente sempre que a vida máxima é expandida por um buff ou upgrade, evitando descompassos.

#### B. Estamina e Mobilidade (Stamina & Locomotion)
- **`CurrentStamina` & `MaxStamina`**: Medidores de energia para corrida, esquiva e ações de salto.
- **`MaxStaminaAged`**: Mecânica de fadiga acumulada — o teto de estamina máxima se degrada progressivamente com o esforço contínuo na run.
- **`JumpStaminaCost`**: Custo atômico debitado a cada pulo.
- **`CanRecoverStamina`**: Flag de travamento que pausa a regeneração de estamina durante ações ativas.
- **`ERunStaminaBehaviour`**: Enum que dita o modelo de consumo da corrida (contínuo vs. pulsado).
- **`RunSpeed`**: Multiplicador de velocidade de deslocamento base.
- **`DoubleJump`**: Habilidade de salto duplo gerenciada pelo componente `CharacterUpgrade_DoubleJump`.

#### C. Inventário e Capacidade (Inventory)
- **`InventorySlot`**: Quantidade base de compartimentos de carga.
- **`_maxBonusSlot`**: Limite máximo de slots adicionais que podem ser desbloqueados por upgrades.

---

### 1.2 Status Persistentes (Meta-Progressão no Save)

Os status permanentes residem no nó `upgrades` de `save`. Cada um dos 8 heróis possui sua própria lista de UIDs de melhorias adquiridas:

```json
"upgrades": {
  "redUpgrades": [ ... ],
  "specsUpgrades": [ ... ],
  "tankUpgrades": [ ... ],
  "ziggyUpgrades": [ ... ],
  "carlUpgrades": [ ... ],
  "bobbyUpgrades": [ ... ],
  "susanUpgrades": [ ... ],
  "lilyUpgrades": [ ... ]
}
```

#### Classes Canônicas e Limites de Pilha da Loja (Shop Upgrades)
Conforme extraído diretamente de `resources.assets` (`Item/shopitem/`):

| Upgrade / Item | Chave de Localização & Asset | Efeito Concedido | Limite de Pilha (Stack Limit) | Preço Base (Desconto 30%) |
| :--- | :--- | :--- | :---: | :---: |
| 🩸 **Saúde (Health)** | `Item/shopitem/upgrade_health` (`CharacterUpgrade_MaxHealth`) | Aumenta saúde máxima em +25 PV por nível | **8 vezes (8x)** | 200 (140) moedas |
| ⚡ **Estamina (Stamina)** | `Item/shopitem/upgrade_stamina` (`CharacterUpgrade_MaxStamina`) | Aumenta estamina máxima em +1 barra por nível | **7 vezes (7x)** | 200 (140) moedas |
| 👟 **Agilidade (Speed)** | `Item/shopitem/upgrade_speed` (`CharacterUpgrade_RunSpeed`) | Concede bônus definitivo de velocidade de corrida/sprint | **5 vezes (5x)** | 200 (140) moedas |
| 🎒 **Pochete (Fanny Pack)** | `Item/shopitem/consumable_fannypack` (`CharacterUpgrade_InventorySlot`) | Adiciona um novo slot ao inventário do proprietário | **2 vezes (2x)** | 400 (280) moedas |
| 🦘 **Pulo Duplo** | `CharacterUpgrade_DoubleJump` (`VHS/ShopContent/Upgrades/Double Jump`) | Segundo salto acrobático no ar (Habilidade Única / Perk) | **1 vez (Booleano)** | Especial / Trainer |

---

## 2. Gestão de Sessão Multi-Jogador

O jogo suporta cooperativo de 1 até 8 jogadores simultâneos.

### 2.1 Mapeamento de Heróis e IDs da Steam
O enum `EPlayerCharacter` estabelece a ordem dos 8 heróis:
- `0`: **Red**
- `1`: **Specs**
- `2`: **Tank**
- `3`: **Ziggy**
- `4`: **Carl**
- `5`: **Bobby**
- `6`: **Susan**
- `7`: **Lily**
- `-1`: **Sentinela / Padrão Global**

No arquivo `meta`, o array `characterOwners` armazena o `SteamID64` do jogador que escolheu aquele herói:
```json
"playerCount": 3,
"characterOwners": [
  76561198000000001, // Slot 0: Red (Jogador 1)
  0,                 // Slot 1: Specs (Desocupado)
  0,                 // Slot 2: Tank (Desocupado)
  76561198000000002, // Slot 3: Ziggy (Jogador 2)
  76561198000000003, // Slot 4: Carl (Jogador 3)
  0,                 // Slot 5: Bobby (Desocupado)
  0,                 // Slot 6: Susan (Desocupado)
  0                  // Slot 7: Lily (Desocupado)
]
```

### 2.2 Inventários Individuais (`playerInventories`)
A lista `playerInventories` contém uma entrada por jogador ativo (`playerCount` elementos):
```json
"playerInventories": [
  {
    "itemStringIds": ["dice_tp", "dice_gather", "ice"],
    "itemBatteryLevels": [-1.0, -1.0, -1.0]
  },
  {
    "itemStringIds": ["Data-Treasure-Flamethrower"],
    "itemBatteryLevels": [1.0]
  },
  {
    "itemStringIds": [],
    "itemBatteryLevels": []
  }
]
```

---

## 3. Catálogo Canônico de Itens, Armas e Ferramentas

### 3.1 Dados Especiais (`itemStringIds`)
| Identificador | Função / Efeito |
| :--- | :--- |
| `dice_tp` / `dice_teleport` | Teleporte tático do personagem. |
| `dice_gather` | Reúne e agrupa aliados ou itens na área alvo. |
| `dice_boom` | Explosão em área com alto dano de impacto. |
| `dice_boomheal` | Explosão curativa que restaura aliados na zona de detonação. |
| `dice_cocoon` | Prende inimigos em um casulo protetor/bloqueador. |
| `dice_cocoonfire` | Casulo incendiário que queima alvos presos. |
| `dice_freeze` | Congela temporariamente monstros e armadilhas. |
| `dice_heal` | Restaura a vida de aliados próximos. |
| `dice_light` | Ilumina áreas escuras e enfraquece monstros fotofóbicos. |
| `dice_lightning` | Descarga elétrica em cadeia que salta entre múltiplos alvos. |
| `dice_revive` | Ressuscita instantaneamente um aliado caído (Downed/NearDeath). |
| `dice_scanner` | Escaneia e revela perigos, monstros e baús através das paredes. |

### 3.2 Armas, Gadgets e Tesouros
| Identificador | Descrição | Nível de Carga Recomendado |
| :--- | :--- | :--- |
| `Data-Treasure-Flamethrower` | **Lança-chamas**: Projeta jatos contínuos de fogo. | `1.0` (100% de bateria) |
| `PF_BoardItem_Jungle_Hunter` | **Arma / Item do Caçador**: Dispositivo de tiro de precisão. | `1.0` (100% de carga) |
| `Data-Treasure-Camera` | **Câmera Fotográfica**: Cega e desorienta inimigos com flash. | `1.0` |
| `Data-Treasure-DiceThrower` | **Atirador de Dados**: Lança dados a longas distâncias. | `-1.0` |
| `Data-Treasure-Puppet` | **Marionete**: Distrai monstros atraindo atenção. | `-1.0` |
| `Data-Treasure-Miniature` | **Miniatura**: Encolhe o personagem para passagens estreitas. | `1.0` |
| `Data-Treasure-Blind` | Dispositivo de fumaça cegante. | `1.0` |
| `Data-Treasure-InvertedView` | Gadget de periscópio e inversão tática de ângulo. | `1.0` |
| `Data-Treasure-ReverseInputs` | Gadget de perturbação de movimento. | `1.0` |
| `Data-Treasure-Slippery` | Espalha superfície lubrificada e escorregadia. | `1.0` |
| `Data-Treasure-Vanishing` | Camuflagem / Manto de invisibilidade temporária. | `1.0` |
| `Data-Treasure-WanderingDice` | Dado autônomo móvel com efeito contínuo. | `1.0` |

### 3.3 Consumíveis, Recipientes e Chaves
| Identificador | Descrição | Bateria |
| :--- | :--- | :--- |
| `ice` (`Data-IceCube`) | Cubo de gelo consumível para resfriar armas ou apagar fogo. | `-1.0` |
| `milk_bottle` | Garrafa de leite consumível: restaura estamina e remove debuffs. | `-1.0` |
| `dice_pouch` | Pochete de dados: expande a capacidade de dados carregados. | `-1.0` |
| `k_corridor` | Chave física que destranca a passagem do corredor do lobby. | `-1.0` |

---

## 4. Estrutura e Lógica de Tabuleiros e Biomas

Os tabuleiros no Invokyr combinam Biomas temáticos, Chefes/Monstros em destaque e níveis de Dificuldade de `1` a `5`.

### 4.1 Biomas Mapeados
1. **Bioma 1 (`Jungle` / Floresta)**: Selva densa e perigosa.
   - Monstros: `Croco` (Crocodilo), `Hunter` (O Caçador e suas armadilhas), `Plant` (Planta Carnívora).
2. **Bioma 2 (`Desert` / Deserto)**: Ruínas áridas e catacumbas.
   - Monstros: `Pharaoh` (O Faraó ancestral), `SandWorm` (Verme gigante da areia).
3. **Bioma 3 (`Frozen` / Neve)**: Cavernas glaciais e picos gelados.
   - Monstros: `Alpinist` (Alpinista amaldiçoado), `Penguin` (Pinguim guardião), `Snowman` (Boneco de neve), `Yeti` (O Abominável).
4. **Bioma 4 (`Manor` / Mansão)**: Mansão assombrada.
   - Monstros: `CursedPlayer` (Sombra do jogador), `Horsemen` (Cavaleiros espectrais), `MoneyGuy` (O Banqueiro avarento), `TVGhost` (Fantasma da TV), `Weeping` (Estátua chorona).

### 4.2 Notação de Chaves de Tabuleiro (`boardKey`)
No arquivo `collection`, cada tabuleiro completado é identificado pela string:
```text
"{biomeId}:{featuredMonsterId}"
```
Exemplos reais extraídos do save:
- `"2:3"`: Deserto (Bioma 2) com Chefe 3.
- `"1:13"`: Selva (Bioma 1) com Chefe 13.
