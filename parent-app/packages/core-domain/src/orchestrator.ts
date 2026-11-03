import type { Judge, SessionPhase, TrialRecord } from "./types.js";

export type StartBlockedReason = "busy" | "device_held";

export type StartResult =
  | { ok: true; trial: TrialRecord }
  | { ok: false; reason: StartBlockedReason; phase: SessionPhase };

export interface TrialRunnerListener {
  onPhaseChange?(phase: SessionPhase, previous: SessionPhase): void;
  onTrialStart?(trial: TrialRecord): void;
  onFirstMotion?(trial: TrialRecord): void;
  onTrialEnd?(trial: TrialRecord): void;
  onReleased?(trial: TrialRecord): void;
  onStartBlocked?(reason: StartBlockedReason, phase: SessionPhase): void;
}

export interface TrialRunnerOptions {
  /** 判定窗口。CVI 视觉延迟 5–20 s，默认 30 s */
  judgeWindowMs?: number;
  /** 注入时钟，方便测试 */
  now?: () => number;
  idFactory?: () => string;
}

let fallbackSeq = 0;
const defaultIdFactory = (): string => {
  fallbackSeq += 1;
  return `trial-${fallbackSeq}`;
};

/**
 * 回合门控状态机。
 *
 * 这个类是唯一真正"不能写错"的一段逻辑，原因有两个：
 *
 * 1. `MOTION` 只在状态**变化**时推送。灯还拿在手上就开下一回合，
 *    孩子下一次拿起根本不会触发通知——整轮数据作废，而且从数据上看不出来。
 * 2. `noResponse` 不是错误。CVI 儿童的视觉延迟 5–20 秒是常态，
 *    超时必须记成"无反应"而不是"失败"，否则命中率会被系统性低估。
 *
 * 所以"能不能开始下一回合"是个显式状态，而不是靠 UI 自觉。
 */
export class TrialRunner {
  private _phase: SessionPhase = "idle";
  private current: TrialRecord | null = null;
  private moving = false;
  private windowMs: number;
  private readonly now: () => number;
  private readonly idFactory: () => string;
  private readonly history: TrialRecord[] = [];
  private readonly listeners = new Set<TrialRunnerListener>();

  constructor(options: TrialRunnerOptions = {}) {
    this.windowMs = options.judgeWindowMs ?? 30_000;
    this.now = options.now ?? (() => performance.now());
    this.idFactory = options.idFactory ?? defaultIdFactory;
  }

  get phase(): SessionPhase {
    return this._phase;
  }

  get judgeWindowMs(): number {
    return this.windowMs;
  }

  /** 设备当前是否还拿在手上（第 4 阶才有意义） */
  get isDeviceHeld(): boolean {
    return this.moving;
  }

  get currentTrial(): TrialRecord | null {
    return this.current;
  }

  trials(): readonly TrialRecord[] {
    return this.history;
  }

  get canStart(): boolean {
    return this._phase === "idle" && !this.moving;
  }

  subscribe(listener: TrialRunnerListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** 家长在训练中临时放宽窗口 */
  setJudgeWindow(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) {
      throw new RangeError(`判定窗口必须是正数，收到 ${ms}`);
    }
    this.windowMs = ms;
  }

  /**
   * 开始一个回合。
   * 设备还拿在手上时会拒绝——因为这时候"拿起"事件不会再来一次。
   */
  start(at: number = this.now(), options: { force?: boolean } = {}): StartResult {
    if (this._phase !== "idle") {
      this.emit((l) => l.onStartBlocked?.("busy", this._phase));
      return { ok: false, reason: "busy", phase: this._phase };
    }
    if (this.moving && !options.force) {
      this.emit((l) => l.onStartBlocked?.("device_held", this._phase));
      return { ok: false, reason: "device_held", phase: this._phase };
    }

    const trial: TrialRecord = {
      id: this.idFactory(),
      index: this.history.length,
      tStim: at,
      tFirstMotion: null,
      tHit: null,
      tRelease: null,
      outcome: null,
      judge: null,
      latencyMs: null,
      pickedUpAtStart: this.moving,
      abortReason: null,
    };

    this.current = trial;
    this.setPhase("presenting");
    this.emit((l) => l.onTrialStart?.(trial));
    return { ok: true, trial };
  }

  /**
   * 喂入一条 `MOTION` 采样。
   * 拿起时记 tFirstMotion；放下时解除门控。
   */
  onMotion(sample: { moving: boolean }, at: number = this.now()): void {
    const wasMoving = this.moving;
    this.moving = sample.moving;
    const trial = this.current;
    if (!trial) return;

    if (!wasMoving && sample.moving) {
      if (this._phase === "presenting" && trial.tFirstMotion === null) {
        trial.tFirstMotion = at;
        this.emit((l) => l.onFirstMotion?.(trial));
      }
      return;
    }

    if (wasMoving && !sample.moving) {
      if (this._phase === "gating") {
        trial.tRelease = at;
        this.setPhase("idle");
        this.emit((l) => l.onReleased?.(trial));
      }
    }
  }

  /** 判定命中。触屏或拿起实物，由调用方说明是哪种。 */
  hit(at: number = this.now(), judge: Judge = "touch"): TrialRecord | null {
    return this.finish(at, "hit", judge);
  }

  /** 判定窗口到了还没反应。这是数据，不是错误。 */
  timeout(at: number = this.now()): TrialRecord | null {
    return this.finish(at, "noResponse", null);
  }

  /**
   * 中途放弃（家长退出、孩子哭闹、设备一直没放下）。
   * 强制回到 idle——已经决定不练了，不该被门控卡住。
   */
  abort(at: number = this.now(), reason = "manual"): TrialRecord | null {
    if (this._phase !== "presenting" || !this.current) return null;
    const trial = this.current;
    trial.outcome = "abort";
    trial.abortReason = reason;
    this.history.push(trial);
    this.setPhase("idle");
    this.emit((l) => l.onTrialEnd?.(trial));
    return trial;
  }

  reset(): void {
    this.history.length = 0;
    this.current = null;
    this.moving = false;
    this.setPhase("idle");
  }

  private finish(
    at: number,
    outcome: "hit" | "noResponse",
    judge: Judge | null,
  ): TrialRecord | null {
    if (this._phase !== "presenting" || !this.current) return null;

    const trial = this.current;
    trial.outcome = outcome;
    trial.judge = judge;
    if (outcome === "hit") {
      trial.tHit = at;
      trial.latencyMs = at - trial.tStim;
    }

    this.history.push(trial);
    this.setPhase(this.moving ? "gating" : "idle");
    this.emit((l) => l.onTrialEnd?.(trial));
    return trial;
  }

  private setPhase(next: SessionPhase): void {
    if (this._phase === next) return;
    const previous = this._phase;
    this._phase = next;
    this.emit((l) => l.onPhaseChange?.(next, previous));
  }

  private emit(fn: (listener: TrialRunnerListener) => void): void {
    for (const listener of this.listeners) fn(listener);
  }
}
