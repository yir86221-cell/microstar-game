// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hitRate } from "@microstar/core-domain";

/**
 * 冒烟测试：每个页面真的渲染一遍。
 *
 * 构建通过不代表打得开——少一个节点、拼错类名、store 字段改名字，
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
 * 测试环境里装一个内存版 localStorage。
 *
 * Node 25 自带实验性的 localStorage 全局，会把 jsdom 那份盖掉，
 * `localStorage.clear` 根本不存在——于是 store 的读写永远走 catch 分支，
 * 测试看着是绿的，其实从没验证过持久化和儿童端数据接入。
 */
function resetStorage(): void {
  const map = new Map<string, string>();
  const fake = {
    getItem: (key: string): string | null => (map.has(key) ? map.get(key)! : null),
    setItem: (key: string, value: string): void => {
      map.set(key, String(value));
    },
    removeItem: (key: string): void => {
      map.delete(key);
    },
    clear: (): void => {
      map.clear();
    },
    key: (index: number): string | null => [...map.keys()][index] ?? null,
    get length(): number {
      return map.size;
    },
  };

  try {
    Object.defineProperty(globalThis, "localStorage", {
      value: fake,
      configurable: true,
      writable: true,
    });
  } catch {
    /* 某些运行时不允许改，跳过 */
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
    expect(root.textContent).toContain("发现目标");
    expect(root.textContent).toContain("开始训练");
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
    expect(root.textContent).toContain("发现目标");
  });

  it("训练页：四个阶段页签，关卡数对齐儿童端", async () => {
    const root = await mountAt("#/train");
    const tabs = [...root.querySelectorAll(".phase-tab")];
    expect(tabs.length).toBe(4);
    expect(tabs[0]!.textContent).toContain("10 关");
    expect(tabs[1]!.textContent).toContain("4 关");
    expect(tabs[3]!.textContent).toContain("实物");
  });

  it("训练页：关卡列表用的是儿童端的关卡名", async () => {
    const root = await mountAt("#/train");
    expect(root.textContent).toContain("星球点亮");
    expect(root.querySelectorAll(".level-card").length).toBe(10);
  });

  it("数据页：没有记录时是空状态，不伪造数据", async () => {
    const root = await mountAt("#/data");
    expect(root.textContent).toContain("还没有数据");
    expect(root.textContent).toContain("载入演示数据");
    expect(root.querySelectorAll(".stat").length).toBe(0);
  });

  it("设备页：未连接时只显示「未连接」", async () => {
    const root = await mountAt("#/device");
    expect(root.textContent).toContain("未连接");
    expect(root.textContent).toContain("连不上怎么办");
  });

  it("我的页：档案、安全标记、默认回应方式", async () => {
    const root = await mountAt("#/profile");
    expect(root.textContent).toContain("安全");
    expect(root.textContent).toContain("怕闪");
    expect(root.querySelectorAll('input[type="checkbox"]').length).toBe(3);
    expect(root.querySelectorAll(".mode-chip").length).toBe(3);
  });

  it("参数页是二级页：有下拉，没有 Tab 栏", async () => {
    const root = await mountAt("#/plan");
    expect(root.querySelectorAll("select").length).toBeGreaterThan(0);
    expect(root.querySelector<HTMLElement>("#tabbar")?.style.display).toBe("none");
  });

  it("训练记录页：没记录时给空状态", async () => {
    const root = await mountAt("#/records");
    expect(root.textContent).toContain("还没有训练记录");
    expect(root.querySelector<HTMLElement>("#tabbar")?.style.display).toBe("none");
  });

  it("默认不伪造数据；点了「载入演示数据」才出现且带横幅", async () => {
    const root = await mountAt("#/data");
    const { store } = await import("../src/lib/store.js");

    // 默认必须是空的——否则界面会显示看起来像真的训练记录
    expect(store.state.sessions.length).toBe(0);
    expect(root.textContent).toContain("还没有数据");

    store.loadDemo();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(store.state.isDemo).toBe(true);
    expect(store.state.sessions.length).toBeGreaterThan(0);
    expect(root.textContent).toContain("演示数据");
  });

  it("孩子模式：全屏、有退出区、没有「看到了」按钮", async () => {
    vi.useFakeTimers();
    const root = await mountAt("#/child");
    expect(root.querySelector(".child-exit")).not.toBeNull();
    expect(root.querySelector(".child-hitlayer")).not.toBeNull();
    expect(root.textContent).not.toContain("看到了");
    expect(root.querySelector<HTMLElement>("#tabbar")?.style.display).toBe("none");
  });

  it("实物训练台：标题正确", async () => {
    const root = await mountAt("#/physical");
    expect(root.textContent).toContain("实物训练");
    expect(root.textContent).not.toContain("看到了");
  });

  it("调试台：能挂载并显示字节区", async () => {
    const root = await mountAt("#/debug");
    expect(root.textContent).toContain("最近下发的字节");
    expect(root.textContent).toContain("ALERT");
  });

  it("儿童端写下的成绩会被家长端读进来", async () => {
    vi.resetModules();
    resetStorage();
    // resetStorage 已经装好了干净的内存存储

    const now = Date.now();
    localStorage.setItem(
      "microstar.game.sessions",
      JSON.stringify([
        {
          id: "g-test-1",
          startedAt: now - 3_600_000,
          endedAt: now - 3_500_000,
          phase: 1,
          levelIndex: 0,
          levelName: "星球点亮",
          mode: "slap",
          rounds: [{ latencyMs: 5_200 }, { latencyMs: 6_100 }, { latencyMs: 4_900 }],
        },
      ]),
    );

    document.body.innerHTML = '<div id="root"></div>';
    window.location.hash = "#/records";
    const mod = await import("../src/app.js");
    const root = document.getElementById("root")!;
    mod.mount(root);

    // 关卡名出现在记录列表里，说明儿童端那份数据真的被读进来了
    expect(root.textContent).toContain("星球点亮");
    expect(root.textContent).toContain("儿童端");
  });
  it("未知路由回落到训练页", async () => {
    const root = await mountAt("#/nope");
    expect(root.textContent).toContain("发现目标");
  });

  it("底部标签可以切换页面", async () => {
    const root = await mountAt("#/train");
    const tabs = root.querySelectorAll<HTMLButtonElement>("#tabbar .tab");
    expect([...tabs].map((t) => t.textContent)).toEqual(["训练", "数据", "设备", "我的"]);
    tabs[1]!.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(window.location.hash).toBe("#/data");
    expect(root.textContent).toContain("还没有数据");
  });

  it("勾上「怕闪」后，设备页的闪烁按钮被禁用", async () => {
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

  it("勾选安全标记后，勾选状态保留在页面上", async () => {
    const root = await mountAt("#/profile");
    const before = root.querySelector<HTMLInputElement>("input[type='checkbox']")!;
    before.checked = true;
    before.dispatchEvent(new Event("change"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    // 重绘后仍然是勾上的（滚动位置由 app.ts 控制，只在换页时回到顶部）
    expect(root.querySelector<HTMLInputElement>("input[type='checkbox']")!.checked).toBe(true);
  });
});

describe("儿童端数据接入", () => {
  it("超时回合记为「无反应」，命中率不再恒为 100%", async () => {
    vi.resetModules();
    resetStorage();
    window.localStorage.setItem(
      "microstar.game.sessions",
      JSON.stringify([
        {
          id: "g-timeout-1",
          startedAt: Date.now() - 60_000,
          endedAt: Date.now(),
          phase: 1,
          levelIndex: 0,
          levelName: "星球点亮",
          mode: "slap",
          rounds: [
            { latencyMs: 4_000, ok: true },
            { latencyMs: 6_000, ok: true },
            { latencyMs: null, ok: false },
          ],
        },
      ]),
    );

    const { store } = await import("../src/lib/store.js");
    const session = store.state.sessions[0]!;

    expect(session.origin).toBe("game");
    expect(session.levelName).toBe("星球点亮");
    expect(session.trials.map((t) => t.outcome)).toEqual(["hit", "hit", "noResponse"]);

    const rate = hitRate(session.trials);
    expect(rate.hits).toBe(2);
    expect(rate.valid).toBe(3);
    expect(rate.rate).toBeCloseTo(2 / 3, 10);
  });
});
