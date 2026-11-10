import { FilesetResolver, InteractiveSegmenter } from '@mediapipe/tasks-vision';
import type { CutoutReply, CutoutRequest, CutoutStage } from './cutout-protocol.js';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<CutoutRequest>) => void) | null;
  postMessage(message: CutoutReply, transfer?: Transferable[]): void;
};
let task: InteractiveSegmenter | null = null;
let image: ImageBitmap | null = null;
let source = '';
let busy = false;

scope.onmessage = async ({ data: request }) => {
  if (busy) return;
  busy = true;
  const { id, x, y, base } = request;
  const progress = (stage: CutoutStage) => scope.postMessage({ id, type: 'progress', stage });
  try {
    // Never fall back to running the heavy model on the page thread.
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') throw Error('unsupported');
    if (!task) {
      progress('loading');
      task = await InteractiveSegmenter.createFromOptions(await FilesetResolver.forVisionTasks(base + 'wasm', true), {
        baseOptions: { modelAssetPath: base + 'magic-touch.task', delegate: 'CPU' },
      });
    }
    if (source !== request.source) {
      progress('encoding');
      const next = await createImageBitmap(await (await fetch(request.source)).blob());
      try { task.setImage(next); } catch (error) { next.close(); throw error; }
      image?.close(); image = next; source = request.source;
    }
    progress('segmenting');
    const result = task.segment([{ brushMode: 1, point: [{ x, y }], isCompleted: true }]);
    try {
      const scores = result.getAsFloat32Array();
      const width = image!.width, height = image!.height;
      const mask = new Uint8ClampedArray(width * height);
      for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
        const score = scores[Math.min(result.height - 1, Math.floor(row * result.height / height)) * result.width + Math.min(result.width - 1, Math.floor(col * result.width / width))]!;
        mask[row * width + col] = Math.round(Math.max(0, Math.min(1, (score - .35) / .3)) * 255);
      }
      scope.postMessage({ id, type: 'result', width, height, mask }, [mask.buffer]);
    } finally { result.close(); }
  } catch (error) {
    task?.close(); task = null; image?.close(); image = null; source = '';
    scope.postMessage({ id, type: 'error', message: error instanceof Error ? error.message : 'Model failed' });
  } finally { busy = false; }
};
