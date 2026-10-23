/**
 * MessagePack sem perdas para o formato de save do Invokyr (MessagePack-CSharp, contractless).
 *
 * Modelo de valores (JS puro, para a UI editar sem wrappers):
 *   nil → null | bool → boolean | str → string | bin → Uint8Array
 *   array → unknown[] | map (chaves string) → objeto de protótipo nulo
 *   inteiro → number se for seguro (|n| ≤ 2^53−1), senão bigint
 *   float → number
 *
 * Fidelidade: o decoder registra, por caminho com curingas (`save.upgrades.redUpgrades[*]`), o formato
 * binário original dos números que não são o mínimo (float32/float64, int64, uint64, larguras fixas).
 * O encoder reaplica esse formato. Assim o jogo continua recebendo `Single` onde esperava `Single`.
 */

export type NumFormat = 'f32' | 'f64' | 'u8' | 'u16' | 'u32' | 'u64' | 'i8' | 'i16' | 'i32' | 'i64';

export interface Hints {
  /** caminho com curingas → formato observado. `mixed` = formatos divergentes no mesmo caminho. */
  formats: Map<string, NumFormat | 'mixed'>;
  /** Tipos de mapa/array vazio, strings em bin etc. não precisam de dica. */
}

export interface DecodeResult {
  value: unknown;
  hints: Hints;
}

export interface Limits {
  maxDepth: number;
  maxBytes: number;
  maxItems: number;
}

export const DEFAULT_LIMITS: Limits = { maxDepth: 64, maxBytes: 64 * 1024 * 1024, maxItems: 5_000_000 };

export class MsgpackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MsgpackError';
  }
}

const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);
const td = new TextDecoder('utf-8', { fatal: true });
const te = new TextEncoder();

function joinPath(parent: string, key: string): string {
  return parent === '' ? key : `${parent}.${key}`;
}

/** Cria objeto sem protótipo para evitar poluição (`__proto__`) vinda de saves não confiáveis. */
function newMap(): Record<string, unknown> {
  return Object.create(null) as Record<string, unknown>;
}

