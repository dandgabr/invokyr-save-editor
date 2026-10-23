import { useRef, useState } from 'react';
import { categoryName, findItem, itemDescription, itemName } from '../../catalog/catalog';
import { useLocale, useText } from '../../i18n';
import { HEROES } from '../../schema/enums';
import * as A from '../../state/actions';
import { useAnnounce } from '../announce';
import { CatalogDialog } from '../CatalogDialog';
import { useEdit, useValues } from '../hooks';

function ItemRow({
  alias,
  level,
  target,
  index,
  onRemoved,
}: {
  alias: string;
  level: number;
  target: A.ItemTarget;
  index: number;
  onRemoved: (label: string) => void;
}) {
  const t = useText();
  const { locale } = useLocale();
  const edit = useEdit();
  const item = findItem(alias);
  const name = item
    ? itemName(item, locale)
    : t('Unrecognized item', 'Item não reconhecido', 'Objeto no reconocido');
  const type = item
    ? categoryName(item.category, locale)
    : t('Unknown type', 'Tipo desconhecido', 'Tipo desconocido');
  const battery = item?.battery ?? null;
  const pct = Math.round(Math.max(0, Math.min(1, level)) * 100);
  const where =
    target.kind === 'bench'
      ? t('bench', 'bancada', 'mesa de trabajo')
      : `${t('player', 'jogador', 'jugador')} ${target.index + 1}`;
  return (
    <article className="card">
      <header className="card-head">
        <h3>{name}</h3>
        <button
          type="button"
          className="btn btn-wax btn-sm"
          aria-label={`${t('Remove', 'Remover', 'Quitar')} ${name} (${t('position', 'posição', 'posición')} ${index + 1}, ${where})`}
          onClick={() => {
            edit((d) => A.removeItem(d, target, index));
            onRemoved(name);
          }}
        >
          ✕ {t('Remove', 'Remover', 'Quitar')}
        </button>
      </header>
      <p className="tiny muted">
        {type} • {t('position', 'posição', 'posición')} {index + 1}
      </p>
      <p className="muted">
        {item
          ? (itemDescription(item, locale) ??
            t(
              'Description unavailable in the verified game data.',
              'Descrição indisponível nos dados verificados do jogo.',
              'Descripción no disponible en los datos verificados del juego.',
            ))
          : t(
              'Description unavailable in the verified game data.',
              'Descrição indisponível nos dados verificados do jogo.',
              'Descripción no disponible en los datos verificados del juego.',
            )}
      </p>
      {battery ? (
        <label className="battery">
          <span className="field-label">
            {t('Battery charge of', 'Carga da bateria de', 'Carga de batería de')} {name}, {where},{' '}
            {t('position', 'posição', 'posición')} {index + 1}: {pct}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={pct}
            aria-valuetext={`${pct}%`}
            onChange={(e) =>
              edit(
                (d) => A.setBattery(d, target, index, Number(e.target.value) / 100),
                `battery:${where}:${index}`,
              )
            }
          />
        </label>
      ) : (
        <p className="muted">
          {t('Charge: not applicable', 'Carga: não se aplica', 'Carga: no aplica')}
          {level === -1
            ? ''
            : t(
                ' (unusual state preserved in the save)',
                ' (estado incomum preservado no save)',
                ' (estado inusual conservado en la partida)',
              )}
        </p>
      )}
    </article>
  );
}

