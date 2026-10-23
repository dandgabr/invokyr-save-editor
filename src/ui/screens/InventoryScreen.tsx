import { useRef, useState } from 'react';
import { CATEGORY_LABELS, findItem } from '../../catalog/catalog';
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
  const edit = useEdit();
  const item = findItem(alias);
  const name = item?.label ?? 'Item não reconhecido';
  const type = item ? CATEGORY_LABELS[item.category] : 'Tipo desconhecido';
  const battery = item?.battery ?? null;
  const pct = Math.round(Math.max(0, Math.min(1, level)) * 100);
  const where = target.kind === 'bench' ? 'bancada' : `jogador ${target.index + 1}`;
  return (
    <article className="card">
      <header className="card-head">
        <h3>{name}</h3>
        <button
          type="button"
          className="btn btn-wax btn-sm"
          aria-label={`Remover ${name} (posição ${index + 1}, ${where})`}
          onClick={() => {
            edit((d) => A.removeItem(d, target, index));
            onRemoved(name);
          }}
        >
          ✕ Remover
        </button>
      </header>
      <p className="tiny muted">
        {type} • posição {index + 1}
      </p>
      <p className="muted">{item?.desc ?? 'Descrição indisponível nos dados verificados do jogo.'}</p>
      {battery ? (
        <label className="battery">
          <span className="field-label">
            Carga da bateria de {name}, {where}, posição {index + 1}: {pct}%
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
          Carga: não se aplica{level === -1 ? '' : ' (estado incomum preservado no save)'}
        </p>
      )}
    </article>
  );
}

export function InventoryScreen() {
  const v = useValues();
  const edit = useEdit();
  const [player, setPlayer] = useState(0);
  const [catalog, setCatalog] = useState<A.ItemTarget | null>(null);
  const say = useAnnounce((x) => x.say);
  const itemsHeading = useRef<HTMLHeadingElement>(null);
  const benchHeading = useRef<HTMLHeadingElement>(null);
  /** Depois de remover, o botão sai do DOM: o foco vai para o título da seção e a remoção é anunciada. */
  const removed = (name: string, ref: React.RefObject<HTMLHeadingElement | null>) => {
    say(`${name} removido.`);
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
      ? (HEROES[occupied[i] as number]?.label ?? `Jogador ${i + 1}`)
      : null;
  const heroOf = (i: number) => confirmedHero(i) ?? `não confirmado (jogador ${i + 1})`;

  return (
    <>
      <section className="panel">
        <h2>Personagem: {heroOf(idx)}</h2>
        <div className="chips" role="group" aria-label="Inventário do jogador">
          {v.save.playerInventories.map((p, i) => (
            <button
              key={i}
              type="button"
              className={`chip-btn${i === idx ? ' selected' : ''}`}
              aria-pressed={i === idx}
              onClick={() => setPlayer(i)}
            >
              Jogador {i + 1}
              {confirmedHero(i) ? ` (${confirmedHero(i)})` : ' — personagem não confirmado'} •{' '}
              {p.itemStringIds.length === 0 ? 'vazio' : `${p.itemStringIds.length} itens`}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2 ref={itemsHeading} tabIndex={-1}>
            Itens carregados ({inv?.itemStringIds.length ?? 0})
          </h2>
          <button
            type="button"
            className="btn btn-green"
            onClick={() => setCatalog({ kind: 'player', index: idx })}
            disabled={!inv || full}
          >
            + Adicionar item
          </button>
        </header>
        {capacity && (
          <p className="muted">
            {capacity.certain
              ? `${inv?.itemStringIds.length ?? 0} de ${capacity.limit} slots ocupados.`
              : `${inv?.itemStringIds.length ?? 0} itens carregados. Novas adições ficam limitadas a 3 até confirmar a associação entre personagem e inventário; os itens existentes são preservados.`}
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
          <p className="muted">Inventário vazio.</p>
        )}
      </section>

      <section className="panel">
        <header className="panel-head">
          <div>
            <h2 ref={benchHeading} tabIndex={-1}>
              Ferramentas na bancada/prateleira
            </h2>
            <p className="muted">Itens disponíveis no lobby para qualquer herói equipar antes da partida.</p>
          </div>
          <button type="button" className="btn btn-green" onClick={() => setCatalog({ kind: 'bench' })}>
            + Adicionar ferramenta
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
          <p className="muted">Bancada vazia.</p>
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
