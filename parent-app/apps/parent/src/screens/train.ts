import { summarize } from "@microstar/core-domain";
import { card, h } from "../lib/dom.js";
import { pct, secs } from "../lib/format.js";
import { device } from "../lib/device.js";
import {
  LEVELS,
  MODE_HINT,
  MODE_NAME,
  PHASES,
  PHYSICAL_LEVEL,
  STAGE_NAME,
  lastSession,
  levelById,
  levelsOf,
  store,
  todaySessions,
  type StageId,
} from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

const TABS: { stage: StageId; name: string }[] = [
  ...PHASES.map((p) => ({ stage: p.id as StageId, name: p.name })),
  { stage: 4, name: "实物" },
];

export const render: ScreenRenderer = (ctx) => {
  const state = store.state;
  const plan = state.plan;
  const isPhysical = plan.stage === 4;
  const level = levelById(plan.levelId) ?? LEVELS[0]!;
  const today = todaySessions();
  const last = lastSession();
  const lastSummary = last ? summarize(last.trials) : null;

  // 顶部阶段切换
  const tabs = h(
    "div",
    { class: "phase-tabs" },
    ...TABS.map((tab) =>
      h(
        "button",
        {
          class: `phase-tab ${plan.stage === tab.stage ? "active" : ""}`,
          onClick: () => {
            if (plan.stage === tab.stage) return;
            const fallback =
              tab.stage === 4 ? PHYSICAL_LEVEL.id : levelsOf(tab.stage as 1 | 2 | 3)[0]!.id;
            store.update((s) => {
              s.plan.stage = tab.stage;
              s.plan.levelId = fallback;
            });
            ctx.rerender();
          },
        },
        h("span", { class: "phase-tab-name" }, tab.name),
        h(
          "span",
          { class: "phase-tab-count" },
          tab.stage === 4 ? "家长" : `${levelsOf(tab.stage as 1 | 2 | 3).length} 关`,
        ),
      ),
    ),
  );

  // 关卡列表
  const levelList = isPhysical
    ? h(
        "div",
        { class: "level-list" },
        h(
          "div",
          { class: "level-card selected" },
          h("span", { class: "level-dot", style: { background: PHYSICAL_LEVEL.color } }),
          h(
            "div",
            { class: "level-text" },
            h("strong", null, PHYSICAL_LEVEL.name),
            h("span", null, PHYSICAL_LEVEL.action),
          ),
          h("span", { class: "level-flag" }, "用灯"),
        ),
      )
    : h(
        "div",
        { class: "level-list" },
        ...levelsOf(plan.stage as 1 | 2 | 3).map((lv) =>
          h(
            "button",
            {
              class: `level-card ${lv.id === plan.levelId ? "selected" : ""}`,
              onClick: () => {
                store.update((s) => {
                  s.plan.levelId = lv.id;
                });
                ctx.rerender();
              },
            },
            h("span", { class: "level-dot", style: { background: lv.color } }),
            h(
              "div",
              { class: "level-text" },
              h("strong", null, lv.name),
              h("span", null, lv.target),
            ),
          ),
        ),
      );

  // 今日计划
  const startText = isPhysical
    ? device.isConnected
      ? "开始实物训练"
      : "连接提示灯并开始"
    : "开始训练";

  const planCard = card(
    h(
      "div",
      { class: "plan-head" },
      h("strong", null, isPhysical ? PHYSICAL_LEVEL.name : level.name),
      h("span", { class: "muted" }, `${plan.maxMinutes} 分钟`),
    ),
    h(
      "div",
      { class: "plan-meta" },
      h("span", null, MODE_NAME[plan.mode]),
      h("span", null, MODE_HINT[plan.mode]),
    ),
    h(
      "button",
      {
        class: "btn primary block lg",
        onClick: () => startTraining(ctx),
      },
      startText,
    ),
    h("button", { class: "link-btn", onClick: () => ctx.navigate("plan") }, "调整参数 ›"),
  );

  // 今天的状态
  const status = h(
    "div",
    { class: "status-strip" },
    h(
      "span",
      { class: `pill ${today.length > 0 ? "ok" : ""}` },
      today.length > 0 ? `今天 ${today.length} 次` : "今天还没练",
    ),
    lastSummary
      ? h("span", { class: "muted" }, `上次 ${pct(lastSummary.rate)} · ${secs(lastSummary.p50)}`)
      : h("span", { class: "muted" }, "还没有记录"),
  );

  return {
    el: h(
      "div",
      { class: "screen" },
      h(
        "div",
        { class: "page-head" },
        h("div", null, h("h1", null, STAGE_NAME[plan.stage]), h("p", { class: "sub" }, "选一关就能开始")),
      ),
      status,
      tabs,
      levelList,
      planCard,
    ),
  };
};

/**
 * 「开始训练」。
 *
 * 1–3 阶在真实演示里要交给儿童模式去打，家长端不自己玩。
 * 家长端是弹窗，和儿童端同源，所以用一条 postMessage 把关卡号递过去；
 * 儿童端收到后会关掉弹窗并直接进那一关。
 *
 * 单独打开家长端（没有外层页面）时，退回内置的全屏训练场，方便开发调试。
 */
function startTraining(ctx: { navigate: (p: string) => void }): void {
  const plan = store.state.plan;

  // 第 4 阶是实物训练，儿童端没有对应关卡，留在家长端
  if (plan.stage === 4) {
    ctx.navigate("physical");
    return;
  }

  const embedded = window.self !== window.top;
  if (!embedded) {
    ctx.navigate("child");
    return;
  }

  const list = levelsOf(plan.stage as 1 | 2 | 3);
  const index = Math.max(0, list.findIndex((l) => l.id === plan.levelId));

  window.parent.postMessage(
    {
      type: "microstar:start-level",
      phase: plan.stage,
      index,
      mode: plan.mode,
      // 判定窗口交给儿童端：到时间没有回应就记一次「无反应」
      timeoutMs: plan.judgeWindowMs,
      sound: plan.sound,
      size: plan.targetSize,
    },
    location.origin,
  );

  // 儿童端没接住时（比如它还没更新），800ms 后仍然留在弹窗里，就退回内置训练场
  window.setTimeout(() => {
    if (document.body.isConnected) ctx.navigate("child");
  }, 800);
}