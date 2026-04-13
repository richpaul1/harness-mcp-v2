/**
 * Shared response extractors for Harness API responses.
 * Used across all toolset definitions — eliminates per-file duplication.
 */
import { isRecord } from "../utils/type-guards.js";

/** Extract `data` from standard NG API responses: `{ status, data, ... }` */
export const ngExtract = (raw: unknown): unknown => {
  const r = raw as { data?: unknown };
  return r.data ?? raw;
};

/** Extract paginated content from NG API responses: `{ data: { content, totalElements } }` */
export const pageExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: { content?: unknown[]; totalElements?: number } };
  return {
    items: r.data?.content ?? [],
    total: r.data?.totalElements ?? 0,
  };
};

/** Known list keys on CCM / NG business-mapping payloads */
const BUSINESS_MAPPING_LIST_KEYS = [
  "content",
  "businessMappingDTOList",
  "businessMappingList",
  "businessMappings",
  "list",
] as const;

function totalFromRecord(rec: Record<string, unknown>, itemsLen: number): number {
  for (const k of ["totalElements", "total", "totalRecords", "totalCount"] as const) {
    const v = rec[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return itemsLen;
}

function pickListFromRecord(obj: Record<string, unknown>): { items: unknown[]; total: number } | null {
  for (const key of BUSINESS_MAPPING_LIST_KEYS) {
    const v = obj[key];
    if (Array.isArray(v)) {
      return { items: v, total: totalFromRecord(obj, v.length) };
    }
  }
  return null;
}

/**
 * CCM cost categories / business-mapping list — response shape varies by cluster/version.
 * Tries `data.content`, `resource.content`, DTO list keys, and bare arrays.
 */
export const ccmBusinessMappingListExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const paged = pageExtract(raw);
  if (paged.items.length > 0 || paged.total > 0) return paged;
  if (!isRecord(raw)) return { items: [], total: 0 };

  for (const wrapKey of ["data", "resource", "response"] as const) {
    const inner = raw[wrapKey];
    if (inner === undefined) continue;
    if (Array.isArray(inner)) return { items: inner, total: inner.length };
    if (isRecord(inner)) {
      const picked = pickListFromRecord(inner);
      if (picked) return picked;
    }
  }

  const d = raw.data;
  if (Array.isArray(d)) return { items: d, total: d.length };

  const top = pickListFromRecord(raw);
  if (top) return top;

  return { items: [], total: 0 };
};

/**
 * Lightweight cost category list — strips heavy rule payloads (costTargets, sharedCosts, etc.)
 * and returns only summary fields. Use the get operation for full rule details.
 */
export const ccmBusinessMappingListCompactExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const full = ccmBusinessMappingListExtract(raw);
  const compact = full.items.map((item) => {
    if (!isRecord(item)) return item;
    return {
      uuid: item.uuid,
      name: item.name,
      dataSources: item.dataSources,
      createdAt: item.createdAt,
      lastUpdatedAt: item.lastUpdatedAt,
    };
  });
  return { items: compact, total: full.total };
};

/** Pass-through extractor — returns raw response unchanged. Used for APIs that don't wrap in `data`. */
export const passthrough = (raw: unknown): unknown => raw;

/**
 * Factory for v1 list responses (bare arrays).
 * If `wrapperKey` is provided, each item is unwrapped: `{ project: {...} }` → `{...}`.
 * Total is derived from array length since response headers aren't accessible.
 */
export const v1ListExtract = (wrapperKey?: string) => (raw: unknown): { items: unknown[]; total: number } => {
  const arr = Array.isArray(raw) ? raw : [];
  const items = wrapperKey
    ? arr.map(item => (isRecord(item) && wrapperKey in item ? item[wrapperKey] : item))
    : arr;
  return { items, total: items.length };
};

/** Factory for v1 single-item responses that may be wrapped: `{ org: {...} }` → `{...}`. */
export const v1Unwrap = (wrapperKey: string) => (raw: unknown): unknown => {
  if (isRecord(raw) && wrapperKey in raw) {
    return raw[wrapperKey];
  }
  return raw;
};

