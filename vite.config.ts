import { rmSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { notBundle } from 'vite-plugin-electron/plugin'
import pkg from './package.json'
import { fileURLToPath } from 'node:url'
import copy from 'rollup-plugin-copy'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  // Clean previous Electron build output
  rmSync('dist-electron', { recursive: true, force: true })

  const isServe = command === 'serve'
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG

  return {
    plugins: [
      vue(),

      electron([
        {
          // Main process entry file of the Electron App.
          entry: 'electron/main/index.ts',
          onstart({ startup }) {
            if (process.env.VSCODE_DEBUG) {
              console.log('[startup] Electron App')
            } else {
              startup()
            }
          },
          vite: {
            build: {
              sourcemap,
              minify: false,
              outDir: 'dist-electron/main',
              rollupOptions: {
                // Mark node-hid as external so it won't be bundled.
                external: [
                  ...Object.keys(pkg.dependencies || {}),
                  'node-hid'
                ],
                // Use the copy plugin to copy HID.node into the "build" folder.
                plugins: [
                  copy({
                    targets: [
                      {
                        src: 'node_modules/node-hid/build/Release/HID.node',
                        dest: 'build'
                      }
                    ],
                    // Run the copy plugin after the bundle is written.
                    hook: 'writeBundle'
                  })
                ]
              },
              commonjsOptions: {
                ignoreDynamicRequires: true,
              },
            },
            plugins: [
              // When in serve mode, skip bundling native modules.
              isServe && notBundle(),
            ],
          },
        },
        {
          entry: 'electron/preload/index.ts',
          onstart({ reload }) {
            // Notify Renderer to reload when Preload is built.
            reload()
          },
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : undefined,
              minify: false,
              outDir: 'dist-electron/preload',
              commonjsOptions: {
                ignoreDynamicRequires: true,
              },
              rollupOptions: {
                external: [
                  ...Object.keys(pkg.dependencies || {}),
                  'node-hid'
                ],
              },
            },
            plugins: [
              isServe && notBundle(),
            ],
          },
        }
      ]),
      // Use Node.js API in the Renderer process.
      renderer(),
    ],
    server: process.env.VSCODE_DEBUG && (() => {
      const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL)
      return {
        host: url.hostname,
        port: +url.port,
      }
    })(),
    clearScreen: false,
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    build: {
      commonjsOptions: {
        ignoreDynamicRequires: true,
      }
    }
  }
})