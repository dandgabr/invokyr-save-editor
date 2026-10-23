import { describe, expect, it } from 'vitest';
import { CATEGORY_LABELS, ITEM_CATALOG, SELECTABLE_ITEMS, searchItems } from '../src/catalog/catalog';

describe('catálogo oferecido pelo editor', () => {
  it('oferece somente itens oficiais das quatro categorias permitidas', () => {
    expect(SELECTABLE_ITEMS).toHaveLength(64);
    expect(SELECTABLE_ITEMS.every((item) => item.available && item.selectable)).toBe(true);
    expect(new Set(SELECTABLE_ITEMS.map((item) => item.category))).toEqual(
      new Set(['dice', 'gadget', 'treasure', 'key']),
    );
    expect(ITEM_CATALOG.some((item) => item.category === 'plain-dice' && !item.selectable)).toBe(true);
    expect(ITEM_CATALOG.some((item) => item.category === 'other' && !item.selectable)).toBe(true);
    expect(CATEGORY_LABELS.dice).toBe('Dados');
  });

  it('dá a cada item oferecido uma descrição com origem explícita', () => {
    for (const item of SELECTABLE_ITEMS) {
      expect(item.desc?.trim(), item.alias).toBeTruthy();
      expect(['game', 'editorial', 'unknown'], item.alias).toContain(item.descriptionSource);
    }
    expect(SELECTABLE_ITEMS.find((item) => item.alias === 'g_camera')?.descriptionSource).toBe('game');
    expect(SELECTABLE_ITEMS.find((item) => item.alias === 'dice_tp')?.descriptionSource).toBe('editorial');
    expect(
      SELECTABLE_ITEMS.every(
        (item) =>
          !/resultado exato não confirmado|alcance e duração não confirmados/i.test(
            item.descriptions['pt-BR'] ?? '',
          ),
      ),
    ).toBe(true);
  });

  it('não pesquisa por alias oculto ao usuário', () => {
    expect(searchItems(SELECTABLE_ITEMS, 'dice_tp')).toEqual([]);
    expect(searchItems(SELECTABLE_ITEMS, 'teletransporte').some((item) => item.alias === 'dice_tp')).toBe(
      true,
    );
  });
});
