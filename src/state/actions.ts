/**
 * Ações de edição sobre o documento (puras: recebem o rascunho do Immer). Cada tela chama estas funções,
 * que mantêm as invariantes do schema 15 (docs/SCHEMA_VERIFIED.md): playerCount ↔ playerInventories,
 * ids ↔ baterias, níveis dentro do máximo etc.
 */
import { findItem, ITEM_CATALOG } from '../catalog/catalog';
import { FIGURINE_MASK, FURNITURES, HERO_COUNT, KEY_DOORS, UPGRADE_KEYS, UPGRADES } from '../schema/enums';
import { SKINS } from '../schema/skins';
import type { InventoryState, SaveValues } from '../schema/types';

type V = SaveValues;

const toBig = (n: bigint | number) => BigInt(n);
/** Mantém `number` quando seguro (como o decoder), `bigint` acima de 2^53. */
const narrow = (b: bigint): bigint | number => (b <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(b) : b);

export const MAX_INT32 = 2147483647;
/** `currentTotalScore` é um `int` assinado no save; 99.999 é só um preset. */
export const MAX_BANK = MAX_INT32;
export const BASE_INVENTORY_SLOTS = 3;
export const MAX_BONUS_INVENTORY_SLOTS = 2;

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

/* ───────── Sessão ───────── */

export const isOccupied = (v: V, hero: number) => toBig(v.meta.characterOwners[hero] ?? 0) !== 0n;
export const occupiedHeroes = (v: V): number[] =>
  Array.from({ length: HERO_COUNT }, (_, h) => h).filter((h) => isOccupied(v, h));

/**
 * Índice de `playerInventories` do herói: ordem de herói entre os ocupados. É uma **hipótese**: o save real só
 * confirma a contagem (docs/SCHEMA_VERIFIED.md §8). Se estiver errada, o jogo liga o inventário ao herói errado.
 */
export const inventoryIndexOf = (v: V, hero: number): number =>
  occupiedHeroes(v).filter((h) => h < hero).length;

/** SteamID64 de conta individual: 17 dígitos na faixa pública da Steam (7656119796… a 7656120225…). */
export const STEAM_ID_MIN = 76561197960265728n;
export const STEAM_ID_MAX = 76561202255233023n;
export const parseSteamId = (text: string): bigint | null => {
  const t = text.trim();
  if (!/^\d{17}$/.test(t)) return null;
  const b = BigInt(t);
  return b >= STEAM_ID_MIN && b <= STEAM_ID_MAX ? b : null;
};

const emptyInventory = (): InventoryState => ({ itemStringIds: [], itemBatteryLevels: [] });

/** Atribui (ou libera, com 0n) o dono de um herói, mantendo playerCount e playerInventories alinhados. */
export function setOwner(d: V, hero: number, steamId: bigint): boolean {
  if (!isInt(hero) || hero < 0 || hero >= HERO_COUNT) return false;
  if (steamId < 0n || steamId > 0xffffffffffffffffn) return false;
  // o mesmo jogador não pode ocupar dois heróis
  if (steamId !== 0n && d.meta.characterOwners.some((o, h) => h !== hero && toBig(o) === steamId))
    return false;
  const wasOccupied = isOccupied(d, hero);
  const willBe = steamId !== 0n;
  if (!willBe && wasOccupied && occupiedHeroes(d).length === 1) return false; // precisa de ao menos 1 jogador
  const pos = inventoryIndexOf(d, hero);
  d.meta.characterOwners[hero] = narrow(steamId);
  if (!wasOccupied && willBe) {
    d.meta.playerCount = occupiedHeroes(d).length;
    d.save.playerInventories.splice(pos, 0, emptyInventory());
  } else if (wasOccupied && !willBe) {
    d.meta.playerCount = occupiedHeroes(d).length;
    d.save.playerInventories.splice(pos, 1);
  }
  return true;
}

export function setClothColor(d: V, hero: number, color: number): void {
  if (!isInt(hero) || hero < 0 || hero >= HERO_COUNT || !isInt(color) || color < 0 || color > 8) return;
  const entry = d.save.playerColors.find((c) => c.playerCharacter === hero);
  if (entry) entry._color = color;
  else d.save.playerColors.push({ playerCharacter: hero, _color: color });
}

/* ───────── Upgrades ───────── */

export const upgradeList = (d: V, hero: number) => {
  const key = UPGRADE_KEYS[hero];
  if (!key) throw new Error(`Herói inválido: ${hero}`);
  const lists = d.save.upgrades;
  if (!lists[key]) lists[key] = [];
  return lists[key];
};

