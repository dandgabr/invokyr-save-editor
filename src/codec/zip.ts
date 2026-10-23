import { type Unzipped, unzipSync, zipSync } from 'fflate';

/** Streams obrigatórios do contêiner `.sav` (ZIP/DEFLATE, nomes sem extensão e case-sensitive). */
export const STREAM_NAMES = ['meta', 'save', 'collection'] as const;
export type StreamName = (typeof STREAM_NAMES)[number];
export type Streams = Record<StreamName, Uint8Array>;

export class SaveContainerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveContainerError';
  }
}

export const ZIP_LIMITS = {
  maxFileBytes: 128 * 1024 * 1024,
  maxEntryBytes: 64 * 1024 * 1024,
  maxEntries: 16,
};

export function readContainer(file: Uint8Array): Streams {
  if (file.byteLength > ZIP_LIMITS.maxFileBytes)
    throw new SaveContainerError('Arquivo grande demais para ser um save');
  // Assinatura local de ZIP (PK\x03\x04); evita tentar descomprimir lixo.
  if (!(file[0] === 0x50 && file[1] === 0x4b))
    throw new SaveContainerError('O arquivo não é um ZIP válido (.sav)');
  let total = 0;
  let entries = 0;
  let files: Unzipped;
  try {
    files = unzipSync(file, {
      filter: (f) => {
        if (++entries > ZIP_LIMITS.maxEntries) throw new SaveContainerError('ZIP com entradas demais');
        if (f.originalSize > ZIP_LIMITS.maxEntryBytes)
          throw new SaveContainerError(`Entrada "${f.name}" grande demais`);
        total += f.originalSize;
        if (total > ZIP_LIMITS.maxEntryBytes * 2)
          throw new SaveContainerError('Conteúdo descomprimido grande demais');
        return (STREAM_NAMES as readonly string[]).includes(f.name);
      },
    });
  } catch (e) {
    if (e instanceof SaveContainerError) throw e;
    throw new SaveContainerError(`ZIP corrompido: ${(e as Error).message}`);
  }
  const out = {} as Streams;
  for (const name of STREAM_NAMES) {
    const data = files[name];
    if (!data) throw new SaveContainerError(`Contêiner inválido: stream "${name}" não encontrado`);
    out[name] = data;
  }
  return out;
}

export function writeContainer(streams: Streams): Uint8Array {
  return zipSync(
    {
      meta: streams.meta,
      save: streams.save,
      collection: streams.collection,
    },
    { level: 6 },
  );
}
