// Gera src/catalog/items.generated.ts a partir de docs/schema-items.json (extraído do jogo, build 26154962).
// Uso: node scripts/gen-catalog.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const src = JSON.parse(readFileSync(new URL('../docs/schema-items.json', import.meta.url), 'utf-8'));

const pretty = (assetName) =>
  assetName
    .replace(/^Data-/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim();

function categoryOf(alias) {
  if (alias.startsWith('k_')) return 'key';
  if (alias.startsWith('g_')) return 'gadget';
  if (alias.startsWith('tr_')) return 'treasure';
  if (/^dice_/.test(alias)) return 'dice';
  if (/^(dice|normal|cursed|blessed|blursed|superblessed|supercursed|haz|heal|lightcursed)/.test(alias)) return 'plain-dice';
  return 'other';
}

const byAlias = new Map();
for (const it of src.items) {
  if (!it.itemAlias) continue; // 20 assets sem alias não são gravados no save
  const prev = byAlias.get(it.itemAlias);
  const better = (a, b) => (a.inAvailableTools ? 1 : 0) + (a.name?.['pt-BR'] ? 1 : 0) > (b.inAvailableTools ? 1 : 0) + (b.name?.['pt-BR'] ? 1 : 0);
  if (!prev || better(it, prev)) byAlias.set(it.itemAlias, it);
}

const rows = [...byAlias.values()]
  .map((it) => ({
    alias: it.itemAlias,
    asset: it.m_Name,
    label: it.name?.['pt-BR'] ?? pretty(it.m_Name),
    localized: Boolean(it.name?.['pt-BR']),
    desc: it.desc?.['pt-BR'] ?? null,
    category: categoryOf(it.itemAlias),
    available: Boolean(it.inAvailableTools),
    battery: it.battery ? { capacity: it.battery.capacity, drainPerSecond: it.battery.drainPerSecond } : null,
  }))
  .sort((a, b) => a.category.localeCompare(b.category) || a.alias.localeCompare(b.alias));

const header = `// GERADO por scripts/gen-catalog.mjs a partir de docs/schema-items.json (build Steam ${src.meta.gameBuild}). Não edite.\n`;
const body = `
export type ItemCategory = 'dice' | 'plain-dice' | 'gadget' | 'treasure' | 'key' | 'other';

export interface CatalogItem {
  /** Valor gravado em itemStringIds no save. */
  alias: string;
  asset: string;
  /** Nome em pt-BR (ou derivado do asset quando o jogo não tem nome localizado). */
  label: string;
  localized: boolean;
  desc: string | null;
  category: ItemCategory;
  /** Presente em ItemManager.availableTools (item "oficial"). */
  available: boolean;
  /** Só 6 itens têm bateria: drenam \`drainPerSecond\` por segundo, a partir de 1.0. */
  battery: { capacity: number; drainPerSecond: number } | null;
}

export const ITEM_CATALOG: readonly CatalogItem[] = ${JSON.stringify(rows, null, 2)};
`;
writeFileSync(new URL('../src/catalog/items.generated.ts', import.meta.url), header + body);
console.log(`${rows.length} itens (${rows.filter((r) => r.battery).length} com bateria)`);
