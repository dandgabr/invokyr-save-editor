import { useState } from 'react';
import { BIOMES, BOARD_MONSTERS, DIFFICULTIES, FIGURINES, labelOf } from '../../schema/enums';
import * as A from '../../state/actions';
import { useEdit, useValues } from '../hooks';

const boardLabel = (key: string) => {
  const [b, m] = key.split(':').map(Number);
  return `${labelOf(BIOMES, b ?? -1)} • ${labelOf(BOARD_MONSTERS, m ?? -1)}`;
};

/** Campo numérico com estado local: confirma no blur/Enter, sem uma entrada de desfazer por tecla. */
function RankField({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    setText(String(value));
  }
  const commit = () => {
    const n = Number(text);
    if (text.trim() === '' || !Number.isFinite(n)) return setText(String(value));
    onCommit(n);
    setText(String(Math.max(0, Math.min(A.MAX_INT32, Math.trunc(n)))));
  };
  return (
    <input
      className="input"
      inputMode="numeric"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}

export function TrophiesScreen() {
  const v = useValues();
  const edit = useEdit();
  const mask = v.collection.monsterFigurines >>> 0;
  const active = FIGURINES.filter((f) => A.hasFigurine(v, f.id)).length;
  const diffOf = (key: string) =>
    v.collection.bestBoardDifficulties.find((b) => b.boardKey === key)?.difficulty;

  return (
    <>
      <section className="panel">
        <header className="panel-head">
          <h2>Bestiário 3D & gabinete de curiosidades (CollectionRoom)</h2>
          <span className="tag tag-gold">
            {active} de {FIGURINES.length} figuras
          </span>
        </header>
        <p className="muted">
          Bitmask atual: <code>{mask}</code> (0x{mask.toString(16)}). O jogo tem {FIGURINES.length} figuras
          (máscara total 0x1FFFF).
        </p>
        <div className="actions">
          <button
            type="button"
            className="btn btn-green"
            onClick={() => edit((d) => A.setAllFigurines(d, true))}
          >
            ★ Ativar todas as {FIGURINES.length}
          </button>
          <button
            type="button"
            className="btn btn-wax"
            onClick={() => edit((d) => A.setAllFigurines(d, false))}
          >
            ✕ Desmarcar todas
          </button>
        </div>
        <ul className="grid grid-4 plain">
          {FIGURINES.map((f) => {
            const on = A.hasFigurine(v, f.id);
            return (
              <li key={f.id}>
                <label className={`card card-check${on ? ' card-active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => edit((d) => A.setFigurine(d, f.id, e.target.checked))}
                  />
                  <span>
                    <strong>{f.label}</strong>
                    <span className="tiny muted"> Bit {f.id}</span>
                  </span>
                  <span className={on ? 'tag tag-gold' : 'tag'} aria-hidden="true">
                    {on ? 'Ativo' : 'Off'}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid grid-2">
        <section className="panel">
          <h2>Tabuleiros concluídos (completedBoardKeys)</h2>
          {v.collection.completedBoardKeys.length === 0 ? (
            <p className="muted">Nenhum tabuleiro concluído.</p>
          ) : (
            <ul className="plain">
              {v.collection.completedBoardKeys.map((key) => {
                const d = diffOf(key);
                return (
                  <li key={key} className="row">
                    <span>
                      {boardLabel(key)} <code className="tiny">({key})</code>
                    </span>
                    <select
                      className="input input-sm"
                      aria-label={`Melhor dificuldade em ${boardLabel(key)}`}
                      value={d ?? ''}
                      onChange={(e) => edit((s) => A.setBoardDifficulty(s, key, Number(e.target.value)))}
                    >
                      {d === undefined && <option value="">—</option>}
                      {DIFFICULTIES.map((x) => (
                        <option key={x.id} value={x.id}>
                          {'★'.repeat(x.id + 1)} ({x.label})
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="panel">
          <h2>Modo Endless & regras da casa</h2>
          <label className="field">
            <span className="field-label">Melhor ranque Endless (bestEndlessRank)</span>
            <input
              className="input"
              type="number"
              min={0}
              step={1}
              value={v.collection.bestEndlessRank}
              onChange={(e) => edit((d) => A.setEndlessRank(d, Number(e.target.value)))}
            />
          </label>
          <p className="muted">
            Regras da casa concluídas:{' '}
            {v.collection.completedHouseRuleIds.length === 0
              ? 'nenhuma'
              : v.collection.completedHouseRuleIds.length}
            .
          </p>
          {v.collection.completedHouseRuleIds.length > 0 && (
            <button type="button" className="btn btn-wax btn-sm" onClick={() => edit(A.clearHouseRules)}>
              Limpar regras concluídas
            </button>
          )}
          <p className="muted tiny">
            O formato exato dos ids das regras da casa não está comprovado; o editor só preserva ou limpa a
            lista.
          </p>
        </section>
      </div>
    </>
  );
}
