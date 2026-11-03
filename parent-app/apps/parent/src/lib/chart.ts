/**
 * 极小的折线图，手写 SVG。
 * 不引图表库：家长端只需要看"这一周是不是在变好"，不需要交互式图表。
 */
export interface ChartOptions {
  height?: number;
  /** 0–1 的比例值 */
  values: number[];
  labels?: string[];
  stroke?: string;
}

const W = 320;
const PAD_X = 10;
const PAD_TOP = 12;
const PAD_BOTTOM = 16;

export function lineChart({
  values,
  labels,
  height = 130,
  stroke = "#ff5a36",
}: ChartOptions): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${height}`);
  svg.setAttribute("class", "chart");
  svg.setAttribute("preserveAspectRatio", "none");

  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const plotW = W - PAD_X * 2;

  const yFor = (v: number): number => PAD_TOP + plotH * (1 - v);
  const xFor = (i: number): number =>
    values.length <= 1 ? W / 2 : PAD_X + (plotW * i) / (values.length - 1);

  // 网格：0 / 50% / 100%
  for (const level of [0, 0.5, 1]) {
    const line = document.createElementNS(ns, "line");
    line.setAttribute("x1", String(PAD_X));
    line.setAttribute("x2", String(W - PAD_X));
    line.setAttribute("y1", String(yFor(level)));
    line.setAttribute("y2", String(yFor(level)));
    line.setAttribute("stroke", "#26272e");
    line.setAttribute("stroke-width", "1");
    if (level !== 0) line.setAttribute("stroke-dasharray", "3 5");
    svg.append(line);
  }

  if (values.length === 0) return svg;

  const points = values.map((v, i) => [xFor(i), yFor(v)] as const);

  if (points.length > 1) {
    const area = document.createElementNS(ns, "path");
    const d =
      `M ${points[0]![0]} ${height - PAD_BOTTOM} ` +
      points.map(([x, y]) => `L ${x} ${y}`).join(" ") +
      ` L ${points[points.length - 1]![0]} ${height - PAD_BOTTOM} Z`;
    area.setAttribute("d", d);
    area.setAttribute("fill", "rgba(255,90,54,0.12)");
    svg.append(area);

    const path = document.createElementNS(ns, "path");
    path.setAttribute(
      "d",
      points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" "),
    );
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", stroke);
    path.setAttribute("stroke-width", "2.5");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("vector-effect", "non-scaling-stroke");
    svg.append(path);
  }

  // 最后一个点高亮
  const last = points[points.length - 1]!;
  const dot = document.createElementNS(ns, "circle");
  dot.setAttribute("cx", String(last[0]));
  dot.setAttribute("cy", String(last[1]));
  dot.setAttribute("r", "4");
  dot.setAttribute("fill", stroke);
  svg.append(dot);

  if (labels && labels.length === values.length) {
    const first = document.createElementNS(ns, "text");
    first.setAttribute("x", String(PAD_X));
    first.setAttribute("y", String(height - 3));
    first.setAttribute("fill", "#6d7080");
    first.setAttribute("font-size", "10");
    first.textContent = labels[0] ?? "";
    svg.append(first);

    const lastLabel = document.createElementNS(ns, "text");
    lastLabel.setAttribute("x", String(W - PAD_X));
    lastLabel.setAttribute("y", String(height - 3));
    lastLabel.setAttribute("fill", "#6d7080");
    lastLabel.setAttribute("font-size", "10");
    lastLabel.setAttribute("text-anchor", "end");
    lastLabel.textContent = labels[labels.length - 1] ?? "";
    svg.append(lastLabel);
  }

  return svg;
}
