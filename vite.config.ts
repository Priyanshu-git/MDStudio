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
        start_url: '/editor',
        scope: '/',
        file_handlers: [
          {
            action: '/open-md',
            accept: {
              'text/markdown': ['.md'],
            },
          },
        ],
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
        globIgnores: [
          '**/assets/abap-*.js',
          '**/assets/actionscript-*.js',
          '**/assets/ada-*.js',
          '**/assets/angular-*.js',
          '**/assets/apache-*.js',
          '**/assets/apex-*.js',
          '**/assets/apl-*.js',
          '**/assets/applescript-*.js',
          '**/assets/architectureDiagram-*.js',
          '**/assets/asciidoc-*.js',
          '**/assets/asm-*.js',
          '**/assets/astro-*.js',
          '**/assets/ballerina-*.js',
          '**/assets/blade-*.js',
          '**/assets/blockDiagram-*.js',
          '**/assets/bsl-*.js',
          '**/assets/c-*.js',
          '**/assets/c4Diagram-*.js',
          '**/assets/catppuccin-*.js',
          '**/assets/cobol-*.js',
          '**/assets/cose-bilkent-*.js',
          '**/assets/cpp-*.js',
          '**/assets/csharp-*.js',
          '**/assets/cytoscape*.js',
          '**/assets/emacs-lisp-*.js',
          '**/assets/erDiagram-*.js',
          '**/assets/flowDiagram-*.js',
          '**/assets/fortran-*.js',
          '**/assets/ganttDiagram-*.js',
          '**/assets/hack-*.js',
          '**/assets/html-*.js',
          '**/assets/javascript-*.js',
          '**/assets/jsx-*.js',
          '**/assets/latex-*.js',
          '**/assets/less-*.js',
          '**/assets/markdown-*.js',
          '**/assets/mdx-*.js',
          '**/assets/mermaid*.js',
          '**/assets/mojo-*.js',
          '**/assets/objective-*.js',
          '**/assets/php-*.js',
          '**/assets/python-*.js',
          '**/assets/racket-*.js',
          '**/assets/sequenceDiagram-*.js',
          '**/assets/swift-*.js',
          '**/assets/tsx-*.js',
          '**/assets/typescript-*.js',
          '**/assets/vue-*.js',
          '**/assets/wardley*.js',
          '**/assets/wasm-*.js',
          '**/assets/wolfram-*.js',
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
