import type { SaveValues } from '../schema/types';
import { useEditor } from '../state/store';

/** Valores do save aberto (as telas só são renderizadas com um save aberto). */
export function useValues(): SaveValues {
  const v = useEditor((s) => s.values);
  if (!v) throw new Error('Nenhum save aberto');
  return v as unknown as SaveValues;
}

/** Executa uma ação de edição (src/state/actions.ts) dentro de um passo de undo/redo. */
export function useEdit(): (fn: (d: SaveValues) => void) => void {
  const edit = useEditor((s) => s.edit);
  return (fn) => edit((d) => fn(d as unknown as SaveValues));
}
