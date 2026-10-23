import { useState } from 'react';
import { useLocale, useText } from '../../i18n';
import type { SaveValues } from '../../schema/types';
import * as A from '../../state/actions';
import { useAnnounce } from '../announce';
import { useEdit, useValues } from '../hooks';

export function PresetsScreen() {
  const t = useText();
  const { locale } = useLocale();
  const fmt = (n: number) => n.toLocaleString(locale);
  const v = useValues();
  const edit = useEdit();
  const bank = v.save.bank.currentTotalScore;
  const say = useAnnounce((x) => x.say);
  const [text, setText] = useState(String(bank));
  const [error, setError] = useState<'negative' | 'integer' | 'max' | null>(null);
  const [synced, setSynced] = useState(bank);
  if (bank !== synced) {
    setSynced(bank);
    setText(String(bank));
  }
  const commit = () => {
    const input = text.trim();
    if (input.startsWith('-')) {
      setError('negative');
      return;
    }
    const validGrouping = /^\d{1,3}(?:[.,\s]\d{3})+$/.test(input);
    const raw = validGrouping ? input.replace(/[.,\s]/g, '') : input;
    if (!/^\d+$/.test(raw)) {
      setError('integer');
      return;
    }
    if (BigInt(raw) > BigInt(A.MAX_BANK)) {
      setError('max');
      return;
    }
    const n = Number(raw);
    setError(null);
    edit((d) => {
      A.setBank(d, n);
    }, 'bank');
    setText(String(n));
  };
  /** Executa um preset e anuncia o resultado. */
  const run = (name: string, fn: (d: SaveValues) => void) =>
    say(
      edit(fn)
        ? `${name}: ${t('changes applied.', 'alterações aplicadas.', 'cambios aplicados.')}`
        : `${name}: ${t('nothing to change.', 'nada a alterar.', 'nada que cambiar.')}`,
    );

  return (
    <>
      <section className="panel">
        <header className="panel-head">
          <h2>
            {t(
              'Library vault & research fund',
              'Cofre da biblioteca & fundo de pesquisa',
              'Bóveda de la biblioteca y fondo de investigación',
            )}
          </h2>
          <strong className="gold">
            {fmt(bank)} {t('coins', 'moedas', 'monedas')}
          </strong>
        </header>
        <div className="actions">
          <div className="field">
            <label>
              <span className="field-label">{t('Balance', 'Saldo', 'Saldo')}</span>
              <input
                className="input"
                inputMode="numeric"
                value={text}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'bank-error' : undefined}
                onChange={(e) => {
                  setText(e.target.value);
                  setError(null);
                }}
                onBlur={commit}
                onKeyDown={(e) => e.key === 'Enter' && commit()}
              />
            </label>
            {error && (
              <span id="bank-error" className="field-error" role="alert">
                {error === 'negative'
                  ? t(
                      'The balance cannot be below zero.',
                      'O saldo não pode ser menor que zero.',
                      'El saldo no puede ser menor que cero.',
                    )
                  : error === 'integer'
                    ? t(
                        'Enter whole numbers only, without a sign.',
                        'Informe apenas números inteiros, sem sinal.',
                        'Ingresa solo números enteros, sin signo.',
                      )
                    : `${t('The maximum allowed balance is', 'O saldo máximo permitido é', 'El saldo máximo permitido es')} ${fmt(A.MAX_BANK)}.`}
              </span>
            )}
          </div>
          <button
            type="button"
            className="btn btn-brass"
            disabled={bank + 10000 > A.MAX_BANK}
            onClick={() =>
              run(t('Balance', 'Saldo', 'Saldo'), (d) => {
                A.setBank(d, bank + 10000);
              })
            }
          >
            +{fmt(10000)}
          </button>
          <button
            type="button"
            className="btn btn-brass"
            disabled={bank + 50000 > A.MAX_BANK}
            onClick={() =>
              run(t('Balance', 'Saldo', 'Saldo'), (d) => {
                A.setBank(d, bank + 50000);
              })
            }
          >
            +{fmt(50000)}
          </button>
          <button
            type="button"
            className="btn btn-green"
            onClick={() =>
              run(t('Balance', 'Saldo', 'Saldo'), (d) => {
                A.setBank(d, 99999);
              })
            }
          >
            {t('Set 99,999', 'Definir 99.999', 'Fijar 99.999')}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>{t('Instant actions', 'Tomos & decretos', 'Acciones instantáneas')}</h2>
        <p className="muted">
          {t(
            'Actions can be undone (Ctrl+Z), and changes appear in the review before saving.',
            'As ações podem ser desfeitas (Ctrl+Z) e as mudanças aparecem na revisão antes de salvar.',
            'Las acciones se pueden deshacer (Ctrl+Z) y los cambios aparecen en la revisión antes de guardar.',
          )}
        </p>
        <div className="grid grid-3">
          <article className="card card-gold">
            <h3>{t('Ultimate mode', 'Modo supremo', 'Modo supremo')}</h3>
            <ul>
              <li>{t('99,999 coins', '99.999 moedas', '99.999 monedas')}</li>
              <li>
                {t('Key doors unlocked', 'Portas com chave destrancadas', 'Puertas con llave desbloqueadas')}
              </li>
              <li>
                {t('8 furniture pieces unlocked', '8 mobílias desbloqueadas', '8 muebles desbloqueados')}
              </li>
              <li>
                {t(
                  'Upgrades maximized for 8 heroes',
                  'Upgrades maximizados nos 8 heróis',
                  'Mejoras maximizadas para los 8 héroes',
                )}
              </li>
              <li>
                {t(
                  '17 figurines in the trophy room',
                  '17 figuras na sala de troféus',
                  '17 figuras en la sala de trofeos',
                )}
              </li>
              <li>
                {t(
                  'Flamethrower and Hunter Gun on the bench',
                  'Lança-chamas e Arma de Caça na bancada',
                  'Lanzallamas y rifle de cazador en la mesa',
                )}
              </li>
            </ul>
            <button
              type="button"
              className="btn btn-gold"
              onClick={() => run(t('Ultimate mode', 'Modo supremo', 'Modo supremo'), A.godMode)}
            >
              {t('Apply ultimate mode', 'Decretar modo supremo', 'Aplicar modo supremo')}
            </button>
          </article>
          <article className="card card-wax">
            <h3>{t('Reset expedition', 'Purificar expedição', 'Reiniciar expedición')}</h3>
            <ul>
              <li>{t('Sets round to 0', 'Define a rodada = 0', 'Establece la ronda en 0')}</li>
              <li>
                {t(
                  'Empties run inventories',
                  'Esvazia os inventários da run',
                  'Vacía los inventarios de la partida',
                )}
              </li>
              <li>
                {t(
                  'Keeps upgrades and furniture',
                  'Preserva upgrades e mobílias',
                  'Conserva mejoras y muebles',
                )}
              </li>
            </ul>
            <button
              type="button"
              className="btn btn-wax"
              onClick={() =>
                run(t('Reset expedition', 'Reiniciar expedição', 'Reiniciar expedición'), A.resetRun)
              }
            >
              {t('Reset expedition', 'Reiniciar expedição', 'Reiniciar expedición')}
            </button>
          </article>
          <article className="card card-green">
            <h3>
              {t('Unlock all passages', 'Destrancar todas as câmaras', 'Desbloquear todos los pasajes')}
            </h3>
            <ul>
              <li>
                {t('Opens the 2 key doors', 'Abre as 2 portas com chave', 'Abre las 2 puertas con llave')}
              </li>
              <li>
                {t(
                  'Activates all furniture in the hub',
                  'Ativa todas as mobílias do hub',
                  'Activa todos los muebles de la sala',
                )}
              </li>
            </ul>
            <button
              type="button"
              className="btn btn-green"
              onClick={() => run(t('Open passages', 'Abrir passagens', 'Abrir pasajes'), A.openAllPassages)}
            >
              {t('Open all passages', 'Abrir todas as passagens', 'Abrir todos los pasajes')}
            </button>
          </article>
        </div>
      </section>
    </>
  );
}
