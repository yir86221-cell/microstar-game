/** 极简 DOM 构造器：不引框架，保持产物小、Capacitor 里好调试。 */

export type Child = Node | string | number | null | undefined | false;

type Props = Record<string, unknown>;

export function h(
  tag: string,
  props?: Props | null,
  ...children: Child[]
): HTMLElement {
  const el = document.createElement(tag);

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;

      if (key.startsWith("on") && typeof value === "function") {
        el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
        continue;
      }
      if (key === "class") {
        el.className = String(value);
        continue;
      }
      if (key === "dataset") {
        Object.assign(el.dataset, value as Record<string, string>);
        continue;
      }
      if (key === "style" && typeof value === "object") {
        Object.assign(el.style, value as Partial<CSSStyleDeclaration>);
        continue;
      }
      if (key === "html") {
        el.innerHTML = String(value);
        continue;
      }
      if (key in el) {
        (el as unknown as Record<string, unknown>)[key] = value;
        continue;
      }
      el.setAttribute(key, String(value));
    }
  }

  appendAll(el, children);
  return el;
}

export function appendAll(el: HTMLElement, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function clear(el: HTMLElement): void {
  while (el.firstChild) el.firstChild.remove();
}

export const text = (s: string): HTMLElement => h("span", null, s);

/** 常用组合，省得每屏都写一遍 */
export const card = (...children: Child[]): HTMLElement =>
  h("section", { class: "card" }, ...children);

export const cardTitle = (title: string, hint?: string): HTMLElement =>
  h(
    "div",
    { class: "card-head" },
    h("h2", null, title),
    hint ? h("span", { class: "card-hint" }, hint) : null,
  );

export const row = (...children: Child[]): HTMLElement =>
  h("div", { class: "row" }, ...children);

export const spacer = (): HTMLElement => h("div", { class: "spacer" });
