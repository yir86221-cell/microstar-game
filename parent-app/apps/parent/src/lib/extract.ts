/**
 * 照片提纯：把家长拍的一张实物照，变成"黑底、单色、轮廓清晰"的训练素材。
 *
 * 两条路：
 *  1. 本地抠图（默认）：色差 + 连通域 + 形态学，纯前端、不上传。
 *  2. 云端抠图（可选）：配了 endpoint 就调它，拿回透明 PNG 再本地单色化。
 *
 * 服务端只负责"把主体抠出来"，所有产品化处理都在本地——
 * 这样换模型、换供应商都不影响产品层。
 */

export interface ExtractConfig {
  endpoint: string;
  key: string;
}

const CONFIG_KEY = "microstar.extract-config.v1";

export function readExtractConfig(): ExtractConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return { endpoint: "", key: "" };
    const parsed = JSON.parse(raw) as Partial<ExtractConfig>;
    return { endpoint: String(parsed.endpoint ?? ""), key: String(parsed.key ?? "") };
  } catch {
    return { endpoint: "", key: "" };
  }
}

export function saveExtractConfig(config: ExtractConfig): void {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* 忽略 */
  }
}

export interface ExtractResult {
  /** 黑底单色图，dataURL */
  image: string;
  /** 菜单缩略图 */
  thumb: string;
  /** 单色化的主色 */
  color: string;
  /** 主体占画面的比例 */
  subjectRatio: number;
  /** 用的是什么通道 */
  via: "local" | "api";
  /** 质量闸门没过的原因；空数组表示通过 */
  problems: string[];
}

// ---------------------------------------------------------------- 基础工具

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片读取失败"));
    img.src = src;
  });
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** 缩放到最长边 maxSide，并转成 JPEG（顺带剥掉 EXIF，里面可能有 GPS） */
export async function preparePhoto(dataUrl: string, maxSide = 512): Promise<string> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持 canvas");
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.82);
}

// ---------------------------------------------------------------- 本地抠图

type Rgb = { r: number; g: number; b: number };

/** 取四条边的像素，各自分量求中位数，得到背景色 */
function sampleBackground(data: Uint8ClampedArray, w: number, h: number): Rgb {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const push = (x: number, y: number): void => {
    const i = (y * w + x) * 4;
    rs.push(data[i]!);
    gs.push(data[i + 1]!);
    bs.push(data[i + 2]!);
  };
  const step = Math.max(1, Math.floor(Math.min(w, h) / 96));
  for (let x = 0; x < w; x += step) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y += step) {
    push(0, y);
    push(w - 1, y);
  }
  const med = (arr: number[]): number => {
    arr.sort((a, b) => a - b);
    return arr[Math.floor(arr.length / 2)] ?? 0;
  };
  return { r: med(rs), g: med(gs), b: med(bs) };
}

/** 色差：亮度差异权重大一些，暗部也能分开（近似 LAB 的效果） */
function colorDistance(r: number, g: number, b: number, bg: Rgb): number {
  const dr = r - bg.r;
  const dg = g - bg.g;
  const db = b - bg.b;
  const lum = (dr * 0.3 + dg * 0.59 + db * 0.11) * 1.6;
  const chroma = Math.sqrt(dr * dr + dg * dg + db * db);
  return Math.abs(lum) * 0.6 + chroma * 0.4;
}

/** Otsu：把色差直方图劈成前景/背景 */
function otsu(hist: number[], total: number): number {
  let sum = 0;
  for (let i = 0; i < hist.length; i += 1) sum += i * hist[i]!;
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let bestVar = -1;
  for (let t = 0; t < hist.length; t += 1) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      best = t;
    }
  }
  return best;
}

/** 只保留最大连通块 */
function keepLargest(mask: Uint8Array, w: number, h: number): void {
  const label = new Int32Array(w * h).fill(-1);
  const stack: number[] = [];
  let best = -1;
  let bestSize = 0;
  let current = 0;

  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 1 || label[start] !== -1) continue;
    let size = 0;
    stack.push(start);
    label[start] = current;
    while (stack.length > 0) {
      const p = stack.pop()!;
      size += 1;
      const x = p % w;
      const y = (p - x) / w;
      const neighbours = [
        x > 0 ? p - 1 : -1,
        x < w - 1 ? p + 1 : -1,
        y > 0 ? p - w : -1,
        y < h - 1 ? p + w : -1,
      ];
      for (const n of neighbours) {
        if (n < 0 || mask[n] !== 1 || label[n] !== -1) continue;
        label[n] = current;
        stack.push(n);
      }
    }
    if (size > bestSize) {
      bestSize = size;
      best = current;
    }
    current += 1;
  }

  for (let i = 0; i < mask.length; i += 1) {
    if (label[i] !== best) mask[i] = 0;
  }
}

