import { existsSync, readFileSync } from 'node:fs';
import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { decode, emptyHints, encode, MsgpackError } from '../src/codec/msgpack';
import { readContainer, STREAM_NAMES } from '../src/codec/zip';
import { csTypeOf } from '../src/schema/cstypes';
import type { SaveValues } from '../src/schema/types';
import { hasErrors, validate } from '../src/schema/validate';
import * as A from '../src/state/actions';
import { openSave, serializeSave } from '../src/state/document';

const doc = openSave(
  't.sav',
  new Uint8Array(readFileSync(new URL('./fixtures/template.sav', import.meta.url))),
);
const base = doc.values as unknown as SaveValues;
const edit = (fn: (d: SaveValues) => void): SaveValues => produce(base, fn);
const ID2 = 76561198000000002n;
const ID3 = 76561198000000003n;

describe('entradas hostis nas ações', () => {
  it('bateria NaN/Infinity é ignorada', () => {
    const v = edit((d) => {
      A.addItem(d, { kind: 'bench' }, 'g_fire');
      const i = d.save.gameRoomTools.itemStringIds.indexOf('g_fire');
      A.setBattery(d, { kind: 'bench' }, i, Number.NaN);
      A.setBattery(d, { kind: 'bench' }, i, Number.POSITIVE_INFINITY);
    });
    expect(v.save.gameRoomTools.itemBatteryLevels.at(-1)).toBe(1);
  });
  it('skin fora da faixa ou fracionária é ignorada', () => {
    for (const bad of [1.5, -1, 999, Number.NaN])
      expect(edit((d) => A.setSkin(d, bad)).save.gameRoomSkinIndex).toBe(0);
    expect(edit((d) => A.setSkin(d, 5)).save.gameRoomSkinIndex).toBe(5);
  });
  it('cor/herói inválidos e alias desconhecido são recusados', () => {
    const v = edit((d) => {
      A.setClothColor(d, 0, 99);
      A.setClothColor(d, 42, 1);
      expect(A.addItem(d, { kind: 'bench' }, '__proto__')).toBe(false);
      expect(A.addItem(d, { kind: 'bench' }, 'zzz')).toBe(false);
    });
    expect(v.save.playerColors).toHaveLength(base.save.playerColors.length);
    expect(v.save.playerColors.find((c) => c.playerCharacter === 0)?._color).toBe(3);
  });
  it('herói não inteiro, SteamID negativo e duplicado são recusados', () => {
    edit((d) => {
      expect(A.setOwner(d, 1.5, ID2)).toBe(false);
      expect(A.setOwner(d, 3, -5n)).toBe(false);
      expect(A.setOwner(d, 3, 76561198000000001n)).toBe(false); // já é o dono do herói 0
    });
  });
  it('parseSteamId exige 17 dígitos na faixa pública', () => {
    expect(A.parseSteamId('76561198000000001')).toBe(76561198000000001n);
    for (const bad of ['1', '7656119800000000', '765611980000000011', '99999999999999999', 'abc'])
      expect(A.parseSteamId(bad)).toBeNull();
  });
  it('NaN em banco, ranque, dificuldade, figura e nível não altera nada', () => {
    const v = edit((d) => {
      A.setBank(d, Number.NaN);
      A.setEndlessRank(d, Number.NaN);
      A.setBoardDifficulty(d, '2:3', Number.NaN);
      A.setFigurine(d, Number.NaN, true);
      A.setUpgradeLevel(d, 0, 1, Number.NaN);
    });
    expect(v).toEqual(base);
  });
  it('nível 0 remove todas as duplicatas pré-existentes', () => {
    const dup = produce(base, (d) => {
      d.save.upgrades.redUpgrades = [
        { x: 1, y: 2 },
        { x: 1, y: 3 },
      ];
    });
    const v = produce(dup, (d) => A.setUpgradeLevel(d, 0, 1, 0));
    expect(v.save.upgrades.redUpgrades).toEqual([]);
    const keep = produce(dup, (d) => A.setUpgradeLevel(d, 0, 1, 4));
    expect(keep.save.upgrades.redUpgrades).toEqual([{ x: 1, y: 4 }]);
  });
  it('sessão com heróis fora de ordem mantém inventários alinhados', () => {
    const v = edit((d) => {
      A.setOwner(d, 5, ID2);
      A.addItem(d, { kind: 'player', index: 1 }, 'ice'); // herói 5 → índice 1
      A.setOwner(d, 2, ID3); // herói 2 entra antes do 5 → índice 1; o do 5 passa para 2
    });
    expect(v.meta.playerCount).toBe(3);
    expect(v.save.playerInventories).toHaveLength(3);
    expect(v.save.playerInventories[2]?.itemStringIds).toEqual(['ice']);
    expect(v.save.playerInventories[1]?.itemStringIds).toEqual([]);
    expect(hasErrors(validate(v))).toBe(false);
  });
});

describe('encoder: faixa e tipo C#', () => {
  const enc = (stream: 'meta' | 'save' | 'collection', v: unknown) =>
    encode(v, emptyHints(), { typeOf: csTypeOf(stream) });
  it('int fora de int32, negativo em unsigned e fração em campo inteiro lançam', () => {
    expect(() => enc('meta', { score: 2 ** 31 })).toThrow(MsgpackError);
    expect(() => enc('meta', { score: 1.5 })).toThrow(/fracionário/);
    expect(() => enc('meta', { characterOwners: [-5n] })).toThrow(MsgpackError);
    expect(() => enc('collection', { monsterFigurines: -5 })).toThrow(MsgpackError);
    expect(() => enc('collection', { monsterFigurines: 2 ** 32 })).toThrow(MsgpackError);
    expect(() => enc('save', { gameRoomSkinIndex: 1.5 })).toThrow(MsgpackError);
  });
  it('limites exatos de int32 e uint32 passam', () => {
    expect(() => enc('meta', { score: 2 ** 31 - 1 })).not.toThrow();
    expect(() => enc('meta', { score: -(2 ** 31) })).not.toThrow();
    expect(() => enc('collection', { monsterFigurines: 2 ** 32 - 1 })).not.toThrow();
  });
});

