import { clear, h } from "./lib/dom.js";
import { icon } from "./lib/icons.js";
import { device } from "./lib/device.js";
import { store } from "./lib/store.js";
import type { ScreenCtx, ScreenRenderer } from "./lib/nav.js";
import { render as train } from "./screens/train.js";
import { render as data } from "./screens/data.js";
import { render as deviceScreen } from "./screens/device.js";
import { render as profile } from "./screens/profile.js";
import { render as plan } from "./screens/plan.js";
import { render as child } from "./screens/child.js";
import { render as physical } from "./screens/physical.js";
import { render as debug } from "./screens/debug.js";

const SCREENS: Record<string, ScreenRenderer> = {
  train,
  data,
  device: deviceScreen,
  profile,
  plan,
  child,
  physical,
  debug,
};

/** 4 个 Tab，开屏落在「训练」——家长打开 App 唯一的动机就是"今天练什么" */
const TABS = [
  { id: "train", label: "训练", icon: "train" },
  { id: "data", label: "数据", icon: "data" },
  { id: "device", label: "设备", icon: "device" },
  { id: "profile", label: "我的", icon: "profile" },
];

const DEFAULT_ROUTE = "train";

/** 这些页面占满整屏，不显示底部标签栏 */
const FULL_SCREEN = new Set(["child", "physical", "plan", "debug"]);

let view: HTMLElement;
let tabbar: HTMLElement;
let cleanup: (() => void) | null = null;
let pending = false;

function currentRoute(): string {
  const raw = location.hash.replace(/^#\/?/, "");
  return raw.split("?")[0] || DEFAULT_ROUTE;
}

export function navigate(path: string): void {
  if (currentRoute() === path) {
    scheduleRender();
    return;
  }
  location.hash = `#/${path}`;
}

/**
 * 合并同一轮里的多次重绘请求。
 * 否则 store 变更和事件处理会各触发一次，导致滑杆跳、页面闪。
 */
function scheduleRender(): void {
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    render();
  });
}

function render(): void {
  const id = currentRoute();
  if (FULL_SCREEN.has(id) && view.dataset.route === id) {
    // 全屏页（训练场 / 实物训练台）自己管理更新，不能被外部重绘打断
    return;
  }

  const screen = SCREENS[id] ?? SCREENS[DEFAULT_ROUTE]!;
  cleanup?.();
  cleanup = null;

  const ctx: ScreenCtx = { navigate, rerender: scheduleRender };
  const result = screen(ctx);
  cleanup = result.destroy ?? null;

  clear(view);
  view.append(result.el);
  view.dataset.route = id;

  buildTabbar(id);

  if (!navigator.userAgent.includes("jsdom")) {
    window.scrollTo(0, 0);
  }
}

function buildTabbar(active: string): void {
  const full = FULL_SCREEN.has(active);
  tabbar.style.display = full ? "none" : "flex";
  if (full) return;

  tabbar.replaceChildren(
    ...TABS.map((tab) =>
      h(
        "button",
        {
          class: `tab ${tab.id === active ? "active" : ""}`,
          onClick: () => navigate(tab.id),
        },
        icon(tab.icon, 21),
        h("span", null, tab.label),
      ),
    ),
  );
}

export function mount(root: HTMLElement): void {
  root.innerHTML = "";
  view = h("main", { id: "view" });
  tabbar = h("nav", { id: "tabbar" });
  root.append(view, tabbar);

  window.addEventListener("hashchange", () => scheduleRender());

  store.subscribe(() => {
    if (!FULL_SCREEN.has(currentRoute())) scheduleRender();
  });

  device.onState(() => {
    if (!FULL_SCREEN.has(currentRoute())) scheduleRender();
  });

  if (!location.hash) location.hash = `#/${DEFAULT_ROUTE}`;
  render();
}
