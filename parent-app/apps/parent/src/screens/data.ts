import { hitRate, latencyStats, summarize } from "@microstar/core-domain";
import { buildAdvice } from "../lib/advice.js";
import { lineChart } from "../lib/chart.js";
import { card, cardTitle, h } from "../lib/dom.js";
import { dateLabel, pct, secs } from "../lib/format.js";
import { store, todaySessions, STAGE_META } from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

export const render: ScreenRenderer = (ctx) => {
  const state = store.state;
  const sessions = [...state.sessions].sort((a, b) => a.startedAt - b.startedAt);
  const recent = sessions.slice(-8);
  const allTrials = sessions.flatMap((s) => s.trials);

  const summary = summarize(allTrials);
  const latency = latencyStats(allTrials);
  const today = todaySessions();
  const advice = buildAdvice().slice(0, 2);

  const chart = lineChart({
    values: recent.map((s) => hitRate(s.trials).rate ?? 0),
    labels: recent.map((s) => dateLabel(s.startedAt)),
    height: 110,
  });

  const status = h(
    "div",
    { class: "status-strip" },
    h(
      "span",
      { class: `pill ${today.length > 0 ? "ok" : ""}` },
      today.length > 0 ? `今天练了 ${today.length} 次` : "今天还没练",
    ),
    h("span", { class: "muted" }, `共 ${sessions.length} 次 · 第 ${state.plan.stage} 阶`),
  );

  const trend = card(
    cardTitle("命中率", `最近 ${recent.length} 次`),
    h("div", { class: "chart-wrap" }, chart),
  );

  const metrics = h(
    "div",
    { class: "stat-grid" },
    stat("命中率", pct(summary.rate)),
    stat("P50 反应", secs(latency.p50)),
    stat("有效回合", String(summary.hits + summary.noResponse)),
  );

  const adviceCards = advice.map((item) =>
    card(
      h(
        "div",
        { class: `advice tone-${item.tone}` },
        h("h3", null, item.title),
        h("p", null, item.body),
        item.action
          ? h(
              "button",
              {
                class: "btn ghost",
                onClick: () => {
                  item.action?.apply();
                  ctx.rerender();
                },
              },
              item.action.label,
            )
          : null,
      ),
    ),
  );

  const entries = card(
    cardTitle("更多"),
    entry("调整计划", planSummary(), () => ctx.navigate("plan")),
    entry("导出报告", "CSV · PDF 在 P1", () => downloadCsv(sessions)),
    entry("全部数据", `${sessions.length} 次训练记录`, () => ctx.navigate("profile")),
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
          h("h1", null, "数据"),
          h("p", { class: "sub" }, `${STAGE_META[state.plan.stage].title} · ${STAGE_META[state.plan.stage].phase}`),
        ),
      ),
      status,
      trend,
      metrics,
      ...(adviceCards.length > 0
        ? [h("div", { class: "section-head" }, h("h2", null, "建议")), ...adviceCards]
        : []),
      entries,
    ),
  };
};

function stat(label: string, value: string): HTMLElement {
  return h("div", { class: "stat" }, h("strong", null, value), h("span", null, label));
}

function entry(title: string, sub: string, onClick: () => void): HTMLElement {
  return h(
    "button",
    { class: "list-row entry", onClick },
    h("div", { class: "list-main" }, h("strong", null, title), h("span", { class: "muted" }, sub)),
    h("span", { class: "chevron" }, "›"),
  );
}

function planSummary(): string {
  const plan = store.state.plan;
  if (plan.stage === 4) {
    return `亮 ${plan.loop.lightOnMs / 1000}s · 间隔 ${plan.loop.gapMs / 1000}s · ${plan.loop.rounds} 轮`;
  }
  return `判定窗口 ${plan.judgeWindowMs / 1000} 秒 · 单次 ${plan.maxMinutes} 分钟`;
}

function downloadCsv(sessions: { startedAt: number; stage: number; trials: unknown[] }[]): void {
  const rows: string[] = ["会话时间,阶段,回合数,命中,无反应,命中率,P50(ms),P90(ms)"];
  for (const session of sessions) {
    const trials = session.trials as Parameters<typeof hitRate>[0];
    const s = summarize(trials);
    const lat = latencyStats(trials);
    rows.push(
      [
        new Date(session.startedAt).toISOString(),
        session.stage,
        s.total,
        s.hits,
        s.noResponse,
        s.rate === null ? "" : (s.rate * 100).toFixed(1),
        lat.p50?.toFixed(0) ?? "",
        lat.p90?.toFixed(0) ?? "",
      ].join(","),
    );
  }

  const blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `微动星瞳-训练数据-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
