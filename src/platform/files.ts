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
  /** Presente só com File System Access: permite gravar no próprio arquivo. */
  handle: FsFileHandle | null;
  /** Pasta de onde o arquivo veio (se aberto pela pasta): permite backup ao lado. */
  dir: FsDirHandle | null;
}

export class UserCancelled extends Error {}

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
    const file = await handle.getFile();
    return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()), handle, dir: null };
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
  const file = await handle.getFile();
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()), handle, dir };
}

export async function readFromInput(file: File): Promise<OpenedFile> {
  return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()), handle: null, dir: null };
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
  } finally {
    await writable.close();
  }
}

export interface SaveOutcome {
  mode: 'in-place' | 'download';
  backup: string | null;
}

/**
 * Grava o save. Com pasta + arquivo (Chromium): backup `.bak_<data>` ao lado e escrita no lugar.
 * Sem permissão de escrita ou sem File System Access: backup e save por download.
 */
export async function saveFile(
  opened: Pick<OpenedFile, 'name' | 'handle' | 'dir'>,
  original: Uint8Array,
  bytes: Uint8Array,
): Promise<SaveOutcome> {
  const { handle, dir, name } = opened;
  if (handle?.requestPermission) {
    const perm = await handle.requestPermission({ mode: 'readwrite' });
    if (perm === 'granted') {
      let backup: string | null = null;
      if (dir) {
        backup = backupName(name);
        await writeAll(await dir.getFileHandle(backup, { create: true }), original);
      } else {
        // Sem pasta não dá para criar arquivo ao lado: o backup vai por download.
        backup = backupName(name);
        download(backup, original);
      }
      await writeAll(handle, bytes);
      return { mode: 'in-place', backup };
    }
  }
  const backup = backupName(name);
  download(backup, original);
  download(name, bytes);
  return { mode: 'download', backup };
}
