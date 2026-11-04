/**
 * 全屏工具。
 *
 * 网页做不到"真正的全屏"——浏览器地址栏永远在。
 * 两个办法逼近：
 *  1. PWA 安装到主屏幕（manifest 里 display: standalone）——最干净
 *  2. 全屏 API——没安装时也能临时去掉地址栏
 *
 * 全屏 API 必须在用户手势里调用，所以挂在「开始训练」的点击上。
 * 失败一律忽略：全屏只是锦上添花，不能因为它让训练进不去。
 */

export function enterFullscreen(): void {
  const el = document.documentElement as HTMLElement & {
    requestFullscreen?: (options?: { navigationUI?: string }) => Promise<void>;
  };
  if (typeof el.requestFullscreen !== "function") return;
  if (document.fullscreenElement) return;

  try {
    void el.requestFullscreen({ navigationUI: "hide" }).catch(() => undefined);
  } catch {
    /* 用户或浏览器拒绝，忽略 */
  }
}

export function exitFullscreen(): void {
  if (!document.fullscreenElement) return;
  try {
    void document.exitFullscreen().catch(() => undefined);
  } catch {
    /* 忽略 */
  }
}
