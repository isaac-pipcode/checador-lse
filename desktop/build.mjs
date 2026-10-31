// Empacota main e preload do Electron (CommonJS) com esbuild.
import { build } from 'esbuild';

const comum = { bundle: true, platform: 'node', target: 'node22', format: 'cjs', external: ['electron'], sourcemap: true, logLevel: 'info' };
await build({ ...comum, entryPoints: ['desktop/main.ts'], outfile: 'dist-desktop/main.cjs' });
await build({ ...comum, entryPoints: ['desktop/preload.ts'], outfile: 'dist-desktop/preload.cjs' });
