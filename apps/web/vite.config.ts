import { defineConfig } from 'vite';
export default defineConfig({
  base: './',                                    // relative URLs: works from any sub-path (GitHub Pages, a school server, …)
  server: { fs: { allow: ['../..'] } },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 600 },
});
