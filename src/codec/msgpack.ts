/**
 * MessagePack sem perdas para o formato de save do Invokyr (MessagePack-CSharp, contractless).
 *
 * Modelo de valores (JS puro, para a UI editar sem wrappers):
 *   nil → null | bool → boolean | str → string | bin → Uint8Array
 *   array → unknown[] | map (chaves string) → objeto de protótipo nulo
 *   inteiro → number se for seguro (|n| ≤ 2^53−1), senão bigint
 *   float → number
 *
 * Fidelidade numérica: o decoder anota o formato binário de TODO número, por caminho com curingas
 * (`save.upgrades.redUpgrades[*]`). Se um caminho tem um único formato, basta ele (`fmt`); se tem vários,
 * guarda a sequência em ordem de visita (`seq`), para que um `0` gravado como uint64 não contamine um fixint
 * vizinho. O encoder reaplica. Cabeçalhos de str/bin/array/map são sempre emitidos no tamanho mínimo, que é
 * o que o serializer do MessagePack-CSharp produz.
 */

export type NumFormat =
  | 'pfix'
  | 'nfix'
  | 'u8'
  | 'u16'
  | 'u32'
  | 'u64'
  | 'i8'
  | 'i16'
  | 'i32'
  | 'i64'
  | 'f32'
  | 'f64';

export interface PathHint {
  fmt: NumFormat;
  count: number;
  /** Presente só quando o caminho tem formatos divergentes: um formato por número, em ordem de visita. */
  seq?: NumFormat[];
}

export interface Hints {
  paths: Map<string, PathHint>;
}

export const emptyHints = (): Hints => ({ paths: new Map() });

/** Formato dominante de um caminho (ou `mixed` se divergente). */
export function hintFormat(hints: Hints, path: string): NumFormat | 'mixed' | undefined {
  const h = hints.paths.get(path);
  if (!h) return undefined;
  return h.seq ? 'mixed' : h.fmt;
}

export interface DecodeResult {
  value: unknown;
  hints: Hints;
}

export interface Limits {
  maxDepth: number;
  maxBytes: number;
  maxItems: number;
  maxKeyBytes: number;
  maxPathLength: number;
}

export const DEFAULT_LIMITS: Limits = {
  maxDepth: 64,
  maxBytes: 64 * 1024 * 1024,
  maxItems: 5_000_000,
  maxKeyBytes: 256,
  maxPathLength: 2048,
};

export class MsgpackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MsgpackError';
  }
}

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);
const td = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
const te = new TextEncoder();

const escapeKey = (k: string): string => k.replace(/[\\.[\]]/g, '\\$&');

function childPath(parent: string, key: string, max: number): string {
  const p = parent === '' ? escapeKey(key) : `${parent}.${escapeKey(key)}`;
  if (p.length > max) throw new MsgpackError('Caminho aninhado longo demais');
  return p;
}

function newMap(): Record<string, unknown> {
  return Object.create(null) as Record<string, unknown>;
}