/** 从边界灌水找背景，把内部空洞补回来 */
function fillHoles(mask: Uint8Array, w: number, h: number): void {
  const outside = new Uint8Array(w * h);
  const stack: number[] = [];
  const pushIf = (p: number): void => {
    if (mask[p] === 0 && outside[p] === 0) {
      outside[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x += 1) {
    pushIf(x);
    pushIf((h - 1) * w + x);
  }
  for (let y = 0; y < h; y += 1) {
    pushIf(y * w);
    pushIf(y * w + w - 1);
  }
  while (stack.length > 0) {
    const p = stack.pop()!;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) pushIf(p - 1);
    if (x < w - 1) pushIf(p + 1);
    if (y > 0) pushIf(p - w);
    if (y < h - 1) pushIf(p + w);
  }
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] === 0 && outside[i] === 0) mask[i] = 1;
  }
}

function erode(src: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(src.length);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      if (
        src[i] === 1 &&
        src[i - 1] === 1 &&
        src[i + 1] === 1 &&
        src[i - w] === 1 &&
        src[i + w] === 1
      ) {
        out[i] = 1;
      }
    }
  }
  return out;
}

function dilate(src: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(src.length);
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      if (
        src[i] === 1 ||
        src[i - 1] === 1 ||
        src[i + 1] === 1 ||
        src[i - w] === 1 ||
        src[i + w] === 1
      ) {
        out[i] = 1;
      }
    }
  }
  return out;
}

export interface MaskResult {
  mask: Uint8Array;
  w: number;
  h: number;
  background: Rgb;
}

export function buildMask(data: Uint8ClampedArray, w: number, h: number): MaskResult {
  const bg = sampleBackground(data, w, h);
  const total = w * h;
  const distances = new Float32Array(total);
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < total; i += 1) {
    const p = i * 4;
    const d = colorDistance(data[p]!, data[p + 1]!, data[p + 2]!, bg);
    distances[i] = d;
    hist[clamp(Math.round(d), 0, 255)]! += 1;
  }
  const threshold = Math.max(12, otsu(hist, total));

  let mask: Uint8Array = new Uint8Array(total);
  for (let i = 0; i < total; i += 1) mask[i] = distances[i]! >= threshold ? 1 : 0;

  keepLargest(mask, w, h);
  fillHoles(mask, w, h);
  mask = dilate(erode(mask, w, h), w, h); // 开运算去毛刺

  return { mask, w, h, background: bg };
}

export function boundingBox(mask: Uint8Array, w: number, h: number): [number, number, number, number] {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (mask[y * w + x] !== 1) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? [0, 0, 0, 0] : [minX, minY, maxX, maxY];
}

/** 前景像素的中位色，用来单色化 */
function dominantColor(data: Uint8ClampedArray, mask: Uint8Array): string {
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let i = 0; i < mask.length; i += 1) {
    if (mask[i] !== 1) continue;
    const p = i * 4;
    rs.push(data[p]!);
    gs.push(data[p + 1]!);
    bs.push(data[p + 2]!);
  }
  if (rs.length === 0) return "#ff2d2d";
  const med = (arr: number[]): number => {
    arr.sort((a, b) => a - b);
    return arr[Math.floor(arr.length / 2)] ?? 0;
  };
  const hex = (v: number): string => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0");
  return `#${hex(med(rs))}${hex(med(gs))}${hex(med(bs))}`;
}

/** 把掩膜画成黑底单色图，四周留 8% 白边 */
function renderMasked(
  data: Uint8ClampedArray,
  mask: Uint8Array,
  w: number,
  h: number,
  color: string,
  size: number,
): string {
  const [minX, minY, maxX, maxY] = boundingBox(mask, w, h);
  const bw = Math.max(1, maxX - minX + 1);
  const bh = Math.max(1, maxY - minY + 1);
  const inner = Math.round(size * 0.84);
  const scale = Math.min(inner / bw, inner / bh);
  const dw = Math.max(1, Math.round(bw * scale));
  const dh = Math.max(1, Math.round(bh * scale));

  const out = document.createElement("canvas");
  out.width = size;
  out.height = size;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持 canvas");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);

  const shape = document.createElement("canvas");
  shape.width = bw;
  shape.height = bh;
  const sctx = shape.getContext("2d");
  if (!sctx) throw new Error("浏览器不支持 canvas");
  const imageData = sctx.createImageData(bw, bh);
  for (let y = 0; y < bh; y += 1) {
    for (let x = 0; x < bw; x += 1) {
      const src = (y + minY) * w + (x + minX);
      const dst = (y * bw + x) * 4;
      if (mask[src] === 1) {
        const p = src * 4;
        imageData.data[dst] = data[p]!;
        imageData.data[dst + 1] = data[p + 1]!;
        imageData.data[dst + 2] = data[p + 2]!;
        imageData.data[dst + 3] = 255;
      }
    }
  }
  sctx.putImageData(imageData, 0, 0);

  // 用主色重绘一遍，只保留轮廓
  const colored = document.createElement("canvas");
  colored.width = bw;
  colored.height = bh;
  const cctx = colored.getContext("2d");
  if (!cctx) throw new Error("浏览器不支持 canvas");
  cctx.drawImage(shape, 0, 0);
  cctx.globalCompositeOperation = "source-in";
  cctx.fillStyle = color;
  cctx.fillRect(0, 0, bw, bh);

  ctx.drawImage(colored, Math.round((size - dw) / 2), Math.round((size - dh) / 2), dw, dh);
  return out.toDataURL("image/png");
}