export function getUpgradeLevel(v: V, hero: number, uid: number): number {
  const key = UPGRADE_KEYS[hero];
  return (key && v.save.upgrades[key]?.find((u) => u.x === uid)?.y) || 0;
}

/** Consulta pura para a UI: evita reduzir slots de um inventário possivelmente associado ao herói. */
export function canSetUpgradeLevel(v: V, hero: number, uid: number, level: number): boolean {
  const def = UPGRADES.find((u) => u.uid === uid);
  if (!def || !isInt(hero) || hero < 0 || hero >= HERO_COUNT || !Number.isFinite(level)) return false;
  const lvl = Math.max(0, Math.min(def.maxLevel, Math.trunc(level)));
  if (uid !== 6 || lvl >= getUpgradeLevel(v, hero, uid) || !isOccupied(v, hero)) return true;
  const safeLimit = BASE_INVENTORY_SLOTS + lvl;
  const certain = certainHeroForInventory(v, 0);
  // Com mais de um jogador, qualquer inventário pode pertencer ao herói que perderia o bônus.
  const affected = certain === hero ? v.save.playerInventories.slice(0, 1) : v.save.playerInventories;
  return !affected.some((inv) => (inv?.itemStringIds.length ?? 0) > safeLimit);
}

export function setUpgradeLevel(d: V, hero: number, uid: number, level: number): boolean {
  const def = UPGRADES.find((u) => u.uid === uid);
  if (!def) throw new Error(`UID de upgrade desconhecido: ${uid}`);
  if (!canSetUpgradeLevel(d, hero, uid, level)) return false;
  const lvl = Math.max(0, Math.min(def.maxLevel, Math.trunc(level)));
  const list = upgradeList(d, hero);
  // remove duplicatas pré-existentes do mesmo UID: sobra no máximo uma entrada
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]?.x === uid && (lvl === 0 || list.findIndex((u) => u.x === uid) !== i)) list.splice(i, 1);
  }
  const entry = list.find((u) => u.x === uid);
  if (lvl === 0) return true;
  if (entry) (entry as { y: number }).y = lvl;
  else list.push({ x: uid, y: lvl });
  return true;
}

export const maximizeHero = (d: V, hero: number) => {
  for (const u of UPGRADES) setUpgradeLevel(d, hero, u.uid, u.maxLevel);
};
export const maximizeAllHeroes = (d: V) => {
  for (let h = 0; h < HERO_COUNT; h++) maximizeHero(d, h);
};

/* ───────── Inventários ───────── */

export type ItemTarget = { kind: 'player'; index: number } | { kind: 'bench' };

/** Só um jogador ocupado + um inventário tem vínculo herói↔inventário inequívoco. */
function certainHeroForInventory(v: V, index: number): number | null {
  if (index !== 0 || v.meta.playerCount !== 1 || v.save.playerInventories.length !== 1) return null;
  const owners = v.meta.characterOwners;
  if (!Array.isArray(owners) || owners.length !== HERO_COUNT) return null;
  let hero: number | null = null;
  for (let i = 0; i < owners.length; i++) {
    const owner = owners[i];
    if (owner === 0 || owner === 0n) continue;
    if (typeof owner !== 'bigint' && !(typeof owner === 'number' && Number.isSafeInteger(owner))) return null;
    if (hero !== null) return null;
    hero = i;
  }
  return hero;
}

/** `certain=false` limita só novas adições; saves existentes podem ter Pochete válida. */
export function inventoryCapacity(v: V, t: ItemTarget): { limit: number; certain: boolean } | null {
  if (t.kind === 'bench' || !isInt(t.index) || t.index < 0 || !v.save.playerInventories[t.index]) return null;
  const hero = certainHeroForInventory(v, t.index);
  if (hero === null) return { limit: BASE_INVENTORY_SLOTS, certain: false };
  const level = getUpgradeLevel(v, hero, 6);
  const bonus = isInt(level) && level >= 0 && level <= MAX_BONUS_INVENTORY_SLOTS ? level : 0;
  return { limit: BASE_INVENTORY_SLOTS + bonus, certain: true };
}

export function inventoryOf(d: V, t: ItemTarget): InventoryState | undefined {
  return t.kind === 'bench' ? d.save.gameRoomTools : d.save.playerInventories[t.index];
}

export const batteryOf = (alias: string) => ITEM_CATALOG.find((i) => i.alias === alias)?.battery ?? null;

export function addItem(d: V, t: ItemTarget, alias: string): boolean {
  const inv = inventoryOf(d, t);
  const item = findItem(alias);
  if (!inv || !item?.selectable) return false;
  const capacity = inventoryCapacity(d, t);
  if (capacity && inv.itemStringIds.length >= capacity.limit) return false;
  inv.itemStringIds.push(alias);
  inv.itemBatteryLevels.push(batteryOf(alias) ? 1 : -1);
  return true;
}

