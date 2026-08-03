import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative assets support both a root domain and GitHub Pages subpaths.
  base: './',
  plugins: [react()],
})
