import { findItem } from '../catalog/catalog';
import {
  BASE_INVENTORY_SLOTS,
  inventoryCapacity,
  MAX_BANK,
  MAX_BONUS_INVENTORY_SLOTS,
} from '../state/actions';
import {
  CLOTH_COLORS,
  FIGURINE_MASK,
  FURNITURES,
  HERO_COUNT,
  KEY_DOORS,
  UPGRADE_KEYS,
  UPGRADES,
} from './enums';
import { SKINS } from './skins';
import type { InventoryState, SaveValues } from './types';

export const SUPPORTED_SCHEMA_VERSION = 15;

export interface Issue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

const err = (path: string, message: string): Issue => ({ severity: 'error', path, message });
const warn = (path: string, message: string): Issue => ({ severity: 'warning', path, message });

/** BigInt seguro: nunca lança com null/fração (dados de saves não confiáveis). */
const asBig = (v: unknown): bigint | null => {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' && Number.isInteger(v)) return BigInt(v);
  return null;
};

function checkInventory(inv: InventoryState | undefined, path: string, out: Issue[]) {
  if (!inv) return out.push(err(path, 'Inventário ausente'));
  const ids = inv.itemStringIds ?? [];
  const bat = inv.itemBatteryLevels ?? [];
  if (ids.length !== bat.length) {
    out.push(
      err(
        path,
        `itemStringIds (${ids.length}) e itemBatteryLevels (${bat.length}) devem ter o mesmo tamanho`,
      ),
    );
  }
  ids.forEach((id, i) => {
    const item = findItem(id);
    if (!item) {
      out.push(
        warn(`${path}.itemStringIds[${i}]`, 'Item não reconhecido pelo catálogo do jogo; valor preservado'),
      );
      return;
    }
    const b = bat[i];
    if (typeof b !== 'number' || !Number.isFinite(b)) {
      out.push(err(`${path}.itemBatteryLevels[${i}]`, 'Carga inválida (não é um número finito)'));
    } else if (item.battery ? !(b >= 0 && b <= 1) : b !== -1) {
      out.push(
        warn(
          `${path}.itemBatteryLevels[${i}]`,
          item.battery
            ? `Carga ${b} fora de 0..1 para um item com bateria`
            : `Item sem bateria deve ter carga -1 (tem ${b})`,
        ),
      );
    }
  });
}

/** Avisa se a versão do schema não é a que este editor conhece (o jogo não parece recusar versões diferentes). */
export function checkVersion(v: Pick<SaveValues, 'save'>): Issue | null {
  const ver = v.save?.version;
  if (ver === SUPPORTED_SCHEMA_VERSION) return null;
  return warn(
    'save.version',
    `Versão de save ${ver} (este editor conhece a ${SUPPORTED_SCHEMA_VERSION}). Edite com cuidado.`,
  );
}

