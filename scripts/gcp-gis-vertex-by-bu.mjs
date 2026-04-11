/**
 * GCP: filter GIS + Vertex AI, group by Business Units (cost category).
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
const BUSINESS_UNITS_FIELD_ID = "QYu4vYaLRpWuzV6erSGPcA"; // cost_category "Business Units"
const GCP_VIEW = "YXI84EP1SXS3amnXLL-XLw";

function last14TimeFilters() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 13));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  return [
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
  ];
}

const QUERY = `
query FetchperspectiveGrid(
  $filters: [QLCEViewFilterWrapperInput],
  $groupBy: [QLCEViewGroupByInput],
  $limit: Int,
  $isClusterOnly: Boolean!,
  $isClusterHourlyData: Boolean = null,
  $preferences: ViewPreferencesInput,
  $useCostCategoryStampedData: Boolean = false
) {
  perspectiveGrid(
    aggregateFunction: [{operationType: SUM, columnName: "cost"}]
    filters: $filters
    groupBy: $groupBy
    limit: $limit
    offset: 0
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
  }
}`;

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

const prefs = {
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
};

async function run(label, filters) {
  const variables = {
    filters,
    groupBy: [
      {
        entityGroupBy: {
          identifier: "BUSINESS_MAPPING",
          identifierName: "Cost Categories",
          fieldId: BUSINESS_UNITS_FIELD_ID,
          fieldName: "Business Units",
        },
      },
    ],
    limit: 25,
    isClusterOnly: false,
    isClusterHourlyData: null,
    preferences: prefs,
    useCostCategoryStampedData: true,
  };
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query: QUERY, operationName: "FetchperspectiveGrid", variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return { label, rows: json.data?.perspectiveGrid?.data || [] };
}

const baseFilters = [
  { viewMetadataFilter: { viewId: GCP_VIEW, isPreview: false } },
  ...last14TimeFilters(),
  {
    idFilter: {
      operator: "IN",
      values: ["GIS"],
      field: {
        fieldId: DOMAIN_FIELD_ID,
        fieldName: "Business Domains",
        identifier: "BUSINESS_MAPPING",
        identifierName: "Cost Categories",
      },
    },
  },
];

const vertexFilters = [
  ...baseFilters,
  {
    idFilter: {
      operator: "IN",
      values: ["Vertex AI"],
      field: {
        fieldId: "product",
        fieldName: "Product",
        identifier: "COMMON",
        identifierName: "Common",
      },
    },
  },
];

console.log(JSON.stringify(await run("GIS + Vertex AI → by Business Unit", vertexFilters), null, 2));
console.log(JSON.stringify(await run("GIS all products → by Business Unit (top spend)", baseFilters), null, 2));
