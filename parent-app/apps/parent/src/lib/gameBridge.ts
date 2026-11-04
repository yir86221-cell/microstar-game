/**
 * 儿童端写入的训练记录。
 *
 * 儿童端在每回合结算时往 localStorage 写一条记录，家长端读同一份。
 * 两个页面同源（家长端跑在儿童端的 iframe 里），所以直接共用 localStorage，
 * 不需要后端，也不需要 postMessage 往返。
 *
 * 注意：这里只负责"读原始记录"，把它转换成家长端的数据模型放在 store 里做，
 * 避免两个模块互相 import 成环。
 */

export const GAME_RECORD_KEY = "microstar.game.sessions";

export interface GameRoundRecord {
  /** 这一回合用了多久才回应（毫秒）。超时回合为 null */
  latencyMs: number | null;
  /** true / 缺省 = 回应了；false = 到时间没有回应 */
  ok?: boolean;
  /** 命中点离目标中心的距离 ÷ 目标半径。只在精准点击时记录 */
  offsetRatio?: number | null;
}

export interface GameRecord {
  id: string;
  startedAt: number;
  endedAt: number;
  /** 儿童端的三个阶段：1 发现目标 / 2 认识物品 / 3 生活探索 */
  phase: 1 | 2 | 3;
  levelIndex: number;
  levelName: string;
  mode: "slap" | "precise" | "dwell";
  /** 这一次用的目标大小 */
  size?: "standard" | "large" | "huge";
  rounds: GameRoundRecord[];
}

const isRecord = (value: unknown): value is GameRecord => {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<GameRecord>;
  return (
    typeof r.id === "string" &&
    typeof r.startedAt === "number" &&
    typeof r.phase === "number" &&
    typeof r.levelIndex === "number" &&
    Array.isArray(r.rounds)
  );
};

/** 读取儿童端写下的记录。数据坏了就返回空数组，不要让家长端白屏。 */
export function readGameRecords(): GameRecord[] {
  try {
    const raw = localStorage.getItem(GAME_RECORD_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord);
  } catch {
    return [];
  }
}

/** 家长端点「清除全部数据」时，儿童端那份也一起清掉，否则下次打开又冒出来 */
export function clearGameRecords(): void {
  try {
    localStorage.removeItem(GAME_RECORD_KEY);
  } catch {
    /* 隐私模式下删不掉，忽略 */
  }
}
