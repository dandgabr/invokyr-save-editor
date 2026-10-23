import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { backupName, download, type OpenedFile, saveFile } from '../platform/files';
import { diffDocs } from '../state/document';
import { useEditor } from '../state/store';
import { SaveDialog } from './SaveDialog';
import { SCREENS } from './screens/registry';
import { Welcome } from './Welcome';

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export function App() {
  const { doc, values, original, fileHandle, past, future, open, close, undo, redo, serialize, markSaved } =
    useEditor();
  const [opened, setOpened] = useState<OpenedFile | null>(null);
  const [tab, setTab] = useState(SCREENS[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const changes = useMemo(() => (original && values ? diffDocs(original, values) : []), [original, values]);
  const dirty = changes.length > 0;

  const handleOpen = (f: OpenedFile) => {
    try {
      open(f.name, f.bytes, f.handle);
      setOpened(f);
      setError(null);
      setNotice(null);
    } catch (e) {
      setError(`Não foi possível abrir "${f.name}": ${(e as Error).message}`);
    }
  };

  const confirmSave = useCallback(async () => {
    if (!doc || !opened || !values) return;
    // Snapshot: o que é gravado é exatamente o que é marcado como salvo, mesmo se o estado mudar durante o await.
    const snapshot = values;
    const bytes = serialize();
    setBusy(true);
    try {
      const out = await saveFile(opened, doc.raw, bytes);
      markSaved(snapshot, bytes);
      if (out.meta) setOpened({ ...opened, ...out.meta });
      setReviewing(false);
      setNotice(
        out.mode === 'in-place'
          ? `Salvo. Backup: ${out.backup}.${out.diskChanged ? ' Atenção: o arquivo no disco havia mudado desde a abertura (Steam Cloud ou o jogo); o backup guarda essa versão.' : ''}`
          : 'Save editado baixado. Copie-o para a pasta de saves do jogo, substituindo o original.',
      );
    } catch (e) {
      setError(`Falha ao salvar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [doc, opened, values, serialize, markSaved]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !doc || reviewing || busy || isEditable(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      } else if (k === 's') {
        e.preventDefault();
        setReviewing(true);
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

  const banner = (
    <>
      {error && (
        <div className="banner banner-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Fechar aviso">
            ✕
          </button>
        </div>
      )}
      {notice && (
        <div className="banner banner-ok" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso">
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
        <Welcome onOpen={handleOpen} onError={setError} />
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
            Tomo: {doc.fileName}
            {version !== undefined ? ` (v${version})` : ''}
            {dirty ? ' •' : ''}
          </span>
        </div>
        <div className="actions">
          <button
            type="button"
            className="btn btn-brass"
            onClick={undo}
            disabled={past.length === 0}
            title="Desfazer (Ctrl+Z)"
          >
            Desfazer
          </button>
          <button
            type="button"
            className="btn btn-brass"
            onClick={redo}
            disabled={future.length === 0}
            title="Refazer (Ctrl+Y)"
          >
            Refazer
          </button>
          <button
            type="button"
            className="btn btn-brass"
            onClick={() => {
              if (!dirty || window.confirm('Há alterações não salvas. Fechar mesmo assim?')) close();
            }}
          >
            Abrir outro save
          </button>
          <button
            type="button"
            className="btn btn-green"
            onClick={() => setReviewing(true)}
            title="Salvar (Ctrl+S)"
          >
            Salvar (.sav)
          </button>
        </div>
      </header>
      {banner}
      <div className="tabs">
        <div role="tablist" aria-label="Seções do save" onKeyDown={onTabKey}>
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
              {s.label}
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
