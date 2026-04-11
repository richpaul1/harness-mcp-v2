/**
 * One-off: line item type breakdown for account + UTC day (CCM perspectiveGrid).
 * Usage: node scripts/line-item-drill.mjs [YYYY-MM-DD]  (default 2026-03-04)
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    if (process.env[k] !== undefined) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    process.env[k] = v;
  }
}

const PERSPECTIVE_GRID_QUERY = `
query FetchperspectiveGrid(
  $filters: [QLCEViewFilterWrapperInput],
  $groupBy: [QLCEViewGroupByInput],
  $limit: Int,
  $offset: Int,
  $aggregateFunction: [QLCEViewAggregationInput],
  $isClusterOnly: Boolean!,
  $isClusterHourlyData: Boolean = null,
  $preferences: ViewPreferencesInput,
  $useCostCategoryStampedData: Boolean = false
) {
  perspectiveGrid(
    aggregateFunction: $aggregateFunction
    filters: $filters
    groupBy: $groupBy
    limit: $limit
    offset: $offset
    preferences: $preferences
    isClusterHourlyData: $isClusterHourlyData
    sortCriteria: [{sortType: COST, sortOrder: DESCENDING}]
    useCostCategoryStampedData: $useCostCategoryStampedData
  ) {
    data {
      name id cost costTrend
      clusterPerspective @include(if: $isClusterOnly)
      __typename
    }
    __typename
  }
}`;

const day = process.argv[2] || "2026-03-04";
const [y, mo, d] = day.split("-").map(Number);
const startMs = Date.UTC(y, mo - 1, d, 0, 0, 0, 0);
const endMs = Date.UTC(y, mo - 1, d, 23, 59, 59, 999);
const viewId = "zdzSd41PQQa-ERSOwqLfSQ";
const accountId = "101852341822";

const baseUrl = (process.env.HARNESS_BASE_URL || "https://app.harness.io/gateway").replace(/\/$/, "");
const apiKey = process.env.HARNESS_API_KEY || process.env.HARNESS_BEARER_TOKEN;
const harnessAccount =
  process.env.HARNESS_ACCOUNT_ID ||
  (process.env.HARNESS_API_KEY?.startsWith("pat.") ? process.env.HARNESS_API_KEY.split(".")[1] : null);
if (!apiKey || !harnessAccount) {
  console.error("Need HARNESS_API_KEY and HARNESS_ACCOUNT_ID (or pat.* token)");
  process.exit(1);
}

const filters = [
  { viewMetadataFilter: { viewId, isPreview: false } },
  {
    timeFilter: {
      field: { fieldId: "startTime", fieldName: "startTime", identifier: "COMMON" },
      operator: "AFTER",
      value: startMs,
    },
  },
  {
    timeFilter: {
      field: { fieldId: "startTime", fieldName: "startTime", identifier: "COMMON" },
      operator: "BEFORE",
      value: endMs,
    },
  },
  {
    idFilter: {
      operator: "IN",
      values: [accountId],
      field: {
        fieldId: "awsUsageAccountId",
        fieldName: "Account",
        identifier: "AWS",
        identifierName: "AWS",
      },
    },
  },
];

const variables = {
  filters,
  groupBy: [
    {
      entityGroupBy: {
        fieldId: "awsLineItemType",
        fieldName: "Line Item Type",
        identifier: "AWS",
        identifierName: "AWS",
      },
    },
  ],
  limit: 40,
  offset: 0,
  aggregateFunction: [{ operationType: "SUM", columnName: "cost" }],
  isClusterOnly: false,
  isClusterHourlyData: null,
  preferences: {
    includeOthers: false,
    includeUnallocatedCost: false,
    awsPreferences: {
      includeDiscounts: false,
      includeCredits: true,
      includeRefunds: true,
      includeTaxes: true,
      awsCost: "NET_AMORTISED",
    },
    gcpPreferences: null,
    azureViewPreferences: null,
    showAnomalies: true,
  },
  useCostCategoryStampedData: true,
};

const url = `${baseUrl}/ccm/api/graphql?accountIdentifier=${harnessAccount}&routingId=${harnessAccount}`;
const headers = {
  "Content-Type": "application/json",
  "Harness-Account": harnessAccount,
  ...(process.env.HARNESS_BEARER_TOKEN
    ? { Authorization: `Bearer ${process.env.HARNESS_BEARER_TOKEN}` }
    : { "x-api-key": process.env.HARNESS_API_KEY }),
};

const res = await fetch(url, {
  method: "POST",
  headers,
  body: JSON.stringify({
    query: PERSPECTIVE_GRID_QUERY,
    operationName: "FetchperspectiveGrid",
    variables,
  }),
});
const json = await res.json();
if (json.errors) {
  console.error(JSON.stringify(json.errors, null, 2));
  process.exit(1);
}
const rows = json.data?.perspectiveGrid?.data || [];
console.log(JSON.stringify({ day, accountId, rows }, null, 2));
