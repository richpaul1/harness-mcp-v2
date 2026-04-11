/**
 * Local PNG chart rendering (no network) — bar and line charts for CCM summaries.
 */

import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import type { CcmChartSpec } from "./ccm-chart-spec.js";

const BG = "#ffffff";
const AXIS = "#374151";
const GRID = "#e5e7eb";
const BAR = "#2563eb";
const LINE = "#1d4ed8";
const FILL = "rgba(37, 99, 235, 0.12)";
const GROUPED_DEFAULT_COLORS = ["#22c55e", "#ef4444", "#2563eb", "#a855f7", "#f97316", "#0ea5e9", "#eab308"];

export interface ChartRenderOptions {
  width: number;
  height: number;
}

export function renderCcmChartPng(spec: CcmChartSpec, opts: ChartRenderOptions): Buffer {
  if (spec.kind === "grouped_bar") {
    return renderGroupedBarPng(spec, opts);
  }

  const { width: W, height: H } = opts;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  const pad = { l: 72, r: 28, t: spec.title ? 52 : 36, b: 88 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  ctx.fillStyle = "#111827";
  ctx.font = "16px sans-serif";
  if (spec.title) {
    ctx.fillText(spec.title, pad.l, 28);
  }

  const points = spec.points;
  const values = points.map((p) => p.value);
  let vmin = Math.min(...values);
  let vmax = Math.max(...values);
  if (vmin === vmax) {
    vmin = vmin === 0 ? -1 : vmin * 0.9;
    vmax = vmax === 0 ? 1 : vmax * 1.1;
  }
  const padY = (vmax - vmin) * 0.06 || 1;
  vmin -= padY;
  vmax += padY;

  const x0 = pad.l;
  const y0 = pad.t + plotH;
  const x1 = pad.l + plotW;
  const y1 = pad.t;

  ctx.strokeStyle = AXIS;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y0);
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y1);
  ctx.stroke();

  // Horizontal grid lines
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  const gridN = 5;
  for (let g = 0; g <= gridN; g++) {
    const t = g / gridN;
    const y = y0 - t * plotH;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    const v = vmin + t * (vmax - vmin);
    ctx.fillStyle = "#6b7280";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(formatTick(v), x0 - 8, y + 4);
  }

  if (spec.y_label) {
    ctx.save();
    ctx.translate(18, pad.t + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#4b5563";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(spec.y_label, 0, 0);
    ctx.restore();
  }

  const n = points.length;
  const mapY = (v: number) => y0 - ((v - vmin) / (vmax - vmin)) * plotH;

  if (spec.kind === "bar" && n > 0) {
    const gap = 4;
    const bw = Math.max(2, (plotW - gap * (n + 1)) / n);
    ctx.fillStyle = BAR;
    points.forEach((p, i) => {
      const x = x0 + gap + i * (bw + gap);
      const y = mapY(p.value);
      const h = y0 - y;
      ctx.fillRect(x, y, bw, h);
    });
    drawBarLabels(ctx, points, x0, y0, gap, bw, W);
  } else if (spec.kind === "line" && n > 0) {
    const step = n > 1 ? plotW / (n - 1) : plotW;
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = n === 1 ? x0 + plotW / 2 : x0 + i * step;
      const y = mapY(p.value);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = FILL;
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = n === 1 ? x0 + plotW / 2 : x0 + i * step;
      const y = mapY(p.value);
      if (i === 0) ctx.moveTo(x, y0);
      ctx.lineTo(x, y);
    });
    const lastX = n === 1 ? x0 + plotW / 2 : x0 + (n - 1) * step;
    ctx.lineTo(lastX, y0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = LINE;
    points.forEach((p, i) => {
      const x = n === 1 ? x0 + plotW / 2 : x0 + i * step;
      const y = mapY(p.value);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    drawLineLabels(ctx, points, x0, y0, step, n, plotW);
  }

  return canvas.toBuffer("image/png");
}

function renderGroupedBarPng(
  spec: Extract<CcmChartSpec, { kind: "grouped_bar" }>,
  opts: ChartRenderOptions,
): Buffer {
  const { width: W, height: H } = opts;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  const legendH = spec.series.length > 0 ? 22 : 0;
  const topBase = spec.title ? 52 : 36;
  const pad = { l: 72, r: 28, t: topBase + legendH + 8, b: 88 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  ctx.fillStyle = "#111827";
  ctx.font = "16px sans-serif";
  if (spec.title) {
    ctx.fillText(spec.title, pad.l, 28);
  }

  // Legend (top, left under title)
  let lx = pad.l;
  const legY = spec.title ? 44 : 28;
  spec.series.forEach((s, si) => {
    const col = s.color ?? GROUPED_DEFAULT_COLORS[si % GROUPED_DEFAULT_COLORS.length] ?? BAR;
    ctx.fillStyle = col;
    ctx.fillRect(lx, legY, 10, 10);
    ctx.fillStyle = "#374151";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "left";
    const lab = s.label.length > 42 ? `${s.label.slice(0, 40)}…` : s.label;
    ctx.fillText(lab, lx + 14, legY + 9);
    lx += ctx.measureText(lab).width + 32;
  });

  const points = spec.points;
  const series = spec.series;
  const k = series.length;
  const allVals: number[] = [];
  for (const p of points) {
    for (const s of series) {
      const v = p.values[s.key];
      if (typeof v === "number" && Number.isFinite(v)) allVals.push(v);
    }
  }
  let vmin = allVals.length ? Math.min(...allVals) : 0;
  let vmax = allVals.length ? Math.max(...allVals) : 1;
  if (vmin > 0) vmin = 0;
  if (vmin === vmax) {
    vmin = 0;
    vmax = vmax === 0 ? 1 : vmax * 1.1;
  }
  const padY = (vmax - vmin) * 0.06 || 1;
  vmin -= padY;
  vmax += padY;

  const x0 = pad.l;
  const y0 = pad.t + plotH;
  const x1 = pad.l + plotW;
  const y1 = pad.t;

  ctx.strokeStyle = AXIS;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y0);
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y1);
  ctx.stroke();

  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  const gridN = 5;
  for (let g = 0; g <= gridN; g++) {
    const t = g / gridN;
    const y = y0 - t * plotH;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    const v = vmin + t * (vmax - vmin);
    ctx.fillStyle = "#6b7280";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(formatTick(v), x0 - 8, y + 4);
  }

  if (spec.y_label) {
    ctx.save();
    ctx.translate(18, pad.t + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#4b5563";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(spec.y_label, 0, 0);
    ctx.restore();
  }

  const n = points.length;
  const mapY = (v: number) => y0 - ((v - vmin) / (vmax - vmin)) * plotH;
  const gap = 6;
  const groupW = n > 0 ? Math.max(4, (plotW - gap * (n + 1)) / n) : 4;
  const innerPad = 4;
  const barGap = 2;
  const barW =
    k > 0 ? Math.max(2, (groupW - innerPad * 2 - barGap * (k - 1)) / k) : 2;

  for (let i = 0; i < n; i++) {
    const gx = x0 + gap + i * (groupW + gap) + innerPad;
    for (let j = 0; j < k; j++) {
      const s = series[j];
      if (!s) continue;
      const col = s.color ?? GROUPED_DEFAULT_COLORS[j % GROUPED_DEFAULT_COLORS.length] ?? BAR;
      const raw = points[i]?.values[s.key];
      const val = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
      const x = gx + j * (barW + barGap);
      const y = mapY(val);
      const h = y0 - y;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, barW, h);
    }
  }

  drawBarLabels(ctx, points, x0, y0, gap, groupW, W);

  return canvas.toBuffer("image/png");
}