export function validate(v: SaveValues): Issue[] {
  const out: Issue[] = [];
  const { meta, save, collection } = v;

  const ver = checkVersion(v);
  if (ver) out.push(ver);

  const owners = meta.characterOwners ?? [];
  if (owners.length !== HERO_COUNT)
    out.push(
      err('meta.characterOwners', `Deve ter exatamente ${HERO_COUNT} posições (tem ${owners.length})`),
    );
  if (!(meta.playerCount >= 1 && meta.playerCount <= HERO_COUNT)) {
    out.push(err('meta.playerCount', `playerCount ${meta.playerCount} fora de 1..${HERO_COUNT}`));
  }
  const seen = new Set<bigint>();
  let filled = 0;
  owners.forEach((o, i) => {
    const b = asBig(o);
    if (b === null || b < 0n) return void out.push(err(`meta.characterOwners[${i}]`, 'SteamID64 inválido'));
    if (b === 0n) return;
    filled++;
    if (seen.has(b))
      out.push(err(`meta.characterOwners[${i}]`, 'O mesmo SteamID64 aparece em mais de um herói'));
    seen.add(b);
  });
  if (filled !== meta.playerCount)
    out.push(
      warn('meta.characterOwners', `${filled} heróis com dono, mas playerCount é ${meta.playerCount}`),
    );

  const invs = save.playerInventories ?? [];
  if (invs.length !== meta.playerCount) {
    out.push(
      err(
        'save.playerInventories',
        `${invs.length} inventários para playerCount ${meta.playerCount} (devem ser iguais)`,
      ),
    );
  }
  invs.forEach((inv, i) => {
    const path = `save.playerInventories[${i}]`;
    checkInventory(inv, path, out);
    const count = inv?.itemStringIds?.length;
    if (!Number.isInteger(count)) return;
    const cap = inventoryCapacity(v, { kind: 'player', index: i });
    const provenLimit = cap?.certain ? cap.limit : BASE_INVENTORY_SLOTS + MAX_BONUS_INVENTORY_SLOTS;
    if ((count as number) > provenLimit) {
      out.push(err(path, `${count} itens excedem a capacidade comprovada de ${provenLimit} slots`));
    }
  });
  checkInventory(save.gameRoomTools, 'save.gameRoomTools', out);

  const skin = save.gameRoomSkinIndex;
  if (!(Number.isInteger(skin) && skin >= 0 && skin < SKINS.length)) {
    out.push(err('save.gameRoomSkinIndex', `Skin ${skin} fora de 0..${SKINS.length - 1}`));
  }
  const colors = new Set(CLOTH_COLORS.map((c) => c.id));
  (save.playerColors ?? []).forEach((c, i) => {
    if (!colors.has(c._color))
      out.push(
        err(`save.playerColors[${i}]._color`, `Cor ${c._color} inválida (0..${CLOTH_COLORS.length - 1})`),
      );
    if (!(Number.isInteger(c.playerCharacter) && c.playerCharacter >= -1 && c.playerCharacter < HERO_COUNT)) {
      out.push(err(`save.playerColors[${i}].playerCharacter`, `Herói ${c.playerCharacter} inválido`));
    }
  });

  const furn = save.furnitures?.furnitures ?? [];
  const validFurn = new Set(FURNITURES.map((f) => f.id));
  furn.forEach((f, i) => {
    if (!validFurn.has(f))
      out.push(
        err(`save.furnitures.furnitures[${i}]`, `Mobília ${f} inválida (use 1..${FURNITURES.length})`),
      );
  });
  if (new Set(furn).size !== furn.length) out.push(warn('save.furnitures.furnitures', 'Mobílias repetidas'));

  const doors = save.unlockedKeyDoors ?? [];
  const validDoor = new Set(KEY_DOORS.map((d) => d.id));
  doors.forEach((d, i) => {
    if (!validDoor.has(d))
      out.push(
        warn(
          `save.unlockedKeyDoors[${i}]`,
          `Chave ${d} desconhecida (válidas: ${[...validDoor].join(', ')})`,
        ),
      );
  });
  if (new Set(doors).size !== doors.length) out.push(warn('save.unlockedKeyDoors', 'Portas repetidas'));

  UPGRADE_KEYS.forEach((key) => {
    const list = save.upgrades?.[key] ?? [];
    const seenUid = new Set<number>();
    list.forEach((u, i) => {
      const def = UPGRADES.find((x) => x.uid === u.x);
      const p = `save.upgrades.${key}[${i}]`;
      if (!def) out.push(warn(p, `UID de upgrade ${u.x} desconhecido`));
      else if (!(Number.isInteger(u.y) && u.y >= 1 && u.y <= def.maxLevel))
        out.push(err(p, `${def.label}: nível ${u.y} fora de 1..${def.maxLevel}`));
      if (seenUid.has(u.x)) out.push(err(p, `Upgrade ${u.x} repetido para o mesmo herói`));
      seenUid.add(u.x);
    });
  });

  const fig = collection.monsterFigurines;
  if (!Number.isInteger(fig) || fig < 0 || fig > FIGURINE_MASK || (fig & ~FIGURINE_MASK) !== 0) {
    out.push(
      err('collection.monsterFigurines', `Bits fora da máscara válida 0x${FIGURINE_MASK.toString(16)}`),
    );
  }
  collection.completedBoardKeys?.forEach((k, i) => {
    if (!/^\d+:\d+$/.test(k))
      out.push(
        err(`collection.completedBoardKeys[${i}]`, `Formato inválido "${k}" (esperado "bioma:monstro")`),
      );
  });
  collection.bestBoardDifficulties?.forEach((b, i) => {
    if (!(b.difficulty >= 0 && b.difficulty <= 4))
      out.push(warn(`collection.bestBoardDifficulties[${i}]`, `Dificuldade ${b.difficulty} fora de 0..4`));
  });
  const bank = save.bank?.currentTotalScore;
  if (!Number.isInteger(bank) || bank < 0 || bank > MAX_BANK)
    out.push(err('save.bank.currentTotalScore', `Saldo deve ser inteiro entre 0 e ${MAX_BANK}`));
  return out;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.severity === 'error');
