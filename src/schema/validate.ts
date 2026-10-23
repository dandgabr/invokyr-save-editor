import { FIGURINE_MASK, FURNITURES, HERO_COUNT, KEY_DOORS, UPGRADE_KEYS, UPGRADES } from './enums';
import type { InventoryState, SaveValues } from './types';

export const SUPPORTED_SCHEMA_VERSION = 15;

export interface Issue {
  severity: 'error' | 'warning';
  path: string;
  message: string;
}

const err = (path: string, message: string): Issue => ({ severity: 'error', path, message });
const warn = (path: string, message: string): Issue => ({ severity: 'warning', path, message });

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
  bat.forEach((b, i) => {
    if (!(b === -1 || (b >= 0 && b <= 1)))
      out.push(warn(`${path}.itemBatteryLevels[${i}]`, `Carga ${b} fora de -1 ou 0..1`));
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
  const filled = owners.filter((o) => BigInt(o) !== 0n).length;
  if (filled !== meta.playerCount)
    out.push(
      warn('meta.characterOwners', `${filled} heróis com dono, mas playerCount é ${meta.playerCount}`),
    );
  owners.forEach((o, i) => {
    if (BigInt(o) < 0n) out.push(err(`meta.characterOwners[${i}]`, 'SteamID64 negativo'));
  });

  const invs = save.playerInventories ?? [];
  if (invs.length !== meta.playerCount) {
    out.push(
      warn('save.playerInventories', `${invs.length} inventários para playerCount ${meta.playerCount}`),
    );
  }
  invs.forEach((inv, i) => checkInventory(inv, `save.playerInventories[${i}]`, out));
  checkInventory(save.gameRoomTools, 'save.gameRoomTools', out);

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
    const seen = new Set<number>();
    list.forEach((u, i) => {
      const def = UPGRADES.find((x) => x.uid === u.x);
      const p = `save.upgrades.${key}[${i}]`;
      if (!def) out.push(warn(p, `UID de upgrade ${u.x} desconhecido`));
      else if (!(u.y >= 1 && u.y <= def.maxLevel))
        out.push(err(p, `${def.label}: nível ${u.y} fora de 1..${def.maxLevel}`));
      if (seen.has(u.x)) out.push(err(p, `Upgrade ${u.x} repetido para o mesmo herói`));
      seen.add(u.x);
    });
  });

  if (collection.monsterFigurines < 0 || (collection.monsterFigurines & ~FIGURINE_MASK) !== 0) {
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
  if ((save.bank?.currentTotalScore ?? 0) < 0) out.push(err('save.bank.currentTotalScore', 'Saldo negativo'));
  return out;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.severity === 'error');
