import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Config } from "../config.js";
import { chartResult, errorResult } from "../utils/response-formatter.js";
import { normalizeCcmJsonToChartSpec } from "../utils/ccm-chart-spec.js";
import { renderCcmChartPng } from "../utils/ccm-chart-png.js";

function clampSize(n: number | undefined, fallback: number, max: number, min: number): number {
  const v = n ?? fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

/**
 * Render a PNG bar or line chart locally from JSON (no external chart APIs).
 */
export function registerCcmChartTool(server: McpServer, config: Config): void {
  server.registerTool(
    "harness_ccm_chart",
    {
      description:
        "Render a PNG chart from JSON. Pass chart_spec: bar/line { kind, title?, y_label?, points: [{ label, value }] }, or grouped_bar { kind: \"grouped_bar\", series: [{ key, label, color? }], points: [{ label, values: { [key]: number } }] } for side-by-side bars (e.g. current vs previous period). Or pass ccm_json (string) from CCM/harness_list — labels sanitized. Local rendering only; returns image/png.",
      inputSchema: {
        chart_spec: z
          .record(z.string(), z.unknown())
          .describe("Chart spec object: kind (bar|line), optional title/y_label, points array")
          .optional(),
        ccm_json: z
          .string()
          .describe("Alternative: JSON string to normalize (same shapes as harness_ccm_json)")
          .optional(),
        width: z
          .number()
          .min(200)
          .max(4096)
          .describe("Image width in pixels (clamped to HARNESS_CCM_CHART_MAX_WIDTH)")
          .optional(),
        height: z
          .number()
          .min(120)
          .max(4096)
          .describe("Image height in pixels (clamped to HARNESS_CCM_CHART_MAX_HEIGHT)")
          .optional(),
        kind_hint: z.enum(["bar", "line"]).describe("When normalizing ambiguous JSON, prefer bar or line").optional(),
      },
      annotations: {
        title: "Render CCM chart PNG",
        readOnlyHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      const hasSpec = args.chart_spec && Object.keys(args.chart_spec).length > 0;
      let raw: unknown;
      if (hasSpec) {
        raw = args.chart_spec;
      } else if (args.ccm_json) {
        try {
          raw = JSON.parse(args.ccm_json) as unknown;
        } catch {
          return errorResult("ccm_json is not valid JSON");
        }
      } else {
        return errorResult("Provide chart_spec (non-empty object) or ccm_json (string).");
      }

      const normalized = normalizeCcmJsonToChartSpec(
        raw,
        config.HARNESS_CCM_CHART_MAX_POINTS,
        args.kind_hint,
      );
      if (!normalized.ok) {
        return errorResult(normalized.error);
      }

      const spec = normalized.spec;
      const w = clampSize(args.width, 960, config.HARNESS_CCM_CHART_MAX_WIDTH, 200);
      const h = clampSize(args.height, 540, config.HARNESS_CCM_CHART_MAX_HEIGHT, 120);

      let png: Buffer;
      try {
        png = renderCcmChartPng(spec, { width: w, height: h });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return errorResult(`Chart render failed: ${msg}`);
      }

      const summary = {
        ok: true,
        kind: spec.kind,
        title: spec.title,
        point_count: spec.points.length,
        width_px: w,
        height_px: h,
        y_label: spec.y_label,
      };

      return chartResult(summary, png);
    },
  );
}
