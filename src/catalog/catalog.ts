import { type CatalogItem, ITEM_CATALOG, type ItemCategory } from './items.generated';

export { type CatalogItem, ITEM_CATALOG, type ItemCategory };

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  dice: 'Dados especiais',
  'plain-dice': 'Dados numéricos',
  gadget: 'Gadgets',
  treasure: 'Tesouros',
  key: 'Chaves',
  other: 'Outros',
};

/** Itens "oficiais" (ItemManager.availableTools). Os demais são internos/de teste. */
export const OFFICIAL_ITEMS = ITEM_CATALOG.filter((i) => i.available);

export const findItem = (alias: string): CatalogItem | undefined =>
  ITEM_CATALOG.find((i) => i.alias === alias);
export const itemLabel = (alias: string): string => findItem(alias)?.label ?? alias;

/** Pesquisa sem acento, em nome, alias e descrição. */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
export function searchItems(items: readonly CatalogItem[], query: string): CatalogItem[] {
  const q = normalize(query.trim());
  if (!q) return [...items];
  return items.filter((i) => normalize(`${i.label} ${i.alias} ${i.desc ?? ''}`).includes(q));
}