export function decode(bytes: Uint8Array, limits: Limits = DEFAULT_LIMITS): DecodeResult {
  if (bytes.byteLength > limits.maxBytes) throw new MsgpackError('Payload MessagePack grande demais');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hints = emptyHints();
  let pos = 0;
  let items = 0;

  const need = (n: number) => {
    if (n < 0 || pos + n > bytes.byteLength) throw new MsgpackError('MessagePack truncado');
  };
  const note = (path: string, fmt: NumFormat) => {
    const h = hints.paths.get(path);
    if (!h) {
      hints.paths.set(path, { fmt, count: 1 });
      return;
    }
    if (h.seq) h.seq.push(fmt);
    else if (h.fmt !== fmt) {
      h.seq = new Array<NumFormat>(h.count).fill(h.fmt);
      h.seq.push(fmt);
    }
    h.count++;
  };
  const narrow = (v: bigint): number | bigint => (v >= MIN_SAFE && v <= MAX_SAFE ? Number(v) : v);
  const str = (n: number): string => {
    need(n);
    try {
      const s = td.decode(bytes.subarray(pos, pos + n));
      pos += n;
      return s;
    } catch {
      throw new MsgpackError('String UTF-8 inválida no MessagePack');
    }
  };
  const u8 = () => {
    need(1);
    return view.getUint8(pos++);
  };
  const u16 = () => {
    need(2);
    const v = view.getUint16(pos);
    pos += 2;
    return v;
  };
  const u32 = () => {
    need(4);
    const v = view.getUint32(pos);
    pos += 4;
    return v;
  };

  const readBin = (n: number): Uint8Array => {
    need(n);
    const out = bytes.slice(pos, pos + n);
    pos += n;
    return out;
  };
  const readArray = (n: number, path: string, depth: number): unknown[] => {
    if (n > limits.maxItems) throw new MsgpackError('Array grande demais');
    const out: unknown[] = [];
    const cp = `${path}[*]`;
    for (let i = 0; i < n; i++) out.push(readValue(cp, depth + 1));
    return out;
  };
  const readKey = (): string => {
    const kb = u8();
    let n: number;
    if (kb >= 0xa0 && kb <= 0xbf) n = kb & 0x1f;
    else if (kb === 0xd9) n = u8();
    else if (kb === 0xda) n = u16();
    else if (kb === 0xdb) n = u32();
    else throw new MsgpackError('Chave de mapa não-string não suportada (save contractless usa nomes)');
    if (n > limits.maxKeyBytes) throw new MsgpackError('Chave de mapa longa demais');
    return str(n);
  };
  const readMap = (n: number, path: string, depth: number): Record<string, unknown> => {
    if (n > limits.maxItems) throw new MsgpackError('Mapa grande demais');
    const out = newMap();
    for (let i = 0; i < n; i++) {
      if (++items > limits.maxItems) throw new MsgpackError('MessagePack com itens demais');
      const key = readKey();
      if (/^(0|[1-9]\d*)$/.test(key)) {
        throw new MsgpackError(`Chave numérica "${key}" quebraria a ordem de campos; formato inesperado`);
      }
      if (key in out) throw new MsgpackError(`Chave duplicada: ${key}`);
      out[key] = readValue(childPath(path, key, limits.maxPathLength), depth + 1);
    }
    return out;
  };

  const readValue = (path: string, depth: number): unknown => {
    if (depth > limits.maxDepth) throw new MsgpackError('MessagePack aninhado demais');
    if (++items > limits.maxItems) throw new MsgpackError('MessagePack com itens demais');
    const b = u8();
    if (b <= 0x7f) {
      note(path, 'pfix');
      return b;
    }
    if (b >= 0xe0) {
      note(path, 'nfix');
      return b - 0x100;
    }
    if (b >= 0xa0 && b <= 0xbf) return str(b & 0x1f);
    if (b >= 0x90 && b <= 0x9f) return readArray(b & 0x0f, path, depth);
    if (b >= 0x80 && b <= 0x8f) return readMap(b & 0x0f, path, depth);
    switch (b) {
      case 0xc0:
        return null;
      case 0xc2:
        return false;
      case 0xc3:
        return true;
      case 0xc4:
        return readBin(u8());
      case 0xc5:
        return readBin(u16());
      case 0xc6:
        return readBin(u32());
      case 0xca: {
        need(4);
        const v = view.getFloat32(pos);
        pos += 4;
        note(path, 'f32');
        return v;
      }
      case 0xcb: {
        need(8);
        const v = view.getFloat64(pos);
        pos += 8;
        note(path, 'f64');
        return v;
      }
      case 0xcc:
        note(path, 'u8');
        return u8();
      case 0xcd:
        note(path, 'u16');
        return u16();
      case 0xce:
        note(path, 'u32');
        return u32();
      case 0xcf: {
        need(8);
        const v = view.getBigUint64(pos);
        pos += 8;
        note(path, 'u64');
        return narrow(v);
      }
      case 0xd0:
        need(1);
        note(path, 'i8');
        return view.getInt8(pos++);
      case 0xd1: {
        need(2);
        const v = view.getInt16(pos);
        pos += 2;
        note(path, 'i16');
        return v;
      }
      case 0xd2: {
        need(4);
        const v = view.getInt32(pos);
        pos += 4;
        note(path, 'i32');
        return v;
      }
      case 0xd3: {
        need(8);
        const v = view.getBigInt64(pos);
        pos += 8;
        note(path, 'i64');
        return narrow(v);
      }
      case 0xd9:
        return str(u8());
      case 0xda:
        return str(u16());
      case 0xdb:
        return str(u32());
      case 0xdc:
        return readArray(u16(), path, depth);
      case 0xdd:
        return readArray(u32(), path, depth);
      case 0xde:
        return readMap(u16(), path, depth);
      case 0xdf:
        return readMap(u32(), path, depth);
      default:
        throw new MsgpackError(`Tipo MessagePack não suportado: 0x${b.toString(16)}`);
    }
  };

  const value = readValue('', 0);
  if (pos !== bytes.byteLength) throw new MsgpackError('Bytes sobrando após o valor MessagePack');
  return { value, hints };
}

