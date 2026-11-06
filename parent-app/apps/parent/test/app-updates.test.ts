// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { installAppUpdates } from '../../../../native/app-updates.js';

it('keeps updates in the parent area, supports retry/download, and closes before returning to the game', async () => {
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => [] as unknown[] }));
  vi.stubGlobal('fetch', fetcher);
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.open = false; } });
  document.body.innerHTML = '<button data-action="app-update">检查更新</button>';
  try {
    const updates = installAppUpdates('0.1.3');
    await flush();
    expect(document.querySelector('dialog')).toBeNull();
    updates.onParentOpen(); expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockResolvedValueOnce({ ok: true, json: async () => [{ tag_name: 'android-v0.1.4', published_at: '2026-11-06', assets: [
      { name: 'microstar-android-v0.1.4.apk', state: 'uploaded', size: 4194304,
        browser_download_url: 'https://github.com/yir86221-cell/microstar-game/releases/download/android-v0.1.4/microstar-android-v0.1.4.apk' },
    ] }] });
    updates.show(); await flush();
    const dialog = document.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('当前版本 0.1.3');
    expect(dialog.textContent).toContain('发现新版 0.1.4');
    expect(document.querySelector('[data-action="app-update"]')?.textContent).toBe('有新版本');
    expect(dialog.querySelector('a')?.getAttribute('href')).toBe('https://github.com/yir86221-cell/microstar-game/releases/download/android-v0.1.4/microstar-android-v0.1.4.apk');
    expect(dialog.querySelector('a')?.hidden).toBe(false);
    expect(updates.close()).toBe(true); expect(updates.close()).toBe(false);
    fetcher.mockRejectedValueOnce(Error('offline'));
    updates.show(); await flush();
    expect(dialog.textContent).toContain('暂时无法检查更新');
    (dialog.querySelector('button') as HTMLButtonElement).click(); await flush();
    expect(dialog.textContent).toContain('当前已是最新发布版本');
    expect(dialog.querySelector('a')?.hidden).toBe(true);
    expect(dialog.querySelector('a')?.hasAttribute('href')).toBe(false);
    (dialog.querySelectorAll('button')[1] as HTMLButtonElement).click();
    expect(dialog.open).toBe(false);
  } finally { vi.unstubAllGlobals(); document.body.innerHTML = ''; }
});
