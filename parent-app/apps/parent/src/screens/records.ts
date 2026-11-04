import {
  averageOffset,
  latencyCv,
  latencyStats,
  longestStreak,
  percentile,
  summarize,
} from "@microstar/core-domain";
import { card, h } from "../lib/dom.js";
import { dateLabel, pct, secs, timeLabel } from "../lib/format.js";
import {
  MODE_NAME,
  STAGE_NAME,
  sessionsNewestFirst,
  store,
  targetSizeLabel,
  type SessionRecord,
} from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

interface Stats {
  rounds: number;
  hits: number;
  noResponse: number;
  aborted: number;
  rate: number | null;
  p50: number | null;
  p90: number | null;
  firstTouchP50: number | null;
  avgTouch: number | null;
  missCount: number;
  streak: { hit: number; noResponse: number };
  cv: number | null;
  offset: number | null;
  durationMs: number;
}

function statsOf(record: SessionRecord): Stats {
  const s = summarize(record.trials);
  const lat = latencyStats(record.trials);
  const firstTouches = record.trials
    .filter((t) => typeof t.tFirstTouch === "number" && t.tFirstTouch !== null)
    .map((t) => t.tFirstTouch! - t.tStim);
  const touchCounts = record.trials.map((t) => t.touchCount ?? 0);
  const misses = record.trials.reduce((sum, t) => sum + (t.missCount ?? 0), 0);
  const offset = averageOffset(record.trials);

  return {
    rounds: s.total,
    hits: s.hits,
    noResponse: s.noResponse,
    aborted: s.aborted,
    rate: s.rate,
    p50: lat.p50,
    p90: lat.p90,
    firstTouchP50: percentile(firstTouches, 50),
    avgTouch: touchCounts.length
      ? Math.round((touchCounts.reduce((a, b) => a + b, 0) / touchCounts.length) * 10) / 10
      : null,
    missCount: misses,
    durationMs: record.endedAt - record.startedAt,
    streak: longestStreak(record.trials),
    cv: latencyCv(record.trials),
    offset,
  };
}

const durationLabel = (ms: number): string => {
  const m = Math.round(ms / 60_000);
  if (m < 1) return "不到 1 分钟";
  if (m < 60) return `${m} 分钟`;
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分`;
};

/** 变异系数越小越稳。不做精确数值的误导，给区间和一句话 */
const CV_LABEL = (cv: number): string => {
  const pctText = `${Math.round(cv * 100)}%`;
  if (cv < 0.25) return `${pctText} · 很稳`;
  if (cv < 0.5) return `${pctText} · 还可以`;
  return `${pctText} · 忽快忽慢`;
};

export const render: ScreenRenderer = (ctx) => {
  const sessions = sessionsNewestFirst();
  const isDemo = store.state.isDemo;

  // 最近 7 天汇总
  const weekAgo = Date.now() - 7 * 86_400_000;
  const week = sessions.filter((s) => s.startedAt >= weekAgo);
  const weekMs = week.reduce((sum, s) => sum + (s.endedAt - s.startedAt), 0);
  const weekRounds = week.reduce((sum, s) => sum + s.trials.length, 0);

  const header = h(
    "header",
    { class: "session-head" },
    h("button", { class: "icon-btn", onClick: () => ctx.navigate("data") }, "‹"),
    h(
      "div",
      { class: "session-title" },
      h("strong", null, "训练记录"),
      h("span", null, `共 ${sessions.length} 次`),
    ),
    h("span", { class: "spacer" }),
  );

  if (sessions.length === 0) {
    return {
      el: h(
        "div",
        { class: "screen" },
        header,
        card(
          h("p", { class: "empty-title" }, "还没有训练记录"),
          h("p", { class: "muted" }, "带孩子练一次，这里就有数据了。"),
          h(
            "button",
            { class: "btn primary block", onClick: () => ctx.navigate("train") },
            "去训练",
          ),
        ),
      ),
    };
  }

  const summary = card(
    h(
      "div",
      { class: "stat-grid" },
      stat("最近 7 天", `${week.length} 次`),
      stat("练习时长", durationLabel(weekMs)),
      stat("回合数", String(weekRounds)),
    ),
  );

  const rows = sessions.map((record) => {
    const s = statsOf(record);
    const detail = h(
      "div",
      { class: "rec-detail" },
      kv("命中 / 无反应 / 中断", `${s.hits} / ${s.noResponse} / ${s.aborted}`),
      kv("P50 反应", secs(s.p50)),
      kv("P90 反应", secs(s.p90)),
      kv("首次触碰延迟", secs(s.firstTouchP50)),
      kv("每回合触碰次数", s.avgTouch === null ? "—" : String(s.avgTouch)),
      s.missCount > 0 ? kv("打偏次数", String(s.missCount)) : null,
      kv("最长连续命中", `${s.streak.hit} 回合`),
      s.streak.noResponse > 0 ? kv("最长连续无反应", `${s.streak.noResponse} 回合`) : null,
      s.cv === null ? null : kv("反应稳定性（变异系数）", CV_LABEL(s.cv)),
      s.offset === null
        ? null
        : kv("落点偏离", `${Math.round(s.offset * 100)}% 半径（越小越准）`),
      kv("目标大小", targetSizeLabel(record.targetSize)),
      kv("练习时长", durationLabel(s.durationMs)),
      kv("回应方式", MODE_NAME[store.state.plan.mode]),
      record.mode === "physical"
        ? kv("灯光", `亮度 ${record.brightness} · 亮灯 ${record.litMinutes} 分钟`)
        : null,
    );

    return h(
      "div",
      { class: "rec" },
      h(
        "button",
        {
          class: "rec-head",
          onClick: (e: Event) => {
            (e.currentTarget as HTMLElement)
              .closest(".rec")
              ?.classList.toggle("open");
          },
        },
        h(
          "div",
          { class: "rec-main" },
          h(
            "strong",
            null,
            record.levelName,
            record.origin === "game"
              ? h("span", { class: "tag-src" }, "儿童端")
              : h("span", { class: "tag-src tag-own" }, "实物"),
          ),
          h(
            "span",
            { class: "muted" },
            `${dateLabel(record.startedAt)} ${timeLabel(record.startedAt)} · ${durationLabel(s.durationMs)}`,
          ),
        ),
        h(
          "div",
          { class: "rec-side" },
          h("strong", null, pct(s.rate)),
          h("span", { class: "muted" }, `${s.rounds} 回合`),
        ),
      ),
      detail,
    );
  });

  return {
    el: h(
      "div",
      { class: "screen" },
      header,
      isDemo ? h("div", { class: "demo-banner" }, "以下是演示数据，不是真实训练记录") : null,
      summary,
      h("div", { class: "rec-list" }, ...rows),
    ),
  };
};

function stat(label: string, value: string): HTMLElement {
  return h("div", { class: "stat" }, h("strong", null, value), h("span", null, label));
}

function kv(label: string, value: string): HTMLElement {
  return h(
    "div",
    { class: "kv" },
    h("span", { class: "muted" }, label),
    h("strong", null, value),
  );
}