describe('validate é robusto e completo', () => {
  const v = (fn: (d: SaveValues) => void) => validate(produce(base, fn));
  it('não lança com owner null/fracionário', () => {
    const bad = produce(base, (d) => {
      (d.meta.characterOwners as unknown[])[1] = null;
      (d.meta.characterOwners as unknown[])[2] = 1.5;
    });
    expect(() => validate(bad)).not.toThrow();
    expect(hasErrors(validate(bad))).toBe(true);
  });
  it('inventários ≠ playerCount é erro', () => {
    const issues = v((d) => {
      d.save.playerInventories.push({ itemStringIds: [], itemBatteryLevels: [] });
    });
    expect(hasErrors(issues)).toBe(true);
  });
  it('skin, cor, duplicata de dono, 2^32 em figuras e NaN em bateria são erros', () => {
    expect(hasErrors(v((d) => void (d.save.gameRoomSkinIndex = 9)))).toBe(true);
    expect(hasErrors(v((d) => void (d.save.playerColors[0] && (d.save.playerColors[0]._color = 77))))).toBe(
      true,
    );
    expect(hasErrors(v((d) => void (d.meta.characterOwners[3] = d.meta.characterOwners[0] as bigint)))).toBe(
      true,
    );
    expect(hasErrors(v((d) => void (d.collection.monsterFigurines = 2 ** 32)))).toBe(true);
    expect(hasErrors(v((d) => void (d.save.gameRoomTools.itemBatteryLevels[0] = Number.NaN)))).toBe(true);
  });
  it('bateria incoerente com o item e alias fora do catálogo são avisos', () => {
    const issues = v((d) => {
      d.save.gameRoomTools.itemBatteryLevels[0] = 0.5; // item sem bateria
      d.save.gameRoomTools.itemStringIds[1] = 'item_inventado';
    });
    expect(issues.filter((i) => i.severity === 'warning').length).toBeGreaterThanOrEqual(2);
    expect(hasErrors(issues)).toBe(false);
  });
});

describe('round-trip com as larguras do jogo (GameDevWare)', () => {
  // Regrava o fixture com o encoder tipado (int→int16/32, uint→uint16, ulong→uint64, float→f32): é o formato do jogo.
  const gameLike = () => serializeSave(doc, doc.values);
  it('decode→encode reproduz exatamente cada stream', () => {
    const c = readContainer(gameLike());
    const again = openSave('x', gameLike());
    for (const n of STREAM_NAMES) {
      const { value, hints } = decode(c.streams[n]);
      expect(Buffer.from(encode(value, hints, { typeOf: csTypeOf(n) })).toString('hex')).toBe(
        Buffer.from(c.streams[n]).toString('hex'),
      );
    }
    expect(again.values).toEqual(doc.values);
  });
  it('valores novos (sem dicas) saem nas larguras do jogo: int→int32/int16, long→int64, ulong→uint64, float→f32', () => {
    const hex = (stream: 'meta' | 'save' | 'collection', v: unknown) =>
      Buffer.from(encode(v, emptyHints(), { typeOf: csTypeOf(stream) })).toString('hex');
    const meta = hex('meta', {
      savedAtUtcTicks: 639283059535910556n,
      score: 50000,
      playTimeSeconds: 100,
      characterOwners: [76561198000000001n, 0],
    });
    expect(meta).toContain('d2' + '0000c350'); // score: int32
    expect(meta).toContain('d3'); // ticks: int64
    expect(meta).toContain('cf'); // ulong grande: uint64
    expect(hex('save', { bank: { currentTotalScore: 2157 } })).toContain('d1086d'); // int16
    expect(hex('collection', { monsterFigurines: 16405 })).toContain('cd4015'); // uint16
    expect(hex('save', { playTimeSeconds: 12.5 })).toContain('ca41480000'); // float32
  });
  it('inserir/remover no meio de um array misto não corrompe os formatos', () => {
    const v = edit((d) => {
      A.addItem(d, { kind: 'bench' }, 'ice');
      A.removeItem(d, { kind: 'bench' }, 0);
    });
    const out = readContainer(serializeSave(doc, v as never));
    const re = decode(out.streams.save).value as SaveValues['save'];
    expect(re.gameRoomTools.itemStringIds).toEqual(v.save.gameRoomTools.itemStringIds);
    expect(re.gameRoomTools.itemBatteryLevels).toEqual(v.save.gameRoomTools.itemBatteryLevels);
  });
});

// Teste opcional contra um save REAL (nunca versionado). Ex.: INVOKYR_REAL_SAVE=/caminho/Natural.sav npm test
const realPath = process.env.INVOKYR_REAL_SAVE;
describe.skipIf(!realPath || !existsSync(realPath))('save real (opcional)', () => {
  it('decode→encode reproduz byte a byte os três streams', () => {
    const c = readContainer(new Uint8Array(readFileSync(realPath as string)));
    for (const n of STREAM_NAMES) {
      const { value, hints } = decode(c.streams[n]);
      expect(Buffer.from(encode(value, hints, { typeOf: csTypeOf(n) })).toString('hex')).toBe(
        Buffer.from(c.streams[n]).toString('hex'),
      );
    }
  });
});
