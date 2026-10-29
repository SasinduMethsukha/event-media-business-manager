import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// The app's classic (non-module) scripts must keep their global scope and
// load order, so Vite cannot bundle them. Without this step `npm run build`
// produced a dist/ folder with no application code at all.
const CLASSIC_SCRIPTS = [
  'legacy/brand-assets.js',
  'legacy/script.js',
  'legacy/features.js',
  'legacy/features2.js',
  'legacy/ai-quote.js',
  'v4-modern.js',
  'v6-enhancements.js',
  'v7-features.js',
  'v8-shell.js'
];

function copyClassicScripts() {
  let outDir = 'dist';
  return {
    name: 'copy-classic-scripts',
    apply: 'build',
    configResolved(cfg) { outDir = path.resolve(cfg.root, cfg.build.outDir); },
    closeBundle() {
      for (const file of CLASSIC_SCRIPTS) {
        const dest = path.join(outDir, file);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.resolve(file), dest);
      }
    }
  };
}

export default defineConfig({
  server: { port: 5173 },
  build: {
    target: 'es2022',
    sourcemap: false
  },
  plugins: [copyClassicScripts()]
});
