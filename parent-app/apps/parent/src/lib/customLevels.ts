/**
 * 家长自己拍的实物素材（第三阶段的自定义关卡）。
 *
 * 存的是 localStorage 里的同一份数据，儿童端读它把目标换成图片。
 * 照片只在这台设备上：不上传、不进仓库、不进同步。
 *
 * 数据形状要稳定，儿童端是纯 JS 直接读的，不经过 TypeScript。
 */

export const CUSTOM_LEVEL_KEY = "microstar.custom-levels.v1";

export interface CustomLevel {
  id: string;
  /** 关卡名，家长填 */
  name: string;
  /** 目标物，默认用关卡名 */
  target: string;
  /** 关卡标记色 */
  color: string;
  /** 训练照片，dataURL；兼容旧版已保存的轮廓图 */
  image: string;
  /** 菜单缩略图 */
  thumb: string;
  createdAt: number;
}

const isCustomLevel = (value: unknown): value is CustomLevel => {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<CustomLevel>;
  return typeof v.id === "string" && /^custom-[\w-]+$/.test(v.id) && typeof v.image === "string" &&
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v.image) && typeof v.name === "string";
};

/** 读全部自定义关卡。数据坏了就返回空数组，不要白屏。 */
export function readCustomLevels(): CustomLevel[] {
  try {
    const raw = localStorage.getItem(CUSTOM_LEVEL_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCustomLevel);
  } catch {
    return [];
  }
}

export function saveCustomLevel(level: CustomLevel): void {
  const list = readCustomLevels();
  const index = list.findIndex((l) => l.id === level.id);
  if (index >= 0) list[index] = level;
  else list.push(level);
  write(list);
}

export function removeCustomLevel(id: string): void {
  write(readCustomLevels().filter((l) => l.id !== id));
}

function write(list: CustomLevel[]): void {
  try {
    localStorage.setItem(CUSTOM_LEVEL_KEY, JSON.stringify(list));
  } catch {
    throw new Error("保存失败：本机存储空间不足或不可用。请删除不用的照片关卡后重试。");
  }
}

/** 给家长端展示用：转成统一的 Level 形状 */
export function customLevelsAsLevels(): {
  id: string;
  phase: 3;
  kind: string;
  name: string;
  target: string;
  action: string;
  color: string;
}[] {
  return readCustomLevels().map((l) => ({
    id: l.id,
    phase: 3 as const,
    kind: "custom",
    name: l.name,
    target: l.target,
    action: `找到${l.target}`,
    color: l.color,
  }));
}

export type PlayableLevel = {
  id: string;
  phase: 1 | 2 | 3;
  kind: string;
  name: string;
  target: string;
  action: string;
  color: string;
  isCustom?: boolean;
};