export function InventoryScreen() {
  const t = useText();
  const v = useValues();
  const edit = useEdit();
  const [player, setPlayer] = useState(0);
  const [catalog, setCatalog] = useState<A.ItemTarget | null>(null);
  const say = useAnnounce((x) => x.say);
  const itemsHeading = useRef<HTMLHeadingElement>(null);
  const benchHeading = useRef<HTMLHeadingElement>(null);
  /** Depois de remover, o botão sai do DOM: o foco vai para o título da seção e a remoção é anunciada. */
  const removed = (name: string, ref: React.RefObject<HTMLHeadingElement | null>) => {
    say(`${name} ${t('removed.', 'removido.', 'quitado.')}`);
    setTimeout(() => ref.current?.focus(), 0);
  };
  const occupied = A.occupiedHeroes(v);
  const idx = Math.min(player, Math.max(0, v.save.playerInventories.length - 1));
  const inv = v.save.playerInventories[idx];
  const capacity = A.inventoryCapacity(v, { kind: 'player', index: idx });
  const full = capacity !== null && (inv?.itemStringIds.length ?? 0) >= capacity.limit;
  const bench = v.save.gameRoomTools;
  const confirmedHero = (i: number) =>
    A.inventoryCapacity(v, { kind: 'player', index: i })?.certain
      ? (HEROES[occupied[i] as number]?.label ?? `${t('Player', 'Jogador', 'Jugador')} ${i + 1}`)
      : null;
  const heroOf = (i: number) =>
    confirmedHero(i) ??
    `${t('unconfirmed', 'não confirmado', 'no confirmado')} (${t('player', 'jogador', 'jugador')} ${i + 1})`;

  return (
    <>
      <section className="panel">
        <h2>
          {t('Character', 'Personagem', 'Personaje')}: {heroOf(idx)}
        </h2>
        <div
          className="chips"
          role="group"
          aria-label={t('Player inventory', 'Inventário do jogador', 'Inventario del jugador')}
        >
          {v.save.playerInventories.map((p, i) => (
            <button
              key={i}
              type="button"
              className={`chip-btn${i === idx ? ' selected' : ''}`}
              aria-pressed={i === idx}
              onClick={() => setPlayer(i)}
            >
              {t('Player', 'Jogador', 'Jugador')} {i + 1}
              {confirmedHero(i)
                ? ` (${confirmedHero(i)})`
                : t(
                    ' — character unconfirmed',
                    ' — personagem não confirmado',
                    ' — personaje no confirmado',
                  )}{' '}
              •{' '}
              {p.itemStringIds.length === 0
                ? t('empty', 'vazio', 'vacío')
                : `${p.itemStringIds.length} ${t('items', 'itens', 'objetos')}`}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2 ref={itemsHeading} tabIndex={-1}>
            {t('Carried items', 'Itens carregados', 'Objetos cargados')} ({inv?.itemStringIds.length ?? 0})
          </h2>
          <button
            type="button"
            className="btn btn-green"
            onClick={() => setCatalog({ kind: 'player', index: idx })}
            disabled={!inv || full}
          >
            + {t('Add item', 'Adicionar item', 'Agregar objeto')}
          </button>
        </header>
        {capacity && (
          <p className="muted">
            {capacity.certain
              ? `${inv?.itemStringIds.length ?? 0} ${t('of', 'de', 'de')} ${capacity.limit} ${t('slots occupied.', 'slots ocupados.', 'espacios ocupados.')}`
              : `${inv?.itemStringIds.length ?? 0} ${t('carried items. New additions are limited to 3 until the character-to-inventory mapping is confirmed; existing items are preserved.', 'itens carregados. Novas adições ficam limitadas a 3 até confirmar a associação entre personagem e inventário; os itens existentes são preservados.', 'objetos cargados. Las nuevas adiciones se limitan a 3 hasta confirmar la relación entre personaje e inventario; se conservan los objetos existentes.')}`}
          </p>
        )}
        {inv && inv.itemStringIds.length > 0 ? (
          <div className="grid grid-3">
            {inv.itemStringIds.map((alias, i) => (
              <ItemRow
                key={`${alias}-${i}`}
                alias={alias}
                level={inv.itemBatteryLevels[i] ?? -1}
                target={{ kind: 'player', index: idx }}
                index={i}
                onRemoved={(n) => removed(n, itemsHeading)}
              />
            ))}
          </div>
        ) : (
          <p className="muted">{t('Empty inventory.', 'Inventário vazio.', 'Inventario vacío.')}</p>
        )}
      </section>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2 ref={benchHeading} tabIndex={-1}>
              {t(
                'Tools on the bench/shelf',
                'Ferramentas na bancada/prateleira',
                'Herramientas en la mesa/estante',
              )}
            </h2>
            <p className="muted">
              {t(
                'Items available in the lobby for any hero to equip before a run.',
                'Itens disponíveis no lobby para qualquer herói equipar antes da partida.',
                'Objetos disponibles en la sala para que cualquier héroe los equipe antes de la partida.',
              )}
            </p>
          </div>
          <button type="button" className="btn btn-green" onClick={() => setCatalog({ kind: 'bench' })}>
            + {t('Add tool', 'Adicionar ferramenta', 'Agregar herramienta')}
          </button>
        </header>
        {bench.itemStringIds.length > 0 ? (
          <div className="grid grid-3">
            {bench.itemStringIds.map((alias, i) => (
              <ItemRow
                key={`${alias}-${i}`}
                alias={alias}
                level={bench.itemBatteryLevels[i] ?? -1}
                target={{ kind: 'bench' }}
                index={i}
                onRemoved={(n) => removed(n, benchHeading)}
              />
            ))}
          </div>
        ) : (
          <p className="muted">{t('Empty bench.', 'Bancada vazia.', 'Mesa vacía.')}</p>
        )}
      </section>
      {catalog && (
        <CatalogDialog
          initialTarget={catalog}
          onClose={() => setCatalog(null)}
          fallbackFocus={itemsHeading}
        />
      )}
    </>
  );
}
