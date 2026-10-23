import { decode, encode, type Hints } from '../codec/msgpack';
import { type Container, readContainer, STREAM_NAMES, type StreamName, writeContainer } from '../codec/zip';

/** Documento aberto: os três streams decodificados + dicas de formato para regravar sem perdas. */
export interface SaveDoc {
  fileName: string;
  values: Record<StreamName, unknown>;
  hints: Record<StreamName, Hints>;
  /** Contêiner original (extras e ordem preservados ao salvar). */
  container: Container;
  /** Bytes originais do arquivo, base do backup antes de gravar. */
  raw: Uint8Array;
}

export function openSave(fileName: string, bytes: Uint8Array): SaveDoc {
  const container = readContainer(bytes);
  const values = {} as Record<StreamName, unknown>;
  const hints = {} as Record<StreamName, Hints>;
  for (const name of STREAM_NAMES) {
    const d = decode(container.streams[name]);
    values[name] = d.value;
    hints[name] = d.hints;
  }
  return { fileName, values, hints, container, raw: bytes };
}

export function serializeSave(doc: SaveDoc, values: Record<StreamName, unknown> = doc.values): Uint8Array {
  const streams = {} as Container['streams'];
  for (const name of STREAM_NAMES) streams[name] = encode(values[name], doc.hints[name]);
  return writeContainer({ ...doc.container, streams });
}

export interface Change {
  /** Caminho legível, ex.: `save.bank.currentTotalScore`. */
  path: string;
  before: unknown;
  after: unknown;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array);

/** Diferenças folha a folha entre dois valores (limitado, para exibir na confirmação de salvar). */
export function diffValues(a: unknown, b: unknown, path = '', out: Change[] = [], max = 500): Change[] {
  if (out.length >= max) return out;
  if (Object.is(a, b)) return out;
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) diffValues(a[i], b[i], `${path}[${i}]`, out, max);
    return out;
  }
  if (isObj(a) && isObj(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      diffValues(a[k], b[k], path === '' ? k : `${path}.${k}`, out, max);
    }
    return out;
  }
  if (
    a instanceof Uint8Array &&
    b instanceof Uint8Array &&
    a.length === b.length &&
    a.every((x, i) => x === b[i])
  )
    return out;
  out.push({ path, before: a, after: b });
  return out;
}

export function diffDocs(
  original: Record<StreamName, unknown>,
  current: Record<StreamName, unknown>,
): Change[] {
  const out: Change[] = [];
  for (const name of STREAM_NAMES) diffValues(original[name], current[name], name, out);
  return out;
}
