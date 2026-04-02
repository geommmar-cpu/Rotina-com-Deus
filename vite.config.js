import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        paz: resolve(__dirname, 'lp-paz.html'),
      },
    },
  },
})
