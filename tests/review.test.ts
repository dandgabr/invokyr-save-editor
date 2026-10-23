import { describe, expect, it } from 'vitest';
import type { SaveValues } from '../src/schema/types';
import { diffDocs } from '../src/state/document';
import { reviewChanges } from '../src/ui/review';
import template from './fixtures/template.json';

const fixture = () => structuredClone(template) as unknown as SaveValues;

describe('semantic save review', () => {
  it('retains positional changes when a list is only reordered', () => {
    const before = fixture();
    before.save.unlockedKeyDoors = [1, 2];
    const after = structuredClone(before);
    after.save.unlockedKeyDoors = [2, 1];
    const changes = diffDocs(before, after);
    expect(reviewChanges(changes, before, after, 'en-US')).toEqual(changes);
  });

  it('names removed list members instead of shifted indexes', () => {
    const before = fixture();
    before.save.unlockedKeyDoors = [1, 2];
    before.save.furnitures.furnitures = [1, 2];
    const after = structuredClone(before);
    after.save.unlockedKeyDoors = [2];
    after.save.furnitures.furnitures = [2];
    after.collection.completedBoardKeys = ['1:13'];
    after.save.upgrades.redUpgrades = [{ x: 2, y: 2 }];
    after.save.playerInventories[0]!.itemStringIds = ['dice_gather', 'ice'];
    after.save.playerInventories[0]!.itemBatteryLevels = [-1, -1];

    const rows = reviewChanges(diffDocs(before, after), before, after, 'en-US');
    expect(rows.map((row) => row.label)).toEqual(
      expect.arrayContaining([
        "Locked passages • Henry's door",
        'Library furniture • Radio',
        'Completed boards • Jungle • Crocodile',
        'Hero upgrades • Red • Health',
      ]),
    );
    expect(rows.filter((row) => row.label?.startsWith('Locked passages'))).toHaveLength(1);
    expect(rows.filter((row) => row.label?.startsWith('Library furniture'))).toHaveLength(1);
    expect(rows.filter((row) => row.label?.startsWith('Completed boards'))).toHaveLength(1);
    expect(rows.filter((row) => row.label?.startsWith('Carried items'))).toHaveLength(1);
    expect(rows.some((row) => row.label?.includes('Corridor'))).toBe(false);
  });

  it('keeps a charge edit visible when another item is removed', () => {
    const before = fixture();
    before.save.playerInventories[0]!.itemStringIds = ['g_fire', 'dice_tp'];
    before.save.playerInventories[0]!.itemBatteryLevels = [0.5, -1];
    const after = structuredClone(before);
    after.save.playerInventories[0]!.itemStringIds = ['g_fire'];
    after.save.playerInventories[0]!.itemBatteryLevels = [0.8];
    const rows = reviewChanges(diffDocs(before, after), before, after, 'en-US');
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: expect.stringContaining('Flamethrower • charge'),
          beforeText: '50%',
          afterText: '80%',
        }),
      ]),
    );
  });

  it('does not infer a charge edit when removing one of two identical items', () => {
    const before = fixture();
    before.save.playerInventories[0]!.itemStringIds = ['g_fire', 'g_fire'];
    before.save.playerInventories[0]!.itemBatteryLevels = [0.2, 0.8];
    const after = structuredClone(before);
    after.save.playerInventories[0]!.itemStringIds = ['g_fire'];
    after.save.playerInventories[0]!.itemBatteryLevels = [0.8];
    const rows = reviewChanges(diffDocs(before, after), before, after, 'en-US');
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: expect.stringContaining('Flamethrower • charges'),
          beforeText: '20%, 80%',
          afterText: '80%',
        }),
      ]),
    );
    expect(rows.some((row) => row.label?.endsWith('• charge'))).toBe(false);
  });
});