export function decode(bytes: Uint8Array, limits: Limits = DEFAULT_LIMITS): DecodeResult {
  if (bytes.byteLength > limits.maxBytes) throw new MsgpackError('Payload MessagePack grande demais');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const formats = new Map<string, NumFormat | 'mixed'>();
  let pos = 0;
  let items = 0;

  const need = (n: number) => {
    if (pos + n > bytes.byteLength) throw new MsgpackError('MessagePack truncado');
  };
  const note = (path: string, fmt: NumFormat) => {
    const prev = formats.get(path);
    if (prev === undefined) formats.set(path, fmt);
    else if (prev !== fmt) formats.set(path, 'mixed');
  };
  const num = (
    path: string,
    fmt: NumFormat,
    v: bigint | number,
    minimal: NumFormat | null,
  ): number | bigint => {
    // Só registra quando o formato difere do mínimo que o encoder escolheria sozinho.
    if (fmt !== minimal) note(path, fmt);
    if (typeof v === 'bigint') return v >= MIN_SAFE && v <= MAX_SAFE ? Number(v) : v;
    return v;
  };
  const str = (n: number): string => {
    need(n);
    const s = td.decode(bytes.subarray(pos, pos + n));
    pos += n;
    return s;
  };

  const readValue = (path: string, depth: number): unknown => {
    if (depth > limits.maxDepth) throw new MsgpackError('MessagePack aninhado demais');
    if (++items > limits.maxItems) throw new MsgpackError('MessagePack com itens demais');
    need(1);
    const b = bytes[pos++] as number;
    if (b <= 0x7f) return num(path, 'u8', b, 'u8') as number; // positive fixint: mínimo
    if (b >= 0xe0) return num(path, 'i8', b - 0x100, 'i8') as number; // negative fixint: mínimo
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
      case 0xc4: {
        need(1);
        const n = view.getUint8(pos++);
        return readBin(n);
      }
      case 0xc5: {
        need(2);
        const n = view.getUint16(pos);
        pos += 2;
        return readBin(n);
      }
      case 0xc6: {
        need(4);
        const n = view.getUint32(pos);
        pos += 4;
        return readBin(n);
      }
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
      case 0xcc: {
        need(1);
        return num(path, 'u8', view.getUint8(pos++), 'u8') as number;
      }
      case 0xcd: {
        need(2);
        const v = view.getUint16(pos);
        pos += 2;
        return num(path, 'u16', v, v > 0xff ? 'u16' : 'u8') as number;
      }
      case 0xce: {
        need(4);
        const v = view.getUint32(pos);
        pos += 4;
        return num(path, 'u32', v, v > 0xffff ? 'u32' : v > 0xff ? 'u16' : 'u8') as number;
      }
      case 0xcf: {
        need(8);
        const v = view.getBigUint64(pos);
        pos += 8;
        const min: NumFormat = v > 0xffffffffn ? 'u64' : v > 0xffffn ? 'u32' : v > 0xffn ? 'u16' : 'u8';
        return num(path, 'u64', v, min);
      }
      case 0xd0: {
        need(1);
        const v = view.getInt8(pos++);
        return num(path, 'i8', v, v >= -32 ? null : 'i8') as number;
      }
      case 0xd1: {
        need(2);
        const v = view.getInt16(pos);
        pos += 2;
        return num(path, 'i16', v, v >= -128 ? null : 'i16') as number;
      }
      case 0xd2: {
        need(4);
        const v = view.getInt32(pos);
        pos += 4;
        return num(path, 'i32', v, v >= -32768 ? null : 'i32') as number;
      }
      case 0xd3: {
        need(8);
        const v = view.getBigInt64(pos);
        pos += 8;
        return num(path, 'i64', v, v >= -2147483648n ? null : 'i64');
      }
      case 0xd9: {
        need(1);
        return str(view.getUint8(pos++));
      }
      case 0xda: {
        need(2);
        const n = view.getUint16(pos);
        pos += 2;
        return str(n);
      }
      case 0xdb: {
        need(4);
        const n = view.getUint32(pos);
        pos += 4;
        return str(n);
      }
      case 0xdc: {
        need(2);
        const n = view.getUint16(pos);
        pos += 2;
        return readArray(n, path, depth);
      }
      case 0xdd: {
        need(4);
        const n = view.getUint32(pos);
        pos += 4;
        return readArray(n, path, depth);
      }
      case 0xde: {
        need(2);
        const n = view.getUint16(pos);
        pos += 2;
        return readMap(n, path, depth);
      }
      case 0xdf: {
        need(4);
        const n = view.getUint32(pos);
        pos += 4;
        return readMap(n, path, depth);
      }
      default:
        throw new MsgpackError(`Tipo MessagePack não suportado: 0x${b.toString(16)}`);
    }
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
    const childPath = `${path}[*]`;
    for (let i = 0; i < n; i++) out.push(readValue(childPath, depth + 1));
    return out;
  };
  const readMap = (n: number, path: string, depth: number): Record<string, unknown> => {
    if (n > limits.maxItems) throw new MsgpackError('Mapa grande demais');
    const out = newMap();
    for (let i = 0; i < n; i++) {
      need(1);
      const kb = bytes[pos] as number;
      if (!((kb >= 0xa0 && kb <= 0xbf) || kb === 0xd9 || kb === 0xda || kb === 0xdb)) {
        throw new MsgpackError('Chave de mapa não-string não suportada (save contractless usa nomes)');
      }
      const key = readValue('', depth + 1) as string;
      if (/^(0|[1-9]\d*)$/.test(key)) {
        throw new MsgpackError(`Chave numérica "${key}" quebraria a ordem de campos; formato inesperado`);
      }
      if (key in out) throw new MsgpackError(`Chave duplicada: ${key}`);
      out[key] = readValue(joinPath(path, key), depth + 1);
    }
    return out;
  };

  const value = readValue('', 0);
  if (pos !== bytes.byteLength) throw new MsgpackError('Bytes sobrando após o valor MessagePack');
  return { value, hints: { formats } };
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
    this.buf[this.len++] = v;
  }
  u16(v: number) {
    this.grow(2);
    this.view.setUint16(this.len, v);
    this.len += 2;
  }
  u32(v: number) {
    this.grow(4);
    this.view.setUint32(this.len, v);
    this.len += 4;
  }
  f32(v: number) {
    this.grow(4);
    this.view.setFloat32(this.len, v);
    this.len += 4;
  }
  f64(v: number) {
    this.grow(8);
    this.view.setFloat64(this.len, v);
    this.len += 8;
  }
  tag8(tag: number, v: number) {
    this.u8(tag);
    this.u8(v);
  }
  tag16(tag: number, v: number) {
    this.u8(tag);
    this.u16(v);
  }
  tag32(tag: number, v: number) {
    this.u8(tag);
    this.u32(v);
  }
  float(fmt: 'f32' | 'f64', v: number) {
    if (fmt === 'f32') {
      this.u8(0xca);
      this.f32(v);
    } else {
      this.u8(0xcb);
      this.f64(v);
    }
  }
  u64(v: bigint) {
    this.grow(8);
    this.view.setBigUint64(this.len, v);
    this.len += 8;
  }
  i64(v: bigint) {
    this.grow(8);
    this.view.setBigInt64(this.len, v);
    this.len += 8;
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

function writeInt(w: Writer, v: number | bigint, fmt: NumFormat | undefined, path: string) {
  const big = BigInt(v);
  const inRange = (lo: bigint, hi: bigint) => big >= lo && big <= hi;
  const f = fmt && fmt !== 'f32' && fmt !== 'f64' ? fmt : undefined;
  switch (f) {
    case 'u64':
      if (big >= 0n && big <= 0xffffffffffffffffn) {
        w.u8(0xcf);
        w.u64(big);
        return;
      }
      break;
    case 'i64':
      if (inRange(-(1n << 63n), (1n << 63n) - 1n)) {
        w.u8(0xd3);
        w.i64(big);
        return;
      }
      break;
    case 'u32':
      if (inRange(0n, 0xffffffffn)) {
        w.u8(0xce);
        w.u32(Number(big));
        return;
      }
      break;
    case 'u16':
      if (inRange(0n, 0xffffn)) {
        w.u8(0xcd);
        w.u16(Number(big));
        return;
      }
      break;
    case 'i32':
      if (inRange(-(1n << 31n), (1n << 31n) - 1n)) {
        w.u8(0xd2);
        w.u32(Number(big) >>> 0);
        return;
      }
      break;
    case 'i16':
      if (inRange(-32768n, 32767n)) {
        w.u8(0xd1);
        w.u16(Number(big) & 0xffff);
        return;
      }
      break;
    case 'i8':
      if (inRange(-128n, -33n)) {
        w.u8(0xd0);
        w.u8(Number(big) & 0xff);
        return;
      }
      break;
    default:
      break;
  }
  // Formato mínimo (ou a dica não cabe mais no valor editado).
  if (big >= 0n) {
    if (big <= 0x7fn) return w.u8(Number(big));
    if (big <= 0xffn) {
      w.u8(0xcc);
      w.u8(Number(big));
      return;
    }
    if (big <= 0xffffn) {
      w.u8(0xcd);
      w.u16(Number(big));
      return;
    }
    if (big <= 0xffffffffn) {
      w.u8(0xce);
      w.u32(Number(big));
      return;
    }
    if (big <= 0xffffffffffffffffn) {
      w.u8(0xcf);
      w.u64(big);
      return;
    }
  } else {
    if (big >= -32n) return w.u8(Number(big) & 0xff);
    if (big >= -128n) {
      w.u8(0xd0);
      w.u8(Number(big) & 0xff);
      return;
    }
    if (big >= -32768n) {
      w.u8(0xd1);
      w.u16(Number(big) & 0xffff);
      return;
    }
    if (big >= -(1n << 31n)) {
      w.u8(0xd2);
      w.u32(Number(big) >>> 0);
      return;
    }
    if (big >= -(1n << 63n)) {
      w.u8(0xd3);
      w.i64(big);
      return;
    }
  }
  throw new MsgpackError(`Inteiro fora da faixa de 64 bits em ${path || '<raiz>'}`);
}

export interface EncodeOptions {
  /** Formato assumido para números fracionários sem dica. O jogo usa `System.Single`. */
  defaultFloat?: 'f32' | 'f64';
}

export function encode(value: unknown, hints: Hints, options: EncodeOptions = {}): Uint8Array {
  const defaultFloat = options.defaultFloat ?? 'f32';
  const w = new Writer();

  const writeLen = (n: number, fix: number, fixMax: number, c16: number, c32: number) => {
    if (n <= fixMax) w.u8(fix | n);
    else if (n <= 0xffff) w.tag16(c16, n);
    else w.tag32(c32, n);
  };

  const write = (v: unknown, path: string) => {
    if (v === null || v === undefined) return w.u8(0xc0);
    if (typeof v === 'boolean') return w.u8(v ? 0xc3 : 0xc2);
    if (typeof v === 'bigint') {
      const h = hints.formats.get(path);
      return writeInt(w, v, h === 'mixed' ? undefined : h, path);
    }
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) throw new MsgpackError(`Número não finito em ${path || '<raiz>'}`);
      const h = hints.formats.get(path);
      const hint = h === 'mixed' ? undefined : h;
      if (hint === 'f32' || hint === 'f64') return w.float(hint, v);
      if (!Number.isInteger(v)) return w.float(defaultFloat, v);
      return writeInt(w, v, hint, path);
    }
    if (typeof v === 'string') {
      const b = te.encode(v);
      if (b.byteLength <= 31) w.u8(0xa0 | b.byteLength);
      else if (b.byteLength <= 0xff) w.tag8(0xd9, b.byteLength);
      else if (b.byteLength <= 0xffff) w.tag16(0xda, b.byteLength);
      else w.tag32(0xdb, b.byteLength);
      return w.bytes(b);
    }
    if (v instanceof Uint8Array) {
      if (v.byteLength <= 0xff) w.tag8(0xc4, v.byteLength);
      else if (v.byteLength <= 0xffff) w.tag16(0xc5, v.byteLength);
      else w.tag32(0xc6, v.byteLength);
      return w.bytes(v);
    }
    if (Array.isArray(v)) {
      writeLen(v.length, 0x90, 15, 0xdc, 0xdd);
      for (const item of v) write(item, `${path}[*]`);
      return;
    }
    if (typeof v === 'object') {
      const entries = Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined);
      writeLen(entries.length, 0x80, 15, 0xde, 0xdf);
      for (const [k, x] of entries) {
        write(k, '');
        write(x, joinPath(path, k));
      }
      return;
    }
    throw new MsgpackError(`Tipo não serializável em ${path || '<raiz>'}: ${typeof v}`);
  };

  write(value, '');
  return w.out();
}
