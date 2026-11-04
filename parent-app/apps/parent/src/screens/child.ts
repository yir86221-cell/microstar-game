import { TrialRunner } from "@microstar/core-domain";
import { h } from "../lib/dom.js";
import { levelById, store, type SessionRecord } from "../lib/store.js";
import type { ScreenRenderer } from "../lib/nav.js";

const GAP_MS = 700;
const EXIT_HOLD_MS = 1_200;
const DWELL_MS = 1_200;

/**
 * 孩子模式（1–3 阶）：全屏训练场。
 *
 * 三种回应方式与儿童端一致：拍击 / 精准点击 / 悬停。
 * 退出区在右上角，长按 1.2 秒，且**不计入判分**。
 */
export const render: ScreenRenderer = (ctx) => {
  const plan = store.state.plan;
  const level = levelById(plan.levelId) ?? null;
  const runner = new TrialRunner({ judgeWindowMs: plan.judgeWindowMs });
  const startedAt = Date.now();
  const bias = store.state.child.fieldBias;

  let round = 0;
  let finished = false;
  let touches = 0;
  let misses = 0;
  let firstTouchAt: number | null = null;
  let holdTimer: number | null = null;
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

  // ---- 判定
  function insideTarget(x: number, y: number): { inside: boolean; ratio: number } {
    const r = target.getBoundingClientRect();
    if (r.width === 0) return { inside: false, ratio: 9 };
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dist = Math.hypot(x - cx, y - cy);
    const radius = Math.max(r.width, r.height) / 2;
    return { inside: dist <= radius, ratio: dist / radius };
  }

  function commitHit(ratio: number): void {
    const trial = runner.currentTrial;
    runner.hit(performance.now(), "touch");
    if (trial) {
      trial.tFirstTouch = firstTouchAt;
      trial.touchCount = touches;
      trial.missCount = misses;
      trial.offsetRatio = Math.round(ratio * 100) / 100;
    }
    hideTarget();
    afterRound();
  }

  function cancelHold(): void {
    if (holdTimer !== null) {
      window.clearTimeout(holdTimer);
      holdTimer = null;
    }
    target.classList.remove("holding");
  }

  function onPress(event: PointerEvent): void {
    event.preventDefault();
    if (runner.phase !== "presenting") return;
    touches += 1;
    if (firstTouchAt === null) firstTouchAt = performance.now();

    if (plan.mode === "slap") {
      commitHit(0);
      return;
    }

    const { inside, ratio } = insideTarget(event.clientX, event.clientY);
    if (!inside) {
      // 打偏：记一次未命中，但不结束本回合——孩子还有机会再点
      misses += 1;
      return;
    }

    if (plan.mode === "precise") {
      commitHit(ratio);
      return;
    }

    // dwell：按住 1.2 秒
    target.classList.add("holding");
    holdTimer = window.setTimeout(() => {
      holdTimer = null;
      if (runner.phase === "presenting") commitHit(ratio);
    }, DWELL_MS);
  }

  const hitLayer = h("div", {
    class: "child-hitlayer",
    onPointerDown: onPress,
    onPointerUp: cancelHold,
    onPointerCancel: cancelHold,
    onPointerLeave: cancelHold,
  });

  // ---- 退出：长按 1.2 秒
  let exitTimer: number | null = null;
  const clearExit = (): void => {
    if (exitTimer !== null) {
      window.clearTimeout(exitTimer);
      exitTimer = null;
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
        exitTimer = window.setTimeout(() => {
          exitTimer = null;
          finish("guardian_exit");
        }, EXIT_HOLD_MS);
      },
      onPointerUp: (e: Event) => {
        e.stopPropagation();
        clearExit();
      },
      onPointerCancel: clearExit,
      onPointerLeave: clearExit,
    },
    "退出",
  );

  function showTarget(): void {
    target.style.background = level?.color ?? "#ffe600";
    target.dataset.position = bias;
    target.classList.add("visible");
    progress.textContent = `${round + 1} / ${plan.maxRounds}`;
  }

  function hideTarget(): void {
    target.classList.remove("visible", "holding");
    cancelHold();
  }

  function startRound(): void {
    if (finished) return;
    if (round >= plan.maxRounds) {
      finish("rounds_done");
      return;
    }
    const result = runner.start(performance.now());
    if (!result.ok) return;
    touches = 0;
    misses = 0;
    firstTouchAt = null;
    showTarget();
    later(() => {
      if (finished) return;
      const trial = runner.currentTrial;
      runner.timeout(performance.now());
      if (trial) {
        trial.tFirstTouch = firstTouchAt;
        trial.touchCount = touches;
        trial.missCount = misses;
      }
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
    if (trials.length > 0 && level) {
      const record: SessionRecord = {
        id: `s-${Date.now()}`,
        startedAt,
        endedAt: Date.now(),
        stage: plan.stage,
        levelId: level.id,
        levelName: level.name,
        mode: "screen",
        trials,
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
      if (exitTimer !== null) window.clearTimeout(exitTimer);
      if (holdTimer !== null) window.clearTimeout(holdTimer);
    },
  };
};
