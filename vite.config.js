import { defineConfig } from 'vite';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  // 这里可以完全留空，或者只指定打包输出目录（默认是 dist）
  build: {
    outDir: 'dist',
  },
  plugins: [cloudflare()],
});