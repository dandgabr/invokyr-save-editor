import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { decode } from '../src/codec/msgpack';
import { readContainer } from '../src/codec/zip';
import { useEditor } from '../src/state/store';

const fixture = () => new Uint8Array(readFileSync(new URL('./fixtures/template.sav', import.meta.url)));
type Meta = { score: number; characterOwners: unknown[] };
const meta = () => useEditor.getState().values?.meta as Meta;

describe('store do editor', () => {
  beforeEach(() => {
    useEditor.getState().close();
    useEditor.getState().open('template.sav', fixture());
  });

  it('abre o save e expõe os três streams', () => {
    const v = useEditor.getState().values;
    expect(Object.keys(v ?? {}).sort()).toEqual(['collection', 'meta', 'save']);
    expect(meta().characterOwners[0]).toBe(76561198000000001n);
  });

  it('edita, desfaz e refaz', () => {
    const s = useEditor.getState();
    const before = meta().score;
    s.edit((d) => {
      (d.meta as Meta).score = 1234;
    });
    expect(meta().score).toBe(1234);
    useEditor.getState().undo();
    expect(meta().score).toBe(before);
    useEditor.getState().redo();
    expect(meta().score).toBe(1234);
  });

  it('uma nova edição descarta o "refazer"', () => {
    const s = useEditor.getState();
    s.edit((d) => {
      (d.meta as Meta).score = 1;
    });
    useEditor.getState().undo();
    useEditor.getState().edit((d) => {
      (d.meta as Meta).score = 2;
    });
    expect(useEditor.getState().future).toHaveLength(0);
  });

  it('edição sem efeito não entra no histórico', () => {
    const s = useEditor.getState();
    s.edit((d) => {
      (d.meta as Meta).score = (d.meta as Meta).score;
    });
    expect(useEditor.getState().past).toHaveLength(0);
  });

  it('diff lista apenas o que mudou, com caminho legível', () => {
    useEditor.getState().edit((d) => {
      (d.meta as Meta).score = 99;
    });
    const ch = useEditor.getState().changes();
    expect(ch).toHaveLength(1);
    expect(ch[0]).toMatchObject({ path: 'meta.score', after: 99 });
  });

  it('serializa sem edição reproduzindo os streams originais', () => {
    const out = readContainer(useEditor.getState().serialize());
    const orig = readContainer(fixture());
    for (const n of ['meta', 'save', 'collection'] as const) {
      expect(Buffer.from(out.streams[n]).toString('hex')).toBe(Buffer.from(orig.streams[n]).toString('hex'));
    }
  });

  it('serializa a edição preservando bigint e float32', () => {
    useEditor.getState().edit((d) => {
      (d.meta as Meta).score = 4242;
      (d.meta as unknown as { playTimeSeconds: number }).playTimeSeconds = 99.5;
    });
    const m = decode(readContainer(useEditor.getState().serialize()).streams.meta);
    const v = m.value as Meta & { playTimeSeconds: number };
    expect(v.score).toBe(4242);
    expect(v.playTimeSeconds).toBe(99.5);
    expect(v.characterOwners[0]).toBe(76561198000000001n);
  });

  it('markSaved zera o diff e o histórico', () => {
    useEditor.getState().edit((d) => {
      (d.meta as Meta).score = 5;
    });
    useEditor.getState().markSaved();
    expect(useEditor.getState().changes()).toHaveLength(0);
    expect(useEditor.getState().past).toHaveLength(0);
  });
});
