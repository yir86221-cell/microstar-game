import { card, cardTitle, h } from "../lib/dom.js";
import { store, STAGE_META, type AccessMode } from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

const WINDOWS: [number, string][] = [
  [15_000, "15 秒"],
  [30_000, "30 秒（默认）"],
  [45_000, "45 秒"],
  [60_000, "60 秒"],
];

const MINUTES: [number, string][] = [
  [10, "10 分钟"],
  [15, "15 分钟（默认）"],
  [20, "20 分钟"],
];

const ACCESS: [AccessMode, string][] = [
  ["anywhereTap", "全屏拍击（重度）"],
  ["hover", "接触悬停 1.2 秒"],
  ["targetTap", "精准触碰"],
];

export const render: ScreenRenderer = (ctx) => {
  const plan = store.state.plan;
  const isPhysical = plan.stage === 4;

  const accessCard = card(
    cardTitle("判定与时长", STAGE_META[plan.stage].title),
    selectRow("判定窗口", plan.judgeWindowMs, WINDOWS, (v) =>
      store.update((s) => {
        s.plan.judgeWindowMs = v;
      }),
    ),
    selectRow("单次上限", plan.maxMinutes, MINUTES, (v) =>
      store.update((s) => {
        s.plan.maxMinutes = v;
      }),
    ),
    isPhysical
      ? null
      : selectRow("交互方式", plan.accessMode, ACCESS, (v) =>
          store.update((s) => {
            s.plan.accessMode = v;
          }),
        ),
    h("p", { class: "hint" }, "CVI 的视觉延迟可以到 20 秒以上，窗口宁长不短。"),
  );

  const loopCard = isPhysical
    ? card(
        cardTitle("自动回路", "第 4 阶"),
        selectRow("每轮亮起", plan.loop.lightOnMs, [
          [15_000, "15 秒"],
          [30_000, "30 秒（默认）"],
          [45_000, "45 秒"],
        ], (v) =>
          store.update((s) => {
            s.plan.loop.lightOnMs = v;
          }),
        ),
        selectRow("熄灭间隔", plan.loop.gapMs, [
          [5_000, "5 秒"],
          [8_000, "8 秒（默认）"],
          [12_000, "12 秒"],
        ], (v) =>
          store.update((s) => {
            s.plan.loop.gapMs = v;
          }),
        ),
        selectRow("轮数", plan.loop.rounds, [
          [6, "6 轮"],
          [10, "10 轮（默认）"],
          [15, "15 轮"],
        ], (v) =>
          store.update((s) => {
            s.plan.loop.rounds = v;
          }),
        ),
        h(
          "p",
          { class: "hint" },
          "亮起时长不能短。亮 8 秒，孩子往往还没反应过来灯就灭了。",
        ),
      )
    : null;

  const lightCard = isPhysical
    ? card(
        cardTitle("灯光"),
        h(
          "div",
          { class: "segmented swatches" },
          ...(["red", "yellow", "warmWhite", "deepBlue"] as const).map((name) =>
            h("button", {
              class: `seg swatch ${name} ${plan.preset === name ? "active" : ""}`,
              onClick: () => {
                store.update((s) => {
                  s.plan.preset = name;
                });
                ctx.rerender();
              },
            }),
          ),
        ),
        h(
          "label",
          { class: "slider" },
          h("span", null, "亮度"),
          h("input", {
            type: "range",
            min: "25",
            max: "128",
            value: String(plan.brightness),
            onInput: (e: Event) => {
              const value = Number((e.target as HTMLInputElement).value);
              store.update((s) => {
                s.plan.brightness = value;
              });
              (e.target as HTMLInputElement)
                .closest(".slider")
                ?.querySelector("output")
                ?.replaceChildren(document.createTextNode(String(value)));
            },
          }),
          h("output", null, String(plan.brightness)),
        ),
        h("p", { class: "hint" }, "亮度越高越费电，也越容易惹眼睛。75 是续航和可见性的甜点。"),
      )
    : null;

  return {
    el: h(
      "div",
      { class: "screen" },
      h(
        "header",
        { class: "session-head" },
        h("button", { class: "icon-btn", onClick: () => ctx.navigate("data") }, "←"),
        h("div", { class: "session-title" }, h("strong", null, "调整计划"), h("span", null, STAGE_META[plan.stage].title)),
        h("span", { class: "spacer" }),
      ),
      accessCard,
      loopCard,
      lightCard,
      h(
        "button",
        { class: "btn primary block", onClick: () => ctx.navigate("train") },
        "保存并回到训练",
      ),
    ),
  };
};

function selectRow<T extends string | number>(
  label: string,
  value: T,
  options: [T, string][],
  onChange: (value: T) => void,
): HTMLElement {
  const select = h("select", {
    onChange: (e: Event) => {
      const raw = (e.target as HTMLSelectElement).value;
      const match = options.find(([v]) => String(v) === raw);
      if (match) onChange(match[0]);
    },
  }) as HTMLSelectElement;

  for (const [v, text] of options) {
    const option = document.createElement("option");
    option.value = String(v);
    option.textContent = text;
    if (String(v) === String(value)) option.selected = true;
    select.append(option);
  }

  return h("label", { class: "field" }, h("span", null, label), select);
}
