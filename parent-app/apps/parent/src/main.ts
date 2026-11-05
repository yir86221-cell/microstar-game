import { mount } from "./app.js";

const root = document.getElementById("root");
if (!root) throw new Error("找不到 #root 挂载点");

/*
 * 被儿童端用 iframe 装进弹窗时，铺满那张卡片，不再按手机宽度居中。
 * 独立打开（直接访问 :5180）时保持原来的居中窄栏。
 */
if (window.self !== window.top) {
  document.documentElement.classList.add("embedded");
}

mount(root);

/*
 * 注册 service worker。
 *
 * 目的只有一个：让浏览器把这个页面当成可安装的应用。
 * 安卓上「添加到主屏幕」后以全屏打开，没有地址栏——孩子模式才能真正做到纯黑无干扰。
 *
 * 只在 HTTPS 或 localhost 下注册（浏览器硬性要求），所以局域网 http 打开时会静默跳过。
 */
// APK updates replace bundled assets. A browser service worker must not keep an
// older parent UI alive across an app update. The iframe can inspect its same-origin host.
function inNativeApp(): boolean {
  try {
    const host = window.top as Window & {
      Capacitor?: { isNativePlatform?: () => boolean };
    };
    return host?.Capacitor?.isNativePlatform?.() === true;
  } catch {
    return false;
  }
}

if (!inNativeApp() && "serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* 注册失败不影响使用，只是不能安装成应用 */
    });
  });
}
