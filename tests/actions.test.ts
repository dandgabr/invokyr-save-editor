import { readFileSync } from 'node:fs';
import { produce } from 'immer';
import { describe, expect, it } from 'vitest';
import { findItem, OFFICIAL_ITEMS, searchItems } from '../src/catalog/catalog';
import { decode } from '../src/codec/msgpack';
import { readContainer } from '../src/codec/zip';
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
const clean = (v: SaveValues) => expect(validate(v).filter((i) => i.severity === 'error')).toEqual([]);
const reread = (v: SaveValues): SaveValues => {
  const out = readContainer(serializeSave(doc, v as never));
  return {
    meta: decode(out.streams.meta).value,
    save: decode(out.streams.save).value,
    collection: decode(out.streams.collection).value,
  } as SaveValues;
};

describe('sessão', () => {
  it('atribuir um herói vago adiciona inventário e atualiza playerCount', () => {
    const v = edit((d) => {
      expect(A.setOwner(d, 3, 76561198000000002n)).toBe(true);
    });
    expect(v.meta.playerCount).toBe(2);
    expect(v.save.playerInventories).toHaveLength(2);
    clean(v);
    const r = reread(v);
    expect(r.meta.characterOwners[3]).toBe(76561198000000002n);
  });
  it('liberar remove o inventário do herói certo', () => {
    const two = edit((d) => {
      A.setOwner(d, 3, 76561198000000002n);
      A.addItem(d, { kind: 'player', index: 1 }, 'g_fire');
    });
    const v = produce(two, (d) => {
      A.setOwner(d, 0, 0n);
    });
    expect(v.meta.playerCount).toBe(1);
    expect(v.save.playerInventories[0]?.itemStringIds).toEqual(['g_fire']); // sobrou o do herói 3
    clean(v);
  });
  it('não permite liberar o último jogador', () => {
    edit((d) => {
      expect(A.setOwner(d, 0, 0n)).toBe(false);
    });
  });
  it('parseSteamId valida', () => {
    expect(A.parseSteamId('76561198000000001')).toBe(76561198000000001n);
    expect(A.parseSteamId('abc')).toBeNull();
    expect(A.parseSteamId('99999999999999999999999')).toBeNull();
  });
  it('cor da roupa', () => {
    const v = edit((d) => A.setClothColor(d, 0, 5));
    expect(v.save.playerColors.find((c) => c.playerCharacter === 0)?._color).toBe(5);
  });
});

describe('upgrades', () => {
  it('define nível e limita ao máximo; 0 remove', () => {
    const v = edit((d) => {
      A.setUpgradeLevel(d, 1, 1, 99);
      A.setUpgradeLevel(d, 0, 1, 0);
    });
    expect(A.getUpgradeLevel(v, 1, 1)).toBe(8);
    expect(A.getUpgradeLevel(v, 0, 1)).toBe(0);
    clean(v);
  });
  it('maximizar todos os heróis respeita todos os máximos', () => {
    const v = edit(A.maximizeAllHeroes);
    for (let h = 0; h < 8; h++) {
      expect(A.getUpgradeLevel(v, h, 1)).toBe(8);
      expect(A.getUpgradeLevel(v, h, 2)).toBe(7);
      expect(A.getUpgradeLevel(v, h, 3)).toBe(5);
      expect(A.getUpgradeLevel(v, h, 5)).toBe(1);
      expect(A.getUpgradeLevel(v, h, 6)).toBe(2);
    }
    clean(v);
    const r = reread(v);
    expect(r.save.upgrades.lilyUpgrades).toHaveLength(5);
  });
  it('uid desconhecido lança', () => {
    expect(() => edit((d) => A.setUpgradeLevel(d, 0, 4, 1))).toThrow();
  });
});

