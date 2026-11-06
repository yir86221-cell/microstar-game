import { createUpdateChecker } from './app-updates-core.mjs';

export function installAppUpdates(currentVersion) {
  const checker = createUpdateChecker({ currentVersion });
  let dialog;
  const title = document.createElement('h2');
  title.id = 'microstar-update-title';
  title.textContent = '应用更新';
  const version = document.createElement('p');
  version.textContent = `当前版本 ${currentVersion}`;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const hint = document.createElement('p');
  hint.textContent = '下载后打开安装包，确认覆盖安装即可。请保留原 App，避免卸载后丢失本机记录。';
  const download = document.createElement('a');
  download.textContent = '下载新版 APK';
  // Capacitor routes external https navigation to Android ACTION_VIEW (browser).
  const retry = document.createElement('button');
  retry.type = 'button'; retry.textContent = '重新检查';
  retry.onclick = () => void checker.check(true);
  const close = document.createElement('button');
  close.type = 'button'; close.textContent = '关闭';
  close.onclick = () => dialog.close();

  const api = {
    get label() { return checker.state.update ? '有新版本' : '检查更新'; },
    onParentOpen() { paint(checker.state); void checker.check(); },
    close() { if (!dialog?.open) return false; dialog.close(); return true; },
    show() {
      if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.className = 'microstar-update';
        dialog.setAttribute('aria-labelledby', title.id);
        dialog.append(title, version, status, hint, download, retry, close);
        document.body.append(dialog);
      }
      paint(checker.state);
      if (!dialog.open) dialog.showModal();
      void checker.check(true);
    },
  };
  function paint(state) {
    for (const button of document.querySelectorAll('[data-action="app-update"]')) button.textContent = api.label;
    status.textContent = state.status === 'checking' ? '正在检查新版…'
      : state.status === 'error' ? '暂时无法检查更新，请联网后重试。仍可正常使用 App。'
      : state.update ? `发现新版 ${state.update.version}（约 ${(state.update.size / 1048576).toFixed(1)} MB）`
      : state.status === 'current' ? '当前已是最新发布版本。' : '准备检查更新…';
    download.hidden = hint.hidden = !state.update;
    if (state.update) download.href = state.update.url;
    else download.removeAttribute('href');
    retry.disabled = state.status === 'checking';
  }
  checker.subscribe(paint);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void checker.check(); });
  void checker.check();
  return api;
}
