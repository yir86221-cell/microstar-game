#!/usr/bin/env node
/**
 * 第三阶段的内置关卡在两处各写了一份：
 *   - 儿童端 dist/game.js 的 builtinPhotos（纯 JS，直接跑）
 *   - 家长端 store.ts 的 PHOTO_BUILTINS（TypeScript，选关和跳转用）
 *
 * 两边的 id 必须完全一致，否则家长点了关卡、儿童端找不到，会静默什么也不做。
 * 这个脚本只做一件事：把两边读出来对比。加关卡时忘了改一边，CI 会失败。
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

const root = path.resolve(__dirname, '..');
const gameSrc = fs.readFileSync(path.join(root, 'dist/game.js'), 'utf8');
const storeSrc = fs.readFileSync(
  path.join(root, 'parent-app/apps/parent/src/lib/store.ts'),
  'utf8',
);

function sliceBetween(source, startMark, endMark, label) {
  const i = source.indexOf(startMark);
  if (i < 0) throw Error(`${label}: 找不到 ${startMark}`);
  const j = source.indexOf(endMark, i);
  if (j < 0) throw Error(`${label}: 找不到结束标记 ${endMark}`);
  return source.slice(i, j);
}

// 儿童端：builtinPhotos = [ {id:'photo-cup',name:'我的杯子',...}, ... ]
const childBlock = sliceBetween(gameSrc, 'var builtinPhotos=[', '];', 'dist/game.js');
const childLevels = [...childBlock.matchAll(/\{id:'([^']+)',name:'([^']+)'/g)].map((m) => ({
  id: m[1],
  name: m[2],
}));

// 家长端：export const PHOTO_BUILTINS: Level[] = [ { id: "photo-cup", ... name: "我的杯子" } ]
const parentBlock = sliceBetween(storeSrc, 'export const PHOTO_BUILTINS', '];', 'store.ts');
const parentLevels = [...parentBlock.matchAll(/id:\s*"([^"]+)"[\s\S]{0,240}?name:\s*"([^"]+)"/g)].map(
  (m) => ({ id: m[1], name: m[2] }),
);

assert.ok(childLevels.length > 0, '儿童端的 builtinPhotos 是空的');
assert.ok(parentLevels.length > 0, '家长端的 PHOTO_BUILTINS 是空的');
assert.equal(
  childLevels.length,
  parentLevels.length,
  `内置关卡数量不一致：儿童端 ${childLevels.length} 个，家长端 ${parentLevels.length} 个`,
);

for (let i = 0; i < childLevels.length; i += 1) {
  const c = childLevels[i];
  const p = parentLevels[i];
  assert.equal(
    c.id,
    p.id,
    `第 ${i + 1} 个内置关卡 id 不一致：儿童端 ${c.id}，家长端 ${p.id}`,
  );
  assert.equal(
    c.name,
    p.name,
    `内置关卡 ${c.id} 的名字不一致：儿童端「${c.name}」，家长端「${p.name}」`,
  );
  assert.match(c.id, /^photo-[a-z0-9-]+$/, `内置关卡 id 要满足 photo-xxx 的格式：${c.id}`);
}

console.log(
  `PASS: built-in photo levels match on both sides (${childLevels
    .map((l) => `${l.id}=${l.name}`)
    .join(', ')}).`,
);
