import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: { exclude: ['mapbox-gl'] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { mapbox: ['mapbox-gl'], d3: ['d3'] }
      }
    }
  }
})
