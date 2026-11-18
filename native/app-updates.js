import { createUpdateChecker, RELEASES_PAGE_URL } from './app-updates-core.mjs';

function errorMessage(error) {
  if (error?.kind === 'rate-limit') {
    const time = error.retryAt ? `接口提示可在 ${new Date(error.retryAt).toLocaleTimeString('zh-CN', { hour12: false })} 后重试。` : '请稍后重试。';
    return `GitHub 更新接口请求过多，当前网络出口被限流，并非未联网。代理节点的其他用户也可能共用额度。${time}也可切换代理节点或通过下方下载页更新。`;
  }
  if (error?.kind === 'timeout') return '检查更新超时。可检查代理或网络连接后重试，也可打开下方下载页。';
  if (error?.kind === 'http') return `更新服务返回 HTTP ${error.httpStatus}，暂时无法检查更新。请稍后重试或打开下方下载页。`;
  if (error?.kind === 'invalid-response') return '更新服务返回的数据异常，无法确认最新版本。请稍后重试或打开下方下载页。';
  return '暂时无法连接更新服务。请检查代理或网络设置，也可打开下方下载页。仍可正常使用 App。';
}

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
  const releasePage = document.createElement('a');
  releasePage.textContent = '浏览器打开版本下载页';
  releasePage.href = RELEASES_PAGE_URL;
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
        dialog.append(title, version, status, hint, download, releasePage, retry, close);
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
      : state.status === 'error' ? errorMessage(state.error)
      : state.update ? `发现新版 ${state.update.version}（约 ${(state.update.size / 1048576).toFixed(1)} MB）`
      : state.status === 'current' ? '当前已是最新发布版本。' : '准备检查更新…';
    download.hidden = !state.update;
    releasePage.hidden = state.status !== 'error';
    hint.hidden = !state.update && releasePage.hidden;
    if (state.update) download.href = state.update.url;
    else download.removeAttribute('href');
    retry.disabled = state.status === 'checking';
  }
  checker.subscribe(paint);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void checker.check(); });
  void checker.check();
  return api;
}
