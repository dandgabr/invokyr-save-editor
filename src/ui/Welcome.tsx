import { useMemo, useRef, useState } from 'react';
import {
  canPickDirectory,
  canUseFsAccess,
  type FsDirHandle,
  type FsFileHandle,
  type OpenedFile,
  pickSaveDirectory,
  pickSaveFile,
  readFromInput,
  readHandle,
  UserCancelled,
} from '../platform/files';
import { detectOs, saveLocationFor } from '../platform/os';

interface Props {
  onOpen: (f: OpenedFile) => void;
  onError: (message: string) => void;
}

export function Welcome({ onOpen, onError }: Props) {
  const os = useMemo(() => detectOs(navigator as unknown as Parameters<typeof detectOs>[0]), []);
  const loc = useMemo(() => saveLocationFor(os), [os]);
  const [copied, setCopied] = useState(false);
  const [dir, setDir] = useState<{ handle: FsDirHandle; files: FsFileHandle[] } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const guard = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      if (!(e instanceof UserCancelled)) onError((e as Error).message);
    }
  };

  const copy = async () => {
    if (!loc.path) return;
    try {
      await navigator.clipboard.writeText(loc.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError('Não foi possível copiar. Selecione o caminho e copie manualmente.');
    }
  };

  return (
    <main className="welcome">
      <h1>Invokyr Archive Studio</h1>
      <p className="lede">
        Edite o seu save do Invokyr direto no navegador. O arquivo é lido e gravado localmente e nunca é
        enviado a nenhum servidor.
      </p>

      <section className="panel" aria-labelledby="where">
        <h2 id="where">Onde fica o seu save ({loc.label})</h2>
        {loc.path ? (
          <>
            <div className="pathrow">
              <code className="path" data-testid="save-path">
                {loc.path}
              </code>
              <button type="button" className="btn btn-brass" onClick={copy}>
                {copied ? 'Copiado ✓' : 'Copiar caminho'}
              </button>
            </div>
            {loc.alternatives.length > 0 && (
              <details>
                <summary>Outros locais possíveis</summary>
                <ul>
                  {loc.alternatives.map((a) => (
                    <li key={a}>
                      <code>{a}</code>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : null}
        <p className="muted">{loc.note}</p>
      </section>

      <section className="panel" aria-labelledby="open">
        <h2 id="open">Abrir save</h2>
        <div className="actions">
          <button
            type="button"
            className="btn btn-green"
            onClick={() =>
              canUseFsAccess() ? guard(async () => onOpen(await pickSaveFile())) : inputRef.current?.click()
            }
          >
            Abrir arquivo .sav
          </button>
          {canPickDirectory() && (
            <button
              type="button"
              className="btn btn-brass"
              onClick={() =>
                guard(async () => {
                  const r = await pickSaveDirectory();
                  setDir({ handle: r.dir, files: r.files });
                })
              }
            >
              Abrir pasta de saves
            </button>
          )}
        </div>

        {dir && (
          <div className="savelist">
            <h3>Saves em “{dir.handle.name}”</h3>
            {dir.files.length === 0 ? (
              <p className="muted">Nenhum arquivo .sav nesta pasta.</p>
            ) : (
              <ul>
                {dir.files.map((f) => (
                  <li key={f.name}>
                    <button
                      type="button"
                      className="btn btn-brass"
                      onClick={() => guard(async () => onOpen(await readHandle(f, dir.handle)))}
                    >
                      {f.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div
          data-dropzone
          className={`dropzone${dragging ? ' dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) guard(async () => onOpen(await readFromInput(f)));
          }}
        >
          …ou arraste o arquivo .sav para cá
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".sav"
          data-testid="file-input"
          hidden
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) guard(async () => onOpen(await readFromInput(f)));
          }}
        />
      </section>

      <section className="panel warn" aria-labelledby="care">
        <h2 id="care">Antes de editar</h2>
        <ul>
          <li>Feche o jogo. Ele regrava o save ao sair e pode desfazer a sua edição.</li>
          <li>
            O Steam Cloud pode sobrescrever o arquivo com a versão da nuvem. Desative a sincronização do jogo
            ou confira depois.
          </li>
          <li>Um backup do arquivo original é feito a cada gravação.</li>
          <li>Projeto de fã, não afiliado à Ludogram. Use por sua conta e risco.</li>
        </ul>
      </section>
    </main>
  );
}
