import { build } from 'esbuild'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'

rmSync('dist', { recursive: true, force: true })
mkdirSync('dist/assets', { recursive: true })

await build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  minify: true,
  sourcemap: false,
  outdir: 'dist/assets',
  entryNames: 'app',
  jsx: 'automatic',
  target: ['chrome100', 'safari16'],
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.svg': 'file', '.png': 'file', '.webp': 'file' },
  logLevel: 'info',
})

cpSync('index.html', 'dist/index.html')
cpSync('watch.html', 'dist/watch.html')
cpSync('public', 'dist', { recursive: true })
writeFileSync('dist/.build', new Date().toISOString(), 'utf8')
console.log('build ready: dist/')
