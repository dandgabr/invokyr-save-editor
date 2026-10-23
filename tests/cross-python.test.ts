import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decode, encode } from '../src/codec/msgpack';
import { readContainer, writeContainer } from '../src/codec/zip';

const py = (args: string[]) => spawnSync('python3', ['-I', ...args], { encoding: 'utf-8' });
const hasPython = py(['-c', 'import msgpack']).status === 0;
const ref = new URL('../reference/save_codec.py', import.meta.url).pathname;

// Oráculo: o codec Python de referência (reference/save_codec.py) precisa ler o que o TS grava.
describe.skipIf(!hasPython)('teste cruzado TS → Python', () => {
  it('o codec Python lê um save editado e regravado pelo TS', () => {
    const c = readContainer(
      new Uint8Array(readFileSync(new URL('./fixtures/template.sav', import.meta.url))),
    );
    const meta = decode(c.streams.meta);
    (meta.value as { score: number }).score = 777;
    (meta.value as { playTimeSeconds: number }).playTimeSeconds = 125;
    c.streams.meta = encode(meta.value, meta.hints);
    const dir = mkdtempSync(join(tmpdir(), 'invokyr-'));
    const out = join(dir, 'x.sav');
    writeFileSync(out, writeContainer(c));
    const script = `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("codec", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
d = m.read_save_file(sys.argv[2])
print(json.dumps({"score": d["meta"]["score"], "t": d["meta"]["playTimeSeconds"], "v": d["save"]["version"], "owner": str(d["meta"]["characterOwners"][0])}))
`;
    const r = py(['-c', script, ref, out]);
    expect(r.status, r.stderr).toBe(0);
    expect(JSON.parse(r.stdout)).toEqual({ score: 777, t: 125, v: 15, owner: '76561198000000001' });
  });
});
