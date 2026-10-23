import { applyPatches, enablePatches, type Patch, produceWithPatches } from 'immer';
import { create } from 'zustand';
import type { StreamName } from '../codec/zip';
import type { FsFileHandle } from '../platform/files';
import { type Change, diffDocs, openSave, type SaveDoc, serializeSave } from './document';

enablePatches();

type Values = Record<StreamName, unknown>;
interface HistoryEntry {
  patches: Patch[];
  inverse: Patch[];
}

export interface EditorState {
  doc: SaveDoc | null;
  /** Valores no momento da abertura (base do diff). */
  original: Values | null;
  values: Values | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** Handle do arquivo (File System Access), quando o navegador permite gravar no lugar. */
  fileHandle: FsFileHandle | null;
  open: (fileName: string, bytes: Uint8Array, fileHandle?: FsFileHandle | null) => void;
  close: () => void;
  edit: (recipe: (draft: Values) => void) => void;
  undo: () => void;
  redo: () => void;
  changes: () => Change[];
  serialize: () => Uint8Array;
  /** Marca como salvo o snapshot que de fato foi gravado (valores + bytes), não o estado atual. */
  markSaved: (snapshot: Values, raw: Uint8Array) => void;
}

export const useEditor = create<EditorState>((set, get) => ({
  doc: null,
  original: null,
  values: null,
  past: [],
  future: [],
  fileHandle: null,

  open(fileName, bytes, fileHandle = null) {
    const doc = openSave(fileName, bytes);
    set({ doc, original: doc.values, values: doc.values, past: [], future: [], fileHandle });
  },
  close() {
    set({ doc: null, original: null, values: null, past: [], future: [], fileHandle: null });
  },
  edit(recipe) {
    const { values, past } = get();
    if (!values) return;
    const [next, patches, inverse] = produceWithPatches(values, recipe);
    if (patches.length === 0) return;
    set({ values: next, past: [...past, { patches, inverse }], future: [] });
  },
  undo() {
    const { values, past, future } = get();
    const entry = past[past.length - 1];
    if (!values || !entry) return;
    set({ values: applyPatches(values, entry.inverse), past: past.slice(0, -1), future: [entry, ...future] });
  },
  redo() {
    const { values, past, future } = get();
    const entry = future[0];
    if (!values || !entry) return;
    set({ values: applyPatches(values, entry.patches), past: [...past, entry], future: future.slice(1) });
  },
  changes() {
    const { original, values } = get();
    return original && values ? diffDocs(original, values) : [];
  },
  serialize() {
    const { doc, values } = get();
    if (!doc || !values) throw new Error('Nenhum save aberto');
    return serializeSave(doc, values);
  },
  markSaved(snapshot, raw) {
    const { doc, values } = get();
    if (!doc) return;
    // Se o usuário desfez/refez durante a gravação, `values` pode diferir do snapshot gravado: mantém o histórico.
    const same = values === snapshot;
    set({ doc: { ...doc, raw }, original: snapshot, ...(same ? { past: [], future: [] } : {}) });
  },
}));
