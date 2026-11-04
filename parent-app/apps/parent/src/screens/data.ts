import { hitRate, latencyStats, summarize } from "@microstar/core-domain";
import { lineChart } from "../lib/chart.js";
import { card, h } from "../lib/dom.js";
import { dateLabel, pct, secs } from "../lib/format.js";
import { STAGE_NAME, store } from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

export const render: ScreenRenderer = (ctx) => {
  const state = store.state;
  const sessions = [...state.sessions].sort((a, b) => a.startedAt - b.startedAt);
  const recent = sessions.slice(-8);
  const allTrials = sessions.flatMap((s) => s.trials);
  const summary = summarize(allTrials);
  const latency = latencyStats(allTrials);

  // 空状态：没有任何记录时不伪造数据
  if (sessions.length === 0) {
    return {
      el: h(
        "div",
        { class: "screen" },
        h("div", { class: "page-head" }, h("div", null, h("h1", null, "数据"))),
        card(
          h("p", { class: "empty-title" }, "还没有数据"),
          h("p", { class: "muted" }, "练一次之后，这里会显示趋势和指标。"),
          h("button", { class: "btn primary block", onClick: () => ctx.navigate("train") }, "去训练"),
          h(
            "button",
            { class: "btn ghost block", onClick: () => store.loadDemo() },
            "载入演示数据（仅用于演示）",
          ),
        ),
      ),
    };
  }

  const chart = lineChart({
    values: recent.map((s) => hitRate(s.trials).rate ?? 0),
    labels: recent.map((s) => dateLabel(s.startedAt)),
    height: 110,
  });

  const trend = card(
    h(
      "div",
      { class: "card-head" },
      h("h2", null, "命中率"),
      h("span", { class: "card-hint" }, `最近 ${recent.length} 次`),
    ),
    h("div", { class: "chart-wrap" }, chart),
  );

  const metrics = h(
    "div",
    { class: "stat-grid" },
    stat("命中率", pct(summary.rate)),
    stat("P50 反应", secs(latency.p50)),
    stat("有效回合", String(summary.hits + summary.noResponse)),
  );

  const entries = h(
    "div",
    { class: "entries" },
    entry("训练记录", `每次的详细数据 · ${sessions.length} 次`, () => ctx.navigate("records")),
    entry("调整参数", `${STAGE_NAME[state.plan.stage]} · ${state.plan.maxMinutes} 分钟`, () =>
      ctx.navigate("plan"),
    ),
    entry("导出 CSV", "原始回合数据", () => downloadCsv(sessions)),
    state.isDemo ? entry("清除演示数据", "回到真实记录", () => store.clearDemo()) : null,
  );

  return {
    el: h(
      "div",
      { class: "screen" },
      h("div", { class: "page-head" }, h("div", null, h("h1", null, "数据"))),
      state.isDemo
        ? h("div", { class: "demo-banner" }, "演示数据：不是真实训练记录，不能用于评估")
        : null,
      trend,
      metrics,
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
    { class: "entry", onClick },
    h("div", { class: "entry-main" }, h("strong", null, title), h("span", { class: "muted" }, sub)),
    h("span", { class: "chevron" }, "›"),
  );
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
