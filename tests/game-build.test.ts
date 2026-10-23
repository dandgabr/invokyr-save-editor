import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = new URL('../scripts/check-game-build.mjs', import.meta.url).pathname;
const schema = JSON.parse(
  (await import('node:fs')).readFileSync(new URL('../docs/schema.json', import.meta.url), 'utf-8'),
) as { build: { steam_buildid: string } };

const run = (acf: string | null) => {
  const dir = mkdtempSync(join(tmpdir(), 'invokyr-acf-'));
  const path = join(dir, 'appmanifest_3883570.acf');
  if (acf !== null) writeFileSync(path, acf);
  return spawnSync('node', [script], {
    encoding: 'utf-8',
    env: { ...process.env, INVOKYR_APPMANIFEST: path, HOME: dir },
  });
};

describe('check-game-build', () => {
  it('build igual ao verificado → 0', () => {
    const r = run(`"AppState"\n{\n\t"buildid"\t\t"${schema.build.steam_buildid}"\n}`);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('OK');
  });
  it('build diferente (jogo atualizado) → 1 com orientação', () => {
    const r = run('"AppState"\n{\n\t"buildid"\t\t"1"\n}');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('atualizado');
  });
  it('manifesto ilegível → 2', () => {
    expect(run('lixo sem buildid').status).toBe(2);
  });
  it('manifesto ausente → 2', () => {
    expect(run(null).status).toBe(2);
  });
});
