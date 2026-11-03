import { card, cardTitle, h } from "../lib/dom.js";
import { ageLabel } from "../lib/format.js";
import { store, type AccessMode, type CviPhase, type FieldBias, type HandFunction } from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

const HANDS: [HandFunction, string][] = [
  ["fist", "握拳为主，不能精确张手"],
  ["spastic", "有痉挛，能触碰但不精准"],
  ["canGrasp", "可以抓握"],
];

const BIAS: [FieldBias, string][] = [
  ["left", "偏好左侧"],
  ["right", "偏好右侧"],
  ["up", "偏好上方"],
  ["down", "偏好下方"],
  ["center", "居中注视"],
];

const PHASES: [CviPhase, string][] = [
  [1, "Phase I · 建立视觉注意（1–3 分）"],
  [2, "Phase II · 视觉联动功能（4–7 分）"],
  [3, "Phase III · 复杂背景中找目标（8–10 分）"],
];

const ACCESS: [AccessMode, string][] = [
  ["anywhereTap", "全屏拍击"],
  ["hover", "接触悬停"],
  ["targetTap", "精准触碰"],
];

export const render: ScreenRenderer = (ctx) => {
  const child = store.state.child;
  const update = (patch: Partial<typeof child>): void => {
    store.update((s) => {
      Object.assign(s.child, patch);
    });
    ctx.rerender();
  };

  const profileCard = card(
    cardTitle("孩子档案", `${ageLabel(child.birthDate)}`),
    field("昵称", h("input", {
      type: "text",
      value: child.nickname,
      onChange: (e: Event) => update({ nickname: (e.target as HTMLInputElement).value || "小朋友" }),
    })),
    field("生日", h("input", {
      type: "date",
      value: child.birthDate,
      onChange: (e: Event) => update({ birthDate: (e.target as HTMLInputElement).value }),
    })),
    field(
      "CVI Range 阶段",
      select(PHASES.map(([v, t]) => [String(v), t]), String(child.cviPhase), (v) =>
        update({ cviPhase: Number(v) as CviPhase }),
      ),
    ),
    field(
      "手部功能",
      select(HANDS.map(([v, t]) => [v, t]), child.handFunction, (v) =>
        update({ handFunction: v as HandFunction }),
      ),
    ),
    field(
      "视野偏好",
      select(BIAS.map(([v, t]) => [v, t]), child.fieldBias, (v) =>
        update({ fieldBias: v as FieldBias }),
      ),
    ),
    h("p", { class: "hint" }, "视野偏好会影响目标默认出现在屏幕的位置，也会进视野热力图。"),
  );

  const safetyCard = card(
    cardTitle("安全标记", "会直接改变灯光"),
    toggle(
      "有光敏癫痫史",
      "禁用闪烁，亮度上限压到 64（约 25%）",
      child.photosensitive,
      (v) => update({ photosensitive: v }),
    ),
    toggle(
      "对强光敏感",
      "亮度上限压到 96",
      child.highLightSensitivity,
      (v) => update({ highLightSensitivity: v }),
    ),
    toggle(
      "触觉敏感（抗拒震动）",
      "所有指令带上震动抑制位，马达不响",
      child.tactileSensitive,
      (v) => update({ tactileSensitive: v }),
    ),
    h("p", { class: "hint" }, "这几条是安全护栏，挡在指令下发之前，不是仅供提示。"),
  );

  const accessCard = card(
    cardTitle("交互方式"),
    field(
      "默认通道",
      select(ACCESS.map(([v, t]) => [v, t]), store.state.plan.accessMode, (v) => {
        store.update((s) => {
          s.plan.accessMode = v as AccessMode;
        });
        ctx.rerender();
      }),
    ),
    h("p", { class: "hint" }, "重度痉挛的孩子用全屏拍击：手掌、拳头、手背任意触碰都算命中。"),
  );

  const privacyCard = card(
    cardTitle("隐私与数据"),
    h("p", { class: "muted" }, "训练数据只存在这台设备上。照片提纯（P1）默认也不上传。"),
    h(
      "div",
      { class: "row" },
      h(
        "button",
        {
          class: "btn ghost grow",
          onClick: () => {
            const blob = new Blob([JSON.stringify(store.state, null, 2)], {
              type: "application/json",
            });
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
          class: "btn ghost grow danger",
          onClick: () => {
            if (window.confirm("删除全部数据？包括孩子档案和所有训练记录。")) {
              store.reset();
              ctx.rerender();
            }
          },
        },
        "清除全部数据",
      ),
    ),
  );

  const aboutCard = card(
    cardTitle("关于"),
    h("p", { class: "muted" }, "微动星瞳 · 家长端 v0.2（P0 骨架）"),
    h(
      "p",
      { class: "hint" },
      "本产品定位为轻医疗辅具 / 特教认知教具，不用于诊断或治疗。所有建议只描述观察到的变化。",
    ),
  );

  return {
    el: h(
      "div",
      { class: "screen" },
      h("div", { class: "page-head" }, h("div", null, h("h1", null, "我的"), h("p", { class: "sub" }, "档案越准，建议越准"))),
      profileCard,
      safetyCard,
      accessCard,
      privacyCard,
      aboutCard,
    ),
  };
};

function field(label: string, control: HTMLElement): HTMLElement {
  return h("label", { class: "field" }, h("span", null, label), control);
}

function select(
  options: [string, string][],
  value: string,
  onChange: (value: string) => void,
): HTMLSelectElement {
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

function toggle(
  title: string,
  sub: string,
  value: boolean,
  onChange: (value: boolean) => void,
): HTMLElement {
  const input = h("input", {
    type: "checkbox",
    checked: value,
    onChange: (e: Event) => onChange((e.target as HTMLInputElement).checked),
  }) as HTMLInputElement;

  return h(
    "label",
    { class: "switch-row" },
    h("div", { class: "list-main" }, h("strong", null, title), h("span", { class: "muted" }, sub)),
    input,
  );
}
