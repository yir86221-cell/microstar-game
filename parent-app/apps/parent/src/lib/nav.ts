export interface ScreenCtx {
  navigate(path: string): void;
  rerender(): void;
}

export interface ScreenResult {
  el: HTMLElement;
  destroy?: () => void;
}

export type ScreenRenderer = (ctx: ScreenCtx) => ScreenResult;
