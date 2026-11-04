import {gamePanel} from '../lib/game-bridge.js';
import { summarize } from "@microstar/core-domain";
import { card, cardTitle, h } from "../lib/dom.js";
import { pct, secs } from "../lib/format.js";
import { device } from "../lib/device.js";
import {
  assetsForStage,
  STAGE_META,
  stageAssets,
  store,
  todaySessions,
  type Stage,
} from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

const STAGES: Stage[] = [1, 2, 3, 4];

export const render: ScreenRenderer = (ctx) => {
  const state = store.state;
  const plan = state.plan;
  const meta = STAGE_META[plan.stage];
  const assets = assetsForStage(plan.stage);
  const selected = new Set(stageAssets().map((a) => a.id));
  const today = todaySessions();
  const lastTrial = [...state.sessions].sort((a, b) => b.startedAt - a.startedAt)[0];
  const lastSummary = lastTrial ? summarize(lastTrial.trials) : null;
  const isPhysical = plan.stage === 4;

  // ---- 顶部状态条（原「今日」Tab 压缩成一行）
  const statusStrip = h(
    "div",
    { class: "status-strip" },
    h(
      "span",
      { class: `pill ${today.length > 0 ? "ok" : ""}` },
      today.length > 0 ? `今天练了 ${today.length} 次` : "今天还没练",
    ),
    lastSummary
      ? h(
          "span",
          { class: "muted" },
          `上次 ${pct(lastSummary.rate)} · P50 ${secs(lastSummary.p50)}`,
        )
      : h("span", { class: "muted" }, "还没有训练记录"),
  );

  // ---- 四阶轨道
  const rail = h(
    "div",
    { class: "rail" },
    ...STAGES.map((stage) => {
      const m = STAGE_META[stage];
      const active = plan.stage === stage;
      const done = stage < plan.stage;
      return h(
        "button",
        {
          class: `rail-item ${active ? "active" : ""} ${done ? "done" : ""}`,
          onClick: () => {
            if (stage === plan.stage) return;
            store.update((s) => {
              s.plan.stage = stage;
              s.plan.assetIds = assetsForStage(stage).slice(0, 2).map((a) => a.id);
            });
            ctx.rerender();
          },
        },
        h("span", { class: "rail-index" }, done ? "✓" : String(stage)),
        h("span", { class: "rail-title" }, m.title),
        h("span", { class: "rail-sub" }, m.phase),
      );
    }),
  );

  // ---- 本阶素材
  const assetGrid = h(
    "div",
    { class: "asset-grid" },
    ...assets.map((asset) => {
      const on = selected.has(asset.id);
      return h(
        "button",
        {
          class: `asset ${on ? "on" : ""}`,
          onClick: () => {
            store.update((s) => {
              const next = new Set(s.plan.assetIds);
              if (next.has(asset.id)) next.delete(asset.id);
              else next.add(asset.id);
              if (next.size === 0) next.add(asset.id);
              s.plan.assetIds = [...next];
            });
            ctx.rerender();
          },
        },
        h("span", {
          class: `asset-thumb ${asset.kind}`,
          style: { background: asset.color },
        }),
        h("span", { class: "asset-name" }, asset.name),
        on ? h("span", { class: "asset-check" }, "✓") : null,
      );
    }),
  );

  // ---- 今日计划 + 开始
  const current = stageAssets();
  const startLabel = isPhysical
    ? device.isConnected
      ? "开始训练"
      : "连接提示灯并开始"
    : "开始训练";

  const planCard = card(
    cardTitle("今天的训练", `${meta.title} · ${meta.phase}`),
    h(
      "div",
      { class: "list" },
      kv("素材", current.map((a) => a.name).join("、")),
      isPhysical
        ? kv(
            "回路",
            `亮 ${plan.loop.lightOnMs / 1000}s · 间隔 ${plan.loop.gapMs / 1000}s · ${plan.loop.rounds} 轮`,
          )
        : kv("交互方式", accessLabel(plan.accessMode)),
      kv("判定窗口", `${plan.judgeWindowMs / 1000} 秒`),
      kv("单次上限", `${plan.maxMinutes} 分钟`),
      isPhysical ? kv("灯光", `${presetLabel(plan.preset)} · 亮度 ${plan.brightness}`) : null,
    ),
    h(
      "button",
      {
        class: "btn primary block lg",
        onClick: () => ctx.navigate(isPhysical ? "physical" : "child"),
      },
      startLabel,
    ),
    h(
      "p",
      { class: "hint" },
      isPhysical
        ? device.isConnected
          ? "灯已连接。点开始后会自动循环，你不用一直拿着 iPad。"
          : "第 4 阶需要提示灯。点上面的按钮会先连接、试亮一次，再开始。"
        : "前 3 阶只用平板，不需要提示灯。",
    ),
    h(
      "button",
      { class: "link-btn", onClick: () => ctx.navigate("plan") },
      "调整这一阶的参数 ›",
    ),
  );

  return {
    el: h(
      "div",
      { class: "screen" },
      h(
        "div",
        { class: "page-head" },
        h(
          "div",
          null,
          h("h1", null, `${state.child.nickname} · 第 ${plan.stage} 阶`),
          h("p", { class: "sub" }, meta.subtitle),
        ),
      ),
      statusStrip,
      rail,
      assetGrid,
      gamePanel(),
      planCard,
    ),
  };
};

function kv(label: string, value: string): HTMLElement {
  return h("div", { class: "kv" }, h("span", { class: "muted" }, label), h("strong", null, value));
}

function accessLabel(mode: string): string {
  switch (mode) {
    case "anywhereTap":
      return "全屏拍击";
    case "hover":
      return "接触悬停 1.2 秒";
    case "targetTap":
      return "精准触碰";
    default:
      return mode;
  }
}

function presetLabel(preset: string): string {
  switch (preset) {
    case "red":
      return "红";
    case "yellow":
      return "黄";
    case "warmWhite":
      return "暖白";
    case "deepBlue":
      return "蓝";
    default:
      return preset;
  }
}
