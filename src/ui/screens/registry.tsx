import type { ReactNode } from 'react';
import { HubScreen } from './HubScreen';
import { InventoryScreen } from './InventoryScreen';
import { PresetsScreen } from './PresetsScreen';
import { SessionScreen } from './SessionScreen';
import { StatusScreen } from './StatusScreen';
import { TrophiesScreen } from './TrophiesScreen';

export interface ScreenDef {
  id: string;
  label: string;
  render: () => ReactNode;
}

/** Ordem e rótulos seguem as abas do design (docs/design/invokyr.pen). O catálogo (tela 7) abre a partir do inventário. */
export const SCREENS: ScreenDef[] = [
  { id: 'session', label: '1. Sessão & Heróis', render: () => <SessionScreen /> },
  { id: 'status', label: '2. Status & Upgrades', render: () => <StatusScreen /> },
  { id: 'inventory', label: '3. Inventários & Itens', render: () => <InventoryScreen /> },
  { id: 'hub', label: '4. Hub & Mobílias', render: () => <HubScreen /> },
  { id: 'trophies', label: '5. Troféus & Coleção', render: () => <TrophiesScreen /> },
  { id: 'presets', label: '6. Trainer Presets', render: () => <PresetsScreen /> },
];
