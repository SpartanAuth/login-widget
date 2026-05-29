import { resolve } from 'path';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig(({ mode }) => ({
  plugins: [
    solidPlugin({
      // Disable the HMR virtual module (/@solid-refresh) in test/build modes.
      // In test mode there is no Vite dev server to serve that virtual module,
      // so importing it would throw.  The `hot` option is supported in
      // vite-plugin-solid v2+.
      hot: mode === 'development',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'SpartanAuthWidgets',
      fileName: 'sa-widgets',
    },
    rollupOptions: {},
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
  },
}));
