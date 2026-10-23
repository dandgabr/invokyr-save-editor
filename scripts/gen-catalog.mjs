// Gera src/catalog/items.generated.ts a partir de docs/schema-items.json (extraído do jogo, build 26154962).
// Uso: node scripts/gen-catalog.mjs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = JSON.parse(readFileSync(new URL('../docs/schema-items.json', import.meta.url), 'utf-8'));
const editorial = JSON.parse(readFileSync(new URL('../docs/item-descriptions.json', import.meta.url), 'utf-8'));
if (editorial.gameBuild !== src.meta.gameBuild) {
  throw new Error(`Descrições da build ${editorial.gameBuild} não correspondem ao catálogo ${src.meta.gameBuild}`);
}

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

const selectableCategories = new Set(['dice', 'gadget', 'treasure', 'key']);
const rows = [...byAlias.values()]
  .map((it) => {
    const category = categoryOf(it.itemAlias);
    const selectable = Boolean(it.inAvailableTools) && selectableCategories.has(category);
    const curated = editorial.items[it.itemAlias];
    const officialDescription = it.desc?.['pt-BR'] || null;
    if (curated && (!curated.description?.trim() || !curated.evidence?.trim())) {
      throw new Error(`Descrição editorial incompleta para ${it.itemAlias}`);
    }
    if (curated && officialDescription) {
      throw new Error(`Descrição editorial desnecessária para ${it.itemAlias}: o jogo já a fornece`);
    }
    if (selectable && !officialDescription && !curated) {
      throw new Error(`Falta descrição para o item selecionável ${it.itemAlias}`);
    }
    return {
      alias: it.itemAlias,
      asset: it.m_Name,
      label: it.name?.['pt-BR'] ?? curated?.label ?? pretty(it.m_Name),
      localized: Boolean(it.name?.['pt-BR']),
      desc: officialDescription ?? curated?.description ?? null,
      descriptionSource: officialDescription ? 'game' : curated ? 'editorial' : 'unknown',
      category,
      available: Boolean(it.inAvailableTools),
      selectable,
      battery: it.battery ? { capacity: it.battery.capacity, drainPerSecond: it.battery.drainPerSecond } : null,
    };
  })
  .sort((a, b) => a.category.localeCompare(b.category) || a.alias.localeCompare(b.alias));

for (const alias of Object.keys(editorial.items)) {
  if (!rows.some((item) => item.alias === alias && item.selectable)) {
    throw new Error(`Descrição editorial sem item selecionável: ${alias}`);
  }
}

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
  /** Descrição oficial quando disponível; nos demais casos, texto editorial identificado. */
  desc: string | null;
  descriptionSource: 'game' | 'editorial' | 'unknown';
  category: ItemCategory;
  /** Presente em ItemManager.availableTools (item "oficial"). */
  available: boolean;
  /** Permitido para novas adições no editor; itens ocultos seguem legíveis no save. */
  selectable: boolean;
  /** Só 6 itens têm bateria: drenam \`drainPerSecond\` por segundo, a partir de 1.0. */
  battery: { capacity: number; drainPerSecond: number } | null;
}

export const ITEM_CATALOG: readonly CatalogItem[] = ${JSON.stringify(rows, null, 2)};
`;
const output = fileURLToPath(new URL('../src/catalog/items.generated.ts', import.meta.url));
writeFileSync(output, header + body);
execFileSync(process.execPath, [fileURLToPath(new URL('../node_modules/@biomejs/biome/bin/biome', import.meta.url)), 'format', '--write', output]);
console.log(`${rows.length} itens (${rows.filter((r) => r.battery).length} com bateria)`);
