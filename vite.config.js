import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// CSP solo en el build: el dev server de Vite necesita scripts inline y websocket
const csp = {
  name: 'emissary-csp',
  apply: 'build',
  transformIndexHtml: () => [{
    tag: 'meta',
    attrs: {
      'http-equiv': 'Content-Security-Policy',
      content: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'",
    },
    injectTo: 'head-prepend',
  }],
};

export default defineConfig({
  plugins: [react(), csp],
  base: './',
  root: path.resolve(__dirname, 'src/renderer'),
  build: {
    outDir: '../../ui-build',
    emptyOutDir: true,
  },
});
