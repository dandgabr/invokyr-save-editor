import { useState } from 'react';
import * as A from '../../state/actions';
import { useEdit, useValues } from '../hooks';

const fmt = (n: number) => n.toLocaleString('pt-BR');

export function PresetsScreen() {
  const v = useValues();
  const edit = useEdit();
  const bank = v.save.bank.currentTotalScore;
  const [text, setText] = useState(String(bank));
  const [synced, setSynced] = useState(bank);
  if (bank !== synced) {
    setSynced(bank);
    setText(String(bank));
  }
  const commit = () => {
    const n = Number(text.replace(/\D/g, ''));
    if (Number.isFinite(n)) edit((d) => A.setBank(d, n));
    else setText(String(bank));
  };

  return (
    <>
      <section className="panel">
        <header className="panel-head">
          <h2>Cofre da biblioteca & fundo de pesquisa (currentTotalScore)</h2>
          <strong className="gold">{fmt(bank)} moedas</strong>
        </header>
        <div className="actions">
          <label className="field">
            <span className="field-label">Saldo</span>
            <input
              className="input"
              inputMode="numeric"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
            />
          </label>
          <button
            type="button"
            className="btn btn-brass"
            onClick={() => edit((d) => A.setBank(d, bank + 10000))}
          >
            +10.000
          </button>
          <button
            type="button"
            className="btn btn-brass"
            onClick={() => edit((d) => A.setBank(d, bank + 50000))}
          >
            +50.000
          </button>
          <button type="button" className="btn btn-green" onClick={() => edit((d) => A.setBank(d, 99999))}>
            Cofre cheio (99.999)
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
              <li>Todas as 8 mobílias ativas</li>
              <li>Upgrades maximizados nos 8 heróis</li>
              <li>17 figuras na sala de troféus</li>
              <li>Lança-chamas e Arma de Caça na bancada</li>
            </ul>
            <button type="button" className="btn btn-gold" onClick={() => edit(A.godMode)}>
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
            <button type="button" className="btn btn-wax" onClick={() => edit(A.resetRun)}>
              Reiniciar expedição
            </button>
          </article>
          <article className="card card-green">
            <h3>Destrancar todas as câmaras</h3>
            <ul>
              <li>Abre as 2 portas com chave</li>
              <li>Ativa todas as mobílias do hub</li>
            </ul>
            <button type="button" className="btn btn-green" onClick={() => edit(A.openAllPassages)}>
              Abrir todas as passagens
            </button>
          </article>
        </div>
      </section>
    </>
  );
}
