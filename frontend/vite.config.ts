import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/autocare/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const sid = String(id || '')
          if (sid.indexOf('node_modules') !== -1) {
            // Keep react/react-dom in the main vendor chunk to avoid multiple React copies
            if (sid.indexOf('lucide-react') !== -1) return 'icons-lucide'
            if (sid.indexOf('@tanstack') !== -1 || sid.indexOf('react-query') !== -1) return 'react-query'
            if (sid.indexOf('date-fns') !== -1) return 'date-fns'
            if (sid.indexOf('axios') !== -1) return 'axios'
            // group react, react-dom and other node_modules into vendor
            return 'vendor'
          }
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3002,
    proxy: {
      '/api': {
        target: 'http://localhost:8008',
        changeOrigin: true,
        secure: false,
        ws: true,
        // rewrite absolute Location headers returned by backend (redirects)
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            const loc = proxyRes.headers && proxyRes.headers['location']
            if (loc && typeof loc === 'string') {
              // rewrite backend host -> dev server host so browser doesn't follow to backend and hit CORS
              proxyRes.headers['location'] = loc.replace('http://localhost:8008', 'http://localhost:3002')
            }
          })
        }
      },
    },
  },
})