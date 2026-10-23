import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decode, emptyHints, encode } from '../src/codec/msgpack';

const key = fc.string({ minLength: 1, maxLength: 12 }).filter((k) => !/^(0|[1-9]\d*)$/.test(k));
const int = fc.oneof(
  fc.integer({ min: -(2 ** 31) - 5, max: 2 ** 32 + 5 }),
  fc.bigInt({ min: -(1n << 63n), max: (1n << 64n) - 1n }),
);
const leaf = fc.oneof(
  fc.constant(null),
  fc.boolean(),
  int,
  fc
    .float({ noNaN: true, noDefaultInfinity: true })
    .map((f) => Math.fround(f))
    .filter((f) => !Number.isInteger(f)),
  fc.string({ maxLength: 40 }),
  fc.uint8Array({ maxLength: 40 }),
);
const tree = fc.letrec((t) => ({
  node: fc.oneof(
    { maxDepth: 4, depthSize: 'small' },
    leaf,
    fc.array(t('node'), { maxLength: 6 }),
    fc.dictionary(key, t('node'), { maxKeys: 6 }),
  ),
})).node;

describe('propriedades do codec', () => {
  it('encode(decode(encode(v))) reproduz exatamente os mesmos bytes', () => {
    fc.assert(
      fc.property(tree, (v) => {
        const once = encode(v, emptyHints());
        const d = decode(once);
        expect(Buffer.from(encode(d.value, d.hints)).toString('hex')).toBe(Buffer.from(once).toString('hex'));
      }),
      { numRuns: 400 },
    );
  });

  it('decode nunca lança erro que não seja MsgpackError em bytes aleatórios', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 64 }), (b) => {
        try {
          decode(b);
        } catch (e) {
          expect((e as Error).name).toBe('MsgpackError');
        }
      }),
      { numRuns: 2000 },
    );
  });
});
