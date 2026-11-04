import { card, h } from "../lib/dom.js";
import { MODE_HINT, MODE_NAME, STAGE_NAME, store, type AccessMode } from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

const WINDOWS: [number, string][] = [
  [15_000, "15 秒"],
  [30_000, "30 秒"],
  [45_000, "45 秒"],
  [60_000, "60 秒"],
];

const MINUTES: [number, string][] = [
  [10, "10 分钟"],
  [15, "15 分钟"],
  [20, "20 分钟"],
];

const MODES: AccessMode[] = ["slap", "precise", "dwell"];

export const render: ScreenRenderer = (ctx) => {
  const plan = store.state.plan;
  const isPhysical = plan.stage === 4;

  const modeCard = card(
    h("div", { class: "card-head" }, h("h2", null, "回应方式")),
    h(
      "div",
      { class: "mode-row" },
      ...MODES.map((m) =>
        h(
          "button",
          {
            class: `mode-chip ${plan.mode === m ? "selected" : ""}`,
            onClick: () => {
              store.update((s) => {
                s.plan.mode = m;
              });
              ctx.rerender();
            },
          },
          MODE_NAME[m],
        ),
      ),
    ),
    h("p", { class: "hint" }, MODE_HINT[plan.mode]),
  );

  const rhythmCard = card(
    h("div", { class: "card-head" }, h("h2", null, "节奏")),
    selectRow("等多久算没反应", plan.judgeWindowMs, WINDOWS, (v) =>
      store.update((s) => {
        s.plan.judgeWindowMs = v;
      }),
    ),
    h("p", { class: "hint" }, "CVI 的反应可能慢到 20 秒，宁长不短。这个值会一起传给儿童模式。"),
    selectRow("单次最多练（实物）", plan.maxMinutes, MINUTES, (v) =>
      store.update((s) => {
        s.plan.maxMinutes = v;
      }),
    ),
    h("p", { class: "hint" }, "儿童模式每关固定 3 回合，由它自己控制时长；这一项只约束实物训练。"),
  );

  const loopCard = isPhysical
    ? card(
        h("div", { class: "card-head" }, h("h2", null, "实物回路")),
        selectRow(
          "每轮亮灯",
          plan.loop.lightOnMs,
          [
            [15_000, "15 秒"],
            [30_000, "30 秒"],
            [45_000, "45 秒"],
          ],
          (v) =>
            store.update((s) => {
              s.plan.loop.lightOnMs = v;
            }),
        ),
        selectRow(
          "熄灭间隔",
          plan.loop.gapMs,
          [
            [5_000, "5 秒"],
            [8_000, "8 秒"],
            [12_000, "12 秒"],
          ],
          (v) =>
            store.update((s) => {
              s.plan.loop.gapMs = v;
            }),
        ),
        selectRow(
          "轮数",
          plan.loop.rounds,
          [
            [6, "6 轮"],
            [10, "10 轮"],
            [15, "15 轮"],
          ],
          (v) =>
            store.update((s) => {
              s.plan.loop.rounds = v;
            }),
        ),
        h("p", { class: "hint" }, "亮灯时间不能短，孩子可能要好一会儿才看见。"),
      )
    : null;

  return {
    el: h(
      "div",
      { class: "screen" },
      h(
        "header",
        { class: "session-head" },
        h("button", { class: "icon-btn", onClick: () => ctx.navigate("data") }, "‹"),
        h(
          "div",
          { class: "session-title" },
          h("strong", null, "调整参数"),
          h("span", null, STAGE_NAME[plan.stage]),
        ),
        h("span", { class: "spacer" }),
      ),
      modeCard,
      rhythmCard,
      loopCard,
      h("button", { class: "btn primary block lg", onClick: () => ctx.navigate("train") }, "好了"),
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
