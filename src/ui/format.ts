export function formatValue(v: unknown): string {
  if (v === undefined) return '—';
  if (v === null) return 'null';
  if (typeof v === 'bigint') return `${v}n`;
  if (typeof v === 'string') return JSON.stringify(v);
  if (v instanceof Uint8Array) return `bin(${v.length} bytes)`;
  if (Array.isArray(v)) return `[${v.length} itens]`;
  if (typeof v === 'object') return '{…}';
  return String(v);
}
