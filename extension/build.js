import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, 'dist');

async function buildExtension() {
  console.log('[Synora Extension] Starting Manifest V3 Extension build...');

  // 1. Recreate clean dist directory
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(path.join(distDir, 'icons'), { recursive: true });
  fs.mkdirSync(path.join(distDir, 'background'), { recursive: true });
  fs.mkdirSync(path.join(distDir, 'content'), { recursive: true });
  fs.mkdirSync(path.join(distDir, 'popup'), { recursive: true });

  // 2. Build Background Service Worker
  console.log('[Synora Extension] Bundling background service worker...');
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'src/background/service-worker.ts')],
    outfile: path.join(distDir, 'background/service-worker.js'),
    bundle: true,
    format: 'esm',
    target: ['chrome100'],
    platform: 'browser',
    sourcemap: true,
  });

  // 3. Build Content Script (IIFE for standalone execution in isolated world)
  console.log('[Synora Extension] Bundling content script...');
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'src/content/index.ts')],
    outfile: path.join(distDir, 'content/index.js'),
    bundle: true,
    format: 'iife',
    target: ['chrome100'],
    platform: 'browser',
    sourcemap: true,
  });

  // 4. Build Popup Script
  console.log('[Synora Extension] Bundling popup script...');
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'src/popup/popup.ts')],
    outfile: path.join(distDir, 'popup/popup.js'),
    bundle: true,
    format: 'esm',
    target: ['chrome100'],
    platform: 'browser',
    sourcemap: true,
  });

  // 5. Copy Static Assets
  console.log('[Synora Extension] Copying static assets and manifest...');
  fs.copyFileSync(
    path.join(__dirname, 'manifest.json'),
    path.join(distDir, 'manifest.json')
  );
  fs.copyFileSync(
    path.join(__dirname, 'src/popup/popup.html'),
    path.join(distDir, 'popup/popup.html')
  );
  fs.copyFileSync(
    path.join(__dirname, 'src/popup/popup.css'),
    path.join(distDir, 'popup/popup.css')
  );

  // Copy Icons
  const iconsDir = path.join(__dirname, 'icons');
  if (fs.existsSync(iconsDir)) {
    for (const iconFile of fs.readdirSync(iconsDir)) {
      fs.copyFileSync(
        path.join(iconsDir, iconFile),
        path.join(distDir, 'icons', iconFile)
      );
    }
  }

  // 6. Verification
  const manifest = JSON.parse(fs.readFileSync(path.join(distDir, 'manifest.json'), 'utf-8'));
  console.log(`[Synora Extension] Manifest V3 verified: "${manifest.name}" v${manifest.version}`);
  console.log('[Synora Extension] Build completed successfully in: extension/dist/');
}

buildExtension().catch((err) => {
  console.error('[Synora Extension] Build failed:', err);
  process.exit(1);
});
