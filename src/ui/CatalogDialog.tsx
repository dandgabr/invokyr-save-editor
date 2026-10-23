import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import {
  CATEGORY_LABELS,
  type CatalogItem,
  type ItemCategory,
  SELECTABLE_ITEMS,
  searchItems,
} from '../catalog/catalog';
import { HEROES } from '../schema/enums';
import * as A from '../state/actions';
import { useAnnounce } from './announce';
import { useEdit, useValues } from './hooks';

type TargetKey = 'bench' | `p${number}`;
const toTarget = (k: TargetKey): A.ItemTarget =>
  k === 'bench' ? { kind: 'bench' } : { kind: 'player', index: Number(k.slice(1)) };
const CATEGORIES: ItemCategory[] = ['dice', 'gadget', 'treasure', 'key'];

interface Props {
  initialTarget: A.ItemTarget;
  onClose: () => void;
  fallbackFocus: RefObject<HTMLElement | null>;
}

export function CatalogDialog({ initialTarget, onClose, fallbackFocus }: Props) {
  const v = useValues();
  const edit = useEdit();
  const ref = useRef<HTMLDialogElement>(null);
  const closeAfterPlayer = useRef(false);
  const [target, setTarget] = useState<TargetKey>(
    initialTarget.kind === 'bench' ? 'bench' : `p${initialTarget.index}`,
  );
  const [query, setQuery] = useState('');
  const say = useAnnounce((x) => x.say);
  const [category, setCategory] = useState<ItemCategory | 'all'>('all');

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      d?.close();
      if (
        !closeAfterPlayer.current &&
        opener?.isConnected &&
        !(opener instanceof HTMLButtonElement && opener.disabled)
      )
        opener.focus();
      else fallbackFocus.current?.focus();
    };
  }, [fallbackFocus]);

  const pool = SELECTABLE_ITEMS;
  const displayNames = useMemo(() => {
    const totals = new Map<string, number>();
    const seen = new Map<string, number>();
    const names = new Map<string, string>();
    for (const item of pool) totals.set(item.label, (totals.get(item.label) ?? 0) + 1);
    for (const item of pool) {
      const n = (seen.get(item.label) ?? 0) + 1;
      seen.set(item.label, n);
      names.set(item.alias, (totals.get(item.label) ?? 0) > 1 ? `${item.label} (variante ${n})` : item.label);
    }
    return names;
  }, [pool]);
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
    { key: 'bench', label: 'Ferramentas na bancada/prateleira' },
    ...v.save.playerInventories.map((_, i) => ({
      key: `p${i}` as TargetKey,
      label: A.inventoryCapacity(v, { kind: 'player', index: i })?.certain
        ? `Personagem ${i + 1} (${HEROES[occupied[i] as number]?.label})`
        : `Jogador ${i + 1} — personagem não confirmado`,
    })),
  ];
  const validTarget = targets.some((t) => t.key === target) ? target : 'bench';
  const targetLabel = targets.find((t) => t.key === validTarget)?.label ?? '';
  const current = A.inventoryOf(v, toTarget(validTarget))?.itemStringIds.length ?? 0;
  const capacity = A.inventoryCapacity(v, toTarget(validTarget));
  const full = capacity !== null && current >= capacity.limit;

  const request = (item: CatalogItem) => {
    const destination = toTarget(validTarget);
    const ok = edit((d) => {
      A.addItem(d, destination, item.alias);
    });
    say(
      ok
        ? `${item.label} adicionado a ${targetLabel} (${current + 1} itens).`
        : `Não foi possível adicionar ${item.label}: destino cheio ou item indisponível.`,
    );
    if (ok && destination.kind === 'player') {
      closeAfterPlayer.current = true;
      onClose();
    }
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
        <span className="muted">
          {capacity
            ? capacity.certain
              ? `${current} de ${capacity.limit} slots ocupados`
              : `${current} itens carregados; novas adições limitadas a 3 até confirmar o personagem`
            : `${current} itens na bancada`}
        </span>
      </div>
      <input
        className="input"
        type="search"
        placeholder="Buscar por nome ou descrição (ex.: cura, gelo, chave)…"
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
      <div className="catalog-grid">
        {shown.map((item) => (
          <article key={item.alias} className="card">
            <header className="card-head">
              <h3>{displayNames.get(item.alias)}</h3>
              <span className={`tag tag-${item.category}`}>{CATEGORY_LABELS[item.category]}</span>
            </header>
            <p className="muted">
              {item.desc ?? (item.localized ? 'Sem descrição.' : 'Sem nome ou descrição no jogo.')}
            </p>
            <div className="card-foot">
              <span className={item.battery ? 'amber' : 'muted'}>
                {item.battery ? `Carga: 100% (${item.battery.capacity}s)` : 'Carga: não se aplica'}
              </span>
              <button
                type="button"
                className="btn btn-green btn-sm"
                aria-label={`Requisitar ${displayNames.get(item.alias)} — ${item.desc ?? CATEGORY_LABELS[item.category]}`}
                disabled={full}
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
