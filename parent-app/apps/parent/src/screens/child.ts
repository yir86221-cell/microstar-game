import { TrialRunner } from "@microstar/core-domain";
import { h } from "../lib/dom.js";
import { store, stageAssets, type SessionRecord } from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

const GAP_MS = 700;
const EXIT_HOLD_MS = 1_200;

/**
 * 孩子模式：1–3 阶的全屏训练场。
 *
 * 三条硬规则：
 * 1. **不用灯**——前 3 阶完全不碰 BLE。
 * 2. **右上角退出区必须从判分区扣掉**，否则家长按退出会顺带记一次命中。
 * 3. 退出要长按 1.2 秒——脑瘫孩子的不自主运动扫过角落是常事。
 */
export const render: ScreenRenderer = (ctx) => {
  const plan = store.state.plan;
  const assets = stageAssets();
  const runner = new TrialRunner({ judgeWindowMs: plan.judgeWindowMs });
  const startedAt = Date.now();

  let round = 0;
  let finished = false;
  const timers = new Set<number>();

  const later = (fn: () => void, ms: number): void => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };

  const target = h("div", { class: "child-target" });
  const progress = h("div", { class: "child-progress" });

  // ---- 判分：除退出区以外，全屏任意触碰都算命中
  function onHit(event: Event): void {
    event.preventDefault();
    if (runner.phase !== "presenting") return;
    runner.hit(performance.now(), "touch");
    hideTarget();
    afterRound();
  }

  const hitLayer = h("div", { class: "child-hitlayer", onPointerDown: onHit });

  // ---- 退出：长按 1.2 秒
  let holdTimer: number | null = null;
  const clearHold = (): void => {
    if (holdTimer !== null) {
      window.clearTimeout(holdTimer);
      holdTimer = null;
    }
    exitButton.classList.remove("holding");
  };
  const exitButton = h(
    "button",
    {
      class: "child-exit",
      onPointerDown: (e: Event) => {
        e.stopPropagation();
        exitButton.classList.add("holding");
        holdTimer = window.setTimeout(() => {
          holdTimer = null;
          finish("guardian_exit");
        }, EXIT_HOLD_MS);
      },
      onPointerUp: (e: Event) => {
        e.stopPropagation();
        clearHold();
      },
      onPointerCancel: clearHold,
      onPointerLeave: clearHold,
    },
    "退出",
  );

  function showTarget(): void {
    const asset = assets[round % Math.max(1, assets.length)];
    target.style.background = asset?.color ?? "#ff2d2d";
    target.classList.toggle("square", plan.stage >= 2 && round % 2 === 1);
    target.dataset.position = store.state.child.fieldBias;
    target.classList.add("visible");
    progress.textContent = `${round + 1} / ${plan.maxRounds}`;
  }

  function hideTarget(): void {
    target.classList.remove("visible");
  }

  function startRound(): void {
    if (finished) return;
    if (round >= plan.maxRounds) {
      finish("rounds_done");
      return;
    }
    const result = runner.start(performance.now());
    if (!result.ok) return;
    showTarget();
    later(() => {
      if (finished) return;
      runner.timeout(performance.now());
      hideTarget();
      afterRound();
    }, plan.judgeWindowMs);
  }

  function afterRound(): void {
    round += 1;
    if (finished) return;
    later(startRound, GAP_MS);
  }

  function finish(reason: string): void {
    if (finished) return;
    finished = true;
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
    hideTarget();

    const trials = [...runner.trials()];
    if (trials.length > 0) {
      const record: SessionRecord = {
        id: `s-${Date.now()}`,
        startedAt,
        endedAt: Date.now(),
        stage: plan.stage,
        mode: "screen",
        trials,
        // 屏幕训练不点灯，不计入用量
        litMinutes: 0,
        brightness: 0,
      };
      store.update((s) => {
        s.sessions.push(record);
      });
    }

    console.info(`孩子模式结束：${reason}，${trials.length} 回合`);
    ctx.navigate("data");
  }

  const el = h(
    "div",
    { class: "screen child-mode" },
    hitLayer,
    target,
    exitButton,
    progress,
  );

  later(startRound, 400);

  return {
    el,
    destroy: () => {
      for (const id of timers) window.clearTimeout(id);
      if (holdTimer !== null) window.clearTimeout(holdTimer);
    },
  };
};
