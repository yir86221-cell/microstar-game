const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'parent-app/apps/parent/dist');
const target = path.join(root, 'dist/parent');

if (!fs.existsSync(path.join(source, 'index.html'))) throw Error('Build parent app first');

// 先清空再复制。只覆盖不清理的话，每次构建都会留下上一版的
// 带哈希文件名（index-xxxx.js / index-yyyy.css），dist/parent 会越滚越大。
fs.rmSync(target, { recursive: true, force: true });
fs.cpSync(source, target, { recursive: true });
console.log('Parent app packaged into dist/parent');
