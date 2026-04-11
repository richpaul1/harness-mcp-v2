/**
 * Local PNG chart rendering (no network) — bar and line charts for CCM summaries.
 * Modern Premium Dark Theme enabled.
 */

import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import type { CcmChartSpec } from "./ccm-chart-spec.js";

// Modern Dark Theme Colors
const BG = "#09090b"; // Zinc 950
const AXIS = "#27272a"; // Zinc 800
const GRID = "#27272a"; // Zinc 800
const TEXT_PRIMARY = "#f4f4f5"; // Zinc 100
const TEXT_SECONDARY = "#a1a1aa"; // Zinc 400

// Gradients & Colors
const BAR_TOP = "#818cf8"; // Indigo 400
const BAR_BOTTOM = "#4f46e5"; // Indigo 600
const LINE_COLOR = "#818cf8"; // Indigo 400
const LINE_FILL_TOP = "rgba(129, 140, 248, 0.4)";
const LINE_FILL_BOTTOM = "rgba(129, 140, 248, 0.0)";

const GROUPED_COLORS = [
  { top: "#34d399", bottom: "#059669" }, // Emerald
  { top: "#f472b6", bottom: "#db2777" }, // Pink
  { top: "#818cf8", bottom: "#4f46e5" }, // Indigo
  { top: "#c084fc", bottom: "#9333ea" }, // Purple
  { top: "#fb923c", bottom: "#ea580c" }, // Orange
  { top: "#38bdf8", bottom: "#0284c7" }, // Sky
  { top: "#facc15", bottom: "#ca8a04" }, // Yellow
];

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

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Layout Padding
  const pad = { l: 72, r: 36, t: spec.title ? 60 : 40, b: 88 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  // Title
  if (spec.title) {
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(spec.title, pad.l, 32);
  }

  const points = spec.points;
  const values = points.map((p) => p.value);
  let vmin = Math.min(...values);
  let vmax = Math.max(...values);
  if (vmin === vmax) {
    vmin = vmin === 0 ? -1 : vmin * 0.9;
    vmax = vmax === 0 ? 1 : vmax * 1.1;
  }
  const padY = (vmax - vmin) * 0.08 || 1;
  if (vmin > 0) vmin = 0; // Usually zero-based charts
  else vmin -= padY;
  vmax += padY;

  const x0 = pad.l;
  const y0 = pad.t + plotH;
  const x1 = pad.l + plotW;
  const y1 = pad.t;

  // Horizontal grid lines
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  const gridN = 5;
  
  // Custom dashed implementation (if setLineDash isn't flawless)
  ctx.setLineDash([4, 4]);

  for (let g = 0; g <= gridN; g++) {
    const t = g / gridN;
    const y = y0 - t * plotH;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    const v = vmin + t * (vmax - vmin);
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(formatTick(v), x0 - 12, y + 4);
  }
  ctx.setLineDash([]); // Reset dash for others

  // Axis Lines
  ctx.strokeStyle = AXIS;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y0);
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y1);
  ctx.stroke();

  // Y Label
  if (spec.y_label) {
    ctx.save();
    ctx.translate(18, pad.t + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(spec.y_label, 0, 0);
    ctx.restore();
  }

  const n = points.length;
  const mapY = (v: number) => y0 - ((v - vmin) / (vmax - vmin)) * plotH;

  if (spec.kind === "bar" && n > 0) {
    const gap = 8;
    const bw = Math.max(4, (plotW - gap * (n + 1)) / n);
    
    // Draw Bars
    points.forEach((p, i) => {
      const x = x0 + gap + i * (bw + gap);
      const y = mapY(p.value);
      const h = y0 - y;
      
      const grad = ctx.createLinearGradient(0, y, 0, y0);
      grad.addColorStop(0, BAR_TOP);
      grad.addColorStop(1, BAR_BOTTOM);
      ctx.fillStyle = grad;
      
      ctx.beginPath();
      ctx.roundRect(x, y, bw, h, [4, 4, 0, 0]);
      ctx.fill();
    });
    drawBarLabels(ctx, points, x0, y0, gap, bw, W);
    
  } else if (spec.kind === "line" && n > 0) {
    const step = n > 1 ? plotW / (n - 1) : plotW;
    
    // Fill Area under line
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = n === 1 ? x0 + plotW / 2 : x0 + i * step;
      const y = mapY(p.value);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    const lastX = n === 1 ? x0 + plotW / 2 : x0 + (n - 1) * step;
    ctx.lineTo(lastX, y0);
    ctx.lineTo(x0, y0);
    ctx.closePath();
    
    const fillGrad = ctx.createLinearGradient(0, y1, 0, y0);
    fillGrad.addColorStop(0, LINE_FILL_TOP);
    fillGrad.addColorStop(1, LINE_FILL_BOTTOM);
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Main Line with Glow
    ctx.save();
    ctx.shadowColor = LINE_COLOR;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = n === 1 ? x0 + plotW / 2 : x0 + i * step;
      const y = mapY(p.value);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Stroke again to make center solid bright
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#a5b4fc"; // lighter center
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // Data points (Dots)
    points.forEach((p, i) => {
      const x = n === 1 ? x0 + plotW / 2 : x0 + i * step;
      const y = mapY(p.value);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = BG;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = LINE_COLOR;
      ctx.stroke();
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

  const legendH = spec.series.length > 0 ? 32 : 0;
  const topBase = spec.title ? 60 : 40;
  const pad = { l: 72, r: 36, t: topBase + legendH + 8, b: 88 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  // Title
  if (spec.title) {
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(spec.title, pad.l, 32);
  }

  // Legend (top, left under title)
  let lx = pad.l;
  const legY = spec.title ? 48 : 28;
  spec.series.forEach((s, si) => {
    const colSet = GROUPED_COLORS[si % GROUPED_COLORS.length]!;
    // Use fallback to given color if provided but default colors look much better in dark mode
    const customCol = s.color ? { top: s.color, bottom: s.color } : colSet;
    const grad = ctx.createLinearGradient(lx, legY, lx, legY + 12);
    grad.addColorStop(0, customCol.top);
    grad.addColorStop(1, customCol.bottom);
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(lx, legY, 12, 12, 2);
    ctx.fill();
    
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.font = "13px sans-serif";
    ctx.textAlign = "left";
    const lab = s.label.length > 42 ? `${s.label.slice(0, 40)}…` : s.label;
    ctx.fillText(lab, lx + 20, legY + 11);
    lx += ctx.measureText(lab).width + 48;
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
  const padY = (vmax - vmin) * 0.08 || 1;
  if (vmin > 0) vmin = 0;
  else vmin -= padY;
  vmax += padY;

  const x0 = pad.l;
  const y0 = pad.t + plotH;
  const x1 = pad.l + plotW;
  const y1 = pad.t;

  // Grid
  ctx.strokeStyle = GRID;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  const gridN = 5;
  for (let g = 0; g <= gridN; g++) {
    const t = g / gridN;
    const y = y0 - t * plotH;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    const v = vmin + t * (vmax - vmin);
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(formatTick(v), x0 - 12, y + 4);
  }
  ctx.setLineDash([]);

  // Axis
  ctx.strokeStyle = AXIS;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y0);
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0, y1);
  ctx.stroke();

  if (spec.y_label) {
    ctx.save();
    ctx.translate(18, pad.t + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = TEXT_SECONDARY;
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(spec.y_label, 0, 0);
    ctx.restore();
  }

  const n = points.length;
  const mapY = (v: number) => y0 - ((v - vmin) / (vmax - vmin)) * plotH;
  const gap = 12;
  const groupW = n > 0 ? Math.max(8, (plotW - gap * (n + 1)) / n) : 8;
  const innerPad = 4;
  const barGap = 4;
  const barW =
    k > 0 ? Math.max(4, (groupW - innerPad * 2 - barGap * (k - 1)) / k) : 4;

  for (let i = 0; i < n; i++) {
    const gx = x0 + gap + i * (groupW + gap) + innerPad;
    for (let j = 0; j < k; j++) {
      const s = series[j];
      if (!s) continue;
      
      const colSet = GROUPED_COLORS[j % GROUPED_COLORS.length]!;
      const customCol = s.color ? { top: s.color, bottom: s.color } : colSet;
      
      const raw = points[i]?.values[s.key];
      const val = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
      const x = gx + j * (barW + barGap);
      const y = mapY(val);
      const h = y0 - y;
      
      if (h > 0) {
        const grad = ctx.createLinearGradient(0, y, 0, y0);
        grad.addColorStop(0, customCol.top);
        grad.addColorStop(1, customCol.bottom);
        ctx.fillStyle = grad;
        
        ctx.beginPath();
        // Subtle rounding on top
        ctx.roundRect(x, y, barW, h, [3, 3, 0, 0]);
        ctx.fill();
      }
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
  ctx.fillStyle = TEXT_SECONDARY;
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  const maxLab = Math.max(8, Math.floor(520 / Math.max(points.length, 1)));
  points.forEach((p, i) => {
    const x = x0 + gap + i * (bw + gap) + bw / 2;
    const lab = p.label.length > maxLab ? `${p.label.slice(0, maxLab - 1)}…` : p.label;
    ctx.fillText(lab, x, y0 + 18);
  });
  ctx.textAlign = "start";

  // Prevent labels spilling past canvas
  if (points.length > 18) {
    ctx.fillStyle = "#52525b"; // Zinc 600
    ctx.font = "10px sans-serif";
    ctx.fillText("(labels truncated)", Math.min(x0, canvasW - 140), y0 + 36);
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
  ctx.fillStyle = TEXT_SECONDARY;
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  const showEvery = n > 14 ? Math.ceil(n / 14) : 1;
  for (let i = 0; i < n; i++) {
    if (i % showEvery !== 0 && i !== n - 1) continue;
    const p = points[i];
    if (!p) continue;
    const x = n === 1 ? x0 + plotW / 2 : x0 + i * step;
    const lab = p.label.length > 12 ? `${p.label.slice(0, 10)}…` : p.label;
    ctx.fillText(lab, x, y0 + 18);
  }
  ctx.textAlign = "start";
}
