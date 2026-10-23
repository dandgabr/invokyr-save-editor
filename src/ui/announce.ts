import { create } from 'zustand';

/** Mensagem para a região `role=status` global (leitores de tela). `n` força novo anúncio da mesma frase. */
export const useAnnounce = create<{ message: string; n: number; say: (m: string) => void }>((set, get) => ({
  message: '',
  n: 0,
  say: (message) => set({ message, n: get().n + 1 }),
}));
