import { useEffect, useRef } from 'react';
import { type Change, MAX_CHANGES } from '../state/document';
import { formatValue } from './format';

interface Props {
  changes: Change[];
  busy: boolean;
  inPlace: boolean;
  onBackup: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SaveDialog({ changes, busy, inPlace, onBackup, onConfirm, onCancel }: Props) {
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
        <p className="muted">Nenhuma alteração: o arquivo será regravado sem mudanças.</p>
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
                    <td>
                      <code>{c.path}</code>
                    </td>
                    <td>{formatValue(c.before)}</td>
                    <td>{formatValue(c.after)}</td>
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
        <button type="button" className="btn btn-green" onClick={onConfirm} disabled={busy}>
          {busy ? 'Salvando…' : inPlace ? 'Confirmar e salvar' : 'Baixar save editado'}
        </button>
      </div>
    </dialog>
  );
}
