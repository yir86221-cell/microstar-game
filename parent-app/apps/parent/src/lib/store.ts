import type { LightPresetName } from "@microstar/core-protocol";
import { DEFAULT_LOOP, type LoopParameters, type TrialRecord } from "@microstar/core-domain";

// ---------------------------------------------------------------- 类型

export type Stage = 1 | 2 | 3 | 4;
export type CviPhase = 1 | 2 | 3;
/** 1–3 阶的触屏通道。第 4 阶由加速度计判定，不走这里。 */
export type AccessMode = "anywhereTap" | "hover" | "targetTap";
export type HandFunction = "fist" | "spastic" | "canGrasp";
export type FieldBias = "left" | "right" | "up" | "down" | "center";

export interface ChildProfile {
  nickname: string;
  birthDate: string;
  cviPhase: CviPhase;
  /** 光敏癫痫史——直接决定灯光策略，安全关键 */
  photosensitive: boolean;
  highLightSensitivity: boolean;
  /** 触觉防御，要关掉马达 */
  tactileSensitive: boolean;
  handFunction: HandFunction;
  fieldBias: FieldBias;
}

export interface Asset {
  id: string;
  name: string;
  stage: Stage;
  kind: "geometry" | "outline" | "purified" | "real";
  color: string;
}

export interface AppPlan {
  stage: Stage;
  accessMode: AccessMode;
  judgeWindowMs: number;
  maxMinutes: number;
  maxRounds: number;
  brightness: number;
  preset: LightPresetName;
  assetIds: string[];
  /** 第 4 阶自动回路参数；1–3 阶不用 */
  loop: LoopParameters;
}

export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  stage: Stage;
  /** screen = 1–3 阶纯屏幕；physical = 第 4 阶用灯的自动回路 */
  mode: "screen" | "physical";
  trials: TrialRecord[];
  litMinutes: number;
  brightness: number;
}

export interface AppState {
  schemaVersion: number;
  child: ChildProfile;
  plan: AppPlan;
  sessions: SessionRecord[];
  /** 自上次充满以来的点亮记录，喂给用量积分 */
  usage: { litMinutes: number; brightness: number }[];
  lastFullChargeAt: number | null;
  selfTest: { at: number; ok: boolean } | null;
}

// ---------------------------------------------------------------- 素材库

export const STAGE_META: Record<
  Stage,
  { title: string; subtitle: string; phase: string }
> = {
  1: {
    title: "纯色几何",
    subtitle: "黑底纯色图形，建立视觉注意",
    phase: "Phase I",
  },
  2: {
    title: "具象轮廓",
    subtitle: "高饱和单色轮廓，训练物体特征识别",
    phase: "Phase II",
  },
  3: {
    title: "提纯照片",
    subtitle: "家里的水杯、玩偶，去掉背景与纹理",
    phase: "Phase II",
  },
  4: {
    title: "现实泛化",
    subtitle: "贴上提示灯的实物，用拿起动作判分",
    phase: "Phase III",
  },
};

export const ASSETS: Asset[] = [
  { id: "g-red-circle", name: "红圆", stage: 1, kind: "geometry", color: "#ff2d2d" },
  { id: "g-yellow-circle", name: "黄圆", stage: 1, kind: "geometry", color: "#ffc800" },
  { id: "g-red-square", name: "红方", stage: 1, kind: "geometry", color: "#ff2d2d" },
  { id: "g-yellow-square", name: "黄方", stage: 1, kind: "geometry", color: "#ffc800" },

  { id: "o-car", name: "小车", stage: 2, kind: "outline", color: "#ff2d2d" },
  { id: "o-horse", name: "小马", stage: 2, kind: "outline", color: "#ffc800" },
  { id: "o-tree", name: "小树", stage: 2, kind: "outline", color: "#3ddc84" },
  { id: "o-fish", name: "小鱼", stage: 2, kind: "outline", color: "#2f6bff" },

  { id: "p-cup", name: "我的水杯", stage: 3, kind: "purified", color: "#ff2d2d" },
  { id: "p-doll", name: "我的玩偶", stage: 3, kind: "purified", color: "#ffc800" },
  { id: "p-bottle", name: "我的奶瓶", stage: 3, kind: "purified", color: "#ffffff" },

  { id: "r-cup", name: "水杯（实物）", stage: 4, kind: "real", color: "#ff2d2d" },
  { id: "r-doll", name: "玩偶（实物）", stage: 4, kind: "real", color: "#ffc800" },
];

