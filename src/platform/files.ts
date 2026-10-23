/** Acesso a arquivos com File System Access (Chromium) e fallback universal (input + download). */

interface FsPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}
interface FsHandleBase {
  kind: 'file' | 'directory';
  name: string;
  queryPermission?(d?: FsPermissionDescriptor): Promise<PermissionState>;
  requestPermission?(d?: FsPermissionDescriptor): Promise<PermissionState>;
}
export interface FsWritable {
  write(data: BufferSource): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}
export interface FsFileHandle extends FsHandleBase {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(): Promise<FsWritable>;
}
export interface FsDirHandle extends FsHandleBase {
  kind: 'directory';
  values(): AsyncIterable<FsFileHandle | FsDirHandle>;
  getFileHandle(name: string, o?: { create?: boolean }): Promise<FsFileHandle>;
}
interface PickerWindow {
  showOpenFilePicker?: (o?: unknown) => Promise<FsFileHandle[]>;
  showDirectoryPicker?: (o?: unknown) => Promise<FsDirHandle>;
}

const w = (): PickerWindow => globalThis as unknown as PickerWindow;

export const canUseFsAccess = (): boolean => typeof w().showOpenFilePicker === 'function';
export const canPickDirectory = (): boolean => typeof w().showDirectoryPicker === 'function';

export interface OpenedFile {
  name: string;
  bytes: Uint8Array;
  /** Metadados do arquivo na abertura, para detectar alteração externa (Steam Cloud, jogo) antes de gravar. */
  lastModified: number;
  size: number;
  /** Presente só com File System Access: permite gravar no próprio arquivo. */
  handle: FsFileHandle | null;
  /** Pasta de onde o arquivo veio (se aberto pela pasta): permite backup ao lado. */
  dir: FsDirHandle | null;
}

export class UserCancelled extends Error {}

export const MAX_SAVE_BYTES = 128 * 1024 * 1024;

function assertSize(file: File): void {
  if (file.size > MAX_SAVE_BYTES)
    throw new Error(`"${file.name}" é grande demais para ser um save do Invokyr`);
}

async function toOpened(
  file: File,
  handle: FsFileHandle | null,
  dir: FsDirHandle | null,
): Promise<OpenedFile> {
  assertSize(file);
  return {
    name: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
    lastModified: file.lastModified,
    size: file.size,
    handle,
    dir,
  };
}

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

export async function pickSaveFile(): Promise<OpenedFile> {
  const pick = w().showOpenFilePicker;
  if (!pick) throw new Error('showOpenFilePicker indisponível');
  try {
    const [handle] = await pick({
      multiple: false,
      types: [{ description: 'Save do Invokyr', accept: { 'application/octet-stream': ['.sav'] } }],
    });
    if (!handle) throw new UserCancelled();
    return await toOpened(await handle.getFile(), handle, null);
  } catch (e) {
    if (isAbort(e)) throw new UserCancelled();
    throw e;
  }
}

/** Lista os `.sav` de uma pasta escolhida pela pessoa (ex.: a pasta `saves` do jogo). */
export async function pickSaveDirectory(): Promise<{ dir: FsDirHandle; files: FsFileHandle[] }> {
  const pick = w().showDirectoryPicker;
  if (!pick) throw new Error('showDirectoryPicker indisponível');
  try {
    const dir = await pick({ mode: 'readwrite', id: 'invokyr-saves' });
    const files: FsFileHandle[] = [];
    for await (const entry of dir.values()) {
      if (entry.kind === 'file' && /\.sav$/i.test(entry.name)) files.push(entry);
    }
    files.sort((a, b) => a.name.localeCompare(b.name));
    return { dir, files };
  } catch (e) {
    if (isAbort(e)) throw new UserCancelled();
    throw e;
  }
}

export async function readHandle(handle: FsFileHandle, dir: FsDirHandle | null): Promise<OpenedFile> {
  return toOpened(await handle.getFile(), handle, dir);
}

export async function readFromInput(file: File): Promise<OpenedFile> {
  return toOpened(file, null, null);
}

export function backupName(name: string, now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;
  return `${name}.bak_${stamp}`;
}

export function download(name: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/octet-stream' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function writeAll(handle: FsFileHandle, bytes: Uint8Array): Promise<void> {
  const writable = await handle.createWritable();
  try {
    await writable.write(bytes as BufferSource);
    await writable.close();
  } catch (e) {
    // Descarta a escrita pendente: o arquivo original permanece intacto.
    await writable.abort?.().catch(() => {});
    throw e;
  }
}

export interface SaveOutcome {
  mode: 'in-place' | 'download';
  /** Nome do backup criado (só no modo in-place). */
  backup: string | null;
  /** O arquivo no disco mudou desde a abertura; o backup guarda o conteúdo que estava lá. */
  diskChanged: boolean;
  /** Novos metadados do arquivo gravado (para a próxima checagem). */
  meta: { lastModified: number; size: number } | null;
}

/**
 * Grava o save no lugar (Chromium, com permissão): antes, confere se o arquivo mudou no disco desde a abertura
 * (Steam Cloud/jogo) e faz backup do conteúdo ATUAL do disco; depois grava. O `createWritable` do navegador só
 * troca o arquivo no `close()`, então uma falha não corrompe o original.
 * Sem permissão/handle: baixa só o save editado (o backup é um botão separado, que exige um clique próprio).
 */
export async function saveFile(
  opened: Pick<OpenedFile, 'name' | 'handle' | 'dir' | 'lastModified' | 'size'>,
  previous: Uint8Array,
  bytes: Uint8Array,
): Promise<SaveOutcome> {
  const { handle, dir, name } = opened;
  if (handle?.requestPermission) {
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      const current = await handle.getFile();
      const diskChanged = current.lastModified !== opened.lastModified || current.size !== opened.size;
      const backupBytes = diskChanged ? new Uint8Array(await current.arrayBuffer()) : previous;
      const backup = backupName(name);
      if (dir) await writeAll(await dir.getFileHandle(backup, { create: true }), backupBytes);
      else download(backup, backupBytes);
      await writeAll(handle, bytes);
      const after = await handle.getFile();
      return {
        mode: 'in-place',
        backup,
        diskChanged,
        meta: { lastModified: after.lastModified, size: after.size },
      };
    }
  }
  download(name, bytes);
  return { mode: 'download', backup: null, diskChanged: false, meta: null };
}
