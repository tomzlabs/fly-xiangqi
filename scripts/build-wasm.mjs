import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
execFileSync('cargo', ['build', '--release', '--target', 'wasm32-unknown-unknown', '--manifest-path', 'native/Cargo.toml'], { stdio: 'inherit' });
mkdirSync('public/wasm', { recursive: true });
copyFileSync('native/target/wasm32-unknown-unknown/release/fly_brain.wasm', 'public/wasm/fly_brain.wasm');
writeFileSync('public/wasm/manifest.json', JSON.stringify({
  sha256: createHash('sha256').update(readFileSync('public/wasm/fly_brain.wasm')).digest('hex'),
  model: 'fly-chess-lif-v1',
}, null, 2) + '\n');
