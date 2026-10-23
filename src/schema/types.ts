/** Formato do save (schema 15), conforme docs/SCHEMA_VERIFIED.md §3. */

export interface SaveMetadata {
  savedAtUtcTicks: bigint | number;
  roundIndex: number;
  endlessRank: number;
  /** `int` no jogo (não Single). */
  playTimeSeconds: number;
  score: number;
  playerCount: number;
  /** SteamID64 por herói (8 posições; 0 = vago). */
  characterOwners: (bigint | number)[];
}

export interface UpgradeEntry {
  /** UID do CharacterUpgrade. */
  x: number;
  /** Nível adquirido (limitado ao MaxLevel). */
  y: number;
}

export interface InventoryState {
  itemStringIds: string[];
  itemBatteryLevels: number[];
}

export interface SaveData {
  version: number;
  bank: { currentTotalScore: number };
  shop: {
    visitCount: number;
    completedBoardsAnchorIndexes: number[];
    completedBoardsConfigurations: { biome: number; difficulty: number; featuredMonster: number }[];
    boardOffersSeed: number;
    boardOffersSolo: boolean;
    completedMonsterRounds: [number, number][];
    shopItemsUIDs: number[];
    shopItemInfos: { boughtCount: number }[];
  };
  upgrades: Record<string, UpgradeEntry[]>;
  furnitures: { furnitures: number[] };
  playerInventories: InventoryState[];
  playerColors: { playerCharacter: number; _color: number }[];
  gameRoomSkinIndex: number;
  gameRoomTools: InventoryState;
  playTimeSeconds: number;
  unlockedKeyDoors: number[];
}

export interface CollectionSaveData {
  bestEndlessRank: number;
  /** `uint`: bitmask de MonsterCollectionId (17 bits válidos). */
  monsterFigurines: number;
  completedBoardKeys: string[];
  completedHouseRuleIds: string[];
  bestBoardDifficulties: { boardKey: string; difficulty: number }[];
}

export interface SaveValues {
  meta: SaveMetadata;
  save: SaveData;
  collection: CollectionSaveData;
}
