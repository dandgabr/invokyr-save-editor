import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATEGORY_LABELS,
  type CatalogItem,
  ITEM_CATALOG,
  type ItemCategory,
  OFFICIAL_ITEMS,
  searchItems,
} from '../catalog/catalog';
import { HEROES } from '../schema/enums';
import * as A from '../state/actions';
import { useAnnounce } from './announce';
import { useEdit, useValues } from './hooks';

type TargetKey = 'bench' | `p${number}`;
const toTarget = (k: TargetKey): A.ItemTarget =>
  k === 'bench' ? { kind: 'bench' } : { kind: 'player', index: Number(k.slice(1)) };
const CATEGORIES: ItemCategory[] = ['dice', 'gadget', 'treasure', 'key', 'plain-dice', 'other'];

interface Props {
  initialTarget: A.ItemTarget;
  onClose: () => void;
}

export function CatalogDialog({ initialTarget, onClose }: Props) {
  const v = useValues();
  const edit = useEdit();
  const ref = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<TargetKey>(
    initialTarget.kind === 'bench' ? 'bench' : `p${initialTarget.index}`,
  );
  const [query, setQuery] = useState('');
  const say = useAnnounce((x) => x.say);
  const [category, setCategory] = useState<ItemCategory | 'all'>('all');
  const [internal, setInternal] = useState(false);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      d?.close();
      opener?.focus();
    };
  }, []);

  const pool = internal ? ITEM_CATALOG : OFFICIAL_ITEMS;
  const counts = useMemo(() => {
    const c = new Map<ItemCategory, number>();
    for (const i of pool) c.set(i.category, (c.get(i.category) ?? 0) + 1);
    return c;
  }, [pool]);
  const shown = useMemo(
    () =>
      searchItems(
        pool.filter((i) => category === 'all' || i.category === category),
        query,
      ),
    [pool, category, query],
  );

  const occupied = A.occupiedHeroes(v);
  const targets: { key: TargetKey; label: string }[] = [
    { key: 'bench', label: 'Bancada do hub (gameRoomTools)' },
    ...v.save.playerInventories.map((_, i) => ({
      key: `p${i}` as TargetKey,
      label: `Inventário do jogador ${i + 1}${occupied[i] !== undefined ? ` (${HEROES[occupied[i] as number]?.label})` : ''}`,
    })),
  ];
  const validTarget = targets.some((t) => t.key === target) ? target : 'bench';
  const targetLabel = targets.find((t) => t.key === validTarget)?.label ?? '';
  const current = A.inventoryOf(v, toTarget(validTarget))?.itemStringIds.length ?? 0;

  const request = (item: CatalogItem) => {
    const ok = edit((d) => {
      A.addItem(d, toTarget(validTarget), item.alias);
    });
    say(
      ok
        ? `${item.label} adicionado a ${targetLabel} (${current + 1} itens).`
        : `Não foi possível adicionar ${item.label}.`,
    );
  };

  return (
    <dialog
      ref={ref}
      className="dialog dialog-wide"
      aria-labelledby="catalog-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header className="dialog-head">
        <h2 id="catalog-title">Índice geral de relíquias</h2>
        <button type="button" className="btn btn-brass" onClick={onClose}>
          ← Voltar ao inventário
        </button>
      </header>
      <div className="catalog-bar">
        <label className="inline">
          <span>Destino:</span>
          <select
            className="input"
            value={validTarget}
            onChange={(e) => setTarget(e.target.value as TargetKey)}
          >
            {targets.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <span className="muted">Itens no destino: {current}</span>
      </div>
      <input
        className="input"
        type="search"
        placeholder="Buscar por nome, alias ou descrição (ex.: cura, gelo, chave)…"
        aria-label="Buscar relíquia"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="chips" role="group" aria-label="Categoria">
        <button
          type="button"
          className={`chip-btn${category === 'all' ? ' selected' : ''}`}
          aria-pressed={category === 'all'}
          onClick={() => setCategory('all')}
        >
          Todos ({pool.length})
        </button>
        {CATEGORIES.filter((c) => counts.has(c)).map((c) => (
          <button
            key={c}
            type="button"
            className={`chip-btn${category === c ? ' selected' : ''}`}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {CATEGORY_LABELS[c]} ({counts.get(c)})
          </button>
        ))}
      </div>
      <label className="inline muted">
        <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Mostrar
        também itens internos/de teste do jogo ({ITEM_CATALOG.length - OFFICIAL_ITEMS.length})
      </label>
      <div className="catalog-grid">
        {shown.map((item) => (
          <article key={item.alias} className="card">
            <header className="card-head">
              <h3>{item.label}</h3>
              <span className={`tag tag-${item.category}`}>{CATEGORY_LABELS[item.category]}</span>
            </header>
            <p className="muted">
              {item.desc ?? (item.localized ? 'Sem descrição.' : 'Sem nome ou descrição no jogo.')}
            </p>
            <p className="alias">
              <code>{item.alias}</code>
            </p>
            <div className="card-foot">
              <span className={item.battery ? 'amber' : 'muted'}>
                {item.battery ? `Bateria (${item.battery.capacity}s)` : 'Carga: passivo'}
              </span>
              <button
                type="button"
                className="btn btn-green btn-sm"
                aria-label={`Requisitar ${item.label} (${item.alias})`}
                onClick={() => request(item)}
              >
                <span aria-hidden="true">+ </span>Requisitar
              </button>
            </div>
          </article>
        ))}
        {shown.length === 0 && <p className="muted">Nenhum item encontrado.</p>}
      </div>
      <footer className="muted">
        Exibindo {shown.length} de {pool.length} itens dos binários do jogo (build verificada).
      </footer>
    </dialog>
  );
}
