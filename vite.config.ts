import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  // Relativ bas så att bygget fungerar under en undermapp, som GitHub Pages
  // på /escape-room/.
  base: './',
  // Kamera och rörelsesensor kräver https, även när mobilerna provar mot
  // datorn på wifi.
  plugins: [react(), basicSsl()],
  build: {
    rollupOptions: {
      // Testsidan och testkorten är egna sidor, på samma adresser som förut.
      // Sökvägarna räknas från repots rot, där npm kör bygget.
      input: {
        start: 'index.html',
        testsida: 'testsida/index.html',
        platskort: 'testsida/platskort.html',
      },
    },
  },
});
