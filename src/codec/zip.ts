import { unzipSync, type Zippable, zipSync } from 'fflate';

/** Streams obrigatórios do contêiner `.sav` (ZIP/DEFLATE, nomes sem extensão e case-sensitive). */
export const STREAM_NAMES = ['meta', 'save', 'collection'] as const;
export type StreamName = (typeof STREAM_NAMES)[number];
export type Streams = Record<StreamName, Uint8Array>;

export interface Container {
  streams: Streams;
  /** Entradas além de meta/save/collection (ex.: stream novo de uma atualização do jogo): preservadas ao salvar. */
  extras: Record<string, Uint8Array>;
  /** Ordem original das entradas no ZIP, reaplicada ao gravar. */
  order: string[];
}

export class SaveContainerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveContainerError';
  }
}

export const ZIP_LIMITS = {
  maxFileBytes: 128 * 1024 * 1024,
  maxEntryBytes: 64 * 1024 * 1024,
  maxTotalBytes: 128 * 1024 * 1024,
  maxEntries: 16,
};

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++)
    c = (CRC_TABLE[(c ^ (data[i] as number)) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface CdEntry {
  name: string;
  crc: number;
  size: number;
  compSize: number;
  flags: number;
  method: number;
}

/** Lê o diretório central (sem confiar no fflate para metadados) para validar CRC, tamanhos e nomes. */
function readCentralDirectory(file: Uint8Array): CdEntry[] {
  const dv = new DataView(file.buffer, file.byteOffset, file.byteLength);
  let eocd = -1;
  for (let i = file.byteLength - 22; i >= Math.max(0, file.byteLength - 22 - 0xffff); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new SaveContainerError('ZIP sem diretório central (arquivo truncado?)');
  const total = dv.getUint16(eocd + 10, true);
  const cdOffset = dv.getUint32(eocd + 16, true);
  if (total === 0xffff || cdOffset === 0xffffffff) throw new SaveContainerError('ZIP64 não é suportado');
  if (total > ZIP_LIMITS.maxEntries) throw new SaveContainerError('ZIP com entradas demais');
  const out: CdEntry[] = [];
  const names = new Set<string>();
  const dec = new TextDecoder('utf-8');
  let p = cdOffset;
  for (let i = 0; i < total; i++) {
    if (p + 46 > file.byteLength || dv.getUint32(p, true) !== 0x02014b50) {
      throw new SaveContainerError('Diretório central do ZIP corrompido');
    }
    const flags = dv.getUint16(p + 8, true);
    const method = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const compSize = dv.getUint32(p + 20, true);
    const size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    if (p + 46 + nameLen > file.byteLength)
      throw new SaveContainerError('Diretório central do ZIP corrompido');
    const name = dec.decode(file.subarray(p + 46, p + 46 + nameLen));
    if (names.has(name)) throw new SaveContainerError(`ZIP com nome de entrada duplicado: "${name}"`);
    names.add(name);
    if (flags & 1) throw new SaveContainerError('ZIP criptografado não é suportado');
    if (method !== 0 && method !== 8)
      throw new SaveContainerError(`Método de compressão ${method} não suportado`);
    out.push({ name, crc, size, compSize, flags, method });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

export function readContainer(file: Uint8Array): Container {
  if (file.byteLength > ZIP_LIMITS.maxFileBytes)
    throw new SaveContainerError('Arquivo grande demais para ser um save');
  if (!(file[0] === 0x50 && file[1] === 0x4b))
    throw new SaveContainerError('O arquivo não é um ZIP válido (.sav)');
  const entries = readCentralDirectory(file).filter((e) => !e.name.endsWith('/'));
  let total = 0;
  for (const e of entries) {
    if (e.size > ZIP_LIMITS.maxEntryBytes) throw new SaveContainerError(`Entrada "${e.name}" grande demais`);
    total += e.size;
    if (total > ZIP_LIMITS.maxTotalBytes)
      throw new SaveContainerError('Conteúdo descomprimido grande demais');
  }
  for (const name of STREAM_NAMES) {
    if (!entries.some((e) => e.name === name))
      throw new SaveContainerError(`Contêiner inválido: stream "${name}" não encontrado`);
  }
  const wanted = new Set(entries.map((e) => e.name));
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(file, { filter: (f) => wanted.has(f.name) });
  } catch (e) {
    throw new SaveContainerError(`ZIP corrompido: ${(e as Error).message}`);
  }
  // O fflate não confere CRC32 e trunca silenciosamente conforme o tamanho declarado: conferimos aqui.
  for (const e of entries) {
    const data = files[e.name];
    if (!data || data.byteLength !== e.size)
      throw new SaveContainerError(`Entrada "${e.name}" com tamanho inconsistente`);
    if (crc32(data) !== e.crc)
      throw new SaveContainerError(`Entrada "${e.name}" com CRC inválido (arquivo corrompido)`);
  }
  const streams = {} as Streams;
  const extras: Record<string, Uint8Array> = {};
  for (const e of entries) {
    const data = files[e.name] as Uint8Array;
    if ((STREAM_NAMES as readonly string[]).includes(e.name)) streams[e.name as StreamName] = data;
    else extras[e.name] = data;
  }
  return { streams, extras, order: entries.map((e) => e.name) };
}

// Meio-dia de 15/06/2000: seguro em qualquer fuso (o ZIP guarda hora local e só aceita 1980–2099).
const FIXED_MTIME = new Date(Date.UTC(2000, 5, 15, 12));

export function writeContainer(c: Container): Uint8Array {
  const all: Record<string, Uint8Array> = { ...c.extras, ...c.streams };
  const names = [...c.order.filter((n) => n in all), ...Object.keys(all).filter((n) => !c.order.includes(n))];
  const z: Zippable = {};
  for (const n of names) z[n] = [all[n] as Uint8Array, { level: 6, mtime: FIXED_MTIME }];
  return zipSync(z);
}
