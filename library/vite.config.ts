import { resolve } from 'path';
import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

// TODO: switch to libary mode
// https://vitejs.dev/guide/build.html#library-mode

export default defineConfig({
  plugins: [solidPlugin()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'SpartanAuthWidgets',
      // the proper extensions will be added
      fileName: 'sa-widgets',
    },
    rollupOptions: {
      // make sure to externalize deps that shouldn't be bundled
      // into your library
      // external: ['solid-js'],
      // output: {
      //   // Provide global variables to use in the UMD build
      //   // for externalized deps
      //   globals: {
      //     'solid-js': 'Solid',
      //     // vue: 'Vue',
      //   },
      // },
    },
  },
  // build: {
  //   target: 'esnext',
  //   polyfillDynamicImport: false,
  //   rollupOptions: {
  //     input: {
  //       main: resolve(__dirname, 'index.html'),
  //       app: resolve(__dirname, 'app.html'),
  //     }
  //   }
  // },
});
