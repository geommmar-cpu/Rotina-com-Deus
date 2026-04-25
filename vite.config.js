import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        v2: resolve(__dirname, 'v2.html'),
        obrigado: resolve(__dirname, 'obrigado.html'),
      },
    },
  },
})
