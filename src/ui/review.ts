import { findItem, itemName } from '../catalog/catalog';
import { type Locale, selectText } from '../i18n';
import { enumNameOf, localizedName } from '../i18n-labels';
import {
  BIOMES,
  BOARD_MONSTERS,
  FURNITURES,
  HEROES,
  KEY_DOORS,
  UPGRADE_KEYS,
  UPGRADES,
} from '../schema/enums';
import type { SaveValues } from '../schema/types';
import type { Change } from '../state/document';

export interface ReviewChange extends Change {
  label?: string;
  beforeText?: string;
  afterText?: string;
}

const counts = <T extends number | string>(values: readonly T[]): Map<T, number> => {
  const result = new Map<T, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
};

const boardName = (key: string, locale: Locale): string => {
  const [biome, monster] = key.split(':').map(Number);
  return `${enumNameOf(BIOMES, biome ?? -1, locale)} • ${enumNameOf(BOARD_MONSTERS, monster ?? -1, locale)}`;
};

/**
 * Present list edits by stable game identity. Index-by-index diffs are correct
 * binary edits but misleading when removing an element shifts later entries.
 */
export function reviewChanges(
  changes: readonly Change[],
  original: SaveValues,
  current: SaveValues,
  locale: Locale,
): ReviewChange[] {
  const tr = (en: string, pt: string, es: string) => selectText(locale, en, pt, es);
  const semantic: ReviewChange[] = [];
  const hiddenPrefixes: string[] = [];
  const hasPrefix = (prefix: string) => changes.some((change) => change.path.startsWith(prefix));

  function listDiff<T extends number | string>(
    prefix: string,
    oldValues: readonly T[],
    newValues: readonly T[],
    labelOf: (value: T) => string,
    beforeState?: string,
    afterState?: string,
  ) {
    if (!hasPrefix(prefix)) return;
    const oldCounts = counts(oldValues);
    const newCounts = counts(newValues);
    if (
      [...new Set([...oldCounts.keys(), ...newCounts.keys()])].every(
        (value) => oldCounts.get(value) === newCounts.get(value),
      )
    )
      return; // Reordering only: retain the exact positional diff.
    hiddenPrefixes.push(prefix);
    for (const value of new Set([...oldCounts.keys(), ...newCounts.keys()])) {
      const before = oldCounts.get(value) ?? 0;
      const after = newCounts.get(value) ?? 0;
      if (before === after) continue;
      semantic.push({
        path: `review:${prefix}:${value}`,
        label: labelOf(value),
        before,
        after,
        beforeText: beforeState && afterState ? (before ? beforeState : afterState) : undefined,
        afterText: beforeState && afterState ? (after ? beforeState : afterState) : undefined,
      });
    }
  }

  listDiff(
    'save.unlockedKeyDoors',
    original.save.unlockedKeyDoors,
    current.save.unlockedKeyDoors,
    (id) =>
      `${tr('Locked passages', 'Passagens com chave', 'Pasajes con llave')} • ${localizedName(KEY_DOORS.find((door) => door.id === id)?.label ?? tr('unknown door', 'porta desconhecida', 'puerta desconocida'), locale)}`,
    tr('Unlocked', 'Destrancada', 'Desbloqueada'),
    tr('Locked', 'Trancada', 'Bloqueada'),
  );
  listDiff(
    'save.furnitures.furnitures',
    original.save.furnitures.furnitures,
    current.save.furnitures.furnitures,
    (id) =>
      `${tr('Library furniture', 'Mobílias da biblioteca', 'Muebles de la biblioteca')} • ${localizedName(FURNITURES.find((item) => item.id === id)?.label ?? tr('unknown furniture', 'mobília desconhecida', 'mueble desconocido'), locale)}`,
    tr('Unlocked', 'Desbloqueada', 'Desbloqueado'),
    tr('Locked', 'Bloqueada', 'Bloqueado'),
  );
  listDiff(
    'collection.completedBoardKeys',
    original.collection.completedBoardKeys,
    current.collection.completedBoardKeys,
    (key) =>
      `${tr('Completed boards', 'Tabuleiros concluídos', 'Tableros completados')} • ${boardName(key, locale)}`,
    tr('Completed', 'Concluído', 'Completado'),
    tr('Not completed', 'Não concluído', 'No completado'),
  );

  for (let heroIndex = 0; heroIndex < UPGRADE_KEYS.length; heroIndex++) {
    const key = UPGRADE_KEYS[heroIndex]!;
    const prefix = `save.upgrades.${key}`;
    if (!hasPrefix(prefix)) continue;
    const oldList = original.save.upgrades[key] ?? [];
    const newList = current.save.upgrades[key] ?? [];
    // Duplicate UIDs are invalid saves; keep the raw diff rather than collapse them.
    if (
      new Set(oldList.map((entry) => entry.x)).size !== oldList.length ||
      new Set(newList.map((entry) => entry.x)).size !== newList.length
    )
      continue;
    hiddenPrefixes.push(prefix);
    const oldLevels = new Map(oldList.map((entry) => [entry.x, entry.y]));
    const newLevels = new Map(newList.map((entry) => [entry.x, entry.y]));
    for (const uid of new Set([...oldLevels.keys(), ...newLevels.keys()])) {
      const before = oldLevels.get(uid) ?? 0;
      const after = newLevels.get(uid) ?? 0;
      if (before === after) continue;
      const upgrade = UPGRADES.find((entry) => entry.uid === uid);
      semantic.push({
        path: `review:${prefix}:${uid}`,
        label: `${tr('Hero upgrades', 'Upgrades dos heróis', 'Mejoras de héroes')} • ${HEROES[heroIndex]?.label} • ${upgrade ? localizedName(upgrade.label, locale) : tr('Unknown upgrade', 'Upgrade desconhecido', 'Mejora desconocida')}`,
        before,
        after,
      });
    }
  }

  const inventories = [
    ...original.save.playerInventories.map((_, index) => ({
      prefix: `save.playerInventories[${index}]`,
      old: original.save.playerInventories[index],
      now: current.save.playerInventories[index],
      place: `${tr('Carried items', 'Itens carregados', 'Objetos cargados')} • ${tr('player', 'jogador', 'jugador')} ${index + 1}`,
    })),
    {
      prefix: 'save.gameRoomTools',
      old: original.save.gameRoomTools,
      now: current.save.gameRoomTools,
      place: tr(
        'Tools on the bench/shelf',
        'Ferramentas na bancada/prateleira',
        'Herramientas en la mesa/estante',
      ),
    },
  ];
  let unknownNumber = 0;
  for (const inventory of inventories) {
    if (!inventory.old || !inventory.now) continue;
    const prefix = `${inventory.prefix}.itemStringIds`;
    if (!hasPrefix(prefix)) continue;
    const oldIds = inventory.old.itemStringIds;
    const newIds = inventory.now.itemStringIds;
    const oldCounts = counts(oldIds);
    const newCounts = counts(newIds);
    if (
      [...new Set([...oldCounts.keys(), ...newCounts.keys()])].every(
        (alias) => oldCounts.get(alias) === newCounts.get(alias),
      )
    )
      continue; // Only an order change: retain the exact positional diff.
    hiddenPrefixes.push(prefix, `${inventory.prefix}.itemBatteryLevels`);
    for (const alias of new Set([...oldCounts.keys(), ...newCounts.keys()])) {
      const before = oldCounts.get(alias) ?? 0;
      const after = newCounts.get(alias) ?? 0;
      const item = findItem(alias);
      const name = item
        ? itemName(item, locale)
        : `${tr('Unrecognized item', 'Item não reconhecido', 'Objeto no reconocido')} ${++unknownNumber}`;
      if (before !== after)
        semantic.push({
          path: `review:${inventory.prefix}:${alias}`,
          label: `${inventory.place} • ${name}`,
          before,
          after,
        });
      const oldCharges = oldIds.flatMap((id, index) =>
        id === alias ? [inventory.old!.itemBatteryLevels[index]] : [],
      );
      const newCharges = newIds.flatMap((id, index) =>
        id === alias ? [inventory.now!.itemBatteryLevels[index]] : [],
      );
      const chargeText = (charge: number | undefined) =>
        charge === undefined || charge < 0 ? '—' : `${Math.round(charge * 100)}%`;
      if (before !== after) {
        if ([...oldCharges, ...newCharges].some((charge) => charge !== undefined && charge >= 0))
          semantic.push({
            path: `review:${inventory.prefix}:${alias}:charges`,
            label: `${inventory.place} • ${name} • ${tr('charges', 'cargas', 'cargas')}`,
            before: oldCharges,
            after: newCharges,
            beforeText: oldCharges.map(chargeText).join(', ') || '—',
            afterText: newCharges.map(chargeText).join(', ') || '—',
          });
        continue;
      }
      for (let occurrence = 0; occurrence < Math.min(oldCharges.length, newCharges.length); occurrence++) {
        const oldCharge = oldCharges[occurrence];
        const newCharge = newCharges[occurrence];
        if (oldCharge === newCharge || oldCharge === undefined || newCharge === undefined) continue;
        semantic.push({
          path: `review:${inventory.prefix}:${alias}:charge:${occurrence}`,
          label: `${inventory.place} • ${name} • ${tr('charge', 'carga', 'carga')}`,
          before: oldCharge,
          after: newCharge,
          beforeText: chargeText(oldCharge),
          afterText: chargeText(newCharge),
        });
      }
    }
  }

  return [
    ...changes.filter((change) => !hiddenPrefixes.some((prefix) => change.path.startsWith(prefix))),
    ...semantic,
  ];
}
