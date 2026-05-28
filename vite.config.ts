import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const buildTempDir = resolve('node_modules/.vite-temp')
mkdirSync(buildTempDir, { recursive: true })
process.env.TMPDIR = buildTempDir
process.env.TMP = buildTempDir
process.env.TEMP = buildTempDir

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      disable: process.env.DISABLE_PWA === 'true',
      registerType: 'autoUpdate',
      manifest: {
        name: 'MD Studio',
        short_name: 'MD Studio',
        description: 'Local-first markdown editor and preview',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'vite.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
