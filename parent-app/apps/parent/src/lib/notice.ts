/**
 * 家长端的一条临时提示。
 *
 * 用在“点下去但什么都没发生”这种场景：必须有可见反馈，否则家长只会重复点击。
 * 只显示一条，重复调用会替换文字并重置计时。
 */
export function showNotice(text: string): void {
  let el = document.getElementById("microstar-notice");
  if (!el) {
    el = document.createElement("div");
    el.id = "microstar-notice";
    el.className = "app-notice";
    el.setAttribute("role", "alert");
    el.setAttribute("aria-live", "assertive");
    document.body.appendChild(el);
  }
  el.textContent = text;
  window.setTimeout(() => {
    document.getElementById("microstar-notice")?.remove();
  }, 6000);
}
