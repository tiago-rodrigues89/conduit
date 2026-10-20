import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The CSP is only added to production builds; the dev server needs inline
// scripts for React fast refresh.
const csp = {
  name: 'conduit-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace(
      '<!--csp-->',
      `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: conduit-media:; connect-src 'self'">`
    );
  },
};

export default defineConfig({
  root: 'src',
  base: './',
  plugins: [react(), csp],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'chrome140',
    chunkSizeWarningLimit: 2000,
  },
  server: { host: '127.0.0.1' },
});
