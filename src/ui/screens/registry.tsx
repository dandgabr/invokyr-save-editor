import type { ReactNode } from 'react';

export interface ScreenDef {
  id: string;
  label: string;
  render: () => ReactNode;
}

const Soon = ({ name }: { name: string }) => (
  <section className="panel">
    <h2>{name}</h2>
    <p className="muted">Tela em construção.</p>
  </section>
);

/** Ordem e rótulos seguem as abas do design (docs/design/invokyr.pen). */
export const SCREENS: ScreenDef[] = [
  { id: 'session', label: '1. Sessão & Heróis', render: () => <Soon name="Sessão & Heróis" /> },
  { id: 'status', label: '2. Status & Upgrades', render: () => <Soon name="Status & Upgrades" /> },
  { id: 'inventory', label: '3. Inventários & Itens', render: () => <Soon name="Inventários & Itens" /> },
  { id: 'hub', label: '4. Hub & Mobílias', render: () => <Soon name="Hub & Mobílias" /> },
  { id: 'trophies', label: '5. Troféus & Coleção', render: () => <Soon name="Troféus & Coleção" /> },
  { id: 'presets', label: '6. Trainer Presets', render: () => <Soon name="Trainer Presets" /> },
];