/** Factory for GraphQL field extraction (used by CCM). */
export const gqlExtract = (field: string) => (raw: unknown): unknown => {
  const r = raw as { data?: Record<string, unknown> };
  return r.data?.[field] ?? raw;
};

const JIRA_STRIP_KEYS = new Set([
  "jiraFields", "jiraFieldNameToKeys", "serviceNowDetails",
  "jiraConnector", "serviceNowConnector",
]);

/**
 * CCM recommendation list — strip verbose JIRA/ServiceNow payloads.
 * Handles both `{ data: [...] }` and `{ data: { items, total } }` response shapes.
 */
export const ccmRecommendationListCompactExtract = (raw: unknown): unknown => {
  const data = ngExtract(raw);

  let items: unknown[];
  let total: number;

  if (Array.isArray(data)) {
    items = data;
    total = data.length;
  } else if (isRecord(data)) {
    items = Array.isArray(data.items) ? data.items : [];
    total = typeof data.total === "number" ? data.total : items.length;
  } else {
    return data;
  }

  const compact = items.map((item) => {
    if (!isRecord(item)) return item;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(item)) {
      if (JIRA_STRIP_KEYS.has(k)) continue;
      out[k] = v;
    }
    if (isRecord(out.recommendationDetails)) {
      const det: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(out.recommendationDetails as Record<string, unknown>)) {
        if (JIRA_STRIP_KEYS.has(k)) continue;
        det[k] = v;
      }
      out.recommendationDetails = det;
    }
    return out;
  });

  return { items: compact, total };
};

/**
 * CCM budget list — strip alertThresholds (contains emails), budgetMonthlyBreakdown
 * (mostly zeros), and internal UUIDs. Keep the essential budget health fields.
 *
 * Response shape: `{ status, data: { summaries: [...], totalCount: N } }`
 */
export const ccmBudgetListCompactExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const r = raw as { data?: { summaries?: unknown[]; totalCount?: number } };
  let items: unknown[] = r.data?.summaries ?? [];
  let total = typeof r.data?.totalCount === "number" ? r.data.totalCount : items.length;

  if (items.length === 0) {
    const paged = pageExtract(raw);
    items = paged.items;
    total = paged.total;
  }

  const compact = items.map((item) => {
    if (!isRecord(item)) return item;
    return {
      id: item.uuid ?? item.id,
      name: item.name,
      perspectiveId: item.perspectiveId,
      perspectiveName: item.perspectiveName,
      budgetAmount: item.budgetAmount,
      actualCost: item.actualCost,
      forecastCost: item.forecastCost,
      timeLeft: item.timeLeft,
      timeUnit: item.timeUnit,
      period: item.period,
      type: item.type,
      growthRate: item.growthRate,
      actualCostAlerts: item.actualCostAlerts,
      forecastCostAlerts: item.forecastCostAlerts,
      budgetGroup: item.budgetGroup,
      folderId: item.folderId,
    };
  });

  return { items: compact, total };
};

/**
 * CCM budget detail (GraphQL FetchBudgetsGridData) — strip __typename fields,
 * return clean time-series with variance tracking.
 */
export const ccmBudgetDetailExtract = (raw: unknown): unknown => {
  const r = raw as {
    data?: {
      budgetCostData?: { costData?: unknown[]; forecastCost?: number };
      budgetSummary?: { period?: string };
    };
  };
  if (!r.data) return raw;

  const costData = r.data.budgetCostData?.costData;
  const cleaned = Array.isArray(costData)
    ? costData.map((d) => {
        if (!isRecord(d)) return d;
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(d)) {
          if (k === "__typename") continue;
          out[k] = v;
        }
        return out;
      })
    : [];

  return {
    costData: cleaned,
    forecastCost: r.data.budgetCostData?.forecastCost,
    period: r.data.budgetSummary?.period,
  };
};
