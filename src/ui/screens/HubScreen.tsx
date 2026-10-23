import { FURNITURES, KEY_DOORS } from '../../schema/enums';
import { SKINS } from '../../schema/skins';
import * as A from '../../state/actions';
import { useEdit, useValues } from '../hooks';

export function HubScreen() {
  const v = useValues();
  const edit = useEdit();
  const skin = v.save.gameRoomSkinIndex;
  const owned = new Set(v.save.furnitures.furnitures);
  const doors = new Set(v.save.unlockedKeyDoors);
  const skinLabel = SKINS[skin]?.label ?? `Desconhecida (#${skin})`;

  return (
    <>
      <section className="panel">
        <h2>Estética & arquitetura do salão (gameRoomSkinIndex)</h2>
        <p className="muted">
          Tema visual do salão de jogos. Skin atual: <strong>{skinLabel}</strong>.
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
                {i}: {s.label}
              </strong>
              <span className="tiny muted">{s.asset}</span>
              <span className={i === skin ? 'tag tag-green' : 'tag'}>
                {i === skin ? '✓ Ativa' : 'Selecionar'}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>Passagens com chave (unlockedKeyDoors)</h2>
          <button type="button" className="btn btn-green" onClick={() => edit(A.unlockAllDoors)}>
            Destrancar as {KEY_DOORS.length} portas
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
              <strong>{k.label}</strong>
              <span className={doors.has(k.id) ? 'green' : 'muted'}>
                {doors.has(k.id) ? 'Destrancada ✓' : 'Trancada'}
              </span>
            </button>
          ))}
        </div>
        <p className="muted tiny">
          O jogo só tem duas portas que usam chave (Henry e Corredor), verificado nos binários.
        </p>
      </section>

      <section className="panel">
        <header className="panel-head">
          <h2>Mobílias & relíquias da biblioteca (furnitures)</h2>
          <button type="button" className="btn btn-green" onClick={() => edit(A.unlockAllFurnitures)}>
            Desbloquear as {FURNITURES.length} mobílias
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
              <strong>
                #{f.id} {f.label}
              </strong>
              <span className={owned.has(f.id) ? 'green' : 'muted'}>
                {owned.has(f.id) ? '✓ Ativo' : '✕ Bloqueado'}
              </span>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
