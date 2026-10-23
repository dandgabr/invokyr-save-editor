import { readFileSync } from 'node:fs';
import { zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { decode, emptyHints, encode, hintFormat, MsgpackError } from '../src/codec/msgpack';
import {
  type Container,
  readContainer,
  SaveContainerError,
  STREAM_NAMES,
  writeContainer,
} from '../src/codec/zip';

const fixture = () => new Uint8Array(readFileSync(new URL('./fixtures/template.sav', import.meta.url)));
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const bytes = (...n: number[]) => new Uint8Array(n);
const roundtrip = (raw: Uint8Array) => {
  const { value, hints } = decode(raw);
  return { value, hints, out: encode(value, hints) };
};

describe('contêiner ZIP', () => {
  it('lê os três streams, sem extras', () => {
    const c = readContainer(fixture());
    for (const n of STREAM_NAMES) expect(c.streams[n].byteLength).toBeGreaterThan(0);
    expect(c.extras).toEqual({});
    expect(c.order).toEqual(['meta', 'save', 'collection']);
  });

  it('round-trip do contêiner preserva os bytes dos streams e é determinístico', () => {
    const a = readContainer(fixture());
    const w1 = writeContainer(a);
    const w2 = writeContainer(readContainer(w1));
    expect(hex(w1)).toBe(hex(w2));
    const b = readContainer(w1);
    for (const n of STREAM_NAMES) expect(hex(b.streams[n])).toBe(hex(a.streams[n]));
  });

  it('preserva streams extras e a ordem ao salvar', () => {
    const raw = zipSync({
      extra: new Uint8Array([9, 9]),
      meta: new Uint8Array([1]),
      save: new Uint8Array([2]),
      collection: new Uint8Array([3]),
    });
    const c = readContainer(raw);
    expect(hex(c.extras.extra as Uint8Array)).toBe('0909');
    const again = readContainer(writeContainer(c));
    expect(again.order).toEqual(['extra', 'meta', 'save', 'collection']);
    expect(hex(again.extras.extra as Uint8Array)).toBe('0909');
  });

  it('rejeita arquivo que não é ZIP', () => {
    expect(() => readContainer(bytes(1, 2, 3, 4))).toThrow(SaveContainerError);
  });

  it('rejeita ZIP sem um dos streams', () => {
    const raw = zipSync({ meta: bytes(1), save: bytes(2) });
    expect(() => readContainer(raw)).toThrow(/collection/);
  });

  it('rejeita CRC corrompido', () => {
    const raw = zipSync({ meta: bytes(1, 2, 3), save: bytes(2), collection: bytes(3) }, { level: 0 });
    // corrompe um byte do conteúdo de "meta" (armazenado sem compressão)
    const at = raw.findIndex((_, i) => raw[i] === 1 && raw[i + 1] === 2 && raw[i + 2] === 3);
    raw[at] = 9;
    expect(() => readContainer(raw)).toThrow(/CRC/);
  });

  it('rejeita tamanho declarado forjado (truncaria o stream em silêncio)', () => {
    const big = new Uint8Array(4096).fill(7);
    const raw = zipSync({ meta: big, save: bytes(2), collection: bytes(3) });
    const dv = new DataView(raw.buffer, raw.byteOffset);
    // acha a entrada "meta" no diretório central e forja originalSize para 10
    for (let i = 0; i < raw.length - 46; i++) {
      if (dv.getUint32(i, true) === 0x02014b50 && String.fromCharCode(raw[i + 46] as number) === 'm') {
        dv.setUint32(i + 24, 10, true);
      }
    }
    expect(() => readContainer(raw)).toThrow(SaveContainerError);
  });

  it('rejeita nome de entrada duplicado', () => {
    const raw = zipSync({ aaaa: bytes(1), meta: bytes(1), save: bytes(2), collection: bytes(3) });
    const patched = Buffer.from(raw).toString('latin1').split('aaaa').join('meta');
    expect(() => readContainer(new Uint8Array(Buffer.from(patched, 'latin1')))).toThrow(/duplicado/);
  });

  it('rejeita entrada acima do limite declarado', () => {
    const raw = zipSync({ meta: bytes(1), save: bytes(2), collection: bytes(3) });
    const dv = new DataView(raw.buffer, raw.byteOffset);
    for (let i = 0; i < raw.length - 46; i++) {
      if (dv.getUint32(i, true) === 0x02014b50) dv.setUint32(i + 24, 0x7fffffff, true);
    }
    expect(() => readContainer(raw)).toThrow(/grande demais/);
  });

  it('rejeita ZIP criptografado', () => {
    const raw = zipSync({ meta: bytes(1), save: bytes(2), collection: bytes(3) });
    const dv = new DataView(raw.buffer, raw.byteOffset);
    for (let i = 0; i < raw.length - 46; i++) {
      if (dv.getUint32(i, true) === 0x02014b50) dv.setUint16(i + 8, dv.getUint16(i + 8, true) | 1, true);
    }
    expect(() => readContainer(raw)).toThrow(/criptografado/);
  });
});

describe('MessagePack sem perdas', () => {
  it.each(STREAM_NAMES)('decode→encode reproduz os bytes de "%s" do fixture', (name) => {
    const raw = readContainer(fixture()).streams[name];
    expect(hex(roundtrip(raw).out)).toBe(hex(raw));
  });

  it('SteamID64 vira bigint', () => {
    const { value, hints } = decode(readContainer(fixture()).streams.meta);
    const owners = (value as { characterOwners: unknown[] }).characterOwners;
    expect(owners[0]).toBe(76561198000000001n);
    expect(owners[1]).toBe(0);
    expect(hintFormat(hints, 'characterOwners[*]')).toBe('mixed'); // u64 + fixint no mesmo array
    expect(hintFormat(hints, 'playTimeSeconds')).toBe('f32');
  });

  it('floats continuam float32 depois de editados', () => {
    const { value, hints } = decode(readContainer(fixture()).streams.meta);
    (value as { playTimeSeconds: number }).playTimeSeconds = 123.5;
    const again = decode(encode(value, hints));
    expect(hintFormat(again.hints, 'playTimeSeconds')).toBe('f32');
    expect((again.value as { playTimeSeconds: number }).playTimeSeconds).toBe(123.5);
  });

  it('float novo sem dica sai como float32 (System.Single)', () => {
    const out = encode({ x: 0.85 }, emptyHints());
    expect(out[out.length - 5]).toBe(0xca);
  });

  it('dica que não cabe mais no valor editado cai para o mínimo', () => {
    const { value, hints } = decode(bytes(0x81, 0xa1, 0x6e, 0xcc, 0x05)); // {n: u8 5}
    (value as { n: number }).n = 70000;
    expect(decode(encode(value, hints)).value).toEqual({ n: 70000 });
  });

  describe('formatos heterogêneos no mesmo caminho (P1-2/P2-3)', () => {
    const cases: Record<string, Uint8Array> = {
      'float32 + fixint': bytes(0x92, 0xca, 0x3f, 0xc0, 0, 0, 0x03),
      'float32 + float64': bytes(0x92, 0xca, 0x3f, 0xc0, 0, 0, 0xcb, 0x40, 0x04, 0, 0, 0, 0, 0, 0),
      'u16 + fixint': bytes(0x92, 0xcd, 0, 5, 0x03),
      'u64 + fixint': bytes(0x92, 0xcf, 0, 0, 0, 0, 0, 0, 0, 1, 0x05),
      'cc com valor pequeno': bytes(0x91, 0xcc, 0x05),
      'd0 positivo': bytes(0x91, 0xd0, 0x05),
      'd0 -32..-1': bytes(0x91, 0xd0, 0xe0),
      'i16 pequeno': bytes(0x91, 0xd1, 0, 1),
      'i64 pequeno': bytes(0x91, 0xd3, 0, 0, 0, 0, 0, 0, 0, 5),
      'u32 pequeno': bytes(0x91, 0xce, 0, 0, 0, 1),
      'misto completo': bytes(0x95, 0x05, 0xcc, 0x05, 0xcd, 0, 5, 0xd0, 0xfb, 0xff),
    };
    it.each(Object.entries(cases))('%s', (_n, raw) => {
      expect(hex(roundtrip(raw).out)).toBe(hex(raw));
    });
  });

  it('elemento acrescentado a um array misto cai no formato mínimo', () => {
    const raw = bytes(0x92, 0xcf, 0, 0, 0, 0, 0, 0, 0, 1, 0x05);
    const { value, hints } = decode(raw);
    (value as unknown[]).push(7);
    expect(decode(encode(value, hints)).value).toEqual([1, 5, 7]);
  });

  it('inteiros negativos e fronteiras', () => {
    const v = { a: -1, b: -33, c: -129, d: -32769, e: -2147483649, f: 255, g: 65536, h: 4294967296 };
    expect({ ...(decode(encode(v, emptyHints())).value as object) }).toEqual(v);
  });

  it('fronteira de 2^53: number até o seguro, bigint acima', () => {
    const { value } = decode(
      encode({ a: 9007199254740991n, b: 9007199254740992n, c: -9007199254740992n }, emptyHints()),
    );
    expect(value).toEqual({ a: 9007199254740991, b: 9007199254740992n, c: -9007199254740992n });
  });

  it('extremos de 64 bits', () => {
    const v = { max: 18446744073709551615n, min: -9223372036854775808n };
    expect({ ...(decode(encode(v, emptyHints())).value as object) }).toEqual(v);
  });

  it('inteiro fora de 64 bits é erro', () => {
    expect(() => encode(1n << 64n, emptyHints())).toThrow(MsgpackError);
  });

  it('number inteiro além de 2^53 é erro (deve ser bigint)', () => {
    expect(() => encode(2 ** 60, emptyHints())).toThrow(/bigint/);
  });

  it('strings UTF-8, bin, nil e bool', () => {
    const v = { s: 'Ação ✓', bin: bytes(1, 2, 3), n: null, t: true, f: false, e: [] };
    expect({ ...(decode(encode(v, emptyHints())).value as object) }).toEqual(v);
  });

  it('preserva BOM no início de string', () => {
    const raw = bytes(0xa3, 0xef, 0xbb, 0xbf);
    const { value, out } = roundtrip(raw);
    expect(value).toBe('﻿');
    expect(hex(out)).toBe(hex(raw));
  });

  it('UTF-8 inválido vira MsgpackError', () => {
    expect(() => decode(bytes(0xa1, 0xff))).toThrow(MsgpackError);
  });

  it('NaN/Inf/-0 existentes fazem round-trip quando há dica de float', () => {
    for (const raw of [
      bytes(0xca, 0x7f, 0xc0, 0, 0),
      bytes(0xca, 0x7f, 0x80, 0, 0),
      bytes(0xca, 0x80, 0, 0, 0),
    ]) {
      expect(hex(roundtrip(raw).out)).toBe(hex(raw));
    }
  });

  it('NaN novo (sem dica) é rejeitado', () => {
    expect(() => encode({ x: Number.NaN }, emptyHints())).toThrow(MsgpackError);
  });

  it('chaves com ponto/colchete não colidem com caminhos aninhados', () => {
    const raw = encode({ 'a.b': 1.5, a: { b: 2.5 } }, emptyHints()); // ambos f32 por padrão
    const { hints } = decode(raw);
    expect(hints.paths.size).toBe(2);
  });
});

describe('limites e entradas hostis', () => {
  it('rejeita aninhamento profundo', () => {
    let v: unknown = 1;
    for (let i = 0; i < 70; i++) v = [v];
    expect(() => encode(v, emptyHints())).toThrow(MsgpackError); // encode também limita
    const raw = new Uint8Array(200).fill(0x91);
    raw[199] = 1;
    expect(() => decode(raw)).toThrow(MsgpackError);
  });

  it('rejeita chave gigante (DoS quadrático pelo caminho dos hints)', () => {
    const key = 'k'.repeat(300);
    const raw = encode({ [key]: 1 }, emptyHints());
    expect(() => decode(raw)).toThrow(/Chave de mapa longa/);
  });

  it('rejeita caminho aninhado longo demais', () => {
    let v: unknown = 1;
    const k = 'k'.repeat(200);
    for (let i = 0; i < 20; i++) v = { [k]: v };
    expect(() => decode(encode(v, emptyHints()))).toThrow(MsgpackError);
  });

  it('chave __proto__ não polui protótipos', () => {
    const { value } = decode(encode(JSON.parse('{"__proto__": {"polluted": 1}}'), emptyHints()));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(Object.getPrototypeOf(value)).toBeNull();
  });

  it('rejeita chave numérica e duplicada', () => {
    expect(() => decode(bytes(0x81, 0xa1, 0x31, 0x01))).toThrow(/numérica/);
    expect(() => decode(bytes(0x82, 0xa1, 0x61, 0x01, 0xa1, 0x61, 0x02))).toThrow(/duplicada/);
  });

  it('rejeita payload truncado, bytes sobrando, array gigante e ext', () => {
    const raw = readContainer(fixture()).streams.save;
    expect(() => decode(raw.subarray(0, raw.length - 3))).toThrow(MsgpackError);
    expect(() => decode(bytes(...readContainer(fixture()).streams.meta, 0))).toThrow(MsgpackError);
    expect(() => decode(bytes(0xdd, 0xff, 0xff, 0xff, 0xff))).toThrow(MsgpackError);
    expect(() => decode(bytes(0xd4, 0x01, 0x00))).toThrow(MsgpackError);
  });

  it('encode recusa objetos que não são simples (Date, Map)', () => {
    expect(() => encode({ d: new Date() }, emptyHints())).toThrow(MsgpackError);
    expect(() => encode({ m: new Map() }, emptyHints())).toThrow(MsgpackError);
  });
});

describe('contêiner completo', () => {
  it('abre → edita → salva → reabre mantendo o resto intacto', () => {
    const c: Container = readContainer(fixture());
    const meta = decode(c.streams.meta);
    (meta.value as { score: number }).score = 777;
    c.streams.meta = encode(meta.value, meta.hints);
    const re = readContainer(writeContainer(c));
    expect((decode(re.streams.meta).value as { score: number }).score).toBe(777);
    expect(hex(re.streams.save)).toBe(hex(readContainer(fixture()).streams.save));
  });
});
