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

// ---------------------------------------------------------------------------
// Commitment Orchestration (Lightwing CO) extractors
// ---------------------------------------------------------------------------

interface LwResponse {
  success?: boolean;
  response?: unknown;
  errors?: unknown;
}

function unwrapLw(raw: unknown): unknown {
  const r = raw as LwResponse;
  return r.response ?? raw;
}

/**
 * CO summary — flatten into coverage, savings, and utilization at a glance.
 */
export const ccmCommitmentSummaryExtract = (raw: unknown): unknown => {
  const resp = unwrapLw(raw) as Record<string, unknown>;
  const coverage = resp.coverage_percentage as Record<string, number> | undefined;
  const savings = resp.savings as Record<string, unknown> | undefined;
  const utilization = resp.utilization_percentage as Record<string, number> | undefined;

  const riSavings = savings?.reserved_instances as Record<string, number> | undefined;
  const spSavings = savings?.savings_plans as Record<string, number> | undefined;

  return {
    compute_spend: resp.compute_spend,
    ondemand_spend: resp.ondemand_spend,
    reservations_spend: resp.reservations_spend,
    savings_plans_spend: resp.savings_plans_spend,
    coverage: {
      ondemand_pct: coverage?.ondemand,
      reserved_instances_pct: coverage?.reserved_instances,
      savings_plan_pct: coverage?.savings_plan,
    },
    savings: {
      total: (savings?.total as number) ?? null,
      reserved_instances: riSavings?.total ?? null,
      reserved_instances_pct: riSavings?.percentage ?? null,
      savings_plans: spSavings?.total ?? null,
      savings_plans_pct: spSavings?.percentage ?? null,
    },
    utilization: {
      reserved_instances_pct: utilization?.reserved_instances,
      savings_plan_pct: utilization?.savings_plan,
    },
  };
};

/**
 * CO coverage detail — extract per-type table summaries and chart data (sorted by date).
 */
export const ccmCommitmentCoverageExtract = (raw: unknown): unknown => {
  const resp = unwrapLw(raw) as Record<string, Record<string, unknown>>;
  const types: Record<string, unknown> = {};

  for (const [typeName, typeData] of Object.entries(resp)) {
    if (!isRecord(typeData)) continue;
    const table = typeData.table as Record<string, unknown> | undefined;
    const chart = typeData.chart as Array<Record<string, unknown>> | undefined;
    const sortedChart = Array.isArray(chart)
      ? [...chart].sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")))
      : [];

    types[typeName] = {
      summary: table ? {
        total_cost: table.total_cost,
        total_hours: table.total_hours,
        on_demand_cost: table.on_demand_cost,
        on_demand_hours: table.on_demand_hours,
        reservation_cost: table.reservation_cost,
        ri_coverage_hours: table.ri_coverage_hours,
        savings_plan_hours: table.savings_plan_hours,
      } : null,
      chart: sortedChart,
    };
  }

  return { commitment_types: types };
};

/**
 * CO savings detail — extract per-type table total + sorted chart.
 */
export const ccmCommitmentSavingsExtract = (raw: unknown): unknown => {
  const resp = unwrapLw(raw) as Record<string, Record<string, unknown>>;
  const types: Record<string, unknown> = {};

  for (const [typeName, typeData] of Object.entries(resp)) {
    if (!isRecord(typeData)) continue;
    const table = typeData.table as Record<string, unknown> | undefined;
    const chart = typeData.chart as Array<Record<string, unknown>> | undefined;
    const sortedChart = Array.isArray(chart)
      ? [...chart].sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")))
      : [];

    types[typeName] = {
      total_savings: table?.total ?? null,
      chart: sortedChart,
    };
  }

  return { commitment_types: types };
};

/**
 * CO utilization detail — extract per-type table + sorted chart.
 */
export const ccmCommitmentUtilisationExtract = (raw: unknown): unknown => {
  const resp = unwrapLw(raw) as Record<string, Record<string, unknown>>;
  const types: Record<string, unknown> = {};

  for (const [typeName, typeData] of Object.entries(resp)) {
    if (!isRecord(typeData)) continue;
    const table = typeData.table as Record<string, unknown> | undefined;
    const chart = typeData.chart as Array<Record<string, unknown>> | undefined;
    const sortedChart = Array.isArray(chart)
      ? [...chart].sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")))
      : [];

    types[typeName] = {
      compute_spend: table?.compute_spend ?? null,
      utilization_amount: table?.utilization ?? null,
      utilization_pct: table?.percentage ?? null,
      trend_pct: table?.trend ?? null,
      chart: sortedChart,
    };
  }

  return { commitment_types: types };
};

