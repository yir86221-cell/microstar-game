/** 判定来源。每个阶段只有一种，不存在人工补录。 */
export type Judge = "touch" | "motion";

/**
 * 一个回合的结局。
 * `noResponse` 不是"错误"——CVI 儿童视觉延迟常达 5–20 秒，
 * 没反应是重要数据，不是失败。统计时计入分母，但不要叫它"错"。
 */
export type TrialOutcome = "hit" | "noResponse" | "abort";

/**
 * 回合阶段。
 *
 *   idle       可以开始下一回合
 *   presenting 目标已呈现，等待命中或超时
 *   gating     本回合已结束，但设备还在孩子手上，必须等放下
 *
 * `gating` 只在第 4 阶出现：`MOTION` 只在状态变化时推送，
 * 灯还没放下就开始下一回合，孩子下一次拿起根本不会触发通知。
 */
export type SessionPhase = "idle" | "presenting" | "gating";

export interface TrialRecord {
  readonly id: string;
  /** 会话内序号，从 0 开始 */
  readonly index: number;
  /** 刺激出现时刻，ms 单调时钟 */
  readonly tStim: number;
  /** 首次收到 moving=1 的时刻（仅第 4 阶） */
  tFirstMotion: number | null;
  /** 判定命中的时刻 */
  tHit: number | null;
  /** 收到 moving=0 的时刻 */
  tRelease: number | null;
  outcome: TrialOutcome | null;
  /** 这一回合由什么判定：触屏还是拿起实物 */
  judge: Judge | null;
  /** tHit - tStim */
  latencyMs: number | null;
  /** 该回合是从开始就是被拿着的（异常情况，计入数据质量） */
  pickedUpAtStart: boolean;
  abortReason: string | null;
}

export interface ChildSafetyFlags {
  /** 有光敏癫痫史或用药——直接决定灯光策略 */
  photosensitive: boolean;
  /** 对强光敏感，但没有癫痫史 */
  highLightSensitivity: boolean;
  /** 对震动抗拒（部分 CVI / 脑瘫儿童有触觉防御） */
  tactileSensitive: boolean;
}

export const SAFE_DEFAULTS: ChildSafetyFlags = {
  photosensitive: false,
  highLightSensitivity: false,
  tactileSensitive: false,
};

/** 一条训练计划里与家长端编辑相关的参数（P0 子集） */
export interface PlanParameters {
  /** 判定窗口。CVI 视觉延迟 5–20 s，默认必须 ≥30 s */
  judgeWindowMs: number;
  /** 单次训练上限，同时是康复节奏与电池的要求 */
  maxMinutes: number;
  /** 回合上限 */
  maxRounds: number;
}

export const DEFAULT_PLAN: PlanParameters = {
  judgeWindowMs: 30_000,
  maxMinutes: 15,
  maxRounds: 20,
};

/**
 * 第 4 阶的自动回路参数。
 * 家长点一次开始，灯按这个节奏自己循环，全程不用再点。
 */
export interface LoopParameters {
  /** 每轮灯亮多久。**不能短**——CVI 视觉延迟 5–20 s，亮 8 秒孩子还没反应过来 */
  lightOnMs: number;
  /** 熄灭间隔，让"熄灭"成为可辨识的信号，也留出放下的时间 */
  gapMs: number;
  /** 轮数 */
  rounds: number;
  /** 设备一直没放下时等多久再放弃本轮 */
  releaseTimeoutMs: number;
}

export const DEFAULT_LOOP: LoopParameters = {
  lightOnMs: 30_000,
  gapMs: 8_000,
  rounds: 10,
  releaseTimeoutMs: 20_000,
};
