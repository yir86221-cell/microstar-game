import { hitRate, latencyStats, estimateRemaining } from "@microstar/core-domain";
import { assetsForStage, store, type AppPlan, type SessionRecord, type Stage } from "./store.js";

export interface Advice {
  id: string;
  tone: "good" | "warn" | "info";
  title: string;
  body: string;
  action?: { label: string; apply: () => void };
}

const rateOf = (session: SessionRecord): number => hitRate(session.trials).rate ?? 0;

const patchPlan = (patch: Partial<AppPlan>): void => {
  store.update((state) => {
    Object.assign(state.plan, patch);
  });
};

/**
 * 规则引擎。
 *
 * 价值在规则本身，不在模型——每条建议都必须能说出"依据是哪个数据"，
 * 家长才敢采纳。措辞只描述观察，不下诊断结论。
 */
export function buildAdvice(): Advice[] {
  const state = store.state;
  const sessions = [...state.sessions].sort((a, b) => a.startedAt - b.startedAt);
  const advice: Advice[] = [];

  const recent = sessions.slice(-3);
  const recentRates = recent.map(rateOf);

  // 1. 连续三次达标 → 建议升阶
  if (recent.length === 3 && recentRates.every((r) => r >= 0.85) && state.plan.stage < 4) {
    const next = (state.plan.stage + 1) as Stage;
    advice.push({
      id: "advance-stage",
      tone: "good",
      title: "可以考虑进入下一阶",
      body: `最近 3 次命中率分别是 ${recentRates
        .map((r) => `${Math.round(r * 100)}%`)
        .join(" / ")}，都超过了 85%。可以试试第 ${next} 阶，如果孩子不适应随时退回来。`,
      action: {
        label: "进入下一阶",
        apply: () => {
          patchPlan({
            stage: next,
            assetIds: assetsForStage(next).slice(0, 2).map((a) => a.id),
          });
        },
      },
    });
  }

  // 2. 命中率偏低 → 建议放宽判定窗口
  if (recent.length >= 2) {
    const avg = recentRates.reduce((a, b) => a + b, 0) / recentRates.length;
    if (avg < 0.5) {
      advice.push({
        id: "widen-window",
        tone: "warn",
        title: "命中率偏低，先别急着降难度",
        body: `最近命中率 ${Math.round(avg * 100)}%。很多时候不是孩子没学会，是留给他的反应时间不够——CVI 的视觉延迟可以到 20 秒以上。先把判定窗口放宽到 45 秒试试。`,
        action: {
          label: "窗口放宽到 45 秒",
          apply: () => patchPlan({ judgeWindowMs: 45_000 }),
        },
      });
    }
  }

  // 3. 潜伏期变长 → 建议缩短单次时长（疲劳）
  if (sessions.length >= 4) {
    const tail = sessions.slice(-2);
    const head = sessions.slice(-4, -2);
    const tailP90 = latencyStats(tail.flatMap((s) => s.trials)).p90;
    const headP90 = latencyStats(head.flatMap((s) => s.trials)).p90;
    if (tailP90 !== null && headP90 !== null && tailP90 > headP90 * 1.25) {
      advice.push({
        id: "shorten",
        tone: "info",
        title: "反应变慢了，可能是疲劳",
        body: `P90 潜伏期从 ${(headP90 / 1000).toFixed(1)} 秒升到 ${(tailP90 / 1000).toFixed(1)} 秒。单次练 10 分钟、一天练两次，通常比一次练 20 分钟更有用。`,
        action: {
          label: "单次改为 10 分钟",
          apply: () => patchPlan({ maxMinutes: 10 }),
        },
      });
    }
  }

  // 4. 电量见底
  const battery = estimateRemaining(state.usage, { brightness: state.plan.brightness });
  if (battery.wholeSessions <= 0) {
    advice.push({
      id: "charge",
      tone: "warn",
      title: "这盏灯该充电了",
      body: `自上次充电已点亮 ${Math.round(battery.litMinutes)} 分钟，大约还能练 ${battery.wholeSessions} 次。充满要 1.5 小时，建议今晚插上。`,
    });
  }

  return advice;
}
