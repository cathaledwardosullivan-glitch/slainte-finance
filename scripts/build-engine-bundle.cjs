const esbuild = require('esbuild');
const path = require('path');

esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'src', 'utils', 'engineExports.js')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.join(__dirname, '..', 'electron', 'utils', 'categorizationBundle.cjs'),
  external: [],  // No external deps — everything is pure JS
});

console.log('[build-engine-bundle] Done');
