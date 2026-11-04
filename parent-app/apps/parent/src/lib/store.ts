import type { LightPresetName } from "@microstar/core-protocol";
import { DEFAULT_LOOP, type LoopParameters, type TrialRecord } from "@microstar/core-domain";
import { customLevelsAsLevels } from "./customLevels.js";
import { clearGameRecords, readGameRecords, type GameRecord } from "./gameBridge.js";

// ---------------------------------------------------------------- 类型

/** 儿童端的三个阶段。家长端在它之后多一个「实物训练」。 */
export type PhaseId = 1 | 2 | 3;
/** 1–3 = 三个阶段（与儿童端一致）；4 = 实物训练，只存在于家长端 */
export type StageId = 1 | 2 | 3 | 4;

/** 与儿童端一致的三种回应方式 */
export type AccessMode = "slap" | "precise" | "dwell";
export type HandFunction = "fist" | "spastic" | "canGrasp";
export type FieldBias = "left" | "right" | "up" | "down" | "center";

export interface Level {
  id: string;
  phase: PhaseId;
  /** 关卡名，与儿童端一致 */
  name: string;
  /** 目标物 */
  target: string;
  /** 要孩子做的动作 */
  action: string;
  /** 主色 */
  color: string;
  kind: string;
}

export interface ChildProfile {
  nickname: string;
  birthDate: string;
  cviPhase: PhaseId;
  photosensitive: boolean;
  highLightSensitivity: boolean;
  tactileSensitive: boolean;
  handFunction: HandFunction;
  fieldBias: FieldBias;
}

export interface AppPlan {
  stage: StageId;
  /** 1–3 阶：关卡 id；第 4 阶固定为 physical */
  levelId: string;
  mode: AccessMode;
  judgeWindowMs: number;
  maxMinutes: number;
  maxRounds: number;
  brightness: number;
  preset: LightPresetName;
  loop: LoopParameters;
  /** 儿童模式的回应音效。默认关：CVI 孩子靠听会比靠看快，容易绕开视觉 */
  sound: boolean;
  /** 目标大小。三档固定，不做连续可调——否则历史数据没法比 */
  targetSize: TargetSize;
}

/** 判定区域的三档。scale 会传给儿童端，改变目标的显示尺寸 */
export type TargetSize = "standard" | "large" | "huge";

export const TARGET_SIZES: { id: TargetSize; label: string; hint: string; scale: number }[] = [
  { id: "standard", label: "标准", hint: "能准确够到", scale: 1 },
  { id: "large", label: "大", hint: "手有点抖", scale: 1.2 },
  { id: "huge", label: "特大", hint: "握拳、够不准", scale: 1.48 },
];

export const targetSizeLabel = (size: TargetSize | undefined): string =>
  TARGET_SIZES.find((t) => t.id === size)?.label ?? "标准";

/** 按手部功能给一个默认档：孩子不用先被要求准确点，先让他能点到 */
export const defaultTargetSize = (hand: HandFunction): TargetSize => {
  if (hand === "fist") return "huge";
  if (hand === "spastic") return "large";
  return "standard";
};

/** 按手部功能给一个默认回应方式 */
export const defaultMode = (hand: HandFunction): AccessMode => {
  if (hand === "fist") return "slap";
  if (hand === "spastic") return "dwell";
  return "precise";
};

export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  stage: StageId;
  levelId: string;
  levelName: string;
  /** screen = 1–3 阶触屏；physical = 第 4 阶用灯的自动回路 */
  mode: "screen" | "physical";
  trials: TrialRecord[];
  litMinutes: number;
  brightness: number;
  /** 这条记录从哪来：儿童端打出来的，还是家长端实物训练。 */
  origin?: "game" | "parent";
  /** 这次用的目标大小。换档之后的老记录不能直接和新记录比 */
  targetSize?: TargetSize;
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
  /** 当前数据是不是演示数据（程序生成的，不是真实训练） */
  isDemo: boolean;
}

// ---------------------------------------------------------------- 阶段与关卡（对齐儿童端）

