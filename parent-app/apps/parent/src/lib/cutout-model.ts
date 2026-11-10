import type { CutoutReply, CutoutRequest, CutoutStage } from './cutout-protocol.js';

export const CUTOUT_TIMEOUT_MS = 45_000;
export class CutoutError extends Error {
  constructor(public readonly code: 'cancelled' | 'timeout' | 'unavailable' | 'closed' | 'busy') { super(code); }
}
type Result = { mask: Uint8ClampedArray; width: number; height: number };
type Job = { id: number; timer: ReturnType<typeof setTimeout>; resolve(value: Result): void; reject(error: Error): void; progress(stage: CutoutStage): void };

/** Only messages cross the UI thread. Loading, image decoding and inference stay in a worker. */
export class CutoutModel {
  private worker: Worker | null = null;
  private job: Job | null = null;
  private serial = 0;
  private closed = false;

  constructor(private readonly makeWorker = () => new Worker(new URL('./cutout.worker.ts', import.meta.url), { type: 'module' })) {}

  select(image: HTMLImageElement, x: number, y: number, progress: (stage: CutoutStage) => void = () => {}): Promise<Result> {
    if (this.closed) return Promise.reject(new CutoutError('closed'));
    if (this.job) return Promise.reject(new CutoutError('busy'));
    return new Promise((resolve, reject) => {
      try {
        const worker = this.worker ??= this.makeWorker();
        const id = ++this.serial;
        const timer = setTimeout(() => this.stop(new CutoutError('timeout')), CUTOUT_TIMEOUT_MS);
        this.job = { id, timer, resolve, reject, progress };
        worker.onmessage = (event: MessageEvent<CutoutReply>) => {
          const reply = event.data, job = this.job;
          if (this.worker !== worker || !job || reply.id !== job.id) return;
          if (reply.type === 'progress') { job.progress(reply.stage); return; }
          if (reply.type === 'error') { console.warn('Background cutout unavailable:', reply.message); this.stop(new CutoutError('unavailable')); return; }
          clearTimeout(job.timer); this.job = null;
          job.resolve({ mask: reply.mask, width: reply.width, height: reply.height });
        };
        worker.onerror = worker.onmessageerror = () => {
          if (this.worker === worker) this.stop(new CutoutError('unavailable'));
        };
        const request: CutoutRequest = { id, source: image.src, x, y, base: new URL('./cutout/', document.baseURI).href };
        worker.postMessage(request);
      } catch {
        this.stop(new CutoutError('unavailable'));
        reject(new CutoutError('unavailable'));
      }
    });
  }

  private stop(error: CutoutError): void {
    const job = this.job; this.job = null;
    this.worker?.terminate(); this.worker = null;
    if (job) { clearTimeout(job.timer); job.reject(error); }
  }
  cancel(): void { this.stop(new CutoutError('cancelled')); }
  close(): void { this.closed = true; this.stop(new CutoutError('closed')); }
}