class Writer {
  private buf = new Uint8Array(1024);
  private view = new DataView(this.buf.buffer);
  len = 0;

  private grow(n: number) {
    if (this.len + n <= this.buf.byteLength) return;
    let size = this.buf.byteLength;
    while (size < this.len + n) size *= 2;
    const next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
    this.view = new DataView(next.buffer);
  }
  u8(v: number) {
    this.grow(1);
    this.buf[this.len++] = v & 0xff;
  }
  tag8(tag: number, v: number) {
    this.u8(tag);
    this.u8(v);
  }
  tag16(tag: number, v: number) {
    this.grow(3);
    this.buf[this.len++] = tag;
    this.view.setUint16(this.len, v & 0xffff);
    this.len += 2;
  }
  tag32(tag: number, v: number) {
    this.grow(5);
    this.buf[this.len++] = tag;
    this.view.setUint32(this.len, v >>> 0);
    this.len += 4;
  }
  tag64(tag: number, v: bigint, signed: boolean) {
    this.grow(9);
    this.buf[this.len++] = tag;
    if (signed) this.view.setBigInt64(this.len, v);
    else this.view.setBigUint64(this.len, v);
    this.len += 8;
  }
  float(fmt: 'f32' | 'f64', v: number) {
    if (fmt === 'f32') {
      this.grow(5);
      this.buf[this.len++] = 0xca;
      this.view.setFloat32(this.len, v);
      this.len += 4;
    } else {
      this.grow(9);
      this.buf[this.len++] = 0xcb;
      this.view.setFloat64(this.len, v);
      this.len += 8;
    }
  }
  bytes(b: Uint8Array) {
    this.grow(b.byteLength);
    this.buf.set(b, this.len);
    this.len += b.byteLength;
  }
  out(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

/** Ao editar, se o valor não cabe mais no formato original, tenta os mais largos da mesma família. */
const WIDEN: Partial<Record<NumFormat, NumFormat[]>> = {
  i8: ['i16', 'i32', 'i64'],
  i16: ['i32', 'i64'],
  i32: ['i64'],
  u8: ['u16', 'u32', 'u64'],
  u16: ['u32', 'u64'],
  u32: ['u64'],
};

/** Formato que o serializer do jogo escreveria para um valor novo, dado o tipo C# (largura fixa acima do fixint). */
export function formatForType(type: CsType, v: bigint): NumFormat | undefined {
  if (type === 'float' || type === 'double') return undefined;
  if (v >= 0n && v <= 0x7fn) return 'pfix';
  if (v < 0n && v >= -32n) return 'nfix';
  if (type === 'ulong') return 'u64';
  if (type === 'long') return 'i64';
  if (type === 'uint') return v <= 0xffffn ? 'u16' : v <= 0xffffffffn ? 'u32' : 'u64';
  if (v >= -32768n && v <= 32767n) return 'i16';
  if (v >= -(1n << 31n) && v < 1n << 31n) return 'i32';
  return 'i64';
}

const I64_MIN = -(1n << 63n);
const I64_MAX = (1n << 63n) - 1n;
const U64_MAX = (1n << 64n) - 1n;

function fits(big: bigint, fmt: NumFormat): boolean {
  switch (fmt) {
    case 'pfix':
      return big >= 0n && big <= 0x7fn;
    case 'nfix':
      return big >= -32n && big <= -1n;
    case 'u8':
      return big >= 0n && big <= 0xffn;
    case 'u16':
      return big >= 0n && big <= 0xffffn;
    case 'u32':
      return big >= 0n && big <= 0xffffffffn;
    case 'u64':
      return big >= 0n && big <= U64_MAX;
    case 'i8':
      return big >= -128n && big <= 127n;
    case 'i16':
      return big >= -32768n && big <= 32767n;
    case 'i32':
      return big >= -(1n << 31n) && big < 1n << 31n;
    case 'i64':
      return big >= I64_MIN && big <= I64_MAX;
    default:
      return false;
  }
}

/** Escreve o inteiro no formato pedido; se o valor não couber nele, cai no formato mínimo. */
function writeInt(w: Writer, big: bigint, fmt: NumFormat | undefined, path: string, type?: CsType) {
  if (fmt && !fits(big, fmt)) {
    fmt = WIDEN[fmt]?.find((f) => fits(big, f)) ?? (type ? formatForType(type, big) : undefined);
  } else if (!fmt && type) {
    fmt = formatForType(type, big);
  }
  switch (fmt) {
    case 'pfix':
      if (big >= 0n && big <= 0x7fn) return w.u8(Number(big));
      break;
    case 'nfix':
      if (big >= -32n && big <= -1n) return w.u8(Number(big));
      break;
    case 'u8':
      if (big >= 0n && big <= 0xffn) return w.tag8(0xcc, Number(big));
      break;
    case 'u16':
      if (big >= 0n && big <= 0xffffn) return w.tag16(0xcd, Number(big));
      break;
    case 'u32':
      if (big >= 0n && big <= 0xffffffffn) return w.tag32(0xce, Number(big));
      break;
    case 'u64':
      if (big >= 0n && big <= U64_MAX) return w.tag64(0xcf, big, false);
      break;
    case 'i8':
      if (big >= -128n && big <= 127n) return w.tag8(0xd0, Number(big));
      break;
    case 'i16':
      if (big >= -32768n && big <= 32767n) return w.tag16(0xd1, Number(big));
      break;
    case 'i32':
      if (big >= -(1n << 31n) && big < 1n << 31n) return w.tag32(0xd2, Number(big));
      break;
    case 'i64':
      if (big >= I64_MIN && big <= I64_MAX) return w.tag64(0xd3, big, true);
      break;
    default:
      break;
  }
  if (big >= 0n) {
    if (big <= 0x7fn) return w.u8(Number(big));
    if (big <= 0xffn) return w.tag8(0xcc, Number(big));
    if (big <= 0xffffn) return w.tag16(0xcd, Number(big));
    if (big <= 0xffffffffn) return w.tag32(0xce, Number(big));
    if (big <= U64_MAX) return w.tag64(0xcf, big, false);
  } else {
    if (big >= -32n) return w.u8(Number(big));
    if (big >= -128n) return w.tag8(0xd0, Number(big));
    if (big >= -32768n) return w.tag16(0xd1, Number(big));
    if (big >= -(1n << 31n)) return w.tag32(0xd2, Number(big));
    if (big >= I64_MIN) return w.tag64(0xd3, big, true);
  }
  throw new MsgpackError(`Inteiro fora da faixa de 64 bits em ${path || '<raiz>'}`);
}

/** Tipo C# do campo, usado para escolher a largura de inteiros que o jogo (GameDevWare) escreveria. */
export type CsType = 'int' | 'uint' | 'long' | 'ulong' | 'float' | 'double';

export interface EncodeOptions {
  /** Tipo C# por caminho com curingas; usado quando não há dica do arquivo original (campo novo/elemento novo). */
  typeOf?: (path: string) => CsType | undefined;
  /** Formato assumido para números fracionários sem dica. O jogo usa `System.Single`. */
  defaultFloat?: 'f32' | 'f64';
  maxDepth?: number;
}

export function encode(value: unknown, hints: Hints, options: EncodeOptions = {}): Uint8Array {
  const defaultFloat = options.defaultFloat ?? 'f32';
  const maxDepth = options.maxDepth ?? DEFAULT_LIMITS.maxDepth;
  const w = new Writer();
  const cursors = new Map<string, number>();

  const hintFor = (path: string): NumFormat | undefined => {
    const h = hints.paths.get(path);
    if (!h) return undefined;
    if (!h.seq) return h.fmt;
    const i = cursors.get(path) ?? 0;
    cursors.set(path, i + 1);
    return h.seq[i]; // além do fim (elementos acrescentados): sem dica → mínimo
  };

  const writeLen = (n: number, fix: number, c16: number, c32: number) => {
    if (n <= 15) w.u8(fix | n);
    else if (n <= 0xffff) w.tag16(c16, n);
    else w.tag32(c32, n);
  };
  const writeHeader = (
    n: number,
    fix: number,
    c8: number | null,
    c16: number,
    c32: number,
    fixMax: number,
  ) => {
    if (n <= fixMax) w.u8(fix | n);
    else if (c8 !== null && n <= 0xff) w.tag8(c8, n);
    else if (n <= 0xffff) w.tag16(c16, n);
    else w.tag32(c32, n);
  };

  const write = (v: unknown, path: string, depth: number) => {
    if (depth > maxDepth) throw new MsgpackError('Valor aninhado demais para serializar');
    if (v === null || v === undefined) return w.u8(0xc0);
    if (typeof v === 'boolean') return w.u8(v ? 0xc3 : 0xc2);
    if (typeof v === 'bigint') return writeInt(w, v, hintFor(path), path, options.typeOf?.(path));
    if (typeof v === 'number') {
      const hint = hintFor(path);
      if (hint === 'f32' || hint === 'f64') return w.float(hint, v); // inclui NaN/Inf/-0 já existentes
      if (!Number.isFinite(v)) throw new MsgpackError(`Número não finito em ${path || '<raiz>'}`);
      const type = options.typeOf?.(path);
      if (!hint && (type === 'float' || type === 'double'))
        return w.float(type === 'float' ? 'f32' : 'f64', v);
      if (!Number.isInteger(v)) return w.float(defaultFloat, v);
      if (!Number.isSafeInteger(v))
        throw new MsgpackError(`Inteiro além de 2^53 deve ser bigint em ${path || '<raiz>'}`);
      return writeInt(w, BigInt(v), hint, path, type);
    }
    if (typeof v === 'string') {
      const b = te.encode(v);
      writeHeader(b.byteLength, 0xa0, 0xd9, 0xda, 0xdb, 31);
      return w.bytes(b);
    }
    if (v instanceof Uint8Array) {
      writeHeader(v.byteLength, 0, 0xc4, 0xc5, 0xc6, -1);
      return w.bytes(v);
    }
    if (Array.isArray(v)) {
      writeLen(v.length, 0x90, 0xdc, 0xdd);
      const cp = `${path}[*]`;
      for (const item of v) write(item, cp, depth + 1);
      return;
    }
    if (typeof v === 'object') {
      const proto = Object.getPrototypeOf(v);
      if (proto !== null && proto !== Object.prototype) {
        throw new MsgpackError(
          `Tipo não serializável em ${path || '<raiz>'}: ${Object.prototype.toString.call(v)}`,
        );
      }
      const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
      writeLen(entries.length, 0x80, 0xde, 0xdf);
      for (const [k, x] of entries) {
        write(k, '', depth + 1);
        write(x, childPath(path, k, DEFAULT_LIMITS.maxPathLength), depth + 1);
      }
      return;
    }
    throw new MsgpackError(`Tipo não serializável em ${path || '<raiz>'}: ${typeof v}`);
  };

  write(value, '', 0);
  return w.out();
}
