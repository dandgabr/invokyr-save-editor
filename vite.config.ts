/// <reference types="vitest/config" />

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// CSP estrita só no build: o app nunca faz requisições de rede (o save não sai da máquina).
const CSP =
  "default-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
const cspPlugin = {
  name: 'invokyr-csp',
  apply: 'build' as const,
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
      injectTo: 'head-prepend' as const,
    },
  ],
};

// Base do GitHub Pages: https://dandgabr.github.io/invokyr-save-editor/
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/invokyr-save-editor/' : '/',
  plugins: [react(), cspPlugin],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
