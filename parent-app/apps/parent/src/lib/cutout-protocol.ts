export type CutoutStage = 'loading' | 'encoding' | 'segmenting';
export type CutoutRequest = { id: number; source: string; base: string; x: number; y: number };
export type CutoutReply =
  | { id: number; type: 'progress'; stage: CutoutStage }
  | { id: number; type: 'result'; width: number; height: number; mask: Uint8ClampedArray }
  | { id: number; type: 'error'; message?: string };
