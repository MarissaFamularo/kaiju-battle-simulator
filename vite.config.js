import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // a version stamp shown on the title screen, so we can tell which build an iPad is really running
  define: { __BUILD__: JSON.stringify(new Date().toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })) },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4000,
  },
  server: { host: true },
});
