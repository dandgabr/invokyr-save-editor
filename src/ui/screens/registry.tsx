import type { ReactNode } from 'react';
import type { Locale } from '../../i18n';
import { HubScreen } from './HubScreen';
import { InventoryScreen } from './InventoryScreen';
import { PresetsScreen } from './PresetsScreen';
import { SessionScreen } from './SessionScreen';
import { StatusScreen } from './StatusScreen';
import { TrophiesScreen } from './TrophiesScreen';

export interface ScreenDef {
  id: string;
  label: string;
  en: string;
  es: string;
  render: () => ReactNode;
}

/** Ordem e rótulos seguem as abas do design (docs/design/invokyr.pen). O catálogo (tela 7) abre a partir do inventário. */
export const SCREENS: ScreenDef[] = [
  {
    id: 'session',
    label: '1. Sessão & Heróis',
    en: '1. Session & Heroes',
    es: '1. Sesión y héroes',
    render: () => <SessionScreen />,
  },
  {
    id: 'status',
    label: '2. Status & Upgrades',
    en: '2. Status & Upgrades',
    es: '2. Estado y mejoras',
    render: () => <StatusScreen />,
  },
  {
    id: 'inventory',
    label: '3. Inventários & Itens',
    en: '3. Inventories & Items',
    es: '3. Inventarios y objetos',
    render: () => <InventoryScreen />,
  },
  {
    id: 'hub',
    label: '4. Hub & Mobílias',
    en: '4. Hub & Furniture',
    es: '4. Sala y muebles',
    render: () => <HubScreen />,
  },
  {
    id: 'trophies',
    label: '5. Troféus & Coleção',
    en: '5. Trophies & Collection',
    es: '5. Trofeos y colección',
    render: () => <TrophiesScreen />,
  },
  {
    id: 'presets',
    label: '6. Trainer Presets',
    en: '6. Trainer Presets',
    es: '6. Ajustes rápidos',
    render: () => <PresetsScreen />,
  },
];

export const screenLabel = (screen: ScreenDef, locale: Locale) =>
  locale === 'pt-BR' ? screen.label : locale === 'es-419' ? screen.es : screen.en;
