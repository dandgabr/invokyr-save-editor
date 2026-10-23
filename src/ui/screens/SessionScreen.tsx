import { useState } from 'react';
import { useLocale, useText } from '../../i18n';
import { enumName, enumNameOf } from '../../i18n-labels';
import { CLOTH_COLORS, HERO_COUNT, HEROES, labelOf } from '../../schema/enums';
import * as A from '../../state/actions';
import { useEdit, useValues } from '../hooks';

function SteamIdField({
  value,
  onCommit,
  label,
  id,
}: {
  value: string;
  onCommit: (text: string) => 'release' | 'invalid' | 'duplicate' | null;
  label: string;
  id: string;
}) {
  const t = useText();
  const [text, setText] = useState(value);
  const [error, setError] = useState<'release' | 'invalid' | 'duplicate' | null>(null);
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    // O valor mudou por fora (desfazer, liberar slot): sincroniza o campo.
    setSynced(value);
    setText(value);
    setError(null);
  }
  const commit = () => {
    if (text === value) return;
    setError(onCommit(text));
  };
  return (
    <div className="field">
      <label>
        <span className="field-label">{label}</span>
        <input
          className="input"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('Vacant (SteamID64)', 'Vago (SteamID64)', 'Libre (SteamID64)')}
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
      </label>
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error === 'release'
            ? t(
                'Use the “Free slot” button to release the hero.',
                'Para liberar o herói use o botão “Liberar slot”.',
                'Usa el botón “Liberar espacio” para liberar al héroe.',
              )
            : error === 'duplicate'
              ? t(
                  'This SteamID64 is assigned to another hero.',
                  'Este SteamID64 já está em outro herói.',
                  'Este SteamID64 ya está asignado a otro héroe.',
                )
              : t(
                  'Enter a 17-digit SteamID64 (e.g. 7656119…).',
                  'Informe um SteamID64 de 17 dígitos (ex.: 7656119…).',
                  'Ingresa un SteamID64 de 17 dígitos (p. ej., 7656119…).',
                )}
        </p>
      )}
    </div>
  );
}

export function SessionScreen() {
  const t = useText();
  const { locale } = useLocale();
  const v = useValues();
  const edit = useEdit();
  const occupied = A.occupiedHeroes(v);
  const free = HERO_COUNT - occupied.length;

  return (
    <>
      <section className="panel">
        <h2>
          {t('Expedition members', 'Rol de membros da expedição', 'Miembros de la expedición')} (
          {occupied.length}{' '}
          {occupied.length === 1
            ? t('hero in play', 'herói em campo', 'héroe en juego')
            : t('heroes in play', 'heróis em campo', 'héroes en juego')}{' '}
          • {free}{' '}
          {free === 1 ? t('vacancy', 'vaga', 'plaza libre') : t('vacancies', 'vagas', 'plazas libres')})
        </h2>
        <p className="muted">
          {t(
            'Each hero belongs to a SteamID64. Assigning or freeing a hero also updates the player count and inventory.',
            'Cada herói pertence a um SteamID64. Atribuir ou liberar um herói também ajusta o número de jogadores e o inventário.',
            'Cada héroe pertenece a un SteamID64. Asignar o liberar un héroe también actualiza la cantidad de jugadores y su inventario.',
          )}
        </p>
      </section>
      <div className="grid grid-4">
        {HEROES.map((hero) => {
          const taken = A.isOccupied(v, hero.id);
          const owner = String(v.meta.characterOwners[hero.id] ?? 0n);
          const color = v.save.playerColors.find((c) => c.playerCharacter === hero.id)?._color ?? 0;
          const order = occupied.indexOf(hero.id);
          return (
            <article key={hero.id} className={`card${taken ? ' card-active' : ''}`} aria-label={hero.label}>
              <header className="card-head">
                <h3>{hero.label}</h3>
                <span className={taken ? 'tag tag-gold' : 'tag'}>
                  {taken
                    ? `${t('Player', 'Jogador', 'Jugador')} ${order + 1}`
                    : t('Available', 'Disponível', 'Disponible')}
                </span>
              </header>
              <SteamIdField
                id={`steam-${hero.id}`}
                label={`${t('Player assigned to', 'Jogador atribuído a', 'Jugador asignado a')} ${hero.label} (Steam)`}
                value={taken ? owner : ''}
                onCommit={(text) => {
                  const value = text.trim();
                  if (value === '') return taken ? 'release' : null;
                  const id = A.parseSteamId(value);
                  if (id === null) return 'invalid';
                  let ok = true;
                  edit((d) => {
                    ok = A.setOwner(d, hero.id, id);
                  });
                  return ok ? null : 'duplicate';
                }}
              />
              <div className="card-foot">
                <label className="inline">
                  <span className="muted">{t('Outfit', 'Roupa', 'Atuendo')}:</span>
                  <select
                    className="input input-sm"
                    value={color}
                    onChange={(e) => edit((d) => A.setClothColor(d, hero.id, Number(e.target.value)))}
                  >
                    {!CLOTH_COLORS.some((c) => c.id === color) && (
                      <option value={color}>
                        {t('Unknown', 'Desconhecida', 'Desconocida')} (#{color})
                      </option>
                    )}
                    {CLOTH_COLORS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {enumName(c, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                {taken && (
                  <button
                    type="button"
                    className="btn btn-wax btn-sm"
                    aria-label={`${t('Free slot for', 'Liberar slot de', 'Liberar espacio de')} ${hero.label}`}
                    onClick={() =>
                      edit((d) => {
                        A.setOwner(d, hero.id, 0n);
                      })
                    }
                    disabled={occupied.length === 1}
                  >
                    {t('Free slot', 'Liberar slot', 'Liberar espacio')}
                  </button>
                )}
              </div>
              <p className="muted tiny">
                {t('Current color', 'Cor atual', 'Color actual')}: {enumNameOf(CLOTH_COLORS, color, locale)}
              </p>
            </article>
          );
        })}
      </div>
    </>
  );
}