export const assetsForStage = (stage: Stage): Asset[] =>
  ASSETS.filter((a) => a.stage === stage);

export const assetById = (id: string): Asset | undefined =>
  ASSETS.find((a) => a.id === id);

// ---------------------------------------------------------------- 默认状态

const DAY = 86_400_000;

const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** 造一条有"进步趋势"的演示历史，让看板不是空的 */
function seedSessions(now: number): SessionRecord[] {
  const sessions: SessionRecord[] = [];
  const count = 10;

  for (let i = 0; i < count; i += 1) {
    const rnd = mulberry32(1_000 + i * 37);
    // 命中率从 0.42 稳步爬到 0.78
    const rate = 0.42 + (0.36 * i) / (count - 1);
    const baseLatency = 9_000 - (5_000 * i) / (count - 1);
    const trialsCount = 9 + Math.floor(rnd() * 5);
    const trials: TrialRecord[] = [];

    for (let k = 0; k < trialsCount; k += 1) {
      const hit = rnd() < rate;
      const latency = hit ? Math.round(baseLatency * (0.7 + rnd() * 0.9)) : null;
      trials.push({
        id: `seed-${i}-${k}`,
        index: k,
        tStim: k * 30_000,
        tFirstMotion: latency === null ? null : Math.round(latency * 0.45),
        tHit: latency,
        tRelease: null,
        outcome: hit ? "hit" : "noResponse",
        judge: hit ? (i < 6 ? "touch" : "motion") : null,
        latencyMs: latency,
        pickedUpAtStart: false,
        abortReason: null,
      });
    }

    const startedAt = now - (count - i) * 2 * DAY + 10 * 3_600_000;
    const stage = (i < 6 ? 1 : 2) as Stage;
    sessions.push({
      id: `seed-${i}`,
      startedAt,
      endedAt: startedAt + trialsCount * 30_000,
      stage,
      mode: "screen",
      trials,
      litMinutes: 0,
      brightness: 0,
    });
  }

  return sessions;
}

export function createInitialState(now = Date.now()): AppState {
  const sessions = seedSessions(now);
  return {
    schemaVersion: 1,
    child: {
      nickname: "小满",
      birthDate: new Date(now - 34 * 30 * DAY).toISOString().slice(0, 10),
      cviPhase: 1,
      photosensitive: false,
      highLightSensitivity: false,
      tactileSensitive: false,
      handFunction: "spastic",
      fieldBias: "left",
    },
    plan: {
      stage: 2,
      accessMode: "hover",
      judgeWindowMs: 30_000,
      maxMinutes: 15,
      maxRounds: 20,
      brightness: 75,
      preset: "red",
      assetIds: ["o-car", "o-horse"],
      loop: { ...DEFAULT_LOOP },
    },
    sessions,
    usage: sessions.slice(-4).map((s) => ({ litMinutes: s.litMinutes, brightness: s.brightness })),
    lastFullChargeAt: now - DAY,
    selfTest: null,
  };
}

// ---------------------------------------------------------------- 存储

const STORAGE_KEY = "microstar.state.v1";

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.schemaVersion !== 1) return createInitialState();
    return parsed;
  } catch {
    return createInitialState();
  }
}

class Store {
  state: AppState = load();
  private readonly listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  update(mutator: (state: AppState) => void): void {
    mutator(this.state);
    this.persist();
    this.emit();
  }

  reset(): void {
    this.state = createInitialState();
    this.persist();
    this.emit();
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* 隐私模式下写不进去，忽略 */
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export const store = new Store();

// ---------------------------------------------------------------- 选择器

export const stageAssets = (): Asset[] => {
  const plan = store.state.plan;
  const chosen = plan.assetIds
    .map((id) => assetById(id))
    .filter((a): a is Asset => Boolean(a) && a!.stage === plan.stage);
  return chosen.length > 0 ? chosen : assetsForStage(plan.stage).slice(0, 2);
};

export const sessionsOfStage = (stage: Stage): SessionRecord[] =>
  store.state.sessions.filter((s) => s.stage === stage);

export const lastSession = (): SessionRecord | undefined =>
  [...store.state.sessions].sort((a, b) => b.startedAt - a.startedAt)[0];

export const todaySessions = (now = Date.now()): SessionRecord[] => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return store.state.sessions.filter((s) => s.startedAt >= start.getTime());
};

export const totalLitMinutes = (): number =>
  store.state.usage.reduce((sum, e) => sum + e.litMinutes, 0);
