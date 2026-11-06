import { h } from "./dom.js";
import { store } from "./store.js";
import { device } from "./device.js";
import { ManualLamp } from "./manual-lamp.js";

export function manualLampButton(onOccupied: (occupied: boolean) => void) {
  const status = h("p", { class: "hint", role: "status", "aria-live": "polite" });
  const button = h("button", { class: "btn ghost block", type: "button", "data-manual-lamp": "true" }) as HTMLButtonElement;
  const lamp = new ManualLamp(state => {
    button.disabled = state.busy;
    button.textContent = state.busy ? "蓝牙控灯：处理中…" : state.active ? "蓝牙控灯：停止闪烁" : "蓝牙控灯：开始闪烁";
    button.setAttribute("aria-pressed", String(state.active));
    status.textContent = state.message;
    onOccupied(state.busy || state.active);
  });
  button.textContent = "蓝牙控灯：开始闪烁";
  button.setAttribute("aria-pressed", "false");
  status.textContent = lamp.state.message;
  button.addEventListener("click", () => {
    if (!lamp.state.active && device.isConnected) {
      status.textContent = "已有训练设备连接，请先在设备页断开，再使用手动控灯。";
      return;
    }
    const { plan, child } = store.state;
    void lamp.toggle({ preset: plan.preset, brightness: plan.brightness,
      photosensitive: child.photosensitive, highLightSensitivity: child.highLightSensitivity,
      tactileSensitive: child.tactileSensitive });
  });
  const stop = () => { void lamp.stop(); };
  // The Android permission/device chooser may temporarily hide the WebView.
  // Do not cancel that user-initiated connection; only stop an active lamp.
  const hidden = () => { if (document.hidden && lamp.state.active) stop(); };
  window.addEventListener("pagehide", stop);
  document.addEventListener("visibilitychange", hidden);
  return {
    el: h("div", { class: "manual-lamp" }, button, status),
    destroy() {
      window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", hidden);
      lamp.dispose();
    },
  };
}
