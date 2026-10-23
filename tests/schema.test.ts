import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decode, encode } from '../src/codec/msgpack';
import { csTypeOf } from '../src/schema/cstypes';
import { FIGURINE_MASK, FIGURINES } from '../src/schema/enums';
import type { SaveValues } from '../src/schema/types';
import { hasErrors, validate } from '../src/schema/validate';
import { openSave } from '../src/state/document';

const doc = () =>
  openSave('t.sav', new Uint8Array(readFileSync(new URL('./fixtures/template.sav', import.meta.url))));
const clone = (): SaveValues => structuredClone(doc().values) as unknown as SaveValues;

describe('enums verificados', () => {
  it('17 figuras e máscara 0x1FFFF', () => {
    expect(FIGURINES).toHaveLength(17);
    expect(FIGURINE_MASK).toBe(0x1ffff);
  });
});

describe('validação de invariantes', () => {
  it('o fixture não tem erros', () => {
    expect(hasErrors(validate(clone()))).toBe(false);
  });
  it('inventário com ids e baterias de tamanhos diferentes é erro', () => {
    const v = clone();
    v.save.playerInventories[0]?.itemStringIds.push('x');
    expect(hasErrors(validate(v))).toBe(true);
  });
  it('nível de upgrade acima do máximo é erro', () => {
    const v = clone();
    v.save.upgrades.redUpgrades = [{ x: 1, y: 9 }];
    expect(validate(v).some((i) => i.severity === 'error' && i.message.includes('1..8'))).toBe(true);
  });
  it('bits fora da máscara de figuras é erro', () => {
    const v = clone();
    v.collection.monsterFigurines = 2147483647;
    expect(validate(v).some((i) => i.path === 'collection.monsterFigurines')).toBe(true);
  });
  it('mobília inválida e versão desconhecida', () => {
    const v = clone();
    v.save.furnitures.furnitures = [0, 9];
    v.save.version = 16;
    const issues = validate(v);
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(2);
    expect(issues.some((i) => i.path === 'save.version')).toBe(true);
  });
  it('characterOwners com tamanho errado é erro', () => {
    const v = clone();
    v.meta.characterOwners = [0n];
    expect(hasErrors(validate(v))).toBe(true);
  });
});

describe('largura dos inteiros por tipo C# (serializer do jogo)', () => {
  const enc = (stream: 'meta' | 'save' | 'collection', v: unknown) =>
    Buffer.from(encode(v, { paths: new Map() }, { typeOf: csTypeOf(stream) })).toString('hex');

  it('int > 127 vira int16/int32 assinado', () => {
    expect(enc('meta', { score: 2157 })).toContain('d1086d'); // int16 0x086d
    expect(enc('meta', { score: 100000 })).toContain('d2000186a0'); // int32
  });
  it('int pequeno continua fixint', () => {
    expect(enc('meta', { score: 5 })).toMatch(/05$/);
  });
  it('uint vira uint16 e ulong vira uint64', () => {
    expect(enc('collection', { monsterFigurines: 16405 })).toContain('cd4015');
    expect(enc('meta', { characterOwners: [76561198000000001n] })).toContain('cf');
  });
  it('long grande vira int64', () => {
    expect(enc('meta', { savedAtUtcTicks: 639283059535910556n })).toContain('d3');
  });
  it('valor editado que estoura a largura original alarga na mesma família', () => {
    const hints = { paths: new Map([['score', { fmt: 'i16' as const, count: 1 }]]) };
    const fits = encode({ score: 2157 }, hints, { typeOf: csTypeOf('meta') });
    expect(Buffer.from(fits).toString('hex')).toContain('d1086d'); // dica i16 respeitada
    const wide = encode({ score: 40000 }, hints, { typeOf: csTypeOf('meta') });
    expect(Buffer.from(wide).toString('hex')).toContain('d200009c40'); // não cabe em int16 → int32
  });
});