function makeThumb(image: string, size = 160): string {
  // 同步缩略图：用一个临时 canvas
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return image;
  const img = new Image();
  // 缩略图是同步生成的最后一步，画不出来就用原图，不影响主流程
  try {
    img.src = image;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    return canvas.toDataURL("image/png");
  } catch {
    return image;
  }
}

// ---------------------------------------------------------------- 对外

/** 本地抠图。不上传，300ms 量级。 */
export async function extractLocal(preparedDataUrl: string): Promise<ExtractResult> {
  const img = await loadImage(preparedDataUrl);
  const w = img.width;
  const h = img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持 canvas");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;

  const { mask } = buildMask(data, w, h);
  const [minX, minY, maxX, maxY] = boundingBox(mask, w, h);

  let foreground = 0;
  let touchingBorder = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (mask[y * w + x] !== 1) continue;
      foreground += 1;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchingBorder += 1;
    }
  }

  const subjectRatio = foreground / (w * h);
  const color = dominantColor(data, mask);
  const problems: string[] = [];
  if (subjectRatio < 0.06) problems.push("没找到明显的主体，换个角度或让物品占满取景框");
  if (subjectRatio > 0.92) problems.push("背景几乎全是主体，换一块纯色背景再拍");
  if (touchingBorder > foreground * 0.08) problems.push("物品被拍出了画面边缘，拍全一点");
  if (maxX < minX) problems.push("没有分出去主体和背景");

  return {
    image: renderMasked(data, mask, w, h, color, 1024),
    thumb: "",
    color,
    subjectRatio,
    via: "local",
    problems,
  };
}

/**
 * 云端抠图。服务端只做一件事：返回透明背景的 PNG。
 * 拿回之后在本地做单色化和质量闸门，所以换供应商不影响产品层。
 */
export async function extractViaApi(
  preparedDataUrl: string,
  config: ExtractConfig,
): Promise<ExtractResult> {
  // 契约：POST JSON { image } → { png }
  // 对接的是我们自己的 /extract 代理，不是厂商接口。
  // 厂商的 AccessKey 在服务端，前端拿不到，家长也不用填。
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.key ? { "x-extract-token": config.key } : {}),
    },
    body: JSON.stringify({ image: preparedDataUrl }),
  });
  if (!response.ok) throw new Error(`抠图服务返回 ${response.status}`);

  const payload: unknown = await response.json();
  const b64 = (payload as { png?: string }).png;
  if (typeof b64 !== "string") {
    const detail = (payload as { error?: string }).error;
    throw new Error(detail ? `抠图服务出错：${detail}` : "抠图服务返回的数据看不懂");
  }

  const cutout = `data:image/png;base64,${b64}`;
  const img = await loadImage(cutout);
  const w = img.width;
  const h = img.height;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("浏览器不支持 canvas");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;

  // 服务端给的是带 alpha 的图，alpha > 128 就是主体
  const mask = new Uint8Array(w * h);
  let foreground = 0;
  for (let i = 0; i < w * h; i += 1) {
    if (data[i * 4 + 3]! > 128) {
      mask[i] = 1;
      foreground += 1;
    }
  }
  const subjectRatio = foreground / (w * h);
  const color = dominantColor(data, mask);
  const problems: string[] = [];
  if (subjectRatio < 0.04) problems.push("抠出来的主体太小，重拍一张");
  if (subjectRatio > 0.95) problems.push("主体几乎占满画面，留一点背景再拍");

  return {
    image: renderMasked(data, mask, w, h, color, 1024),
    thumb: "",
    color,
    subjectRatio,
    via: "api",
    problems,
  };
}

/** 有配置就走云端，没配置（或失败）走本地 */
export async function extract(preparedDataUrl: string): Promise<ExtractResult> {
  const config = readExtractConfig();
  if (config.endpoint) {
    try {
      const result = await extractViaApi(preparedDataUrl, config);
      return { ...result, thumb: makeThumb(result.image) };
    } catch (error) {
      console.warn("云端抠图失败，退回本地", error);
    }
  }
  const result = await extractLocal(preparedDataUrl);
  return { ...result, thumb: makeThumb(result.image) };
}