export const PHASES: { id: PhaseId; name: string; hint: string }[] = [
  { id: 1, name: "发现目标", hint: "看见并回应" },
  { id: 2, name: "认识物品", hint: "认出常见的东西" },
  { id: 3, name: "生活探索", hint: "在生活场景里找到" },
];

export const LEVELS: Level[] = [
  // Phase 1 · 发现目标（10 关）
  { id: "planet", phase: 1, kind: "planet", name: "星球点亮", target: "黄色圆球", action: "点亮星球", color: "#ffe600" },
  { id: "star", phase: 1, kind: "star", name: "点亮小星星", target: "小星星", action: "点亮小星星", color: "#ffe600" },
  { id: "colors", phase: 1, kind: "colors", name: "色彩探索", target: "亮起的圆球", action: "点亮圆球", color: "#ff3b30" },
  { id: "shapes", phase: 1, kind: "shapes", name: "形状朋友", target: "绿色图形", action: "圆 → 方 → 三角", color: "#54e373" },
  { id: "growth", phase: 1, kind: "growth", name: "大小星球", target: "橙色圆球", action: "点三次，长大并前进", color: "#ff9637" },
  { id: "peek", phase: 1, kind: "peek", name: "躲猫猫", target: "粉色圆球", action: "左侧 → 右下 → 左上", color: "#ff70ba" },
  { id: "horizontal", phase: 1, kind: "horizontal", name: "星球换位置", target: "紫色圆球", action: "左 → 中 → 右", color: "#b57aff" },
  { id: "vertical", phase: 1, kind: "vertical", name: "上下找星星", target: "粉色星星", action: "点三次，上下移动", color: "#ff79bf" },
  { id: "drift", phase: 1, kind: "drift", name: "漂流星球", target: "绿色圆球", action: "点三次，推到右侧", color: "#39df96" },
  { id: "path", phase: 1, kind: "path", name: "星光旅行", target: "紫色圆球", action: "横移、停顿、再向下", color: "#a087ff" },

  // Phase 2 · 认识物品（4 关）
  { id: "chick", phase: 2, kind: "item", name: "让小鸡跳舞", target: "小鸡", action: "和小鸡打招呼", color: "#ffe600" },
  { id: "car", phase: 2, kind: "item", name: "让小车开起来", target: "小车", action: "让小车出发", color: "#00dce9" },
  { id: "apple", phase: 2, kind: "item", name: "摘下红苹果", target: "红苹果", action: "摘下红苹果", color: "#ff3b30" },
  { id: "starchild", phase: 2, kind: "item", name: "点亮小星星", target: "小星星", action: "点亮小星星", color: "#ffe600" },

  // Phase 3 · 生活探索（4 关）
  { id: "p3-chick", phase: 3, kind: "item", name: "让小鸡跳舞", target: "小鸡", action: "和小鸡打招呼", color: "#ffe600" },
  { id: "p3-car", phase: 3, kind: "item", name: "让小车开起来", target: "小车", action: "让小车出发", color: "#00dce9" },
  { id: "p3-apple", phase: 3, kind: "item", name: "摘下红苹果", target: "红苹果", action: "摘下红苹果", color: "#ff3b30" },
  { id: "p3-star", phase: 3, kind: "item", name: "点亮小星星", target: "小星星", action: "点亮小星星", color: "#ffe600" },
];

export const PHYSICAL_LEVEL: Level = {
  id: "physical",
  phase: 3,
  kind: "physical",
  name: "实物训练",
  target: "贴了灯的实物",
  action: "看见灯、伸手拿起",
  color: "#ff2d2d",
};

export const levelsOf = (phase: PhaseId): Level[] =>
  LEVELS.filter((l) => l.phase === phase).concat(
    phase === 3 ? (customLevelsAsLevels() as Level[]) : [],
  );
export const levelById = (id: string): Level | undefined => {
  if (id === PHYSICAL_LEVEL.id) return PHYSICAL_LEVEL;
  const builtIn = LEVELS.find((l) => l.id === id);
  if (builtIn) return builtIn;
  // 家长自己拍的关卡不在内置表里，要单独找一次
  return (customLevelsAsLevels() as Level[]).find((l) => l.id === id);
};

