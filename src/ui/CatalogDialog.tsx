import { type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import {
  type CatalogItem,
  categoryName,
  type ItemCategory,
  itemDescription,
  itemName,
  SELECTABLE_ITEMS,
  searchItems,
} from '../catalog/catalog';
import { useLocale, useText } from '../i18n';
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
  const t = useText();
  const { locale } = useLocale();
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
    for (const item of pool)
      totals.set(itemName(item, locale), (totals.get(itemName(item, locale)) ?? 0) + 1);
    for (const item of pool) {
      const name = itemName(item, locale);
      const n = (seen.get(name) ?? 0) + 1;
      seen.set(name, n);
      names.set(
        item.alias,
        (totals.get(name) ?? 0) > 1 ? `${name} (${t('variant', 'variante', 'variante')} ${n})` : name,
      );
    }
    return names;
  }, [pool, locale]);
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
        locale,
      ),
    [pool, category, query, locale],
  );

  const occupied = A.occupiedHeroes(v);
  const targets: { key: TargetKey; label: string }[] = [
    {
      key: 'bench',
      label: t(
        'Tools on the bench/shelf',
        'Ferramentas na bancada/prateleira',
        'Herramientas en la mesa/estante',
      ),
    },
    ...v.save.playerInventories.map((_, i) => ({
      key: `p${i}` as TargetKey,
      label: A.inventoryCapacity(v, { kind: 'player', index: i })?.certain
        ? `${t('Character', 'Personagem', 'Personaje')} ${i + 1} (${HEROES[occupied[i] as number]?.label})`
        : `${t('Player', 'Jogador', 'Jugador')} ${i + 1} — ${t('character unconfirmed', 'personagem não confirmado', 'personaje no confirmado')}`,
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
        ? `${itemName(item, locale)} ${t('added to', 'adicionado a', 'agregado a')} ${targetLabel} (${current + 1} ${t('items', 'itens', 'objetos')}).`
        : `${t('Could not add', 'Não foi possível adicionar', 'No se pudo agregar')} ${itemName(item, locale)}: ${t('destination full or item unavailable.', 'destino cheio ou item indisponível.', 'destino lleno u objeto no disponible.')}`,
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
        <h2 id="catalog-title">
          {t('General relic index', 'Índice geral de relíquias', 'Índice general de reliquias')}
        </h2>
        <button type="button" className="btn btn-brass" onClick={onClose}>
          ← {t('Back to inventory', 'Voltar ao inventário', 'Volver al inventario')}
        </button>
      </header>
      <div className="catalog-bar">
        <label className="inline">
          <span>{t('Destination', 'Destino', 'Destino')}:</span>
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
              ? `${current} ${t('of', 'de', 'de')} ${capacity.limit} ${t('slots occupied', 'slots ocupados', 'espacios ocupados')}`
              : `${current} ${t('carried items; new additions limited to 3 until the character is confirmed', 'itens carregados; novas adições limitadas a 3 até confirmar o personagem', 'objetos cargados; nuevas adiciones limitadas a 3 hasta confirmar el personaje')}`
            : `${current} ${t('items on the bench', 'itens na bancada', 'objetos en la mesa')}`}
        </span>
      </div>
      <input
        className="input"
        type="search"
        placeholder={t(
          'Search by name or description (e.g. heal, ice, key)…',
          'Buscar por nome ou descrição (ex.: cura, gelo, chave)…',
          'Busca por nombre o descripción (p. ej., cura, hielo, llave)…',
        )}
        aria-label={t('Search relic', 'Buscar relíquia', 'Buscar reliquia')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="chips" role="group" aria-label={t('Category', 'Categoria', 'Categoría')}>
        <button
          type="button"
          className={`chip-btn${category === 'all' ? ' selected' : ''}`}
          aria-pressed={category === 'all'}
          onClick={() => setCategory('all')}
        >
          {t('All', 'Todos', 'Todos')} ({pool.length})
        </button>
        {CATEGORIES.filter((c) => counts.has(c)).map((c) => (
          <button
            key={c}
            type="button"
            className={`chip-btn${category === c ? ' selected' : ''}`}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {categoryName(c, locale)} ({counts.get(c)})
          </button>
        ))}
      </div>
      <div className="catalog-grid">
        {shown.map((item) => (
          <article key={item.alias} className="card">
            <header className="card-head">
              <h3>{displayNames.get(item.alias)}</h3>
              <span className={`tag tag-${item.category}`}>{categoryName(item.category, locale)}</span>
            </header>
            <p className="muted">
              {itemDescription(item, locale) ??
                (item.localized
                  ? t('No description.', 'Sem descrição.', 'Sin descripción.')
                  : t(
                      'No name or description in the game.',
                      'Sem nome ou descrição no jogo.',
                      'Sin nombre ni descripción en el juego.',
                    ))}
            </p>
            <div className="card-foot">
              <span className={item.battery ? 'amber' : 'muted'}>
                {item.battery
                  ? `${t('Charge', 'Carga', 'Carga')}: 100% (${item.battery.capacity}s)`
                  : t('Charge: not applicable', 'Carga: não se aplica', 'Carga: no aplica')}
              </span>
              <button
                type="button"
                className="btn btn-green btn-sm"
                aria-label={`${t('Request', 'Requisitar', 'Solicitar')} ${displayNames.get(item.alias)} — ${itemDescription(item, locale) ?? categoryName(item.category, locale)}`}
                disabled={full}
                onClick={() => request(item)}
              >
                <span aria-hidden="true">+ </span>
                {t('Request', 'Requisitar', 'Solicitar')}
              </button>
            </div>
          </article>
        ))}
        {shown.length === 0 && (
          <p className="muted">
            {t('No items found.', 'Nenhum item encontrado.', 'No se encontraron objetos.')}
          </p>
        )}
      </div>
      <footer className="muted">
        {t('Showing', 'Exibindo', 'Mostrando')} {shown.length} {t('of', 'de', 'de')} {pool.length}{' '}
        {t(
          'items from the verified game build.',
          'itens da build verificada do jogo.',
          'objetos de la build verificada del juego.',
        )}
      </footer>
    </dialog>
  );
}
