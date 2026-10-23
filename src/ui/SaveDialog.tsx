import { useEffect, useRef } from 'react';
import { findItem } from '../catalog/catalog';
import { hasErrors, type Issue } from '../schema/validate';
import { type Change, MAX_CHANGES } from '../state/document';
import { formatValue } from './format';

function itemChangePath(path: string): string | null {
  const player = /^save\.playerInventories\[(\d+)\]\.itemStringIds\[(\d+)\]$/.exec(path);
  if (player) return `Itens carregados • jogador ${Number(player[1]) + 1}, posição ${Number(player[2]) + 1}`;
  const bench = /^save\.gameRoomTools\.itemStringIds\[(\d+)\]$/.exec(path);
  if (bench) return `Ferramentas na bancada/prateleira • posição ${Number(bench[1]) + 1}`;
  return null;
}

function displayChangeValue(path: string, value: unknown): string {
  if (itemChangePath(path) && typeof value === 'string')
    return findItem(value)?.label ?? 'Item não reconhecido';
  return formatValue(value);
}

interface Props {
  changes: Change[];
  issues: Issue[];
  busy: boolean;
  inPlace: boolean;
  onBackup: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SaveDialog({ changes, issues, busy, inPlace, onBackup, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      d?.close();
      opener?.focus(); // devolve o foco a quem abriu o diálogo
    };
  }, []);

  const truncated = changes.length >= MAX_CHANGES;
  const blocked = hasErrors(issues);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="save-title"
      onCancel={(e) => {
        e.preventDefault(); // Esc não fecha durante a gravação
        if (!busy) onCancel();
      }}
    >
      <h2 id="save-title">
        Revisar alterações ({changes.length}
        {truncated ? '+' : ''})
      </h2>
      {changes.length === 0 ? (
        <p className="muted">Nenhuma alteração: os dados do save não mudam (o arquivo é regravado).</p>
      ) : (
        <>
          <div className="changes" role="region" aria-label="Lista de alterações" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Campo</th>
                  <th scope="col">Antes</th>
                  <th scope="col">Depois</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.path}>
                    <td>{itemChangePath(c.path) ?? <code>{c.path}</code>}</td>
                    <td>{displayChangeValue(c.path, c.before)}</td>
                    <td>{displayChangeValue(c.path, c.after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {truncated && (
            <p className="muted">
              Mostrando as primeiras {MAX_CHANGES} alterações; há mais. Todas serão gravadas.
            </p>
          )}
        </>
      )}
      {issues.length > 0 && (
        <section className={blocked ? 'issues issues-error' : 'issues'} aria-labelledby="issues-title">
          <h3 id="issues-title">{blocked ? 'Corrija antes de salvar' : 'Avisos'}</h3>
          <ul>
            {issues.map((i) => (
              <li key={`${i.severity}-${i.path}-${i.message}`}>
                <strong>{i.severity === 'error' ? 'Erro' : 'Aviso'}:</strong> <code>{i.path}</code> —{' '}
                {i.message}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="muted">
        {inPlace
          ? 'Um backup (.bak_data) será criado ao lado e o arquivo será gravado no lugar. Feche o jogo antes.'
          : 'Seu navegador não permite gravar no lugar: o save editado será baixado. Antes, baixe o backup do original e depois copie o save editado para a pasta de saves do jogo.'}
      </p>
      <div className="actions">
        <button type="button" className="btn btn-brass" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        {!inPlace && (
          <button type="button" className="btn btn-brass" onClick={onBackup} disabled={busy}>
            Baixar backup do original
          </button>
        )}
        <button type="button" className="btn btn-green" onClick={onConfirm} disabled={busy || blocked}>
          {busy ? 'Salvando…' : inPlace ? 'Confirmar e salvar' : 'Baixar save editado'}
        </button>
      </div>
    </dialog>
  );
}