/**
 * CO filters — flatten response into typed arrays.
 */
export const ccmCommitmentFiltersExtract = (raw: unknown): unknown => {
  const resp = unwrapLw(raw) as Record<string, unknown>;
  return {
    account_ids: Array.isArray(resp.account_id) ? resp.account_id : [],
    instance_families: Array.isArray(resp.instance_family) ? resp.instance_family : [],
    regions: Array.isArray(resp.region) ? resp.region : [],
  };
};

/**
 * CO master accounts — compact list of connected payer accounts with CO status.
 */
export const ccmCommitmentAccountsExtract = (raw: unknown): { items: unknown[]; total: number } => {
  const resp = unwrapLw(raw) as Record<string, unknown>;
  const data = resp.data as Record<string, unknown> | undefined;
  const content = Array.isArray(data?.content) ? data!.content as Array<Record<string, unknown>> : [];

  const items = content.map((entry) => {
    const connector = entry.connector as Record<string, unknown> | undefined;
    const spec = connector?.spec as Record<string, unknown> | undefined;
    const status = entry.status as Record<string, unknown> | undefined;
    const features = Array.isArray(spec?.featuresEnabled) ? spec!.featuresEnabled as string[] : [];

    return {
      identifier: connector?.identifier ?? null,
      name: connector?.name ?? null,
      aws_account_id: spec?.awsAccountId ?? null,
      type: connector?.type ?? null,
      features_enabled: features,
      co_enabled: features.includes("COMMITMENT_ORCHESTRATOR"),
      connection_status: status?.status ?? null,
      last_connected_at: status?.lastConnectedAt ?? null,
    };
  });

  return { items, total: items.length };
};

/**
 * CO spend detail (v2) — per-type spend with table (total, trend, service) and daily chart.
 */
export const ccmCommitmentSpendDetailExtract = (raw: unknown): unknown => {
  const resp = unwrapLw(raw) as Record<string, Record<string, unknown>>;
  const types: Record<string, unknown> = {};

  for (const [typeName, typeData] of Object.entries(resp)) {
    if (!isRecord(typeData)) continue;
    const table = typeData.table as Record<string, unknown> | undefined;
    const chart = typeData.chart as Array<Record<string, unknown>> | undefined;
    const sortedChart = Array.isArray(chart)
      ? [...chart].sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")))
      : [];

    types[typeName] = {
      total_spend: table?.total_spend ?? null,
      trend_pct: table?.trend ?? null,
      service: table?.service ?? null,
      chart: sortedChart,
    };
  }

  return { commitment_types: types };
};

/**
 * CO savings overview (v2) — managed vs unmanaged savings split by RI and Savings Plans.
 */
export const ccmCommitmentSavingsOverviewExtract = (raw: unknown): unknown => {
  const resp = unwrapLw(raw) as Record<string, unknown>;
  const sp = resp.savings_plans as Record<string, unknown> | undefined;
  const ri = resp.reserved_instances as Record<string, unknown> | undefined;
  const spManaged = sp?.managed_savings as Record<string, unknown> | undefined;
  const spUnmanaged = sp?.unmanaged_savings as Record<string, unknown> | undefined;
  const riManaged = ri?.managed_savings as Record<string, unknown> | undefined;
  const riUnmanaged = ri?.unmanaged_savings as Record<string, unknown> | undefined;

  return {
    overall_savings: resp.overall_savings,
    managed_savings_total: resp.managed_savings_total,
    unmanaged_savings_total: resp.unmanaged_savings_total,
    savings_plans: {
      total: sp?.sp_total ?? null,
      pct_of_total: sp?.sp_percentage ?? null,
      managed: spManaged?.total ?? null,
      managed_pct: spManaged?.percentage ?? null,
      unmanaged: spUnmanaged?.total ?? null,
      unmanaged_pct: spUnmanaged?.percentage ?? null,
    },
    reserved_instances: {
      total: ri?.ri_total ?? null,
      pct_of_total: ri?.ri_percentage ?? null,
      managed: riManaged?.total ?? null,
      managed_pct: riManaged?.percentage ?? null,
      unmanaged: riUnmanaged?.total ?? null,
      unmanaged_pct: riUnmanaged?.percentage ?? null,
    },
  };
};
