import { useState } from 'react';
import { useLocale, useText } from '../../i18n';
import { enumName, enumNameOf } from '../../i18n-labels';
import { BIOMES, BOARD_MONSTERS, DIFFICULTIES, FIGURINES } from '../../schema/enums';
import * as A from '../../state/actions';
import { useEdit, useValues } from '../hooks';

const boardLabel = (key: string, locale: import('../../i18n').Locale) => {
  const [b, m] = key.split(':').map(Number);
  return `${enumNameOf(BIOMES, b ?? -1, locale)} • ${enumNameOf(BOARD_MONSTERS, m ?? -1, locale)}`;
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
  const t = useText();
  const { locale } = useLocale();
  const v = useValues();
  const edit = useEdit();
  const active = FIGURINES.filter((f) => A.hasFigurine(v, f.id)).length;
  const diffOf = (key: string) =>
    v.collection.bestBoardDifficulties.find((b) => b.boardKey === key)?.difficulty;

  return (
    <>
      <section className="panel">
        <header className="panel-head">
          <h2>
            {t(
              '3D bestiary & curiosities',
              'Bestiário 3D & gabinete de curiosidades',
              'Bestiario 3D y curiosidades',
            )}
          </h2>
          <span className="tag tag-gold">
            {active} {t('of', 'de', 'de')} {FIGURINES.length} {t('figurines', 'figuras', 'figuras')}
          </span>
        </header>
        <p className="muted">
          {t(
            'Collect or remove the figurines found in the game.',
            'Colete ou remova as figuras encontradas no jogo.',
            'Colecciona o quita las figuras que aparecen en el juego.',
          )}
        </p>
        <div className="actions">
          <button
            type="button"
            className="btn btn-green"
            onClick={() => edit((d) => A.setAllFigurines(d, true))}
          >
            ★ {t('Enable all', 'Ativar todas as', 'Activar las')} {FIGURINES.length}
          </button>
          <button
            type="button"
            className="btn btn-wax"
            onClick={() => edit((d) => A.setAllFigurines(d, false))}
          >
            ✕ {t('Clear all', 'Desmarcar todas', 'Desmarcar todas')}
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
                    <strong>{enumName(f, locale)}</strong>
                  </span>
                  <span className={on ? 'tag tag-gold' : 'tag'} aria-hidden="true">
                    {on ? t('Active', 'Ativo', 'Activo') : t('Off', 'Off', 'Inactivo')}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid grid-2">
        <section className="panel">
          <h2>{t('Completed boards', 'Tabuleiros concluídos', 'Tableros completados')}</h2>
          {v.collection.completedBoardKeys.length === 0 ? (
            <p className="muted">
              {t('No completed boards.', 'Nenhum tabuleiro concluído.', 'No hay tableros completados.')}
            </p>
          ) : (
            <ul className="plain">
              {v.collection.completedBoardKeys.map((key) => {
                const d = diffOf(key);
                return (
                  <li key={key} className="row">
                    <span>{boardLabel(key, locale)}</span>
                    <select
                      className="input input-sm"
                      aria-label={`${t('Best difficulty on', 'Melhor dificuldade em', 'Mejor dificultad en')} ${boardLabel(key, locale)}`}
                      value={d ?? ''}
                      onChange={(e) => edit((s) => A.setBoardDifficulty(s, key, Number(e.target.value)))}
                    >
                      {d === undefined && <option value="">—</option>}
                      {DIFFICULTIES.map((x) => (
                        <option key={x.id} value={x.id}>
                          {'★'.repeat(x.id + 1)} ({enumName(x, locale)})
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
          <h2>
            {t(
              'Endless mode & house rules',
              'Modo Endless & regras da casa',
              'Modo infinito y reglas de la casa',
            )}
          </h2>
          <label className="field">
            <span className="field-label">
              {t('Best Endless rank', 'Melhor ranque Endless', 'Mejor rango en modo infinito')}
            </span>
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
            {t('Completed house rules', 'Regras da casa concluídas', 'Reglas de la casa completadas')}:{' '}
            {v.collection.completedHouseRuleIds.length === 0
              ? t('none', 'nenhuma', 'ninguna')
              : v.collection.completedHouseRuleIds.length}
            .
          </p>
          {v.collection.completedHouseRuleIds.length > 0 && (
            <button type="button" className="btn btn-wax btn-sm" onClick={() => edit(A.clearHouseRules)}>
              {t('Clear completed rules', 'Limpar regras concluídas', 'Borrar reglas completadas')}
            </button>
          )}
          <p className="muted tiny">
            {t(
              'The editor can preserve or clear this list.',
              'O editor pode preservar ou limpar esta lista.',
              'El editor puede conservar o borrar esta lista.',
            )}
          </p>
        </section>
      </div>
    </>
  );
}
