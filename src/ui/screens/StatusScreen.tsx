import { useState } from 'react';
import { useLocale, useText } from '../../i18n';
import { localizedName } from '../../i18n-labels';
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
  const t = useText();
  const { locale } = useLocale();
  const v = useValues();
  const edit = useEdit();
  const [hero, setHero] = useState(0);
  const heroDef = HEROES[hero];
  const hasAny = (h: number) => UPGRADES.some((u) => A.getUpgradeLevel(v, h, u.uid) > 0);

  return (
    <>
      <section className="panel">
        <h2>
          {t('Hero upgrades', 'Árvore de upgrades do herói', 'Mejoras del héroe')}: {heroDef?.label}
        </h2>
        <div
          className="chips"
          role="group"
          aria-label={t('Choose a hero', 'Escolha o herói', 'Elige un héroe')}
        >
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
                  <span className="visually-hidden">
                    {' '}
                    ({t('with upgrades', 'com upgrades', 'con mejoras')})
                  </span>
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
            {t('Maximize only', 'Maximizar apenas', 'Maximizar solo a')} {heroDef?.label}
          </button>
          <button type="button" className="btn btn-brass" onClick={() => edit((d) => A.maximizeAllHeroes(d))}>
            {t('Maximize upgrades for all', 'Maximizar upgrades dos', 'Maximizar mejoras de los')}{' '}
            {HERO_COUNT} {t('heroes', 'heróis', 'héroes')}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>{t('Purchased hero upgrades', 'Atributos de meta-progressão', 'Mejoras compradas del héroe')}</h2>
        {UPGRADES.filter((u) => u.key !== 'DoubleJump').map((u) => {
          const info = INFO[u.uid];
          const level = A.getUpgradeLevel(v, hero, u.uid);
          const decreaseBlocked =
            u.uid === 6 && level > 0 && !A.canSetUpgradeLevel(v, hero, u.uid, level - 1);
          return (
            <div key={u.uid} className={`upgrade tone-${info?.tone ?? 'amber'}`}>
              <div className="upgrade-head">
                <div>
                  <h3>{localizedName(info?.title ?? u.label, locale)}</h3>
                  <p className="muted">{localizedName(info?.desc ?? '', locale)}</p>
                </div>
                <span className="badge">
                  {t('Level', 'Nível', 'Nivel')} {level} {t('of', 'de', 'de')} {u.maxLevel}
                  {u.uid === 1 && level > 0 ? ` (+${HEALTH_BONUS[level - 1]} ${t('HP', 'PV', 'PV')})` : ''} |{' '}
                  {t('Max', 'Máx', 'Máx')}: {u.maxLevel}x
                </span>
              </div>
              <div className="stepper">
                <button
                  type="button"
                  className="btn btn-brass btn-icon"
                  aria-label={`${t('Decrease', 'Diminuir', 'Disminuir')} ${localizedName(u.label, locale)}`}
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
                  aria-label={`${t('Increase', 'Aumentar', 'Aumentar')} ${localizedName(u.label, locale)}`}
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
                    ? t(
                        'The hero-to-inventory mapping is unverified in this save. Downgrading is blocked while an inventory may exceed the new limit.',
                        'A associação entre personagem e inventário não está confirmada neste save. A redução fica bloqueada enquanto algum inventário pode exceder o novo limite.',
                        'La relación entre héroe e inventario no está verificada en esta partida. No se puede reducir la mejora si algún inventario puede superar el nuevo límite.',
                      )
                    : t(
                        'Remove carried items before reducing the fanny pack.',
                        'Remova itens carregados antes de reduzir a Pochete.',
                        'Quita objetos cargados antes de reducir la riñonera.',
                      )}
                </p>
              )}
            </div>
          );
        })}
        <div className="upgrade tone-green">
          <div className="upgrade-head">
            <div>
              <h3>{localizedName(INFO[5]?.title ?? '', locale)}</h3>
              <p className="muted">{localizedName(INFO[5]?.desc ?? '', locale)}</p>
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
              {t('Arcane jump', 'Salto arcano', 'Salto arcano')}:{' '}
              {A.getUpgradeLevel(v, hero, 5) > 0
                ? t('enabled', 'habilitado', 'activado')
                : t('disabled', 'desabilitado', 'desactivado')}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
