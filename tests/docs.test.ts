import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ITEM_CATALOG, OFFICIAL_ITEMS } from '../src/catalog/catalog';
import {
  BIOMES,
  BOARD_MONSTERS,
  FIGURINES,
  FURNITURES,
  HEROES,
  KEY_DOORS,
  UPGRADES,
} from '../src/schema/enums';
import { SKINS } from '../src/schema/skins';

const root = resolve(new URL('..', import.meta.url).pathname);
const read = (p: string) => readFileSync(join(root, p), 'utf-8');

function markdownFiles(dir = root, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (['node_modules', '.git', 'dist', 'playwright-report', 'test-results'].includes(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) markdownFiles(full, out);
    else if (name.endsWith('.md')) out.push(relative(root, full));
  }
  return out;
}

const docs = markdownFiles();
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

describe('documentação: links, caminhos e comandos', () => {
  it('há documentos para validar', () => {
    expect(docs).toEqual(
      expect.arrayContaining(['README.md', 'SECURITY.md', 'docs/ARCHITECTURE.md', 'docs/SCHEMA_VERIFIED.md']),
    );
  });

  it.each(docs)('%s: links relativos apontam para arquivos que existem', (file) => {
    const text = read(file);
    const broken: string[] = [];
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1] as string;
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const path = target.split('#')[0] as string;
      if (path && !existsSync(resolve(root, dirname(file), path))) broken.push(target);
    }
    expect(broken).toEqual([]);
  });

  it.each(docs)('%s: caminhos do repositório citados em `código` existem', (file) => {
    const text = read(file);
    const missing: string[] = [];
    for (const m of text.matchAll(/`((?:src|tests|e2e|scripts|docs|reference|\.github)\/[^`\s]*)`/g)) {
      const p = (m[1] as string).replace(/[.,;:]$/, '');
      if (/[*<>[\]]|…/.test(p) || p.includes('scratchpad')) continue; // curingas e exemplos
      if (!existsSync(join(root, p))) missing.push(p);
    }
    expect(missing).toEqual([]);
  });

  it.each(docs)('%s: comandos `npm run` citados existem no package.json', (file) => {
    const text = read(file);
    const unknown = [...text.matchAll(/npm run ([\w:-]+)/g)]
      .map((m) => m[1] as string)
      .filter((s) => !(s in pkg.scripts));
    expect(unknown).toEqual([]);
  });
});

describe('documentação: números afirmados batem com o código', () => {
  const all = docs.map(read).join('\n');

  it('catálogo: 135 itens, 133 oficiais, 2 internos, 6 com bateria', () => {
    expect(ITEM_CATALOG).toHaveLength(135);
    expect(OFFICIAL_ITEMS).toHaveLength(133);
    expect(ITEM_CATALOG.filter((i) => i.battery)).toHaveLength(6);
    const readme = read('README.md');
    expect(readme).toContain('135 itens');
    expect(readme).toContain('133 oficiais');
    expect(readme).toContain('2 internos');
    expect(read('docs/design/README.md')).toContain('135 itens');
  });

  it('enums: 8 heróis, 8 mobílias, 2 portas, 17 figuras, 6 skins, 5 upgrades, 7 biomas', () => {
    expect([
      HEROES.length,
      FURNITURES.length,
      KEY_DOORS.length,
      FIGURINES.length,
      SKINS.length,
      UPGRADES.length,
      BIOMES.length,
    ]).toEqual([8, 8, 2, 17, 6, 5, 7]);
    expect(all).toContain('17 figuras');
    expect(all).toContain('0x1FFFF');
    expect(all).toContain('6 skins');
  });

  it('o build documentado é o mesmo do schema e está em README e ARCHITECTURE', () => {
    const schema = JSON.parse(read('docs/schema.json')) as { build: { steam_buildid: string } };
    const items = JSON.parse(read('docs/schema-items.json')) as { meta: { gameBuild?: string | number } };
    const id = String(schema.build.steam_buildid);
    expect(read('README.md')).toContain(id);
    expect(read('docs/SCHEMA_VERIFIED.md')).toContain(id);
    expect(read('docs/SCHEMA_ITEMS.md')).toContain(id);
    expect(read('src/ui/Welcome.tsx')).toContain(id);
    expect(String(items.meta.gameBuild ?? id)).toContain(id);
  });

  it('a documentação herdada e não verificada foi removida', () => {
    expect(existsSync(join(root, 'docs/legacy'))).toBe(false);
    expect(existsSync(join(root, 'docs/PLAN.md'))).toBe(false);
  });
});

describe('nomes pt-BR dos monstros são os do jogo', () => {
  const items = JSON.parse(read('docs/schema-items.json')) as {
    monsterNames: Record<string, { 'pt-BR': string }>;
  };
  // chave do enum → termo de localização do jogo (featured_monster_name)
  const term: Record<string, string> = {
    Plant: 'plant',
    Horseman: 'horsemen',
    Yeti: 'yeti',
    Croco: 'croco',
    Crocodile: 'croco',
    Hunter: 'hunter',
    Ultimate: 'ultimate',
    Weeping: 'weeping',
    WeepingAngel: 'weeping',
    CursedPlayer: 'cursedplayer',
    Penguin: 'penguin',
    MoneyGuy: 'moneyguy',
    Snowman: 'snowman',
    Alpinist: 'alpinist',
    Pharaoh: 'pharaoh',
    SandWorm: 'sandworm',
    TVGhost: 'tvghost',
    DoorMonster: 'doormonster',
    Spider: 'spider',
    BeeSwarm: 'Bees',
  };
  it.each([...BOARD_MONSTERS, ...FIGURINES])('$key', ({ key, label }) => {
    const t = term[key];
    if (!t) return; // None, Demo e Mimic não têm termo no jogo
    expect(label).toBe(items.monsterNames[t]?.['pt-BR']);
  });
});
