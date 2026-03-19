import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://172.16.1.167:8002/oracle-office',
        changeOrigin: true,
      },
    },
  },
})