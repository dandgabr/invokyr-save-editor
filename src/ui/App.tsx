import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LanguageSelect, useLocale, useText } from '../i18n';
import { backupName, download, type OpenedFile, saveFile } from '../platform/files';
import type { SaveValues } from '../schema/types';
import { checkVersion, type Issue, validate } from '../schema/validate';
import { diffDocs } from '../state/document';
import { useEditor } from '../state/store';
import { useAnnounce } from './announce';
import { diagnosticMessage, fileErrorMessage } from './diagnostics';
import { SaveDialog } from './SaveDialog';
import { SCREENS, screenLabel } from './screens/registry';
import { Welcome } from './Welcome';

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

type AppError =
  | { kind: 'open'; name: string; detail: string }
  | { kind: 'save'; detail: string }
  | { kind: 'file'; detail: string }
  | { kind: 'copy' };
type SaveNotice = { mode: 'in-place' | 'download'; backup?: string; diskChanged?: boolean };

export function App() {
  const t = useText();
  const { locale } = useLocale();
  const { doc, values, original, fileHandle, past, future, open, close, undo, redo, serialize, markSaved } =
    useEditor();
  const [opened, setOpened] = useState<OpenedFile | null>(null);
  const [tab, setTab] = useState(SCREENS[0]?.id ?? '');
  const [error, setError] = useState<AppError | null>(null);
  const [notice, setNotice] = useState<SaveNotice | null>(null);
  const [warning, setWarning] = useState<Issue | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const announcement = useAnnounce((x) => x.message);
  const announceN = useAnnounce((x) => x.n);
  const say = useAnnounce((x) => x.say);

  const changes = useMemo(() => (original && values ? diffDocs(original, values) : []), [original, values]);
  const dirty = changes.length > 0;
  const issues = useMemo<Issue[]>(() => {
    if (!values) return [];
    try {
      return validate(values as unknown as SaveValues);
    } catch (e) {
      return [
        {
          severity: 'error',
          path: '(save)',
          message: `Estrutura do save inesperada: ${(e as Error).message}`,
        },
      ];
    }
  }, [values]);

  const handleOpen = (f: OpenedFile) => {
    try {
      open(f.name, f.bytes, f.handle);
      setOpened(f);
      setError(null);
      setNotice(null);
      // Versão de schema desconhecida: avisa ao abrir (não recusa; o jogo não parece recusar versões diferentes).
      const issue = checkVersion(useEditor.getState().values as unknown as SaveValues);
      setWarning(issue);
      if (issue) say(diagnosticMessage(issue.message, locale));
    } catch (e) {
      setError({ kind: 'open', name: f.name, detail: (e as Error).message });
    }
  };

  const confirmSave = useCallback(async () => {
    if (!doc || !opened || !values) return;
    if (issues.some((i) => i.severity === 'error')) return;
    // Snapshot: o que é gravado é exatamente o que é marcado como salvo, mesmo se o estado mudar durante o await.
    const snapshot = values;
    const bytes = serialize();
    setBusy(true);
    try {
      const out = await saveFile(opened, doc.raw, bytes);
      markSaved(snapshot, bytes);
      if (out.meta) setOpened({ ...opened, ...out.meta });
      setReviewing(false);
      say(
        out.mode === 'in-place'
          ? t(
              'Save written with backup.',
              'Save gravado com backup.',
              'Partida guardada con copia de seguridad.',
            )
          : t('Edited save downloaded.', 'Save editado baixado.', 'Partida editada descargada.'),
      );
      setNotice({ mode: out.mode, backup: out.backup ?? undefined, diskChanged: out.diskChanged });
    } catch (e) {
      setError({ kind: 'save', detail: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }, [doc, opened, values, issues, serialize, markSaved, say]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !doc || reviewing || busy) return;
      if (document.querySelector('dialog[open]')) return; // modal aberto (catálogo): não age por baixo dele
      const k = e.key.toLowerCase();
      if (k === 's') {
        e.preventDefault(); // também dentro de campos: evita o "Salvar página" do navegador
        setReviewing(true);
        return;
      }
      if (isEditable(e.target)) return; // desfazer/refazer nativos dos campos de texto
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doc, reviewing, busy, undo, redo]);

  // Soltar um arquivo fora da zona de drop faria o navegador navegar para ele e perder as edições.
  useEffect(() => {
    const stop = (e: DragEvent) => {
      if (!(e.target instanceof HTMLElement && e.target.closest('[data-dropzone]'))) e.preventDefault();
    };
    window.addEventListener('dragover', stop);
    window.addEventListener('drop', stop);
    return () => {
      window.removeEventListener('dragover', stop);
      window.removeEventListener('drop', stop);
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = SCREENS.findIndex((s) => s.id === tab);
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % SCREENS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + SCREENS.length) % SCREENS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = SCREENS.length - 1;
    else return;
    e.preventDefault();
    const target = SCREENS[next];
    if (!target) return;
    setTab(target.id);
    tabRefs.current[target.id]?.focus();
  };

  const statusRegion = (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true" key={announceN}>
      {announcement}
    </div>
  );
  const errorText =
    error?.kind === 'open'
      ? `${t('Could not open', 'Não foi possível abrir', 'No se pudo abrir')} "${error.name}": ${fileErrorMessage(error.detail, locale)}`
      : error?.kind === 'file'
        ? fileErrorMessage(error.detail, locale)
        : error?.kind === 'copy'
          ? t(
              'Could not copy. Select the path and copy it manually.',
              'Não foi possível copiar. Selecione o caminho e copie manualmente.',
              'No se pudo copiar. Selecciona la ruta y cópiala manualmente.',
            )
          : error?.kind === 'save'
            ? `${t('Could not save', 'Falha ao salvar', 'No se pudo guardar')}: ${fileErrorMessage(error.detail, locale)}`
            : '';
  const noticeText =
    notice?.mode === 'in-place'
      ? `${t('Saved. Backup', 'Salvo. Backup', 'Guardado. Copia de seguridad')}: ${notice.backup}.${notice.diskChanged ? t(' Warning: the file on disk changed after opening (Steam Cloud or the game); the backup contains that version.', ' Atenção: o arquivo no disco havia mudado desde a abertura (Steam Cloud ou o jogo); o backup guarda essa versão.', ' Atención: el archivo en disco cambió después de abrirlo (Steam Cloud o el juego); la copia conserva esa versión.') : ''}`
      : t(
          'Edited save downloaded. Copy it to the game saves folder, replacing the original.',
          'Save editado baixado. Copie-o para a pasta de saves do jogo, substituindo o original.',
          'Se descargó la partida editada. Cópiala en la carpeta de partidas del juego y reemplaza la original.',
        );
  const banner = (
    <>
      {statusRegion}
      {error && (
        <div className="banner banner-error" role="alert">
          <span>{errorText}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label={t('Dismiss message', 'Fechar aviso', 'Cerrar aviso')}
          >
            ✕
          </button>
        </div>
      )}
      {warning && (
        <div className="banner banner-warn">
          <span>{diagnosticMessage(warning.message, locale)}</span>
          <button
            type="button"
            onClick={() => setWarning(null)}
            aria-label={t('Dismiss message', 'Fechar aviso', 'Cerrar aviso')}
          >
            ✕
          </button>
        </div>
      )}
      {notice && (
        <div className="banner banner-ok">
          <span>{noticeText}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label={t('Dismiss message', 'Fechar aviso', 'Cerrar aviso')}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );

  if (!doc || !values) {
    return (
      <>
        {banner}
        <Welcome
          onOpen={handleOpen}
          onError={(kind, detail) =>
            setError(kind === 'copy' ? { kind: 'copy' } : { kind: 'file', detail: detail ?? '' })
          }
        />
      </>
    );
  }

  const screen = SCREENS.find((s) => s.id === tab) ?? SCREENS[0];
  const version = (values.save as { version?: number } | undefined)?.version;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <h1 className="brand-title">Invokyr Archive Studio</h1>
          <span className="chip" data-testid="file-chip">
            {t('Save', 'Tomo', 'Partida')}: {doc.fileName}
            {version !== undefined ? ` (v${version})` : ''}
            {dirty && (
              <>
                <span aria-hidden="true"> •</span>
                <span className="visually-hidden"> ({t('modified', 'alterado', 'modificado')})</span>
              </>
            )}
          </span>
        </div>
        <div className="actions">
          <LanguageSelect />
          <button
            type="button"
            className="btn btn-brass"
            onClick={undo}
            disabled={past.length === 0}
            title={t('Undo (Ctrl+Z)', 'Desfazer (Ctrl+Z)', 'Deshacer (Ctrl+Z)')}
          >
            {t('Undo', 'Desfazer', 'Deshacer')}
          </button>
          <button
            type="button"
            className="btn btn-brass"
            onClick={redo}
            disabled={future.length === 0}
            title={t('Redo (Ctrl+Y)', 'Refazer (Ctrl+Y)', 'Rehacer (Ctrl+Y)')}
          >
            {t('Redo', 'Refazer', 'Rehacer')}
          </button>
          <button
            type="button"
            className="btn btn-brass"
            onClick={() => {
              if (
                !dirty ||
                window.confirm(
                  t(
                    'There are unsaved changes. Close anyway?',
                    'Há alterações não salvas. Fechar mesmo assim?',
                    'Hay cambios sin guardar. ¿Cerrar de todos modos?',
                  ),
                )
              )
                close();
            }}
          >
            {t('Open another save', 'Abrir outro save', 'Abrir otra partida')}
          </button>
          <button
            type="button"
            className="btn btn-green"
            onClick={() => setReviewing(true)}
            title={t('Save (Ctrl+S)', 'Salvar (Ctrl+S)', 'Guardar (Ctrl+S)')}
          >
            {t('Save (.sav)', 'Salvar (.sav)', 'Guardar (.sav)')}
          </button>
        </div>
      </header>
      {banner}
      <div className="tabs">
        <div
          role="tablist"
          aria-label={t('Save sections', 'Seções do save', 'Secciones de la partida')}
          onKeyDown={onTabKey}
        >
          {SCREENS.map((s) => (
            <button
              key={s.id}
              ref={(el) => {
                tabRefs.current[s.id] = el;
              }}
              type="button"
              role="tab"
              id={`tab-${s.id}`}
              aria-selected={s.id === tab}
              aria-controls="panel"
              tabIndex={s.id === tab ? 0 : -1}
              className={`tab${s.id === tab ? ' active' : ''}`}
              onClick={() => setTab(s.id)}
            >
              {screenLabel(s, locale)}
            </button>
          ))}
        </div>
      </div>
      <main className="content">
        <div id="panel" role="tabpanel" aria-labelledby={`tab-${screen?.id}`} tabIndex={0}>
          {screen?.render()}
        </div>
      </main>
      {reviewing && (
        <SaveDialog
          changes={changes}
          issues={issues}
          original={original as SaveValues}
          values={values as SaveValues}
          busy={busy}
          inPlace={fileHandle !== null}
          onBackup={() => download(backupName(doc.fileName), doc.raw)}
          onConfirm={confirmSave}
          onCancel={() => setReviewing(false)}
        />
      )}
    </div>
  );
}
