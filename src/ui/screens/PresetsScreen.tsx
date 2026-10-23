import { useState } from 'react';
import type { SaveValues } from '../../schema/types';
import * as A from '../../state/actions';
import { useAnnounce } from '../announce';
import { useEdit, useValues } from '../hooks';

const fmt = (n: number) => n.toLocaleString('pt-BR');

export function PresetsScreen() {
  const v = useValues();
  const edit = useEdit();
  const bank = v.save.bank.currentTotalScore;
  const say = useAnnounce((x) => x.say);
  const [text, setText] = useState(String(bank));
  const [error, setError] = useState<string | null>(null);
  const [synced, setSynced] = useState(bank);
  if (bank !== synced) {
    setSynced(bank);
    setText(String(bank));
  }
  const commit = () => {
    const raw = text.replace(/[.\s]/g, '');
    if (raw.startsWith('-')) {
      setError('O saldo não pode ser menor que zero.');
      return;
    }
    if (!/^\d+$/.test(raw)) {
      setError('Informe apenas números inteiros, sem sinal.');
      return;
    }
    if (BigInt(raw) > BigInt(A.MAX_BANK)) {
      setError(`O saldo máximo permitido é ${A.MAX_BANK}.`);
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
    say(edit(fn) ? `${name}: alterações aplicadas.` : `${name}: nada a alterar.`);

  return (
    <>
      <section className="panel">
        <header className="panel-head">
          <h2>Cofre da biblioteca & fundo de pesquisa</h2>
          <strong className="gold">{fmt(bank)} moedas</strong>
        </header>
        <div className="actions">
          <div className="field">
            <label>
              <span className="field-label">Saldo</span>
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
                {error}
              </span>
            )}
          </div>
          <button
            type="button"
            className="btn btn-brass"
            disabled={bank + 10000 > A.MAX_BANK}
            onClick={() =>
              run('Saldo', (d) => {
                A.setBank(d, bank + 10000);
              })
            }
          >
            +10.000
          </button>
          <button
            type="button"
            className="btn btn-brass"
            disabled={bank + 50000 > A.MAX_BANK}
            onClick={() =>
              run('Saldo', (d) => {
                A.setBank(d, bank + 50000);
              })
            }
          >
            +50.000
          </button>
          <button
            type="button"
            className="btn btn-green"
            onClick={() =>
              run('Saldo', (d) => {
                A.setBank(d, 99999);
              })
            }
          >
            Definir 99.999
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Tomos & decretos (ações instantâneas)</h2>
        <p className="muted">
          As ações podem ser desfeitas (Ctrl+Z) e as mudanças aparecem na revisão antes de salvar.
        </p>
        <div className="grid grid-3">
          <article className="card card-gold">
            <h3>Modo supremo (god mode)</h3>
            <ul>
              <li>99.999 moedas</li>
              <li>Portas com chave destrancadas</li>
              <li>8 mobílias desbloqueadas</li>
              <li>Upgrades maximizados nos 8 heróis</li>
              <li>17 figuras na sala de troféus</li>
              <li>Lança-chamas e Arma de Caça na bancada</li>
            </ul>
            <button type="button" className="btn btn-gold" onClick={() => run('Modo supremo', A.godMode)}>
              Decretar modo supremo
            </button>
          </article>
          <article className="card card-wax">
            <h3>Purificar expedição (resetar run)</h3>
            <ul>
              <li>Define a rodada = 0</li>
              <li>Esvazia os inventários da run</li>
              <li>Preserva upgrades e mobílias</li>
            </ul>
            <button
              type="button"
              className="btn btn-wax"
              onClick={() => run('Reiniciar expedição', A.resetRun)}
            >
              Reiniciar expedição
            </button>
          </article>
          <article className="card card-green">
            <h3>Destrancar todas as câmaras</h3>
            <ul>
              <li>Abre as 2 portas com chave</li>
              <li>Ativa todas as mobílias do hub</li>
            </ul>
            <button
              type="button"
              className="btn btn-green"
              onClick={() => run('Abrir passagens', A.openAllPassages)}
            >
              Abrir todas as passagens
            </button>
          </article>
        </div>
      </section>
    </>
  );
}
