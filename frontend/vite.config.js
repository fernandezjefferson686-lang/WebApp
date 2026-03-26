import { defineConfig } from 'vite'   // ← THIS LINE WAS MISSING
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    allowedHosts: "all",
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
})