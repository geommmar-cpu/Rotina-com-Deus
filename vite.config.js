import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        vendas2: resolve(__dirname, 'vendas2.html'),
      },
    },
  },
})
