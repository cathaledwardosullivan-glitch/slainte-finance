import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({
    // Disable Fast Refresh for Electron to avoid HMR/WebSocket errors
    fastRefresh: false,
  })],
  // Use relative paths for assets - required for Electron file:// protocol
  base: './',
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
    strictPort: true, // Fail if port is already in use
    hmr: false, // Disable HMR for Electron - use manual reload instead
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
})
