import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Configuración con base relativa './' para que al compilar (npm run build)
// funcione directamente en cualquier carpeta o public_html de Hostinger compartido.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
})
