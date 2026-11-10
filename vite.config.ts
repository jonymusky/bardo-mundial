import { defineConfig } from 'vite';

// Base relativa: el mismo build funciona en un dominio propio y en usuario.github.io/repo/.
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: { index: 'index.html', play: 'play.html' },
    },
  },
});
