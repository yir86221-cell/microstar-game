import { AlertMode } from "@microstar/core-protocol";
import { summarize, TrialRunner } from "@microstar/core-domain";
import { h } from "../lib/dom.js";
import { device } from "../lib/device.js";
import { pct, secs } from "../lib/format.js";
import { stageAssets, store, type SessionRecord } from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * 实物训练台（第 4 阶，家长持机）。
 *
 * 流程：连接 → 试亮自检 → 自动回路 → 结算（再练一次 / 今天到此为止）。
 * 家长点一次开始之后全程不用再点。
 *
 * 最容易做错的是**门控**：MOTION 只在状态变化时推送，
 * 灯还拿在手上就开下一轮，孩子下一次拿起根本不会触发通知。
 */
export const render: ScreenRenderer = (ctx) => {
  const plan = store.state.plan;
  const loop = plan.loop;
  const assets = stageAssets();
  const runner = new TrialRunner({ judgeWindowMs: loop.lightOnMs });

  let stopped = false;
  let running = false;
  let litMs = 0;
  let sessionStart = Date.now();
  let roundIndex = 0;

  const titleEl = h("div", { class: "session-phase" }, "正在连接提示灯…");
  const subEl = h("p", { class: "session-hint" }, "第一次连接可能需要几秒");
  const counterEl = h("div", { class: "session-stats" });
  const gateEl = h("div", { class: "gate-banner" });
  const actionRow = h("div", { class: "row" });
  const resultBox = h("div", { class: "result-box" });
  const body = h("div", { class: "session-body" }, titleEl, subEl, gateEl, counterEl, actionRow, resultBox);

  function renderStats(): void {
    const s = summarize(runner.trials());
    counterEl.replaceChildren(
      chip("轮次", `${Math.min(roundIndex, loop.rounds)}/${loop.rounds}`),
      chip("命中", String(s.hits)),
      chip("命中率", pct(s.rate)),
      chip("P50", secs(s.p50)),
    );
  }

  function renderGate(): void {
    const held = runner.isDeviceHeld;
    gateEl.className = `gate-banner ${held ? "blocked" : ""}`;
    gateEl.textContent = held ? "孩子还拿着灯 · 等放下才会开始下一轮" : "";
  }

  // ---- MOTION：拿起即命中
  const offMotion = device.onMotion((event) => {
    runner.onMotion({ moving: event.moving }, performance.now());
    if (event.moving && runner.phase === "presenting") {
      runner.hit(performance.now(), "motion");
    }
    renderGate();
    renderStats();
  });

  const offState = device.onState(() => {
    if (running && !device.isConnected) {
      stopped = true;
      void finish("disconnected");
    }
  });

  /** 等设备放下。超过 ms 返回 false，本轮记 abort。 */
  async function waitRelease(ms: number): Promise<boolean> {
    const started = Date.now();
    while (runner.isDeviceHeld) {
      if (stopped) return false;
      if (Date.now() - started > ms) return false;
      await sleep(150);
    }
    return true;
  }

  async function runLoop(): Promise<void> {
    running = true;
    sessionStart = Date.now();
    roundIndex = 0;
    resultBox.replaceChildren();

    for (let i = 0; i < loop.rounds; i += 1) {
      if (stopped) break;

      // 门控：灯还拿在手上就不能开下一轮
      const released = await waitRelease(loop.releaseTimeoutMs);
      if (stopped) break;
      if (!released) {
        runner.start(performance.now(), { force: true });
        runner.abort(performance.now(), "stillHeld");
        roundIndex = i + 1;
        renderStats();
        continue;
      }

      const started = runner.start(performance.now());
      if (!started.ok) {
        roundIndex = i + 1;
        continue;
      }
      roundIndex = i + 1;
      renderStats();

      const litAt = Date.now();
      await device.writeLight({ mode: AlertMode.Steady });
      titleEl.textContent = "灯亮着，等孩子伸手";
      subEl.textContent = `第 ${roundIndex} 轮 · 亮 ${loop.lightOnMs / 1000} 秒`;

      await sleep(loop.lightOnMs);
      litMs += Date.now() - litAt;

      if (!stopped && runner.phase === "presenting") {
        runner.timeout(performance.now());
      }
      await device.turnOff();
      renderStats();

      if (stopped) break;
      await sleep(loop.gapMs);
    }

    running = false;
    if (!stopped) await finish("rounds_done");
  }

  async function finish(reason: string): Promise<void> {
    stopped = true;
    running = false;
    await device.turnOff();

    const trials = [...runner.trials()];
    const litMinutes = Math.round((litMs / 60_000) * 10) / 10;

    if (trials.length > 0) {
      const record: SessionRecord = {
        id: `s-${Date.now()}`,
        startedAt: sessionStart,
        endedAt: Date.now(),
        stage: 4,
        mode: "physical",
        trials,
        litMinutes,
        brightness: plan.brightness,
      };
      store.update((s) => {
        s.sessions.push(record);
        s.usage.push({ litMinutes, brightness: plan.brightness });
        if (s.usage.length > 40) s.usage = s.usage.slice(-40);
      });
    }

    const s = summarize(trials);
    titleEl.textContent = "本次结束";
    subEl.textContent = reason === "disconnected" ? "设备断开了，本次已经记录。" : "";
    gateEl.textContent = "";
    actionRow.replaceChildren();

    resultBox.replaceChildren(
      h(
        "div",
        { class: "stat-grid" },
        stat("命中率", pct(s.rate)),
        stat("P50 反应", secs(s.p50)),
        stat("回合", String(s.total)),
      ),
      h(
        "div",
        { class: "row" },
        h(
          "button",
          {
            class: "btn ghost grow",
            onClick: () => {
              runner.reset();
              litMs = 0;
              stopped = false;
              void runLoop();
            },
          },
          "再练一次",
        ),
        h(
          "button",
          {
            class: "btn primary grow",
            onClick: async () => {
              await device.disconnect();
              ctx.navigate("data");
            },
          },
          "今天到此为止",
        ),
      ),
      h("p", { class: "hint" }, "选「今天到此为止」会断开提示灯，并顺手提醒充电。"),
    );
    renderStats();
  }

  async function boot(): Promise<void> {
    if (!device.isConnected) {
      await device.connect();
    }
    if (!device.isConnected) {
      titleEl.textContent = "连不上提示灯";
      subEl.textContent = "先插上充电 10 分钟再试 · 确认没在充电 · 靠近一点";
      actionRow.replaceChildren(
        h("button", { class: "btn ghost grow", onClick: () => location.reload() }, "重试"),
        h("button", { class: "btn ghost grow", onClick: () => ctx.navigate("train") }, "返回"),
      );
      return;
    }

    await device.selfTest();
    titleEl.textContent = `准备开始 · ${assets.map((a) => a.name).join(" / ") || "实物"}`;
    subEl.textContent = `共 ${loop.rounds} 轮，每轮亮 ${loop.lightOnMs / 1000} 秒、间隔 ${loop.gapMs / 1000} 秒`;
    actionRow.replaceChildren(
      h(
        "button",
        {
          class: "btn primary block lg",
          onClick: () => {
            actionRow.replaceChildren();
            void runLoop();
          },
        },
        "开始回路",
      ),
      h(
        "button",
        {
          class: "btn ghost grow",
          onClick: async () => {
            await device.disconnect();
            ctx.navigate("train");
          },
        },
        "取消",
      ),
    );
    renderStats();
  }

  void boot();

  return {
    el: h(
      "div",
      { class: "screen session" },
      h(
        "header",
        { class: "session-head" },
        h("button", { class: "icon-btn", onClick: () => ctx.navigate("train") }, "←"),
        h(
          "div",
          { class: "session-title" },
          h("strong", null, "实物训练 · 第 4 阶"),
          h("span", null, device.isConnected ? "已连接" : "未连接"),
        ),
        h(
          "button",
          {
            class: "btn ghost small",
            onClick: () => {
              if (running) {
                stopped = true;
                void finish("manual");
              } else {
                ctx.navigate("train");
              }
            },
          },
          "结束",
        ),
      ),
      body,
    ),
    destroy: () => {
      stopped = true;
      offMotion();
      offState();
    },
  };
};

function chip(label: string, value: string): HTMLElement {
  return h("div", { class: "chip" }, h("strong", null, value), h("span", null, label));
}

function stat(label: string, value: string): HTMLElement {
  return h("div", { class: "stat" }, h("strong", null, value), h("span", null, label));
}
