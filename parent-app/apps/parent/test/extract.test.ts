// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { boundingBox, buildMask } from "../src/lib/extract.js";

/**
 * 抠图算法用真实像素跑一遍。
 *
 * 之前只验过"能编译、能打包"，等于没验——分割算法最怕的就是
 * "类型都对，但阈值/连通域写错了，输出一张全黑图"。
 * 这里用合成像素代替真实照片：结构可控，失败时能定位到具体一步。
 */

interface Canvas {
  data: Uint8ClampedArray;
  w: number;
  h: number;
}

const WHITE = [255, 255, 255, 255];
const RED = [220, 40, 40, 255];
const DARK = [20, 20, 24, 255];

function makeCanvas(w: number, h: number, fill: number[]): Canvas {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) data.set(fill, i * 4);
  return { data, w, h };
}

function paint(c: Canvas, x0: number, y0: number, x1: number, y1: number, color: number[]): void {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      c.data.set(color, (y * c.w + x) * 4);
    }
  }
}

const countMask = (mask: Uint8Array): number => {
  let n = 0;
  for (const v of mask) if (v === 1) n += 1;
  return n;
};

describe("抠图：白底上的红色方块", () => {
  const c = makeCanvas(100, 100, WHITE);
  paint(c, 25, 25, 75, 75, RED); // 50×50 方块，占画面 25%

  it("背景色取到的是白色", () => {
    const { background } = buildMask(c.data, c.w, c.h);
    expect(background.r).toBeGreaterThan(240);
    expect(background.g).toBeGreaterThan(240);
    expect(background.b).toBeGreaterThan(240);
  });

  it("掩膜覆盖的正是那个方块，面积误差在 15% 以内", () => {
    const { mask } = buildMask(c.data, c.w, c.h);
    const painted = countMask(mask);
    expect(painted).toBeGreaterThan(50 * 50 * 0.85);
    expect(painted).toBeLessThan(50 * 50 * 1.15);
  });

  it("外接矩形贴住方块，不会扩到整张图", () => {
    const { mask } = buildMask(c.data, c.w, c.h);
    const [minX, minY, maxX, maxY] = boundingBox(mask, c.w, c.h);
    expect(minX).toBeGreaterThanOrEqual(20);
    expect(minX).toBeLessThanOrEqual(28);
    expect(maxX).toBeGreaterThanOrEqual(72);
    expect(maxX).toBeLessThanOrEqual(80);
    expect(maxY - minY).toBeGreaterThan(40);
  });
});

describe("抠图：干扰与边界情况", () => {
  it("左上角的一小块噪点会被丢掉，只保留主体", () => {
    const c = makeCanvas(120, 120, WHITE);
    paint(c, 40, 40, 90, 90, RED);
    paint(c, 2, 2, 8, 8, DARK); // 角落噪点
    const { mask } = buildMask(c.data, c.w, c.h);
    const [minX, minY] = boundingBox(mask, c.w, c.h);
    expect(minX).toBeGreaterThan(20);
    expect(minY).toBeGreaterThan(20);
  });

  it("方块内部有个洞（和背景同色的高光）会被补上", () => {
    const c = makeCanvas(100, 100, WHITE);
    paint(c, 25, 25, 75, 75, RED);
    paint(c, 45, 45, 55, 55, WHITE); // 洞
    const { mask } = buildMask(c.data, c.w, c.h);
    // 洞中心那一点应该被判成前景
    expect(mask[50 * 100 + 50]).toBe(1);
  });

  it("整张图同一颜色时，不会把整张图当成主体", () => {
    const c = makeCanvas(80, 80, WHITE);
    const { mask } = buildMask(c.data, c.w, c.h);
    expect(countMask(mask)).toBeLessThan(80 * 80 * 0.2);
  });

  it("深色背景上的深色物体，靠亮度差也能分开", () => {
    const c = makeCanvas(100, 100, DARK);
    paint(c, 30, 30, 70, 70, [70, 70, 78, 255]);
    const { mask } = buildMask(c.data, c.w, c.h);
    expect(countMask(mask)).toBeGreaterThan(40 * 40 * 0.7);
  });
});
