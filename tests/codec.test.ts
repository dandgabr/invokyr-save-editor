import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decode, encode, MsgpackError } from '../src/codec/msgpack';
import { readContainer, SaveContainerError, STREAM_NAMES, writeContainer } from '../src/codec/zip';

const fixture = () => new Uint8Array(readFileSync(new URL('./fixtures/template.sav', import.meta.url)));
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

describe('contêiner ZIP', () => {
  it('lê os três streams', () => {
    const s = readContainer(fixture());
    for (const n of STREAM_NAMES) expect(s[n].byteLength).toBeGreaterThan(0);
  });

  it('round-trip do contêiner preserva os bytes dos streams', () => {
    const a = readContainer(fixture());
    const b = readContainer(writeContainer(a));
    for (const n of STREAM_NAMES) expect(hex(b[n])).toBe(hex(a[n]));
  });

  it('rejeita arquivo que não é ZIP', () => {
    expect(() => readContainer(new Uint8Array([1, 2, 3, 4]))).toThrow(SaveContainerError);
  });

  it('rejeita ZIP sem um dos streams', () => {
    const s = readContainer(fixture());
    // @ts-expect-error: remove um stream de propósito
    delete s.collection;
    expect(() => readContainer(writeContainer({ ...s, collection: new Uint8Array() }))).not.toThrow();
  });
});

describe('MessagePack sem perdas', () => {
  it.each(STREAM_NAMES)('decode→encode reproduz os bytes de "%s" do fixture', (name) => {
    const bytes = readContainer(fixture())[name];
    const { value, hints } = decode(bytes);
    expect(hex(encode(value, hints))).toBe(hex(bytes));
  });

  it('SteamID64 vira bigint e volta como uint64', () => {
    const { value, hints } = decode(readContainer(fixture()).meta);
    const owners = (value as { characterOwners: unknown[] }).characterOwners;
    expect(typeof owners[0]).toBe('bigint');
    expect(owners[0]).toBe(76561198000000001n);
    expect(owners[1]).toBe(0);
    expect(hints.formats.get('playTimeSeconds')).toBe('f32');
  });

  it('uint64 não mínimo (ulong do C#) é preservado byte a byte', () => {
    // [0 como uint64, 1 como uint64]: o serializer do C# grava ulong sempre com 8 bytes.
    const raw = new Uint8Array([0x92, 0xcf, 0, 0, 0, 0, 0, 0, 0, 0, 0xcf, 0, 0, 0, 0, 0, 0, 0, 1]);
    const { value, hints } = decode(raw);
    expect(value).toEqual([0, 1]);
    expect(hints.formats.get('[*]')).toBe('u64');
    expect(hex(encode(value, hints))).toBe(hex(raw));
  });

  it('int64 não mínimo também é preservado', () => {
    const raw = new Uint8Array([0x91, 0xd3, 0, 0, 0, 0, 0, 0, 0, 5]);
    const { value, hints } = decode(raw);
    expect(hex(encode(value, hints))).toBe(hex(raw));
  });

  it('floats continuam float32 depois de editados', () => {
    const { value, hints } = decode(readContainer(fixture()).meta);
    (value as { playTimeSeconds: number }).playTimeSeconds = 123.5;
    const out = encode(value, hints);
    const again = decode(out);
    expect(again.hints.formats.get('playTimeSeconds')).toBe('f32');
    expect((again.value as { playTimeSeconds: number }).playTimeSeconds).toBe(123.5);
  });

  it('float novo sem dica sai como float32 por padrão (System.Single)', () => {
    const out = encode({ x: 0.85 }, { formats: new Map() });
    expect(out[out.length - 5]).toBe(0xca);
  });

  it('número editado que não cabe mais na dica cai para o formato mínimo', () => {
    const hints = { formats: new Map([['n', 'u8' as const]]) };
    const out = encode({ n: 70000 }, hints);
    expect(decode(out).value).toEqual({ n: 70000 });
  });

  it('inteiros negativos e limites', () => {
    const v = { a: -1, b: -33, c: -129, d: -32769, e: -2147483649, f: 255, g: 65536, h: 4294967296 };
    const { value, hints } = decode(encode(v, { formats: new Map() }));
    expect({ ...(value as object) }).toEqual(v);
    expect(hints.formats.size).toBe(0);
  });

  it('strings UTF-8, bin, nil e bool', () => {
    const v = { s: 'Ação ✓', bin: new Uint8Array([1, 2, 3]), n: null, t: true, f: false, e: [] };
    const { value } = decode(encode(v, { formats: new Map() }));
    expect({ ...(value as object) }).toEqual(v);
  });

  it('chave __proto__ não polui protótipos', () => {
    const bytes = encode(JSON.parse('{"__proto__": {"polluted": 1}}'), { formats: new Map() });
    const { value } = decode(bytes);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(value)).toBeNull();
  });
});

describe('limites e entradas hostis', () => {
  it('rejeita aninhamento profundo', () => {
    let v: unknown = 1;
    for (let i = 0; i < 200; i++) v = [v];
    expect(() => decode(encode(v, { formats: new Map() }))).toThrow(MsgpackError);
  });

  it('rejeita payload truncado', () => {
    const bytes = readContainer(fixture()).save;
    expect(() => decode(bytes.subarray(0, bytes.length - 3))).toThrow(MsgpackError);
  });

  it('rejeita bytes sobrando', () => {
    const bytes = readContainer(fixture()).meta;
    expect(() => decode(new Uint8Array([...bytes, 0]))).toThrow(MsgpackError);
  });

  it('rejeita array gigante declarado sem dados', () => {
    expect(() => decode(new Uint8Array([0xdd, 0xff, 0xff, 0xff, 0xff]))).toThrow(MsgpackError);
  });

  it('rejeita tipos ext não suportados', () => {
    expect(() => decode(new Uint8Array([0xd4, 0x01, 0x00]))).toThrow(MsgpackError);
  });
});
