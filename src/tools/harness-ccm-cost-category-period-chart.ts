import * as z from "zod/v4";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Registry } from "../registry/index.js";
import type { HarnessClient } from "../client/harness-client.js";
import type { Config } from "../config.js";
import { chartResult, errorResult } from "../utils/response-formatter.js";
import { renderCcmChartPng } from "../utils/ccm-chart-png.js";
import { computeTwoPeriodWindowsBeforeExcludedTail } from "../utils/ccm-period-windows.js";
import { isRecord } from "../utils/type-guards.js";
import { isUserError, isUserFixableApiError, toMcpError } from "../utils/errors.js";

function clampSize(n: number | undefined, fallback: number, max: number, min: number): number {
  const v = n ?? fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function extractBreakdownCosts(rows: unknown): Map<string, number> {
  const m = new Map<string, number>();
  if (!Array.isArray(rows)) return m;
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const name = row.name ?? row.id;
    const cost = row.cost;
    if (name === undefined || name === null) continue;
    const c = typeof cost === "number" ? cost : Number(cost);
    if (!Number.isFinite(c)) continue;
    m.set(String(name), c);
  }
  return m;
}

/**
 * Two-period grouped bar chart for any CCM cost-category mapping (BUSINESS_MAPPING group-by).
 */
export function registerCcmCostCategoryPeriodChartTool(
  server: McpServer,
  registry: Registry,
  client: HarnessClient,
  config: Config,
): void {
  server.registerTool(
    "harness_ccm_cost_category_period_chart",
    {
      description:
        "Compare total cost by **cost category** (business-mapping dimension) across two consecutive UTC windows. " +
        "Calls cost_breakdown twice with group_by cost_category, resolving the mapping by name (same as harness_list cost_category). " +
        "Current window: last N days ending before an excluded trailing tail (default exclude 2 calendar days). " +
        "Previous window: the N days immediately before that. " +
        "Chart: current period green, previous period red. Requires CCM toolset.",
      inputSchema: {
        perspective_id: z.string().min(1).describe("Perspective UUID"),
        cost_category_name: z
          .string()
          .min(1)
          .describe(
            "Exact cost category / business-mapping name to group by (e.g. from harness_list cost_category). Not limited to Business Domains.",
          ),
        exclude_last_days: z
          .number()
          .int()
          .min(0)
          .max(14)
          .describe("Exclude the most recent N UTC calendar days before defining windows (default 2)")
          .optional(),
        period_days: z
          .number()
          .int()
          .min(1)
          .max(90)
          .describe("Length of each comparison window in UTC days (default 14)")
          .optional(),
        limit: z
          .number()
          .int()
          .min(1)
          .max(500)
          .describe("Max breakdown rows per API call (default 100)")
          .optional(),
        width: z.number().min(400).max(4096).describe("PNG width (pixels)").optional(),
        height: z.number().min(280).max(4096).describe("PNG height (pixels)").optional(),
      },
      annotations: {
        title: "Cost category period comparison chart",
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async (args) => {
      try {
        const excludeLast = args.exclude_last_days ?? 2;
        const periodDays = args.period_days ?? 14;
        const limit = args.limit ?? 100;
        const mappingName = args.cost_category_name.trim();

        const windows = computeTwoPeriodWindowsBeforeExcludedTail(new Date(), {
          excludeLastDays: excludeLast,
          periodDays,
        });

        const base = {
          perspective_id: args.perspective_id,
          group_by: "cost_category",
          business_mapping_name: mappingName,
          limit,
        };

        const cur = await registry.dispatch(
          client,
          "cost_breakdown",
          "list",
          {
            ...base,
            start_time_ms: windows.current.startMs,
            end_time_ms: windows.current.endMs,
            time_filter: "LAST_30_DAYS",
          },
        );

        const prev = await registry.dispatch(
          client,
          "cost_breakdown",
          "list",
          {
            ...base,
            start_time_ms: windows.previous.startMs,
            end_time_ms: windows.previous.endMs,
            time_filter: "LAST_30_DAYS",
          },
        );

        const curItems = isRecord(cur) && Array.isArray(cur.items) ? cur.items : [];
        const prevItems = isRecord(prev) && Array.isArray(prev.items) ? prev.items : [];

        const curMap = extractBreakdownCosts(curItems);
        const prevMap = extractBreakdownCosts(prevItems);
        const names = new Set<string>([...curMap.keys(), ...prevMap.keys()]);
        const sorted = [...names].sort((a, b) => {
          const ma = Math.max(curMap.get(a) ?? 0, prevMap.get(a) ?? 0);
          const mb = Math.max(curMap.get(b) ?? 0, prevMap.get(b) ?? 0);
          return mb - ma || a.localeCompare(b);
        });

        const points = sorted.map((label) => ({
          label,
          values: {
            current: curMap.get(label) ?? 0,
            previous: prevMap.get(label) ?? 0,
          },
        }));

        const shortTitle =
          mappingName.length > 48 ? `${mappingName.slice(0, 46)}…` : mappingName;
        const spec = {
          kind: "grouped_bar" as const,
          title: `${shortTitle} — ${periodDays}d vs prior ${periodDays}d (excl. last ${excludeLast}d)`,
          y_label: "Cost (USD)",
          series: [
            { key: "current", label: `Current: ${windows.currentLegend}`, color: "#22c55e" },
            { key: "previous", label: `Previous: ${windows.previousLegend}`, color: "#ef4444" },
          ],
          points,
        };

        const w = clampSize(args.width, 1100, config.HARNESS_CCM_CHART_MAX_WIDTH, 400);
        const h = clampSize(args.height, 620, config.HARNESS_CCM_CHART_MAX_HEIGHT, 280);

        const png = renderCcmChartPng(spec, { width: w, height: h });

        const summary = {
          ok: true,
          kind: "grouped_bar",
          perspective_id: args.perspective_id,
          cost_category_name: mappingName,
          exclude_last_days: excludeLast,
          period_days: periodDays,
          current_window_ms: windows.current,
          previous_window_ms: windows.previous,
          current_legend: windows.currentLegend,
          previous_legend: windows.previousLegend,
          entity_count: points.length,
          width_px: w,
          height_px: h,
        };

        return chartResult(summary, png);
      } catch (err) {
        if (isUserError(err)) return errorResult(err.message);
        if (isUserFixableApiError(err)) return errorResult(err.message);
        throw toMcpError(err);
      }
    },
  );
}
