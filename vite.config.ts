import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Single config: add proxy for /audit and keep open=true
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/audit': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})