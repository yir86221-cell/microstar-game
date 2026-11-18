export const RELEASES_URL = 'https://api.github.com/repos/yir86221-cell/microstar-game/releases?per_page=100';
const REPO_URL = 'https://github.com/yir86221-cell/microstar-game';
export const RELEASES_PAGE_URL = `${REPO_URL}/releases`;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function compareVersions(a, b) {
  if (!VERSION.test(a) || !VERSION.test(b)) throw Error('版本号无效');
  const left = a.split('.').map(Number), right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return Math.sign(left[i] - right[i]);
  return 0;
}
export function findUpdate(releases, currentVersion) {
  if (!Array.isArray(releases)) throw Error('更新服务返回了无效数据');
  let latest = null;
  for (const release of releases) {
    if (!release || release.draft || !release.published_at || typeof release.tag_name !== 'string') continue;
    const version = release.tag_name.replace(/^android-v/, '');
    if (release.tag_name !== `android-v${version}` || !VERSION.test(version)) continue;
    if (compareVersions(version, currentVersion) <= 0 || (latest && compareVersions(version, latest.version) <= 0)) continue;
    const name = `microstar-android-v${version}.apk`;
    const url = `${REPO_URL}/releases/download/android-v${version}/${name}`;
    const asset = release.assets?.find(a => a.name === name && a.state === 'uploaded' && a.size > 0 && a.browser_download_url === url);
    if (asset) latest = { version, url, pageUrl: `${REPO_URL}/releases/tag/android-v${version}`, size: asset.size };
  }
  return latest;
}

class UpdateError extends Error {
  constructor(kind, details = {}) { super(kind); this.details = { kind, ...details }; }
}

async function readUpdate(fetcher, signal, currentVersion, now) {
  const response = await fetcher(RELEASES_URL, { signal, credentials: 'omit', cache: 'no-cache', headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) {
    const header = name => response.headers?.get(name);
    const exhausted = header('x-ratelimit-remaining') === '0';
    let body;
    try { body = await response.json(); } catch { /* Error responses may have no JSON body. */ }
    const limited = response.status === 429 || (response.status === 403 &&
      (exhausted || /rate.?limit/i.test(body?.message ?? '')));
    if (limited) {
      const after = header('retry-after');
      const reset = exhausted ? header('x-ratelimit-reset') : null;
      const retryAt = after ? (/^\d+$/.test(after) ? now() + Number(after) * 1000 : Date.parse(after))
        : reset ? Number(reset) * 1000 : NaN;
      throw new UpdateError('rate-limit', { httpStatus: response.status,
        retryAt: Number.isFinite(retryAt) && retryAt > now() ? retryAt : null });
    }
    throw new UpdateError('http', { httpStatus: response.status });
  }
  try { return findUpdate(await response.json(), currentVersion); }
  catch { throw new UpdateError('invalid-response'); }
}

// No credentials or downloaded code; only inspect this public repository's releases.
export function createUpdateChecker({ currentVersion, fetcher = fetch, now = Date.now, interval = 3600000, timeout = 10000 }) {
  let state = { status: 'idle', update: null, error: null }, pending = null, lastCheck = null;
  const listeners = new Set();
  const emit = value => { state = value; for (const listener of listeners) listener(state); };
  return {
    get state() { return state; },
    subscribe(listener) { listeners.add(listener); listener(state); return () => listeners.delete(listener); },
    check(force = false) {
      if (pending) return pending;
      if (!force && lastCheck !== null && now() - lastCheck < interval) return Promise.resolve(state);
      lastCheck = now();
      emit({ ...state, status: 'checking', error: null });
      pending = (async () => {
        const controller = new AbortController();
        let timer;
        const deadline = new Promise((_, reject) => {
          timer = setTimeout(() => { reject(new UpdateError('timeout')); controller.abort(); }, timeout);
        });
        try {
          const update = await Promise.race([readUpdate(fetcher, controller.signal, currentVersion, now), deadline]);
          emit({ status: update ? 'available' : 'current', update, error: null });
        } catch (error) {
          // Do not report "latest" when offline, rate limited, or the response is invalid.
          emit({ status: 'error', update: state.update,
            error: error instanceof UpdateError ? error.details : { kind: 'network' } });
        } finally { clearTimeout(timer); pending = null; }
        return state;
      })();
      return pending;
    },
  };
}
