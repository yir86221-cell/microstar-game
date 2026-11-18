const path = require('node:path');
const root = path.resolve(__dirname, '..');
const gradle = require('node:fs').readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
const version = gradle.match(/versionName\s+"(\d+\.\d+\.\d+)"/)?.[1];
if (!version) throw Error('Android versionName 必须为三段版本号');
require('esbuild').buildSync({
  entryPoints: [path.join(root, 'native/lamp-bridge.js')],
  outfile: path.join(root, 'dist/native-lamp.js'),
  bundle: true, format: 'iife', platform: 'browser', target: 'es2022', minify: true,
  define: { __APP_VERSION__: JSON.stringify(version) },
});
