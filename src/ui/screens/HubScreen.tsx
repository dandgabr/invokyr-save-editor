import { useLocale, useText } from '../../i18n';
import { enumName, localizedName } from '../../i18n-labels';
import { FURNITURES, KEY_DOORS } from '../../schema/enums';
import { SKINS } from '../../schema/skins';
import * as A from '../../state/actions';
import { useEdit, useValues } from '../hooks';

export function HubScreen() {
  const t = useText();
  const { locale } = useLocale();
  const v = useValues();
  const edit = useEdit();
  const skin = v.save.gameRoomSkinIndex;
  const owned = new Set(v.save.furnitures.furnitures);
  const doors = new Set(v.save.unlockedKeyDoors);
  const skinLabel = SKINS[skin]
    ? localizedName(SKINS[skin].label, locale)
    : `${t('Unknown', 'Desconhecida', 'Desconocida')} (#${skin})`;

  return (
    <>
      <section className="panel">
        <h2>
          {t('Game room appearance', 'Estética & arquitetura do salão', 'Aspecto de la sala de juegos')}
        </h2>
        <p className="muted">
          {t(
            'Game room theme. Current skin:',
            'Tema visual do salão de jogos. Skin atual:',
            'Tema visual de la sala de juegos. Aspecto actual:',
          )}{' '}
          <strong>{skinLabel}</strong>.
        </p>
        <div className="grid grid-6">
          {SKINS.map((s, i) => (
            <button
              key={s.asset}
              type="button"
              className={`card card-btn${i === skin ? ' card-active' : ''}`}
              aria-pressed={i === skin}
              onClick={() => edit((d) => A.setSkin(d, i))}
            >
              <span className={`swatch swatch-${s.tone}`} aria-hidden="true" />
              <strong>
                {i}: {localizedName(s.label, locale)}
              </strong>
              <span className={i === skin ? 'tag tag-green' : 'tag'}>
                {i === skin ? t('✓ Active', '✓ Ativa', '✓ Activa') : t('Select', 'Selecionar', 'Seleccionar')}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>{t('Locked passages', 'Passagens com chave', 'Pasajes con llave')}</h2>
          <button type="button" className="btn btn-green" onClick={() => edit(A.unlockAllDoors)}>
            {t('Unlock all', 'Destrancar as', 'Desbloquear las')} {KEY_DOORS.length}{' '}
            {t('doors', 'portas', 'puertas')}
          </button>
        </header>
        <div className="grid grid-2">
          {KEY_DOORS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={`card card-btn${doors.has(k.id) ? ' card-active' : ''}`}
              aria-pressed={doors.has(k.id)}
              onClick={() => edit((d) => A.setDoor(d, k.id, !doors.has(k.id)))}
            >
              <strong>{enumName(k, locale)}</strong>
              <span className={doors.has(k.id) ? 'green' : 'muted'}>
                {doors.has(k.id)
                  ? t('Unlocked ✓', 'Destrancada ✓', 'Desbloqueada ✓')
                  : t('Locked', 'Trancada', 'Bloqueada')}
              </span>
            </button>
          ))}
        </div>
        <p className="muted tiny">
          {t(
            'The verified game build has two key doors: Henry and Corridor.',
            'A build verificada do jogo tem duas portas com chave: Henry e Corredor.',
            'La build verificada del juego tiene dos puertas con llave: Henry y Pasillo.',
          )}
        </p>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>
            {t(
              'Library furniture & relics',
              'Mobílias & relíquias da biblioteca',
              'Muebles y reliquias de la biblioteca',
            )}
          </h2>
          <button type="button" className="btn btn-green" onClick={() => edit(A.unlockAllFurnitures)}>
            {t('Unlock all', 'Desbloquear as', 'Desbloquear los')} {FURNITURES.length}{' '}
            {t('furniture pieces', 'mobílias', 'muebles')}
          </button>
        </header>
        <div className="grid grid-4">
          {FURNITURES.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`card card-btn${owned.has(f.id) ? ' card-active' : ''}`}
              aria-pressed={owned.has(f.id)}
              onClick={() => edit((d) => A.setFurniture(d, f.id, !owned.has(f.id)))}
            >
              <strong>{enumName(f, locale)}</strong>
              <span className={owned.has(f.id) ? 'green' : 'muted'}>
                {f.id === 8
                  ? owned.has(f.id)
                    ? t('✓ Unlocked', '✓ Desbloqueado', '✓ Desbloqueado')
                    : t('✕ Locked', '✕ Não desbloqueado', '✕ Bloqueado')
                  : owned.has(f.id)
                    ? t('✓ Active', '✓ Ativo', '✓ Activo')
                    : t('✕ Locked', '✕ Bloqueado', '✕ Bloqueado')}
              </span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
