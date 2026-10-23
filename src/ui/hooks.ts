import type { SaveValues } from '../schema/types';
import { useEditor } from '../state/store';

/** Valores do save aberto (as telas só são renderizadas com um save aberto). */
export function useValues(): SaveValues {
  const v = useEditor((s) => s.values);
  if (!v) throw new Error('Nenhum save aberto');
  return v as unknown as SaveValues;
}

/** Executa uma ação de edição (src/state/actions.ts) dentro de um passo de undo/redo. Retorna `true` se mudou algo. */
export function useEdit(): (fn: (d: SaveValues) => void, coalesceKey?: string) => boolean {
  const edit = useEditor((s) => s.edit);
  return (fn, coalesceKey) => edit((d) => fn(d as unknown as SaveValues), coalesceKey);
}
