import { card, h } from "../lib/dom.js";
import { MODE_HINT, MODE_NAME, STAGE_NAME, TARGET_SIZES, store, type AccessMode } from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

const WINDOWS: [number, string][] = [
  [15_000, "15 秒"],
  [30_000, "30 秒"],
  [45_000, "45 秒"],
  [60_000, "60 秒"],
];

const MODES: AccessMode[] = ["slap", "precise", "dwell"];

export const render: ScreenRenderer = (ctx) => {
  const plan = store.state.plan;
  const isPhysical = plan.stage === 4;
  if (isPhysical) return {el:h("div",{class:"screen"},h("h1",null,"实物灯光设置"),
    h("p",{class:"hint"},"实物阶段由家长手动控灯。颜色和亮度在设备页设置。"),
    h("button",{class:"btn primary",onClick:()=>ctx.navigate("device")},"打开设备页"),
    h("button",{class:"btn ghost",onClick:()=>ctx.navigate("train")},"返回训练"))};

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
  );

  const audioCard = isPhysical
    ? null
    : card(
        h("div", { class: "card-head" }, h("h2", null, "儿童模式里怎么呈现")),
        h(
          "div",
          { class: "segmented" },
          ...TARGET_SIZES.map((size) =>
            h(
              "button",
              {
                class: `seg ${plan.targetSize === size.id ? "active" : ""}`,
                onClick: () => {
                  store.update((s) => {
                    s.plan.targetSize = size.id;
                  });
                  ctx.rerender();
                },
              },
              size.label,
            ),
          ),
        ),
        h(
          "p",
          { class: "hint" },
          `${TARGET_SIZES.find((t) => t.id === plan.targetSize)?.hint ?? ""}。只有三档，不做连续可调——换了档之后，之前的记录不能和新记录直接比。`,
        ),
        h(
          "label",
          { class: "switch-row" },
          h(
            "div",
            { class: "list-main" },
            h("strong", null, "回应音效"),
            h("span", { class: "muted" }, "默认关。CVI 孩子靠听会比靠看快，容易绕开视觉"),
          ),
          h("input", {
            type: "checkbox",
            checked: plan.sound,
            onChange: (e: Event) => {
              const on = (e.target as HTMLInputElement).checked;
              store.update((s) => {
                s.plan.sound = on;
              });
            },
          }),
        ),
      );

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
      audioCard,
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
