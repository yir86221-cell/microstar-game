const path = require('node:path');
const root = path.resolve(__dirname, '..');
require('esbuild').buildSync({
  entryPoints: [path.join(root, 'native/lamp-bridge.js')],
  outfile: path.join(root, 'dist/native-lamp.js'),
  bundle: true, format: 'iife', platform: 'browser', target: 'es2022', minify: true,
});
