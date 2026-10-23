import type { CsType } from '../codec/msgpack';
import type { StreamName } from '../codec/zip';

/**
 * Tipo C# por caminho (com curingas). O serializer do jogo grava inteiros em largura fixa conforme o tipo
 * (int → int16/32/64, uint → uint16, ulong → uint64); campos novos seguem a mesma regra.
 * Fonte: docs/SCHEMA_VERIFIED.md §3.
 */
const TYPES: Record<StreamName, Record<string, CsType>> = {
  meta: {
    savedAtUtcTicks: 'long',
    roundIndex: 'int',
    endlessRank: 'int',
    playTimeSeconds: 'int',
    score: 'int',
    playerCount: 'int',
    'characterOwners[*]': 'ulong',
  },
  save: {
    version: 'int',
    'bank.currentTotalScore': 'int',
    'shop.visitCount': 'int',
    'shop.completedBoardsAnchorIndexes[*]': 'int',
    'shop.completedBoardsConfigurations[*].biome': 'int',
    'shop.completedBoardsConfigurations[*].difficulty': 'int',
    'shop.completedBoardsConfigurations[*].featuredMonster': 'int',
    'shop.boardOffersSeed': 'int',
    'shop.completedMonsterRounds[*][*]': 'int',
    'shop.shopItemsUIDs[*]': 'int',
    'shop.shopItemInfos[*].boughtCount': 'int',
    'furnitures.furnitures[*]': 'int',
    'playerInventories[*].itemBatteryLevels[*]': 'float',
    'playerColors[*].playerCharacter': 'int',
    'playerColors[*]._color': 'int',
    gameRoomSkinIndex: 'int',
    'gameRoomTools.itemBatteryLevels[*]': 'float',
    playTimeSeconds: 'float',
    'unlockedKeyDoors[*]': 'int',
  },
  collection: {
    bestEndlessRank: 'int',
    monsterFigurines: 'uint',
    'bestBoardDifficulties[*].difficulty': 'int',
  },
};

for (const hero of ['red', 'specs', 'tank', 'ziggy', 'carl', 'bobby', 'susan', 'lily']) {
  TYPES.save[`upgrades.${hero}Upgrades[*].x`] = 'int';
  TYPES.save[`upgrades.${hero}Upgrades[*].y`] = 'int';
}

export const csTypeOf =
  (stream: StreamName) =>
  (path: string): CsType | undefined =>
    TYPES[stream][path];