describe('inventários', () => {
  it('calcula 3 slots mais a Pochete para o único herói com vínculo comprovado', () => {
    expect(A.inventoryCapacity(base, { kind: 'player', index: 0 })).toEqual({ limit: 3, certain: true });
    const upgraded = edit((d) => {
      A.setUpgradeLevel(d, 0, 6, 2);
    });
    expect(A.inventoryCapacity(upgraded, { kind: 'player', index: 0 })).toEqual({ limit: 5, certain: true });
    expect(A.inventoryCapacity(upgraded, { kind: 'bench' })).toBeNull();
  });
  it('recusa o quarto item sem Pochete e permite exatamente os dois slots extras', () => {
    const v = edit((d) => {
      expect(A.addItem(d, { kind: 'player', index: 0 }, 'g_fire')).toBe(false);
      expect(A.setUpgradeLevel(d, 0, 6, 1)).toBe(true);
      expect(A.addItem(d, { kind: 'player', index: 0 }, 'g_fire')).toBe(true);
      expect(A.addItem(d, { kind: 'player', index: 0 }, 'g_hgun')).toBe(false);
      expect(A.setUpgradeLevel(d, 0, 6, 2)).toBe(true);
      expect(A.addItem(d, { kind: 'player', index: 0 }, 'g_hgun')).toBe(true);
      expect(A.addItem(d, { kind: 'player', index: 0 }, 'g_mask')).toBe(false);
    });
    expect(v.save.playerInventories[0]?.itemStringIds).toHaveLength(5);
    clean(v);
  });
  it('recusa reduzir a Pochete quando os itens não caberiam e preserva tudo', () => {
    const v = edit((d) => {
      A.setUpgradeLevel(d, 0, 6, 2);
      A.addItem(d, { kind: 'player', index: 0 }, 'g_fire');
      A.addItem(d, { kind: 'player', index: 0 }, 'g_hgun');
      expect(A.canSetUpgradeLevel(d, 0, 6, 1)).toBe(false);
      expect(A.setUpgradeLevel(d, 0, 6, 1)).toBe(false);
    });
    expect(A.getUpgradeLevel(v, 0, 6)).toBe(2);
    expect(v.save.playerInventories[0]?.itemStringIds).toHaveLength(5);
  });
  it('usa só 3 slots para novas adições quando há vários heróis sem vínculo confirmado', () => {
    const v = edit((d) => {
      A.setOwner(d, 3, 76561198000000002n);
      A.setUpgradeLevel(d, 0, 6, 2);
      expect(A.inventoryCapacity(d, { kind: 'player', index: 0 })).toEqual({ limit: 3, certain: false });
      expect(A.addItem(d, { kind: 'player', index: 0 }, 'g_fire')).toBe(false);
      expect(A.addItem(d, { kind: 'player', index: 1 }, 'g_fire')).toBe(true);
    });
    expect(v.save.playerInventories[0]?.itemStringIds).toHaveLength(3);
    expect(v.save.playerInventories[1]?.itemStringIds).toHaveLength(1);
  });
  it('não permite acrescentar dados numéricos, Outros ou itens internos, mas mantém itens existentes', () => {
    const v = edit((d) => {
      for (const alias of ['dice1', 'ice', 'blursed24']) {
        expect(A.addItem(d, { kind: 'bench' }, alias)).toBe(false);
      }
      expect(A.addItem(d, { kind: 'bench' }, 'dice_tp')).toBe(true);
    });
    expect(v.save.playerInventories[0]?.itemStringIds).toContain('ice');
    expect(v.save.gameRoomTools.itemStringIds).toContain('dice_tp');
  });
  it('também recusa itens ocultos no inventário do personagem quando há espaço', () => {
    const v = edit((d) => {
      A.removeItem(d, { kind: 'player', index: 0 }, 0);
      for (const alias of ['dice1', 'ice', 'blursed24']) {
        expect(A.addItem(d, { kind: 'player', index: 0 }, alias)).toBe(false);
      }
    });
    expect(v.save.playerInventories[0]?.itemStringIds).toHaveLength(2);
  });
  it('adicionar item de bateria usa 1.0 e comum usa -1.0, mantendo o paralelismo', () => {
    const v = edit((d) => {
      A.setUpgradeLevel(d, 0, 6, 2);
      A.addItem(d, { kind: 'player', index: 0 }, 'g_fire');
      A.addItem(d, { kind: 'player', index: 0 }, 'dice_tp');
    });
    const inv = v.save.playerInventories[0];
    expect(inv?.itemStringIds.slice(-2)).toEqual(['g_fire', 'dice_tp']);
    expect(inv?.itemBatteryLevels.slice(-2)).toEqual([1, -1]);
    clean(v);
  });
  it('bateria só muda em itens com bateria e vira float32', () => {
    const v = edit((d) => {
      A.addItem(d, { kind: 'bench' }, 'g_fire');
      const i = d.save.gameRoomTools.itemStringIds.indexOf('g_fire');
      A.setBattery(d, { kind: 'bench' }, i, 0.85);
      A.setBattery(d, { kind: 'bench' }, 0, 0.5); // item sem bateria: ignorado
    });
    const i = v.save.gameRoomTools.itemStringIds.indexOf('g_fire');
    expect(v.save.gameRoomTools.itemBatteryLevels[i]).toBeCloseTo(0.85, 5);
    expect(v.save.gameRoomTools.itemBatteryLevels[0]).toBe(-1);
    const r = reread(v);
    expect(r.save.gameRoomTools.itemBatteryLevels[i]).toBe(Math.fround(0.85));
  });
  it('remover mantém ids e baterias alinhados', () => {
    const v = edit((d) => A.removeItem(d, { kind: 'bench' }, 1));
    expect(v.save.gameRoomTools.itemStringIds).toHaveLength(v.save.gameRoomTools.itemBatteryLevels.length);
    clean(v);
  });
  it('alias vazio é recusado', () => {
    edit((d) => {
      expect(A.addItem(d, { kind: 'bench' }, '')).toBe(false);
    });
  });
});

