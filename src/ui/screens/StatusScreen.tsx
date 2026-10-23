import { useState } from 'react';
import { HERO_COUNT, HEROES, UPGRADES } from '../../schema/enums';
import * as A from '../../state/actions';
import { useEdit, useValues } from '../hooks';

/** Bônus cumulativo de vida por nível (CharacterUpgrade_MaxHealth._healthBonuses, verificado no binário). */
const HEALTH_BONUS = [20, 40, 60, 80, 100, 120, 140, 160];

const INFO: Record<number, { title: string; desc: string; tone: string }> = {
  1: {
    title: 'Elixir de vitalidade máxima',
    desc: 'Aumenta a vida máxima do herói (bônus acumulado de +20 PV por nível).',
    tone: 'red',
  },
  2: { title: 'Vigor acadêmico & fôlego', desc: 'Aumenta a estamina máxima do herói.', tone: 'amber' },
  3: {
    title: 'Botas de expedição & agilidade',
    desc: 'Aumenta a velocidade de corrida e sprint.',
    tone: 'teal',
  },
  6: {
    title: 'Pochete',
    desc: 'Cada nível concede um espaço extra para itens carregados.',
    tone: 'violet',
  },
  5: {
    title: 'Encantamento de salto arcano',
    desc: 'Segundo salto no ar (habilidade única).',
    tone: 'green',
  },
};

export function StatusScreen() {
  const v = useValues();
  const edit = useEdit();
  const [hero, setHero] = useState(0);
  const heroDef = HEROES[hero];
  const hasAny = (h: number) => UPGRADES.some((u) => A.getUpgradeLevel(v, h, u.uid) > 0);

  return (
    <>
      <section className="panel">
        <h2>Árvore de upgrades do herói: {heroDef?.label}</h2>
        <div className="chips" role="group" aria-label="Escolha o herói">
          {HEROES.map((h) => (
            <button
              key={h.id}
              type="button"
              className={`chip-btn${h.id === hero ? ' selected' : ''}`}
              aria-pressed={h.id === hero}
              onClick={() => setHero(h.id)}
            >
              {h.label}
              {hasAny(h.id) && (
                <>
                  <span aria-hidden="true"> ★</span>
                  <span className="visually-hidden"> (com upgrades)</span>
                </>
              )}
            </button>
          ))}
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-green"
            onClick={() => edit((d) => A.maximizeHero(d, hero))}
          >
            Maximizar apenas {heroDef?.label}
          </button>
          <button type="button" className="btn btn-brass" onClick={() => edit((d) => A.maximizeAllHeroes(d))}>
            Maximizar upgrades dos {HERO_COUNT} heróis
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Atributos de meta-progressão (níveis comprados)</h2>
        {UPGRADES.filter((u) => u.key !== 'DoubleJump').map((u) => {
          const info = INFO[u.uid];
          const level = A.getUpgradeLevel(v, hero, u.uid);
          const decreaseBlocked =
            u.uid === 6 && level > 0 && !A.canSetUpgradeLevel(v, hero, u.uid, level - 1);
          return (
            <div key={u.uid} className={`upgrade tone-${info?.tone ?? 'amber'}`}>
              <div className="upgrade-head">
                <div>
                  <h3>{info?.title ?? u.label}</h3>
                  <p className="muted">{info?.desc}</p>
                </div>
                <span className="badge">
                  Nível {level} de {u.maxLevel}
                  {u.uid === 1 && level > 0 ? ` (+${HEALTH_BONUS[level - 1]} PV)` : ''} | Máx: {u.maxLevel}x
                </span>
              </div>
              <div className="stepper">
                <button
                  type="button"
                  className="btn btn-brass btn-icon"
                  aria-label={`Diminuir ${u.label}`}
                  aria-describedby={decreaseBlocked ? 'pouch-reduction-note' : undefined}
                  disabled={level === 0 || decreaseBlocked}
                  onClick={() =>
                    edit((d) => {
                      A.setUpgradeLevel(d, hero, u.uid, level - 1);
                    })
                  }
                >
                  −
                </button>
                <div className="pips" role="img" aria-label={`${level} de ${u.maxLevel}`}>
                  {Array.from({ length: u.maxLevel }, (_, i) => (
                    <span key={`${u.uid}-${i}`} className={i < level ? 'pip on' : 'pip'} />
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-brass btn-icon"
                  aria-label={`Aumentar ${u.label}`}
                  disabled={level === u.maxLevel}
                  onClick={() =>
                    edit((d) => {
                      A.setUpgradeLevel(d, hero, u.uid, level + 1);
                    })
                  }
                >
                  +
                </button>
              </div>
              {decreaseBlocked && (
                <p id="pouch-reduction-note" className="muted">
                  {A.occupiedHeroes(v).length > 1
                    ? 'A associação entre personagem e inventário não está confirmada neste save. A redução fica bloqueada enquanto algum inventário pode exceder o novo limite.'
                    : 'Remova itens carregados antes de reduzir a Pochete.'}
                </p>
              )}
            </div>
          );
        })}
        <div className="upgrade tone-green">
          <div className="upgrade-head">
            <div>
              <h3>{INFO[5]?.title}</h3>
              <p className="muted">{INFO[5]?.desc}</p>
            </div>
            <button
              type="button"
              className={A.getUpgradeLevel(v, hero, 5) > 0 ? 'btn btn-green' : 'btn btn-brass'}
              role="switch"
              aria-checked={A.getUpgradeLevel(v, hero, 5) > 0}
              onClick={() =>
                edit((d) => {
                  A.setUpgradeLevel(d, hero, 5, A.getUpgradeLevel(v, hero, 5) > 0 ? 0 : 1);
                })
              }
            >
              Salto arcano: {A.getUpgradeLevel(v, hero, 5) > 0 ? 'habilitado' : 'desabilitado'}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