export const STAGE_NAME: Record<StageId, string> = {
  1: "发现目标",
  2: "认识物品",
  3: "生活探索",
  4: "实物训练",
};

export const MODE_NAME: Record<AccessMode, string> = {
  slap: "拍击",
  precise: "精准点击",
  dwell: "悬停",
};

export const MODE_HINT: Record<AccessMode, string> = {
  slap: "触碰屏幕任意位置",
  precise: "点中目标才算",
  dwell: "按住目标 1.2 秒",
};

// ---------------------------------------------------------------- 演示数据生成

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

function buildDemoSessions(now: number): SessionRecord[] {
  const out: SessionRecord[] = [];
  const count = 10;
  const names = ["planet", "star", "colors", "chick", "car"];

  for (let i = 0; i < count; i += 1) {
    const rnd = mulberry32(1_000 + i * 37);
    const rate = 0.42 + (0.36 * i) / (count - 1);
    const base = 9_000 - (5_000 * i) / (count - 1);
    const n = 9 + Math.floor(rnd() * 5);
    const trials: TrialRecord[] = [];
    const level = levelById(names[Math.min(names.length - 1, Math.floor(i / 2))]!)!;

    for (let k = 0; k < n; k += 1) {
      const hit = rnd() < rate;
      const latency = hit ? Math.round(base * (0.7 + rnd() * 0.9)) : null;
      trials.push({
        id: `demo-${i}-${k}`,
        index: k,
        tStim: k * 30_000,
        tFirstMotion: null,
        tHit: latency,
        tRelease: null,
        outcome: hit ? "hit" : "noResponse",
        judge: hit ? "touch" : null,
        latencyMs: latency,
        tFirstTouch: latency === null ? null : Math.round(latency * (0.55 + rnd() * 0.3)),
        touchCount: latency === null ? 0 : 1 + Math.floor(rnd() * 2),
        offsetRatio: hit ? Math.round(rnd() * 60) / 100 : null,
        pickedUpAtStart: false,
        abortReason: null,
      });
    }

    const startedAt = now - (count - i) * 2 * DAY + 10 * 3_600_000;
    out.push({
      id: `demo-${i}`,
      startedAt,
      endedAt: startedAt + n * 30_000,
      stage: level.phase,
      levelId: level.id,
      levelName: level.name,
      mode: "screen",
      trials,
      litMinutes: 0,
      brightness: 0,
    });
  }
  return out;
}

// ---------------------------------------------------------------- 儿童端记录接入

/**
 * 把儿童端写下的一条记录转成家长端的数据模型。
 *
 * 儿童端只知道"这一回合用了多久才回应"，不知道刺激出现的绝对时间，
 * 所以这里用累积时间造出时间轴——对算命中率和 P50/P90 没有影响，
 * 因为这些指标只看 latencyMs。
 */
function fromGameRecord(record: GameRecord): SessionRecord {
  const level = levelsOf(record.phase)[record.levelIndex];
  let cursor = 0;
  const trials: TrialRecord[] = record.rounds.map((round, index) => {
    const raw = round.ok === false ? null : round.latencyMs;

    if (raw === null) {
      // 到时间没有回应：不计入潜伏期统计，但计入命中率分母
      const tStim = cursor;
      cursor = tStim + 30_000;
      return {
        id: `${record.id}-${index}`,
        index,
        tStim,
        tFirstMotion: null,
        tHit: null,
        tRelease: null,
        outcome: "noResponse",
        judge: null,
        latencyMs: null,
        tFirstTouch: null,
        touchCount: 0,
        offsetRatio: null,
        pickedUpAtStart: false,
        abortReason: null,
      };
    }

    const latencyMs = Math.max(0, Math.round(raw));
    const tStim = cursor;
    const tHit = tStim + latencyMs;
    cursor = tHit + 1_500; // 奖励 + 回合间隔，只为了让时间戳有序，不参与统计
    return {
      id: `${record.id}-${index}`,
      index,
      tStim,
      tFirstMotion: null,
      tHit,
      tRelease: null,
      outcome: "hit",
      judge: "touch",
      latencyMs,
      tFirstTouch: null,
      touchCount: 1,
      offsetRatio: typeof round.offsetRatio === "number" ? round.offsetRatio : null,
      pickedUpAtStart: false,
      abortReason: null,
    };
  });

  return {
    id: record.id,
    startedAt: record.startedAt,
    endedAt: record.endedAt || record.startedAt,
    stage: record.phase,
    levelId: level?.id ?? `game-${record.phase}-${record.levelIndex}`,
    levelName: record.levelName || level?.name || "儿童端关卡",
    mode: "screen",
    trials,
    litMinutes: 0,
    brightness: 0,
    origin: "game",
    targetSize: (record.size as TargetSize | undefined) ?? "standard",
  };
}

