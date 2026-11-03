// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 冒烟测试：每个页面真的渲染一遍。
 *
 * 存在的理由很实际——构建通过不代表打得开。
 * 少一个 DOM 节点、拼错一个类名、store 里某个字段是 undefined，
 * 都会白屏，而 tsc 和 vite build 都不会报。
 */

async function mountAt(hash: string): Promise<HTMLElement> {
  vi.resetModules();
  resetStorage();
  document.body.innerHTML = '<div id="root"></div>';
  window.location.hash = hash;

  const mod = await import("../src/app.js");
  const root = document.getElementById("root")!;
  mod.mount(root);
  return root;
}

/**
 * Node 25 自带一个实验性的 localStorage 全局，会盖住 jsdom 的那个，
 * 直接调 `localStorage.clear()` 会报 "is not a function"。
 * 所以这里走 window 上的真实现，并且容忍不可用。
 */
function resetStorage(): void {
  try {
    window.localStorage.clear();
  } catch {
    /* jsdom 没提供就跳过：store 自己有兜底 */
  }
}

beforeEach(() => {
  resetStorage();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("家长端页面", () => {
  it("开屏落在训练页，有 4 个 Tab", async () => {
    const root = await mountAt("#/train");
    expect(root.textContent).toContain("今天的训练");
    expect(root.textContent).toContain("今天还没练");
    expect(root.querySelectorAll("#tabbar .tab").length).toBe(4);
  });

  it("空 hash 也落在训练页", async () => {
    vi.resetModules();
    resetStorage();
    document.body.innerHTML = '<div id="root"></div>';
    window.location.hash = "";
    const mod = await import("../src/app.js");
    const root = document.getElementById("root")!;
    mod.mount(root);
    expect(root.textContent).toContain("今天的训练");
  });

  it("训练页：四阶轨道 4 段，素材可选", async () => {
    const root = await mountAt("#/train");
    expect(root.querySelectorAll(".rail-item").length).toBe(4);
    expect(root.querySelectorAll(".asset").length).toBeGreaterThan(0);
  });

  it("数据页：趋势图 + 三个指标 + 入口列表", async () => {
    const root = await mountAt("#/data");
    expect(root.querySelector(".chart")).not.toBeNull();
    expect(root.querySelectorAll(".stat-grid .stat").length).toBe(3);
    expect(root.textContent).toContain("调整计划");
    // 内联计划表单已经移到二级页
    expect(root.querySelectorAll("select").length).toBe(0);
  });

  it("设备页：未连接时只显示「未连接」", async () => {
    const root = await mountAt("#/device");
    expect(root.textContent).toContain("未连接");
    expect(root.textContent).toContain("连不上怎么办");
  });

  it("我的页：档案与安全标记都在", async () => {
    const root = await mountAt("#/profile");
    expect(root.textContent).toContain("孩子档案");
    expect(root.textContent).toContain("光敏癫痫史");
    expect(root.querySelectorAll('input[type="checkbox"]').length).toBe(3);
  });

  it("计划页是二级页：有表单，没有 Tab 栏", async () => {
    const root = await mountAt("#/plan");
    expect(root.querySelectorAll("select").length).toBeGreaterThan(0);
    const tabbar = root.querySelector<HTMLElement>("#tabbar");
    expect(tabbar?.style.display).toBe("none");
  });

  it("孩子模式：全屏、有退出区、没有「看到了」按钮", async () => {
    vi.useFakeTimers();
    const root = await mountAt("#/child");
    expect(root.querySelector(".child-exit")).not.toBeNull();
    expect(root.querySelector(".child-hitlayer")).not.toBeNull();
    expect(root.textContent).not.toContain("看到了");
    const tabbar = root.querySelector<HTMLElement>("#tabbar");
    expect(tabbar?.style.display).toBe("none");
  });

  it("实物训练台：标题正确，家长不需要逐个点", async () => {
    const root = await mountAt("#/physical");
    expect(root.textContent).toContain("实物训练");
    expect(root.textContent).not.toContain("看到了");
  });

  it("调试台：能挂载并显示字节区", async () => {
    const root = await mountAt("#/debug");
    expect(root.textContent).toContain("最近下发的字节");
    expect(root.textContent).toContain("ALERT");
  });

  it("未知路由回落到训练页", async () => {
    const root = await mountAt("#/nope");
    expect(root.textContent).toContain("今天的训练");
  });

  it("底部标签可以切换页面", async () => {
    const root = await mountAt("#/train");
    const tabs = root.querySelectorAll<HTMLButtonElement>("#tabbar .tab");
    expect([...tabs].map((t) => t.textContent)).toEqual(["训练", "数据", "设备", "我的"]);
    tabs[1]!.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(window.location.hash).toBe("#/data");
    expect(root.textContent).toContain("调整计划");
  });

  it("勾上光敏癫痫史后，设备页的闪烁按钮被禁用", async () => {
    const root = await mountAt("#/profile");
    const first = root.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(first.checked).toBe(false);
    first.checked = true;
    first.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    root.querySelectorAll<HTMLButtonElement>("#tabbar .tab")[2]!.click();
    await new Promise((resolve) => setTimeout(resolve, 30));

    const blink = [...root.querySelectorAll<HTMLButtonElement>(".seg")].find(
      (button) => button.textContent === "闪烁",
    );
    expect(blink).toBeDefined();
    expect(blink?.disabled).toBe(true);
  });
});
