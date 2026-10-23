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

// Assets without I2 names: editorial labels, not claims about item effects.
const editorialNames = {
  dice_push: ['Push Die', 'Dado de Empuje'],
  dice_smoke: ['Smoke Die', 'Dado de Humo'],
  g_trap: ['Steel Jaw Trap', 'Trampa de Mandíbulas'],
  tr_blind: ['Blindness Treasure', 'Tesoro de Ceguera'],
  tr_camera: ['Camera Treasure', 'Tesoro de Cámara'],
  tr_dice_thrower: ['Dice Thrower Treasure', 'Tesoro Lanzador de Dados'],
  tr_final: ['Final Treasure', 'Tesoro Final'],
  tr_flame: ['Flame Treasure', 'Tesoro de Llamas'],
  tr_hallucination: ['Hallucination Treasure', 'Tesoro de Alucinación'],
  tr_heavy: ['Heavy Treasure', 'Tesoro Pesado'],
  tr_invertview: ['Inverted Vision Treasure', 'Tesoro de Visión Invertida'],
  tr_lightning: ['Lightning Treasure', 'Tesoro de Relámpago'],
  tr_linked: ['Linked Treasure', 'Tesoro Vinculado'],
  tr_meduza: ['Medusa Treasure', 'Tesoro de Medusa'],
  tr_mini: ['Miniature Treasure', 'Tesoro en Miniatura'],
  tr_musical: ['Musical Treasure', 'Tesoro Musical'],
  tr_prankster: ['Prankster Treasure', 'Tesoro del Bromista'],
  tr_puppet: ['Puppet Treasure', 'Tesoro del Títere'],
  tr_rvi: ['Reversed Controls Treasure', 'Tesoro de Controles Invertidos'],
  tr_score: ['Score Treasure', 'Tesoro de Puntuación'],
  tr_slippery: ['Slippery Treasure', 'Tesoro Resbaladizo'],
  tr_vanish: ['Vanishing Treasure', 'Tesoro de Desaparición'],
  tr_wandering: ['Wandering Die Treasure', 'Tesoro del Dado Errante'],
};

const neutralDescription = (category, name, locale) => {
  if (locale === 'en-US') {
    if (category === 'key') return `Key associated with ${name}.`;
    if (category === 'dice') return `Special die associated with ${name}.`;
    if (category === 'treasure') return `Treasure associated with ${name}.`;
    return `Item associated with ${name}.`;
  }
  if (category === 'key') return `Llave relacionada con ${name}.`;
  if (category === 'dice') return `Dado especial relacionado con ${name}.`;
  if (category === 'treasure') return `Tesoro relacionado con ${name}.`;
  return `Objeto relacionado con ${name}.`;
};

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
    const officialEnglish = it.desc?.en || null;
    const officialSpanish = it.desc?.['es-419'] || null;
    const enName = it.name?.en || editorialNames[it.itemAlias]?.[0] || pretty(it.m_Name);
    const esName = it.name?.['es-419'] || editorialNames[it.itemAlias]?.[1] || enName;
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
      labels: {
        'en-US': enName,
        'pt-BR': it.name?.['pt-BR'] ?? curated?.label ?? pretty(it.m_Name),
        'es-419': esName,
      },
      localized: Boolean(it.name?.['pt-BR']),
      desc: officialDescription ?? curated?.description ?? null,
      descriptions: {
        'en-US': officialEnglish ?? (curated ? neutralDescription(category, enName, 'en-US') : null),
        'pt-BR': officialDescription ?? curated?.description ?? null,
        'es-419': officialSpanish ?? (curated ? neutralDescription(category, esName, 'es-419') : null),
      },
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
  labels: Record<'en-US' | 'pt-BR' | 'es-419', string>;
  localized: boolean;
  /** Descrição oficial quando disponível; nos demais casos, texto editorial identificado. */
  desc: string | null;
  descriptions: Record<'en-US' | 'pt-BR' | 'es-419', string | null>;
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
