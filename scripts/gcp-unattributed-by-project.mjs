/**
 * GCP default perspective: Business Domain = Unattributed, group by Project (LAST_14 UTC).
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

const DOMAIN_FIELD_ID = process.env.HARNESS_CCM_BUSINESS_DOMAINS_FIELD_ID || "_Ahbf0HGSsuDh4LnyCYlVw";
const GCP_VIEW = process.env.GCP_VIEW || "YXI84EP1SXS3amnXLL-XLw";

function last14() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 13));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  return { start, end };
}

const QUERY = `
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

async function run(groupByField) {
  const { start, end } = last14();
  const baseUrl = (process.env.HARNESS_BASE_URL || "https://app.harness.io/gateway").replace(/\/$/, "");
  const harnessAccount =
    process.env.HARNESS_ACCOUNT_ID ||
    (process.env.HARNESS_API_KEY?.startsWith("pat.") ? process.env.HARNESS_API_KEY.split(".")[1] : null);
  const url = `${baseUrl}/ccm/api/graphql?accountIdentifier=${harnessAccount}&routingId=${harnessAccount}`;
  const headers = {
    "Content-Type": "application/json",
    "Harness-Account": harnessAccount,
    ...(process.env.HARNESS_BEARER_TOKEN
      ? { Authorization: `Bearer ${process.env.HARNESS_BEARER_TOKEN}` }
      : { "x-api-key": process.env.HARNESS_API_KEY }),
  };
  const filters = [
    { viewMetadataFilter: { viewId: GCP_VIEW, isPreview: false } },
    {
      timeFilter: {
        field: { fieldId: "startTime", fieldName: "startTime", identifier: "COMMON" },
        operator: "AFTER",
        value: start.getTime(),
      },
    },
    {
      timeFilter: {
        field: { fieldId: "startTime", fieldName: "startTime", identifier: "COMMON" },
        operator: "BEFORE",
        value: end.getTime(),
      },
    },
    {
      idFilter: {
        operator: "IN",
        values: ["Unattributed"],
        field: {
          identifier: "BUSINESS_MAPPING",
          identifierName: "Cost Categories",
          fieldId: DOMAIN_FIELD_ID,
          fieldName: "Business Domains",
        },
      },
    },
  ];
  const variables = {
    filters,
    groupBy: [{ entityGroupBy: groupByField }],
    limit: 80,
    offset: 0,
    aggregateFunction: [{ operationType: "SUM", columnName: "cost" }],
    isClusterOnly: false,
    isClusterHourlyData: null,
    preferences: {
      includeOthers: true,
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
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: QUERY, operationName: "FetchperspectiveGrid", variables }),
  });
  const json = await res.json();
  return json;
}

const candidates = [
  { fieldId: "gcpProjectId", fieldName: "Project", identifier: "GCP", identifierName: "GCP" },
  { fieldId: "projectId", fieldName: "Project", identifier: "GCP", identifierName: "GCP" },
  { fieldId: "gcp_project_id", fieldName: "Project", identifier: "GCP", identifierName: "GCP" },
];

for (const entityGroupBy of candidates) {
  const json = await run(entityGroupBy);
  if (json.errors) {
    console.error("Field", entityGroupBy.fieldId, JSON.stringify(json.errors).slice(0, 500));
    continue;
  }
  const rows = json.data?.perspectiveGrid?.data || [];
  console.log("OK groupBy", entityGroupBy.fieldId, "rows", rows.length);
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
console.error("No working GCP project groupBy");
process.exit(1);