export function removeItem(d: V, t: ItemTarget, index: number): void {
  const inv = inventoryOf(d, t);
  if (!inv || index < 0 || index >= inv.itemStringIds.length) return;
  inv.itemStringIds.splice(index, 1);
  inv.itemBatteryLevels.splice(index, 1);
}

/** `level01` em 0..1 (a UI trabalha em porcentagem). Itens sem bateria mantêm -1. */
export function setBattery(d: V, t: ItemTarget, index: number, level01: number): void {
  if (!Number.isFinite(level01)) return;
  const inv = inventoryOf(d, t);
  const alias = inv?.itemStringIds[index];
  if (!inv || alias === undefined || !batteryOf(alias)) return;
  inv.itemBatteryLevels[index] = Math.max(0, Math.min(1, Math.fround(level01)));
}

/* ───────── Hub ───────── */

export function setFurniture(d: V, id: number, on: boolean): void {
  if (!FURNITURES.some((f) => f.id === id)) return;
  const list = d.save.furnitures.furnitures;
  const i = list.indexOf(id);
  if (on && i < 0) list.push(id);
  else if (!on && i >= 0) list.splice(i, 1);
}
export const unlockAllFurnitures = (d: V) => {
  for (const f of FURNITURES) setFurniture(d, f.id, true);
};

export function setDoor(d: V, id: number, on: boolean): void {
  if (!KEY_DOORS.some((k) => k.id === id)) return;
  const list = d.save.unlockedKeyDoors;
  const i = list.indexOf(id);
  if (on && i < 0) list.push(id);
  else if (!on && i >= 0) list.splice(i, 1);
}
export const unlockAllDoors = (d: V) => {
  for (const k of KEY_DOORS) setDoor(d, k.id, true);
};

export const setSkin = (d: V, index: number) => {
  if (isInt(index) && index >= 0 && index < SKINS.length) d.save.gameRoomSkinIndex = index;
};

/* ───────── Coleção ───────── */

export const hasFigurine = (v: V, bit: number) => ((v.collection.monsterFigurines >>> bit) & 1) === 1;
export function setFigurine(d: V, bit: number, on: boolean): void {
  if (!isInt(bit) || bit < 0 || bit > 16) return;
  const cur = d.collection.monsterFigurines >>> 0;
  d.collection.monsterFigurines = (on ? cur | (1 << bit) : cur & ~(1 << bit)) >>> 0;
}
export const setAllFigurines = (d: V, on: boolean) => {
  d.collection.monsterFigurines = on ? FIGURINE_MASK : 0;
};

export function setBoardDifficulty(d: V, boardKey: string, difficulty: number): void {
  if (!Number.isFinite(difficulty)) return;
  const list = d.collection.bestBoardDifficulties;
  const e = list.find((b) => b.boardKey === boardKey);
  const diff = Math.max(0, Math.min(4, Math.trunc(difficulty)));
  if (e) e.difficulty = diff;
  else list.push({ boardKey, difficulty: diff });
}

export const setEndlessRank = (d: V, rank: number) => {
  if (!Number.isFinite(rank)) return;
  d.collection.bestEndlessRank = Math.max(0, Math.min(MAX_INT32, Math.trunc(rank)));
};

export const clearHouseRules = (d: V) => {
  d.collection.completedHouseRuleIds = [];
};

/* ───────── Banco e presets ───────── */

export const setBank = (d: V, n: number): boolean => {
  if (!isInt(n) || n < 0 || n > MAX_BANK) return false;
  d.save.bank.currentTotalScore = n;
  return true;
};

export function godMode(d: V): void {
  setBank(d, 99999);
  unlockAllDoors(d);
  unlockAllFurnitures(d);
  maximizeAllHeroes(d);
  setAllFigurines(d, true);
  for (const alias of ['g_fire', 'g_hgun']) {
    if (!d.save.gameRoomTools.itemStringIds.includes(alias)) addItem(d, { kind: 'bench' }, alias);
  }
}

/** Prepara uma partida limpa: rodada 0 e inventários da run vazios. Preserva upgrades e mobílias. */
export function resetRun(d: V): void {
  d.meta.roundIndex = 0;
  for (const inv of d.save.playerInventories) {
    inv.itemStringIds.splice(0);
    inv.itemBatteryLevels.splice(0);
  }
}

export function openAllPassages(d: V): void {
  unlockAllDoors(d);
  unlockAllFurnitures(d);
}
