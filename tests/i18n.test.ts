import { describe, expect, it } from 'vitest';
import { ITEM_CATALOG, SELECTABLE_ITEMS, searchItems } from '../src/catalog/catalog';
import { resolveLocale, selectText } from '../src/i18n';
import type { SaveValues } from '../src/schema/types';
import { diagnosticMessage, fieldName } from '../src/ui/diagnostics';
import template from './fixtures/template.json';

describe('language selection', () => {
  it('honors stored choice, maps browser languages and falls back to en-US', () => {
    expect(resolveLocale('es-419', ['pt-BR'])).toBe('es-419');
    expect(resolveLocale(null, ['fr-FR', 'pt-PT'])).toBe('pt-BR');
    expect(resolveLocale(null, ['es-MX'])).toBe('es-419');
    expect(resolveLocale('invalid', ['fr-FR'])).toBe('en-US');
    expect(selectText('en-US', 'English', 'Português', 'Español')).toBe('English');
  });

  it('catalog names and descriptions exist in all supported languages and search follows locale', () => {
    for (const item of SELECTABLE_ITEMS) {
      for (const locale of ['en-US', 'pt-BR', 'es-419'] as const) {
        expect(item.labels[locale]?.trim(), item.alias).toBeTruthy();
        expect(item.descriptions[locale]?.trim(), item.alias).toBeTruthy();
      }
    }
    const camera = ITEM_CATALOG.find((item) => item.alias === 'g_camera');
    expect(camera?.labels['es-419']).toBe('Cámara');
    expect(searchItems(SELECTABLE_ITEMS, 'cámara', 'es-419').some((item) => item.alias === 'g_camera')).toBe(
      true,
    );
    expect(searchItems(SELECTABLE_ITEMS, 'camera', 'es-419')).toEqual([]);
  });

  it('shows localized validation details without raw property names', () => {
    expect(fieldName('save.unlockedKeyDoors[0]', 'en-US')).toContain('Locked passages');
    expect(diagnosticMessage('Saldo deve ser inteiro entre 0 e 2147483647', 'es-419')).toContain('saldo');
  });

  it('distinguishes heroes, upgrades and boards in the save review', () => {
    const values = template as unknown as SaveValues;
    expect(fieldName('save.upgrades.redUpgrades[0].y', 'en-US', values)).toContain('Red • Health');
    expect(fieldName('save.upgrades.specsUpgrades[0].y', 'en-US', values)).toContain('Specs');
    expect(fieldName('save.playerColors[1]._color', 'es-419', values)).toContain('Specs');
    expect(fieldName('collection.completedBoardKeys[1]', 'en-US', values)).toContain('Ice');
  });

  it('keeps the cause of an unexpected structure error in every language', () => {
    expect(diagnosticMessage('Estrutura do save inesperada: missing bank', 'en-US')).toContain(
      'missing bank',
    );
    expect(diagnosticMessage('Saúde: nível 9 fora de 1..8', 'es-419')).toContain('Salud');
  });
});