describe('hub e coleção', () => {
  it('mobílias e portas', () => {
    const v = edit((d) => {
      A.unlockAllFurnitures(d);
      A.unlockAllDoors(d);
      A.setFurniture(d, 99, true);
      A.setDoor(d, 0, true);
    });
    expect(v.save.furnitures.furnitures.slice().sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(v.save.unlockedKeyDoors.slice().sort()).toEqual([1, 2]);
    clean(v);
  });
  it('figuras: bit a bit e todas', () => {
    const v = edit((d) => {
      A.setAllFigurines(d, false);
      A.setFigurine(d, 0, true);
      A.setFigurine(d, 16, true);
      A.setFigurine(d, 17, true); // fora da faixa: ignorado
    });
    expect(v.collection.monsterFigurines).toBe(1 + 65536);
    expect(A.hasFigurine(v, 16)).toBe(true);
    expect(edit((d) => A.setAllFigurines(d, true)).collection.monsterFigurines).toBe(0x1ffff);
    clean(v);
  });
  it('dificuldade e ranque limitados', () => {
    const v = edit((d) => {
      A.setBoardDifficulty(d, '2:3', 9);
      A.setEndlessRank(d, -4);
    });
    expect(v.collection.bestBoardDifficulties.find((b) => b.boardKey === '2:3')?.difficulty).toBe(4);
    expect(v.collection.bestEndlessRank).toBe(0);
  });
});

describe('presets', () => {
  it('aceita saldo exatamente zero', () => {
    const v = edit((d) => {
      expect(A.setBank(d, 0)).toBe(true);
    });
    expect(v.save.bank.currentTotalScore).toBe(0);
  });
  it('recusa saldo negativo, fracionário e acima de int32 sem alterar o save', () => {
    const v = edit((d) => {
      for (const n of [-1, 0.5, A.MAX_INT32 + 1, Number.POSITIVE_INFINITY]) {
        expect(A.setBank(d, n)).toBe(false);
      }
      expect(A.setBank(d, A.MAX_INT32)).toBe(true);
    });
    expect(v.save.bank.currentTotalScore).toBe(A.MAX_INT32);
  });
  it('god mode gera um save válido e regravável', () => {
    const v = edit(A.godMode);
    expect(v.save.bank.currentTotalScore).toBe(99999);
    expect(v.collection.monsterFigurines).toBe(0x1ffff);
    clean(v);
    const r = reread(v);
    expect(r.save.gameRoomTools.itemStringIds).toContain('g_fire');
    expect(r.save.upgrades.redUpgrades).toHaveLength(5);
  });
  it('resetar run zera a rodada e esvazia inventários, preservando upgrades', () => {
    const withUp = edit(A.maximizeAllHeroes);
    const v = produce(withUp, (d) => {
      d.meta.roundIndex = 7;
      A.addItem(d, { kind: 'player', index: 0 }, 'ice');
      A.resetRun(d);
    });
    expect(v.meta.roundIndex).toBe(0);
    expect(v.save.playerInventories.every((i) => i.itemStringIds.length === 0)).toBe(true);
    expect(A.getUpgradeLevel(v, 0, 1)).toBe(8);
    clean(v);
  });
  it('banco recusa valores fora de 0..int32 sem truncamento silencioso', () => {
    const v = edit((d) => {
      expect(A.setBank(d, 1e12)).toBe(false);
      expect(A.setBank(d, -5)).toBe(false);
    });
    expect(v.save.bank.currentTotalScore).toBe(base.save.bank.currentTotalScore);
  });
});

describe('catálogo', () => {
  it('tem os itens oficiais, com bateria nos 6 corretos', () => {
    expect(OFFICIAL_ITEMS.length).toBeGreaterThan(100);
    expect(
      OFFICIAL_ITEMS.filter((i) => i.battery)
        .map((i) => i.alias)
        .sort(),
    ).toEqual(['g_fire', 'g_hgun', 'g_mask', 'g_megaphone', 'g_mobradar', 'g_xray']);
  });
  it('os aliases do save real existem no catálogo', () => {
    for (const a of ['dice_tp', 'dice_gather', 'ice', 'dice_boomheal', 'dice_cocoon', 'k_corridor'])
      expect(findItem(a)).toBeDefined();
  });
  it('busca ignora acento e caixa', () => {
    expect(searchItems(OFFICIAL_ITEMS, 'teletransporte').some((i) => i.alias === 'dice_tp')).toBe(true);
    expect(searchItems(OFFICIAL_ITEMS, 'CHAVE').some((i) => i.alias === 'k_corridor')).toBe(true);
  });
});
