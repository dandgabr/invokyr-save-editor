import { useCallback, useEffect, useState } from 'react';
import { type OpenedFile, saveFile } from '../platform/files';
import { useEditor } from '../state/store';
import { SaveDialog } from './SaveDialog';
import { SCREENS } from './screens/registry';
import { Welcome } from './Welcome';

export function App() {
  const { doc, values, fileHandle, past, future, open, close, undo, redo, changes, serialize, markSaved } =
    useEditor();
  const [opened, setOpened] = useState<OpenedFile | null>(null);
  const [tab, setTab] = useState(SCREENS[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);

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
    if (!doc || !opened) return;
    setBusy(true);
    try {
      const out = await saveFile(opened, doc.raw, serialize());
      markSaved();
      setReviewing(false);
      setNotice(
        out.mode === 'in-place'
          ? `Salvo. Backup: ${out.backup ?? '—'}`
          : `Arquivos baixados (backup: ${out.backup}). Copie o save editado para a pasta de saves.`,
      );
    } catch (e) {
      setError(`Falha ao salvar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [doc, opened, serialize, markSaved]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !doc) return;
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
  }, [doc, undo, redo]);

  const banner = (
    <>
      {error && (
        <div className="banner banner-error" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Fechar aviso">
            ✕
          </button>
        </div>
      )}
      {notice && (
        <div className="banner banner-ok" role="status">
          {notice}
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
  const dirty = past.length > 0 || changes().length > 0;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-title">Invokyr Archive Studio</span>
          <span className="chip" data-testid="file-chip">
            {doc.fileName}
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
          <button type="button" className="btn btn-brass" onClick={() => close()}>
            Fechar
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
      <nav className="tabs" aria-label="Seções do save">
        <div role="tablist">
          {SCREENS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`tab-${s.id}`}
              aria-selected={s.id === tab}
              aria-controls="panel"
              className={`tab${s.id === tab ? ' active' : ''}`}
              onClick={() => setTab(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </nav>
      <main id="panel" role="tabpanel" aria-labelledby={`tab-${screen?.id}`} className="content">
        {screen?.render()}
      </main>
      {reviewing && (
        <SaveDialog
          changes={changes()}
          busy={busy}
          inPlace={fileHandle !== null}
          onConfirm={confirmSave}
          onCancel={() => setReviewing(false)}
        />
      )}
    </div>
  );
}