/** 合并儿童端记录，按 id 去重，旧的在前 */
function mergeGameSessions(sessions: SessionRecord[]): SessionRecord[] {
  const seen = new Set(sessions.map((s) => s.id));
  const merged = [...sessions];

  for (const record of readGameRecords()) {
    if (seen.has(record.id)) continue;
    const session = fromGameRecord(record);
    if (session.trials.length === 0) continue;
    seen.add(session.id);
    merged.push(session);
  }

  return merged.sort((a, b) => a.startedAt - b.startedAt);
}

// ---------------------------------------------------------------- 初始状态

export function createInitialState(): AppState {
  return {
    schemaVersion: 2,
    child: {
      nickname: "小满",
      birthDate: new Date(Date.now() - 34 * 30 * DAY).toISOString().slice(0, 10),
      cviPhase: 1,
      photosensitive: false,
      highLightSensitivity: false,
      tactileSensitive: false,
      handFunction: "spastic",
      fieldBias: "left",
    },
    plan: {
      stage: 1,
      levelId: "planet",
      mode: "dwell",
      judgeWindowMs: 30_000,
      maxMinutes: 15,
      maxRounds: 20,
      brightness: 75,
      preset: "red",
      loop: { ...DEFAULT_LOOP },
      sound: false,
      // 默认按手部功能给：有痉挛的孩子先让他能点到，不要求点准
      targetSize: "large",
    },
    // 默认没有任何训练记录：这是真实使用的起点，不是演示
    sessions: mergeGameSessions([]),
    usage: [],
    lastFullChargeAt: null,
    selfTest: null,
    isDemo: false,
  };
}

// ---------------------------------------------------------------- 存储

const STORAGE_KEY = "microstar.state.v2";

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.schemaVersion !== 2) return createInitialState();
    // 每次打开都重新扫一遍儿童端记录：孩子可能刚练完
    parsed.sessions = mergeGameSessions(parsed.sessions ?? []);
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

  /** 载入演示数据。界面上必须同时显示「演示数据」标记。 */
  loadDemo(): void {
    this.state.sessions = buildDemoSessions(Date.now());
    this.state.usage = [];
    this.state.isDemo = true;
    this.persist();
    this.emit();
  }

  clearDemo(): void {
    // 演示数据清掉后，把儿童端真实记录重新接回来
    this.state.sessions = mergeGameSessions([]);
    this.state.usage = [];
    this.state.isDemo = false;
    this.persist();
    this.emit();
  }

  /** 清空全部数据。儿童端那份也一起清，否则下次打开又冒出来 */
  reset(): void {
    clearGameRecords();
    this.state = createInitialState();
    this.persist();
    this.emit();
  }

  /** 重新从儿童端拉一次记录（家长端打开时调用） */
  syncFromGame(): void {
    const merged = mergeGameSessions(this.state.sessions);
    if (merged.length === this.state.sessions.length) return;
    this.state.sessions = merged;
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

export const currentLevel = (): Level =>
  levelById(store.state.plan.levelId) ?? LEVELS[0]!;

export const lastSession = (): SessionRecord | undefined =>
  [...store.state.sessions].sort((a, b) => b.startedAt - a.startedAt)[0];

export const todaySessions = (now = Date.now()): SessionRecord[] => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return store.state.sessions.filter((s) => s.startedAt >= start.getTime());
};

export const sessionsNewestFirst = (): SessionRecord[] =>
  [...store.state.sessions].sort((a, b) => b.startedAt - a.startedAt);
