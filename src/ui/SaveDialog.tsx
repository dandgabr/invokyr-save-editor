import { useEffect, useRef } from 'react';
import type { Change } from '../state/document';
import { formatValue } from './format';

interface Props {
  changes: Change[];
  busy: boolean;
  inPlace: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SaveDialog({ changes, busy, inPlace, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  return (
    <dialog ref={ref} className="dialog" aria-labelledby="save-title" onCancel={onCancel}>
      <h2 id="save-title">Revisar alterações</h2>
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
        </>
      )}
      <p className="muted">
        {inPlace
          ? 'Um backup (.bak_data) será criado e o arquivo será gravado no lugar. Feche o jogo antes.'
          : 'Seu navegador não permite gravar no lugar: um backup e o save editado serão baixados. Copie o save editado para a pasta de saves do jogo.'}
      </p>
      <div className="actions">
        <button type="button" className="btn btn-brass" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
        <button type="button" className="btn btn-green" onClick={onConfirm} disabled={busy}>
          {busy ? 'Salvando…' : 'Confirmar e salvar'}
        </button>
      </div>
    </dialog>
  );
}
