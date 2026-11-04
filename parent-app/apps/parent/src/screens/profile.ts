import { card, h } from "../lib/dom.js";
import { ageLabel } from "../lib/format.js";
import {
  MODE_HINT,
  MODE_NAME,
  store,
  type AccessMode,
  type FieldBias,
  type HandFunction,
  type PhaseId,
} from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

const HANDS: [HandFunction, string][] = [
  ["fist", "握拳为主"],
  ["spastic", "有痉挛，能碰但不精准"],
  ["canGrasp", "可以抓握"],
];

const BIAS: [FieldBias, string][] = [
  ["left", "偏左"],
  ["right", "偏右"],
  ["up", "偏上"],
  ["down", "偏下"],
  ["center", "居中"],
];

const PHASES: [PhaseId, string][] = [
  [1, "发现目标"],
  [2, "认识物品"],
  [3, "生活探索"],
];

const MODES: AccessMode[] = ["slap", "precise", "dwell"];

export const render: ScreenRenderer = () => {
  const state = store.state;
  const child = state.child;

  /**
   * 改动只写进 store，不重绘整页。
   * 重绘会让页面跳回最上面，勾一个框跳一次，很难受。
   */
  const update = (patch: Partial<typeof child>): void => {
    store.update((s) => {
      Object.assign(s.child, patch);
    });
  };

  const profileCard = card(
    h("div", { class: "card-head" }, h("h2", null, "孩子"), h("span", { class: "card-hint" }, ageLabel(child.birthDate))),
    field(
      "小名",
      h("input", {
        type: "text",
        value: child.nickname,
        onChange: (e: Event) => update({ nickname: (e.target as HTMLInputElement).value || "小朋友" }),
      }),
    ),
    field(
      "生日",
      h("input", {
        type: "date",
        value: child.birthDate,
        onChange: (e: Event) => update({ birthDate: (e.target as HTMLInputElement).value }),
      }),
    ),
    field("阶段", select(PHASES.map(([v, t]) => [String(v), t]), String(child.cviPhase), (v) => update({ cviPhase: Number(v) as PhaseId }))),
    field("手部", select(HANDS.map(([v, t]) => [v, t]), child.handFunction, (v) => update({ handFunction: v as HandFunction }))),
    field("爱看哪边", select(BIAS.map(([v, t]) => [v, t]), child.fieldBias, (v) => update({ fieldBias: v as FieldBias }))),
  );

  const safetyCard = card(
    h("div", { class: "card-head" }, h("h2", null, "安全")),
    toggle("怕闪", "关掉闪烁，亮度调低", child.photosensitive, (v) => update({ photosensitive: v })),
    toggle("怕亮", "亮度再压低一档", child.highLightSensitivity, (v) => update({ highLightSensitivity: v })),
    toggle("不喜欢震动", "提示灯不震", child.tactileSensitive, (v) => update({ tactileSensitive: v })),
  );

  const modeCard = card(
    h("div", { class: "card-head" }, h("h2", null, "默认回应方式")),
    h(
      "div",
      { class: "mode-row" },
      ...MODES.map((m) =>
        h(
          "button",
          {
            class: `mode-chip ${state.plan.mode === m ? "selected" : ""}`,
            onClick: (e: Event) => {
              const row = (e.currentTarget as HTMLElement).parentElement;
              row?.querySelectorAll(".mode-chip").forEach((el) => el.classList.remove("selected"));
              (e.currentTarget as HTMLElement).classList.add("selected");
              store.update((s) => {
                s.plan.mode = m;
              });
              const hint = row?.parentElement?.querySelector(".hint");
              if (hint) hint.textContent = MODE_HINT[m];
            },
          },
          MODE_NAME[m],
        ),
      ),
    ),
    h("p", { class: "hint" }, MODE_HINT[state.plan.mode]),
  );

  const dataCard = card(
    h("div", { class: "card-head" }, h("h2", null, "数据")),
    h("p", { class: "hint" }, "训练记录只存在这台设备上。"),
    h(
      "button",
      {
        class: "btn ghost block",
        onClick: () => {
          const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `微动星瞳-全部数据-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
        },
      },
      "导出全部数据",
    ),
    h(
      "button",
      {
        class: "btn ghost block danger",
        onClick: () => {
          if (window.confirm("删除全部数据？包括孩子档案和训练记录。")) store.reset();
        },
      },
      "清除全部数据",
    ),
  );

  return {
    el: h(
      "div",
      { class: "screen" },
      h("div", { class: "page-head" }, h("div", null, h("h1", null, "我的"))),
      profileCard,
      safetyCard,
      modeCard,
      dataCard,
    ),
  };
};

function field(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function select(options: [string, string][], value: string, onChange: (value: string) => void): HTMLSelectElement {
  const el = h("select", {
    onChange: (e: Event) => onChange((e.target as HTMLSelectElement).value),
  }) as HTMLSelectElement;
  for (const [v, text] of options) {
    const option = document.createElement("option");
    option.value = v;
    option.textContent = text;
    if (v === value) option.selected = true;
    el.append(option);
  }
  return el;
}

function toggle(title: string, sub: string, value: boolean, onChange: (value: boolean) => void): HTMLElement {
  return h(
    "label",
    { class: "switch-row" },
    h("div", { class: "list-main" }, h("strong", null, title), h("span", { class: "muted" }, sub)),
    h("input", {
      type: "checkbox",
      checked: value,
      onChange: (e: Event) => onChange((e.target as HTMLInputElement).checked),
    }),
  );
}