function formatTick(v: number): string {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  if (Math.abs(v) < 0.01 && v !== 0) return v.toExponential(1);
  return v.toFixed(v % 1 === 0 ? 0 : 2);
}

function drawBarLabels(
  ctx: SKRSContext2D,
  points: { label: string }[],
  x0: number,
  y0: number,
  gap: number,
  bw: number,
  canvasW: number,
): void {
  ctx.fillStyle = "#4b5563";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  const maxLab = Math.max(8, Math.floor(520 / Math.max(points.length, 1)));
  points.forEach((p, i) => {
    const x = x0 + gap + i * (bw + gap) + bw / 2;
    const lab = p.label.length > maxLab ? `${p.label.slice(0, maxLab - 1)}…` : p.label;
    ctx.fillText(lab, x, y0 + 14);
  });
  ctx.textAlign = "start";

  // Prevent labels spilling past canvas
  if (points.length > 18) {
    ctx.fillStyle = "#9ca3af";
    ctx.font = "10px sans-serif";
    ctx.fillText("(labels truncated)", Math.min(x0, canvasW - 120), y0 + 28);
  }
}

function drawLineLabels(
  ctx: SKRSContext2D,
  points: { label: string }[],
  x0: number,
  y0: number,
  step: number,
  n: number,
  plotW: number,
): void {
  ctx.fillStyle = "#4b5563";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  const showEvery = n > 14 ? Math.ceil(n / 14) : 1;
  for (let i = 0; i < n; i++) {
    if (i % showEvery !== 0 && i !== n - 1) continue;
    const p = points[i];
    if (!p) continue;
    const x = n === 1 ? x0 + plotW / 2 : x0 + i * step;
    const lab = p.label.length > 12 ? `${p.label.slice(0, 10)}…` : p.label;
    ctx.fillText(lab, x, y0 + 14);
  }
  ctx.textAlign = "start";
}
