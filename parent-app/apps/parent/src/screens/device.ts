import { AlertMode } from "@microstar/core-protocol";
import { estimateRemaining, resolveLightPolicy } from "@microstar/core-domain";
import { card, cardTitle, h } from "../lib/dom.js";
import { device } from "../lib/device.js";
import { store } from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

export const render: ScreenRenderer = (ctx) => {
  const state = store.state;
  const policy = resolveLightPolicy(state.child);
  const battery = estimateRemaining(state.usage, { brightness: state.plan.brightness });
  const hasPhysicalData = state.usage.length > 0;

  const statusCard = card(
    cardTitle("提示灯", device.kind === "mock" ? "模拟设备" : undefined),
    h(
      "div",
      { class: `device-status ${device.isConnected ? "ok" : "off"}` },
      h("span", { class: "status-dot" }),
      h(
        "div",
        null,
        h("strong", null, device.isConnected ? "已连接" : "未连接"),
        h(
          "span",
          { class: "muted" },
          device.isConnected
            ? "第 4 阶训练结束时会自动断开"
            : "第 4 阶才需要灯，前 3 阶不用连",
        ),
      ),
    ),
    hasPhysicalData
      ? h(
          "div",
          { class: "usage-line" },
          h("strong", null, `已亮灯 ${Math.round(battery.litMinutes)} 分钟`),
          h("span", { class: "muted" }, `· 大约还能练 ${Math.max(0, battery.wholeSessions)} 次`),
        )
      : null,
    h(
      "div",
      { class: "row" },
      h(
        "button",
        { class: "btn primary grow", onClick: () => void device.connect() },
        device.isConnected ? "重新连接" : "连接",
      ),
      h(
        "button",
        { class: "btn ghost", onClick: () => void device.selfTest(), disabled: !device.isConnected },
        "试亮",
      ),
      h(
        "button",
        { class: "btn ghost", onClick: () => void device.findLamp(), disabled: !device.isConnected },
        "找灯",
      ),
    ),
    h(
      "button",
      {
        class: "link-btn",
        onClick: (e: Event) => {
          (e.target as HTMLElement)
            .closest(".card")
            ?.querySelector(".troubleshoot")
            ?.classList.toggle("open");
        },
      },
      "▸ 连不上怎么办？",
    ),
    h(
      "div",
      { class: "troubleshoot" },
      h(
        "ol",
        null,
        h("li", null, "先插上充电 10 分钟再试——最常见的原因就是没电。"),
        h("li", null, "确认没在充电。这版硬件充电时会停机，必须拔线。"),
        h("li", null, "靠近一点，避开金属桌面。"),
        h("li", null, "如果另一台 iPad 正在用这盏灯，这边连不上是正常的。"),
      ),
    ),
  );

  const modes: [AlertMode, string][] = [
    [AlertMode.Off, "熄灭"],
    [AlertMode.Steady, "常亮"],
    [AlertMode.Breathe, "呼吸"],
    [AlertMode.Blink, "闪烁"],
  ];

  const lightCard = card(
    cardTitle("灯光", "只允许安全档位"),
    h(
      "div",
      { class: "segmented" },
      ...modes.map(([mode, label]) =>
        h(
          "button",
          {
            class: "seg",
            disabled: !policy.allowedModes.includes(mode) || !device.isConnected,
            onClick: () => void device.setMode(mode),
          },
          label,
        ),
      ),
    ),
    h(
      "div",
      { class: "segmented swatches" },
      ...(["red", "yellow", "warmWhite", "deepBlue"] as const).map((name) =>
        h("button", {
          class: `seg swatch ${name} ${state.plan.preset === name ? "active" : ""}`,
          disabled: !device.isConnected,
          onClick: () => {
            store.update((s) => {
              s.plan.preset = name;
            });
            void device.setLight(store.state.plan.brightness, name);
          },
        }),
      ),
    ),
    policy.notes.length > 0
      ? h("p", { class: "notice" }, policy.notes.join("；"))
      : h("p", { class: "hint" }, "有光敏癫痫史时，闪烁会被禁用、亮度会自动压低。"),
  );

  const advanced = card(
    cardTitle("高级"),
    h("p", { class: "muted" }, "调试台可以看原始字节、手动模拟拿起/放下。排硬件问题时用它。"),
    h("button", { class: "btn ghost block", onClick: () => ctx.navigate("debug") }, "打开调试台"),
  );

  const off = device.onState(() => ctx.rerender());

  return {
    el: h(
      "div",
      { class: "screen" },
      h("div", { class: "page-head" }, h("div", null, h("h1", null, "设备"))),
      statusCard,
      lightCard,
      advanced,
    ),
    destroy: off,
  };
};
