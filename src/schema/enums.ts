/**
 * Enums do jogo verificados no binário (build Steam 26154962). Fonte: docs/SCHEMA_VERIFIED.md §4.
 * `label` é o nome exibido na interface (pt-BR). Para monstros, usa o texto localizado do próprio jogo
 * (termos `featured_monster_name`, docs/SCHEMA_ITEMS.md §2); `None`, `Demo` e `Mimic` não têm termo no jogo.
 */

export interface EnumEntry {
  id: number;
  key: string;
  label: string;
}

const make = (rows: [number, string, string][]): readonly EnumEntry[] =>
  rows.map(([id, key, label]) => ({ id, key, label }));

export const HEROES = make([
  [0, 'Red', 'Red'],
  [1, 'Specs', 'Specs'],
  [2, 'Tank', 'Tank'],
  [3, 'Ziggy', 'Ziggy'],
  [4, 'Carl', 'Carl'],
  [5, 'Bobby', 'Bobby'],
  [6, 'Susan', 'Susan'],
  [7, 'Lily', 'Lily'],
]);
export const HERO_COUNT = HEROES.length;
/** `playerColors` inclui uma entrada global com `playerCharacter = -1` (EPlayerCharacter.None). */
export const PLAYER_NONE = -1;

/** Chave do nó `upgrades` para cada herói, na ordem de EPlayerCharacter. */
export const UPGRADE_KEYS = [
  'redUpgrades',
  'specsUpgrades',
  'tankUpgrades',
  'ziggyUpgrades',
  'carlUpgrades',
  'bobbyUpgrades',
  'susanUpgrades',
  'lilyUpgrades',
] as const;
export type UpgradeKey = (typeof UPGRADE_KEYS)[number];

export const CLOTH_COLORS = make([
  [0, 'PURPLE', 'Roxo'],
  [1, 'DARKBLUE', 'Azul-escuro'],
  [2, 'BLUE', 'Azul'],
  [3, 'GREEN', 'Verde'],
  [4, 'YELLOW', 'Amarelo'],
  [5, 'RED', 'Vermelho'],
  [6, 'PINK', 'Rosa'],
  [7, 'WHITE', 'Branco'],
  [8, 'GOLD', 'Dourado'],
]);

/** EGameRoomFurniture: NONE=0 existe mas não deve ser gravado. */
export const FURNITURES = make([
  [1, 'RADIO', 'Rádio'],
  [2, 'WARDROBE', 'Guarda-roupa'],
  [3, 'MIRROR', 'Espelho'],
  [4, 'DISCO', 'Globo de discoteca'],
  [5, 'DOORBELL', 'Campainha'],
  [6, 'DICEBOX_FIREWORK', 'Caixa de dados de fogos'],
  [7, 'DICEBOX_CUBE', 'Caixa de dados cúbica'],
  [8, 'OLD_CLOCK', 'Relógio antigo'],
]);

/** KeyName: `unlockedKeyDoors` só admite 1 e 2 de forma significativa. */
export const KEY_DOORS = make([
  [1, 'Henry', 'Porta do Henry'],
  [2, 'Corridor', 'Porta do Corredor'],
]);

/** BiomeChoice (ordem real do jogo; a spec herdada estava errada). */
export const BIOMES = make([
  [0, 'Vanilla_UnToggle', 'Padrão'],
  [1, 'Frozen', 'Gelo'],
  [2, 'Jungle', 'Selva'],
  [3, 'Desert', 'Deserto'],
  [4, 'Abyss', 'Abismo'],
  [5, 'Ash', 'Cinzas'],
  [6, 'Endless', 'Infinito'],
]);

/** EBoardFeaturedMonster: usado em `completedBoardKeys` ("{BiomeChoice}:{EBoardFeaturedMonster}"). */
export const BOARD_MONSTERS = make([
  [0, 'None', 'Nenhum'],
  [1, 'Hunter', 'Caçador'],
  [2, 'Horseman', 'Cavaleiro'],
  [3, 'Croco', 'Crocodilo'],
  [4, 'Yeti', 'Iéti'],
  [5, 'Plant', 'Planta'],
  [6, 'Ultimate', 'Edição Definitiva'],
  [7, 'Demo', 'Demo'],
  [8, 'Weeping', 'Manequim'],
  [9, 'CursedPlayer', 'Pessoa Amaldiçoada'],
  [10, 'Penguin', 'Pinguim'],
  [11, 'Snowman', 'Boneco de Neve'],
  [12, 'MoneyGuy', 'Abonado'],
  [13, 'Alpinist', 'Alpinista'],
  [14, 'TVGhost', 'Fantasma da TV'],
  [15, 'Pharaoh', 'Faraó'],
  [16, 'SandWorm', 'Minhoca'],
]);

/** EBoardDifficulty: valores 0..4 (Difficulty1..5). */
export const DIFFICULTIES = make([
  [0, 'Difficulty1', '1 estrela'],
  [1, 'Difficulty2', '2 estrelas'],
  [2, 'Difficulty3', '3 estrelas'],
  [3, 'Difficulty4', '4 estrelas'],
  [4, 'Difficulty5', '5 estrelas'],
]);

/** MonsterCollectionId: o bit k de `collection.monsterFigurines` liga a figura k. 17 bits válidos. */
export const FIGURINES = make([
  [0, 'Alpinist', 'Alpinista'],
  [1, 'BeeSwarm', 'Abelhas'],
  [2, 'Crocodile', 'Crocodilo'],
  [3, 'CursedPlayer', 'Pessoa Amaldiçoada'],
  [4, 'DoorMonster', 'Monstro-porta'],
  [5, 'Horseman', 'Cavaleiro'],
  [6, 'Hunter', 'Caçador'],
  [7, 'Mimic', 'Mímico'],
  [8, 'MoneyGuy', 'Abonado'],
  [9, 'Penguin', 'Pinguim'],
  [10, 'Pharaoh', 'Faraó'],
  [11, 'SandWorm', 'Minhoca'],
  [12, 'Snowman', 'Boneco de Neve'],
  [13, 'Spider', 'Aranha'],
  [14, 'WeepingAngel', 'Manequim'],
  [15, 'Yeti', 'Iéti'],
  [16, 'TVGhost', 'Fantasma da TV'],
]);
export const FIGURINE_MASK = (1 << FIGURINES.length) - 1; // 0x1FFFF

/** Upgrades de personagem: UID e nível máximo (docs/SCHEMA_VERIFIED.md §5). */
export const UPGRADES = [
  { uid: 1, key: 'Health', label: 'Saúde', maxLevel: 8 },
  { uid: 2, key: 'Stamina', label: 'Estamina', maxLevel: 7 },
  { uid: 3, key: 'Speed', label: 'Agilidade', maxLevel: 5 },
  { uid: 5, key: 'DoubleJump', label: 'Pulo duplo', maxLevel: 1 },
  { uid: 6, key: 'InventorySlot', label: 'Pochete', maxLevel: 2 },
] as const;

export const labelOf = (list: readonly EnumEntry[], id: number): string =>
  list.find((e) => e.id === id)?.label ?? `#${id}`;
