import { useState } from 'react';
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
  onCommit: (text: string) => string | null;
  label: string;
  id: string;
}) {
  const [text, setText] = useState(value);
  const [error, setError] = useState<string | null>(null);
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
          placeholder="Vago (SteamID64)"
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
          {error}
        </p>
      )}
    </div>
  );
}

export function SessionScreen() {
  const v = useValues();
  const edit = useEdit();
  const occupied = A.occupiedHeroes(v);
  const free = HERO_COUNT - occupied.length;

  return (
    <>
      <section className="panel">
        <h2>
          Rol de membros da expedição ({occupied.length}{' '}
          {occupied.length === 1 ? 'herói em campo' : 'heróis em campo'} • {free}{' '}
          {free === 1 ? 'vaga' : 'vagas'})
        </h2>
        <p className="muted">
          Cada herói pertence a um SteamID64. Atribuir ou liberar um herói também ajusta{' '}
          <code>playerCount</code> e o inventário do jogador.
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
                <h3>
                  {hero.label} ({hero.id})
                </h3>
                <span className={taken ? 'tag tag-gold' : 'tag'}>
                  {taken ? `Jogador ${order + 1}` : 'Disponível'}
                </span>
              </header>
              <SteamIdField
                id={`steam-${hero.id}`}
                label={`Jogador atribuído a ${hero.label} (Steam)`}
                value={taken ? owner : ''}
                onCommit={(text) => {
                  const t = text.trim();
                  if (t === '') return taken ? 'Para liberar o herói use o botão “Liberar slot”.' : null;
                  const id = A.parseSteamId(t);
                  if (id === null) return 'Informe um SteamID64 de 17 dígitos (ex.: 7656119…).';
                  let ok = true;
                  edit((d) => {
                    ok = A.setOwner(d, hero.id, id);
                  });
                  return ok ? null : 'Este SteamID64 já está em outro herói.';
                }}
              />
              <div className="card-foot">
                <label className="inline">
                  <span className="muted">Roupa:</span>
                  <select
                    className="input input-sm"
                    value={color}
                    onChange={(e) => edit((d) => A.setClothColor(d, hero.id, Number(e.target.value)))}
                  >
                    {!CLOTH_COLORS.some((c) => c.id === color) && (
                      <option value={color}>Desconhecida (#{color})</option>
                    )}
                    {CLOTH_COLORS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
                {taken && (
                  <button
                    type="button"
                    className="btn btn-wax btn-sm"
                    aria-label={`Liberar slot de ${hero.label}`}
                    onClick={() =>
                      edit((d) => {
                        A.setOwner(d, hero.id, 0n);
                      })
                    }
                    disabled={occupied.length === 1}
                  >
                    Liberar slot
                  </button>
                )}
              </div>
              <p className="muted tiny">Cor atual: {labelOf(CLOTH_COLORS, color)}</p>
            </article>
          );
        })}
      </div>
    </>
  );
}
