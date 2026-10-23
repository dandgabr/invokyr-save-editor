import { useMemo, useRef, useState } from 'react';
import { LanguageSelect, useLocale, useText } from '../i18n';
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
import { detectOs, locationAlternatives, locationLabel, locationNote, saveLocationFor } from '../platform/os';

interface Props {
  onOpen: (f: OpenedFile) => void;
  onError: (kind: 'copy' | 'file', detail?: string) => void;
}

export function Welcome({ onOpen, onError }: Props) {
  const t = useText();
  const { locale } = useLocale();
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
      if (!(e instanceof UserCancelled)) onError('file', (e as Error).message);
    }
  };

  const copy = async () => {
    if (!loc.path) return;
    try {
      await navigator.clipboard.writeText(loc.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError('copy');
    }
  };

  return (
    <main className="welcome">
      <h1>Invokyr Archive Studio</h1>
      <LanguageSelect />
      <p className="lede">
        {t(
          'Edit your Invokyr save in your browser. The file is read and written locally and is never sent to a server.',
          'Edite o seu save do Invokyr direto no navegador. O arquivo é lido e gravado localmente e nunca é enviado a nenhum servidor.',
          'Edita tu partida de Invokyr en el navegador. El archivo se lee y guarda localmente y nunca se envía a un servidor.',
        )}
      </p>
      <p className="muted" data-testid="game-build">
        {t(
          'Based on Invokyr Steam build 26154962 (save v15). Compatibility with other builds is unverified.',
          'Baseado na build Steam 26154962 do Invokyr (save v15). A compatibilidade com outras builds não foi verificada.',
          'Basado en la build de Steam 26154962 de Invokyr (partida v15). No se verificó la compatibilidad con otras builds.',
        )}
      </p>

      <section className="panel" aria-labelledby="where">
        <h2 id="where">
          {t('Where to find your save', 'Onde fica o seu save', 'Dónde está tu partida')} (
          {locationLabel(os, locale)})
        </h2>
        {loc.path ? (
          <>
            <div className="pathrow">
              <code className="path" data-testid="save-path">
                {loc.path}
              </code>
              <button type="button" className="btn btn-brass" onClick={copy}>
                {copied
                  ? t('Copied ✓', 'Copiado ✓', 'Copiado ✓')
                  : t('Copy path', 'Copiar caminho', 'Copiar ruta')}
              </button>
            </div>
            {loc.alternatives.length > 0 && (
              <details>
                <summary>
                  {t('Other possible locations', 'Outros locais possíveis', 'Otras ubicaciones posibles')}
                </summary>
                <ul>
                  {locationAlternatives(os, locale).map((a) => (
                    <li key={a}>
                      <code>{a}</code>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        ) : null}
        <p className="muted">{locationNote(os, locale)}</p>
      </section>

      <section className="panel" aria-labelledby="open">
        <h2 id="open">{t('Open save', 'Abrir save', 'Abrir partida')}</h2>
        <div className="actions">
          <button
            type="button"
            className="btn btn-green"
            onClick={() =>
              canUseFsAccess() ? guard(async () => onOpen(await pickSaveFile())) : inputRef.current?.click()
            }
          >
            {t('Open .sav file', 'Abrir arquivo .sav', 'Abrir archivo .sav')}
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
              {t('Open saves folder', 'Abrir pasta de saves', 'Abrir carpeta de partidas')}
            </button>
          )}
        </div>

        {dir && (
          <div className="savelist">
            <h3>
              {t('Saves in', 'Saves em', 'Partidas en')} “{dir.handle.name}”
            </h3>
            {dir.files.length === 0 ? (
              <p className="muted">
                {t(
                  'No .sav files in this folder.',
                  'Nenhum arquivo .sav nesta pasta.',
                  'No hay archivos .sav en esta carpeta.',
                )}
              </p>
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
          {t(
            '…or drag the .sav file here',
            '…ou arraste o arquivo .sav para cá',
            '…o arrastra el archivo .sav aquí',
          )}
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
        <h2 id="care">{t('Before editing', 'Antes de editar', 'Antes de editar')}</h2>
        <ul>
          <li>
            {t(
              'Close the game. It writes the save on exit and may undo your changes.',
              'Feche o jogo. Ele regrava o save ao sair e pode desfazer a sua edição.',
              'Cierra el juego. Al salir vuelve a guardar la partida y puede deshacer tus cambios.',
            )}
          </li>
          <li>
            {t(
              'Steam Cloud may overwrite the file with its cloud version. Disable syncing for the game or check afterward.',
              'O Steam Cloud pode sobrescrever o arquivo com a versão da nuvem. Desative a sincronização do jogo ou confira depois.',
              'Steam Cloud puede sobrescribir el archivo con la versión de la nube. Desactiva la sincronización del juego o revísalo después.',
            )}
          </li>
          <li>
            {t(
              'When saving in place (Chrome or Edge), a .bak backup is created first: beside the save if you opened its folder, or downloaded if you opened only the file. In other browsers, download the original backup in the save dialog.',
              'Ao gravar no próprio arquivo (Chrome ou Edge), um backup .bak é criado antes: ao lado do save, se você abriu a pasta, ou baixado, se abriu só o arquivo. Nos outros navegadores, baixe o backup do original na tela de salvar.',
              'Al guardar en el mismo archivo (Chrome o Edge), primero se crea una copia .bak: junto a la partida si abriste la carpeta, o descargada si abriste solo el archivo. En otros navegadores, descarga la copia original en el diálogo de guardado.',
            )}
          </li>
          <li>
            {t(
              'Fan project, not affiliated with Ludogram. Use at your own risk.',
              'Projeto de fã, não afiliado à Ludogram. Use por sua conta e risco.',
              'Proyecto de fans no afiliado con Ludogram. Úsalo bajo tu responsabilidad.',
            )}
          </li>
        </ul>
      </section>
    </main>
  );
}
