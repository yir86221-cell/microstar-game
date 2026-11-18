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
  assert.deepEqual(checker.state.error, { kind: 'http', httpStatus: 403 }, '403 alone does not prove rate limiting');
  const manual = checker.check(true); resolve({ ok: true, json: async () => [] }); await manual;
  assert.equal(checker.state.status, 'current'); assert.equal(checker.state.update, null); assert.equal(checker.state.error, null);
  const offline = createUpdateChecker({ currentVersion: '0.1.3', fetcher: async () => { throw Error('offline'); } });
  await offline.check(); assert.equal(offline.state.status, 'error'); assert.equal(offline.state.error.kind, 'network');
  const slow = createUpdateChecker({ currentVersion: '0.1.3', timeout: 5, fetcher: async (_url, {signal}) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(Error('timeout')))) });
  await slow.check(); assert.equal(slow.state.status, 'error'); assert.equal(slow.state.error.kind, 'timeout');
  for (const [status, headers, body, expected] of [
    [403, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '3600' }, {}, { kind: 'rate-limit', httpStatus: 403, retryAt: 3600000 }],
    [403, {}, { message: 'API rate limit exceeded for 1.2.3.4.' }, { kind: 'rate-limit', httpStatus: 403, retryAt: null }],
    [403, {}, { message: 'You have exceeded a secondary rate limit.' }, { kind: 'rate-limit', httpStatus: 403, retryAt: null }],
    [429, { 'retry-after': '120' }, {}, { kind: 'rate-limit', httpStatus: 429, retryAt: 121000 }],
    [429, { 'retry-after': new Date(60000).toUTCString() }, {}, { kind: 'rate-limit', httpStatus: 429, retryAt: 60000 }],
    [429, { 'retry-after': 'invalid' }, {}, { kind: 'rate-limit', httpStatus: 429, retryAt: null }],
    [500, {}, {}, { kind: 'http', httpStatus: 500 }],
  ]) {
    const limited = createUpdateChecker({ currentVersion: '0.1.5', now: () => 1000,
      fetcher: async () => ({ ok: false, status, headers: new Headers(headers), json: async () => body }) });
    await limited.check(); assert.deepEqual(limited.state.error, expected); assert.equal(limited.state.update, null);
  }
  for (const json of [async () => ({ message: 'not a release list' }), async () => { throw SyntaxError('invalid JSON'); }]) {
    const invalid = createUpdateChecker({ currentVersion: '0.1.5', fetcher: async () => ({ ok: true, json }) });
    await invalid.check(); assert.equal(invalid.state.error.kind, 'invalid-response');
  }
  let lateResolve;
  const late = createUpdateChecker({ currentVersion: '0.1.5', timeout: 5,
    fetcher: () => new Promise(resolve => { lateResolve = resolve; }) });
  await late.check(); assert.equal(late.state.error.kind, 'timeout', 'timeout also works if a transport ignores abort');
  lateResolve({ ok: true, json: async () => [] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(late.state.error.kind, 'timeout', 'a late response cannot replace the timeout result');
  let failedCalls = 0;
  const syncFailure = createUpdateChecker({ currentVersion: '0.1.5', fetcher: () => { failedCalls++; throw Error('failed'); } });
  await syncFailure.check(); await syncFailure.check(true); assert.equal(failedCalls, 2, 'synchronous failures must not prevent retry');
  console.log('PASS: Android update ordering, trusted APK URLs, throttling, retry, rate limits, HTTP/data/network errors and timeouts.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
