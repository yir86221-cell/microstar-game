const assert = require('node:assert/strict');
async function main() {
  const { findUpdate, compareVersions, createUpdateChecker, RELEASES_URL } = await import('../native/app-updates-core.mjs');
  const release = (version, extra = {}) => ({ tag_name: `android-v${version}`, published_at: '2026-11-06', draft: false, prerelease: true,
    assets: [{ name: `microstar-android-v${version}.apk`, state: 'uploaded', size: 4000000,
      browser_download_url: `https://github.com/yir86221-cell/microstar-game/releases/download/android-v${version}/microstar-android-v${version}.apk` }], ...extra });
  assert.equal(compareVersions('0.1.10', '0.1.9'), 1);
  assert.equal(findUpdate([release('0.1.3')], '0.1.3'), null);
  assert.equal(findUpdate([release('0.1.4'), release('0.1.10'), release('0.1.9')], '0.1.3').version, '0.1.10');
  for (const invalid of [release('0.1.4', { draft: true }), release('0.1.4', { published_at: null }), release('0.1.4', { assets: [] }), release('0.1.4', { tag_name: 'desktop-v0.1.4' }), release('0.1.4', { assets: [{ ...release('0.1.4').assets[0], browser_download_url: 'https://example.com/bad.apk' }] })]) {
    assert.equal(findUpdate([invalid], '0.1.3'), null);
  }
  let count = 0, time = 0, resolve;
  const checker = createUpdateChecker({ currentVersion: '0.1.3', now: () => time,
    fetcher: async (url, options) => { count++; assert.equal(url, RELEASES_URL); assert.equal(options.credentials, 'omit'); return new Promise(r => { resolve = r; }); } });
  const pending = checker.check();
  assert.equal(checker.check(true), pending, 'coalesce concurrent automatic/manual checks');
  resolve({ ok: true, json: async () => [release('0.1.4')] }); await pending;
  assert.equal(checker.state.update.version, '0.1.4', 'Android prereleases are eligible');
  await checker.check(); assert.equal(count, 1, 'foreground checks are limited to once per hour');
  time = 3600001;
  const again = checker.check(); resolve({ ok: false, status: 403 }); await again;
  assert.equal(checker.state.status, 'error'); assert.equal(checker.state.update.version, '0.1.4');
  const manual = checker.check(true); resolve({ ok: true, json: async () => [] }); await manual;
  assert.equal(checker.state.status, 'current'); assert.equal(checker.state.update, null);
  const offline = createUpdateChecker({ currentVersion: '0.1.3', fetcher: async () => { throw Error('offline'); } });
  await offline.check(); assert.equal(offline.state.status, 'error');
  const slow = createUpdateChecker({ currentVersion: '0.1.3', timeout: 5, fetcher: async (_url, {signal}) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Error('timeout')))) });
  await slow.check(); assert.equal(slow.state.status, 'error');
  console.log('PASS: Android update version ordering, prereleases, trusted APK URLs, throttling, retry, offline and timeout.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
