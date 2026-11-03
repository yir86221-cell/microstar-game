import { AlertMode, LIGHT_PRESETS, encodeAlert, encodeLight } from "@microstar/core-protocol";
import { card, cardTitle, h } from "../lib/dom.js";
import { device } from "../lib/device.js";
import { timeLabel } from "../lib/format.js";
import { store } from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

const hex = (bytes: number[] | null): string =>
  bytes ? bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ") : "—";

/**
 * 调试台：只看原始字节和事件。
 * 产品页面里不出现的脏活都放这儿：模拟拿起/放下、看实际下发的字节、排硬件。
 */
export const render: ScreenRenderer = (ctx) => {
  const plan = store.state.plan;
  const last = device.lastWrite;

  const bytesCard = card(
    cardTitle("最近下发的字节"),
    kv("ALERT", hex(last.alert)),
    kv("LIGHT", hex(last.light)),
    h(
      "p",
      { class: "hint" },
      "ALERT 只有 1 字节：00 灭 / 01 闪 / 02 常亮 / 03 呼吸；最高位为 1 表示本次不下发震动。",
    ),
  );

  const simCard = card(
    cardTitle("模拟设备"),
    h("p", { class: "muted" },
      device.kind === "mock" ? "当前是模拟设备，可以手动触发拿起/放下。" : "连的是真设备，模拟按钮无效。"),
    h(
      "div",
      { class: "row" },
      h("button", { class: "btn ghost grow", onClick: () => device.simulateMotion(true) }, "模拟拿起"),
      h("button", { class: "btn ghost grow", onClick: () => device.simulateMotion(false) }, "模拟放下"),
    ),
  );

  const rawCard = card(
    cardTitle("原始测试"),
    h(
      "div",
      { class: "row" },
      h(
        "button",
        {
          class: "btn ghost grow",
          onClick: () =>
            void device.writeLight({
              mode: AlertMode.Steady,
              brightness: LIGHT_PRESETS[plan.preset].brightness,
            }),
        },
        "常亮",
      ),
      h("button", { class: "btn ghost grow", onClick: () => void device.writeLight({ mode: AlertMode.Breathe }) }, "呼吸"),
      h("button", { class: "btn ghost grow", onClick: () => void device.writeLight({ mode: AlertMode.Blink }) }, "闪"),
      h("button", { class: "btn ghost grow", onClick: () => void device.turnOff() }, "灭"),
    ),
    h("p", { class: "hint" },
      `如果直接 writeValue 一段字节：ALERT=${encodeAlert({ mode: AlertMode.Steady, muteVibration: false })[0]!}，` +
        `LIGHT=${[...encodeLight({ ...LIGHT_PRESETS[plan.preset], brightness: plan.brightness })]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" ")}`,
    ),
  );

  const logCard = card(
    cardTitle("事件日志", `${device.logs.length} 条`),
    h(
      "ul",
      { class: "log" },
      ...device.logs.slice(0, 40).map((entry) =>
        h(
          "li",
          { class: `log-${entry.tone}` },
          `${timeLabel(entry.at)}  ${entry.text}`,
        ),
      ),
    ),
  );

  const off = device.onState(() => ctx.rerender());

  return {
    el: h(
      "div",
      { class: "screen" },
      h(
        "header",
        { class: "session-head" },
        h("button", { class: "icon-btn", onClick: () => ctx.navigate("device") }, "←"),
        h("div", { class: "session-title" }, h("strong", null, "调试台"), h("span", null, device.kind || "未连接")),
        h("span", { class: "spacer" }),
      ),
      bytesCard,
      simCard,
      rawCard,
      logCard,
    ),
    destroy: off,
  };
};

function kv(label: string, value: string): HTMLElement {
  return h(
    "div",
    { class: "kv mono" },
    h("span", { class: "muted" }, label),
    h("strong", null, value),
  );
}
