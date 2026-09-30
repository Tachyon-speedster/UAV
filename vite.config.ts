import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  optimizeDeps: {
    // onnxruntime-web's dynamic wasm-file loading (new URL(...) at runtime)
    // gets mangled by esbuild's dependency pre-bundling in dev mode, which is
    // what causes the "fetched index.html instead of the .wasm binary" error.
    // Excluding it from pre-bundling forces Vite to serve it as a normal
    // ESM import instead, so its runtime path resolution stays correct.
    exclude: ['onnxruntime-web'],
  },
});
