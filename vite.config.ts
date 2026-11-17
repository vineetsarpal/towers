/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
    lib: { entry: 'src/index.ts', formats: ['es', 'cjs'], fileName: 'index' },
    rollupOptions: {
      external: ['react', 'react/jsx-runtime'],
      // <Towers /> keeps selection state, so frameworks with server components need the marker.
      output: { banner: "'use client';" },
    },
  },
  test: { environment: 'jsdom' },
})
