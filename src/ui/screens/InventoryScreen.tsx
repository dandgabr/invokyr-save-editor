import { useState } from 'react';
import { findItem } from '../../catalog/catalog';
import { HEROES } from '../../schema/enums';
import * as A from '../../state/actions';
import { CatalogDialog } from '../CatalogDialog';
import { useEdit, useValues } from '../hooks';

function ItemRow({
  alias,
  level,
  target,
  index,
}: {
  alias: string;
  level: number;
  target: A.ItemTarget;
  index: number;
}) {
  const edit = useEdit();
  const item = findItem(alias);
  const battery = item?.battery ?? null;
  const pct = Math.round(Math.max(0, Math.min(1, level)) * 100);
  return (
    <article className="card">
      <header className="card-head">
        <h3>{item?.label ?? alias}</h3>
        <button
          type="button"
          className="btn btn-wax btn-sm"
          aria-label={`Remover ${item?.label ?? alias}`}
          onClick={() => edit((d) => A.removeItem(d, target, index))}
        >
          ✕ Remover
        </button>
      </header>
      <p className="tiny muted">
        ID: <code>{alias}</code>
        {item ? '' : ' (não consta no catálogo do jogo)'}
      </p>
      {battery ? (
        <label className="battery">
          <span className="field-label">Carga da bateria: {pct}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={pct}
            aria-label={`Carga de ${item?.label}`}
            onChange={(e) => edit((d) => A.setBattery(d, target, index, Number(e.target.value) / 100))}
          />
        </label>
      ) : (
        <p className="muted">Sem bateria (carga {level === -1 ? 'passiva' : level})</p>
      )}
    </article>
  );
}

export function InventoryScreen() {
  const v = useValues();
  const edit = useEdit();
  const [player, setPlayer] = useState(0);
  const [catalog, setCatalog] = useState<A.ItemTarget | null>(null);
  const occupied = A.occupiedHeroes(v);
  const idx = Math.min(player, Math.max(0, v.save.playerInventories.length - 1));
  const inv = v.save.playerInventories[idx];
  const bench = v.save.gameRoomTools;
  const heroOf = (i: number) => HEROES[occupied[i] as number]?.label ?? `Jogador ${i + 1}`;

  return (
    <>
      <section className="panel">
        <h2>Pasta de couro: {heroOf(idx)}</h2>
        <div className="chips" role="group" aria-label="Inventário do jogador">
          {v.save.playerInventories.map((p, i) => (
            <button
              key={i}
              type="button"
              className={`chip-btn${i === idx ? ' selected' : ''}`}
              aria-pressed={i === idx}
              onClick={() => setPlayer(i)}
            >
              Jogador {i + 1} ({heroOf(i)}) •{' '}
              {p.itemStringIds.length === 0 ? 'vazio' : `${p.itemStringIds.length} itens`}
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>Itens na pasta ({inv?.itemStringIds.length ?? 0})</h2>
          <button
            type="button"
            className="btn btn-green"
            onClick={() => setCatalog({ kind: 'player', index: idx })}
            disabled={!inv}
          >
            + Adicionar item
          </button>
        </header>
        {inv && inv.itemStringIds.length > 0 ? (
          <div className="grid grid-3">
            {inv.itemStringIds.map((alias, i) => (
              <ItemRow
                key={`${alias}-${i}`}
                alias={alias}
                level={inv.itemBatteryLevels[i] ?? -1}
                target={{ kind: 'player', index: idx }}
                index={i}
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
            <h2>Ferramentas na bancada do hub (gameRoomTools)</h2>
            <p className="muted">Itens disponíveis no lobby para qualquer herói equipar antes da partida.</p>
          </div>
          <button type="button" className="btn btn-green" onClick={() => setCatalog({ kind: 'bench' })}>
            + Adicionar ferramenta
          </button>
        </header>
        <ul className="pills">
          {bench.itemStringIds.map((alias, i) => (
            <li key={`${alias}-${i}`} className="pill">
              <span>{findItem(alias)?.label ?? alias}</span>
              <button
                type="button"
                className="pill-x"
                aria-label={`Remover ${findItem(alias)?.label ?? alias}`}
                onClick={() => edit((d) => A.removeItem(d, { kind: 'bench' }, i))}
              >
                ✕
              </button>
            </li>
          ))}
          {bench.itemStringIds.length === 0 && <li className="muted">Bancada vazia.</li>}
        </ul>
      </section>
      {catalog && <CatalogDialog initialTarget={catalog} onClose={() => setCatalog(null)} />}
    </>
  );
}
