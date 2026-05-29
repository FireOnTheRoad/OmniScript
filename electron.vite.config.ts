import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      externalizeDeps: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'electron/main.ts')
        }
      }
    }
  },
  preload: {
    build: {
      outDir: 'out/preload',
      externalizeDeps: true,
      rollupOptions: {
        input: {
          preload: resolve(__dirname, 'electron/preload.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    plugins: [vue()]
  }
})
