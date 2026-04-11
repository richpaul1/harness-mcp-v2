# CCM MCP tools → API walkthrough

When you call the Harness MCP tools for CCM, the server turns them into HTTP requests to your Harness base URL (`HARNESS_BASE_URL`, e.g. `https://app3.harness.io`). Every request gets `accountIdentifier=<HARNESS_ACCOUNT_ID>` added as a query parameter by the client.

---

## 1. `harness_list(resource_type="cost_perspective")`

**API:** REST  
**Method:** `GET`  
**Path:** `/ccm/api/perspectives`

**Full URL pattern:**  
`{HARNESS_BASE_URL}/ccm/api/perspectives?accountIdentifier={accountId}&page={page}&size={size}`

**Query params (from tool input):**
- `page` — from list input `page` (defaults from pagination)
- `size` — from list input `size`

**Response:** Paginated list of cost perspectives (name, id, uuid, etc.). The server uses `pageExtract` to return `{ items, total }` from the Harness NG response envelope.

**Note:** In your environment this endpoint has been returning “Oops, something went wrong” from Harness; the workaround is to use **cost_summary** without `perspective_id` to get default perspective IDs from CCM metadata.

---

## 2. `harness_list(resource_type="cost_summary")` — no perspective_id

**API:** GraphQL  
**Method:** `POST`  
**Path:** `/ccm/api/graphql`

**Full URL pattern:**  
`{HARNESS_BASE_URL}/ccm/api/graphql?accountIdentifier={accountId}`

**Body:**
```json
{
  "query": "<CCM_METADATA_QUERY>",
  "operationName": "FetchCcmMetaData",
  "variables": {}
}
```

**GraphQL operation:** `FetchCcmMetaData`  
**Fields requested:** `ccmMetaData { k8sClusterConnectorPresent, cloudDataPresent, awsConnectorsPresent, gcpConnectorsPresent, azureConnectorsPresent, defaultAwsPerspectiveId, defaultGcpPerspectiveId, defaultAzurePerspectiveId, defaultClusterPerspectiveId, currencyPreference { ... }, ... }`

**Response:** CCM metadata object (connectors present, **default perspective IDs** including AWS, currency, etc.). The server returns `data.ccmMetaData` as the tool result.

---

## 3. `harness_list(resource_type="cost_summary", perspective_id="...", time_filter="LAST_7")`

**API:** GraphQL  
**Method:** `POST`  
**Path:** `/ccm/api/graphql`

**Full URL pattern:**  
`{HARNESS_BASE_URL}/ccm/api/graphql?accountIdentifier={accountId}`

**Body:**
```json
{
  "query": "<PERSPECTIVE_SUMMARY_QUERY>",
  "operationName": "FetchPerspectiveDetailsSummaryWithBudget",
  "variables": {
    "filters": [
      { "viewMetadataFilter": { "viewId": "<perspective_id>", "isPreview": false } },
      { "timeFilter": { "field": {...}, "operator": "AFTER", "value": <startTime> } },
      { "timeFilter": { "field": {...}, "operator": "BEFORE", "value": <endTime> } }
    ],
    "groupBy": [{ "entityGroupBy": { "fieldId": "product", ... } }],
    "aggregateFunction": [{ "operationType": "SUM", "columnName": "cost" }],
    "isClusterQuery": false,
    "isClusterHourlyData": false,
    "preferences": { ... }
  }
}
```

**GraphQL operation:** `FetchPerspectiveDetailsSummaryWithBudget`  
**Fields requested:**
- `perspectiveTrendStats` — cost, idleCost, unallocatedCost, utilizedCost, efficiencyScoreStats
- `perspectiveForecastCost` — forecast cost

**Response:** The server returns `{ trendStats: data.perspectiveTrendStats, forecastCost: data.perspectiveForecastCost }`. If the API response still contains `ccmMetaData`, the extractor returns metadata instead (current quirk when both are present).

---

## 4. `harness_list(resource_type="cost_timeseries", perspective_id="...", time_filter="LAST_7", group_by="product")`

**API:** GraphQL  
**Method:** `POST`  
**Path:** `/ccm/api/graphql`

**Full URL pattern:**  
`{HARNESS_BASE_URL}/ccm/api/graphql?accountIdentifier={accountId}`

**Body:**
```json
{
  "query": "<PERSPECTIVE_TIMESERIES_QUERY>",
  "operationName": "FetchPerspectiveTimeSeries",
  "variables": {
    "filters": [
      { "viewMetadataFilter": { "viewId": "<perspective_id>", "isPreview": false } },
      { "timeFilter": { "operator": "AFTER", "value": <startMs> } },
      { "timeFilter": { "operator": "BEFORE", "value": <endMs> } }
    ],
    "groupBy": [
      { "timeTruncGroupBy": { "resolution": "DAY" } },
      { "entityGroupBy": { "fieldId": "product", ... } }
    ],
    "limit": 12,
    "preferences": { ... },
    "isClusterHourlyData": false
  }
}
```

**GraphQL operation:** `FetchPerspectiveTimeSeries`  
**Fields requested:** `perspectiveTimeSeriesStats { stats { values { key { id name type }, value }, time } }`

**Response:** Array of time-series stats (time buckets and cost values). The server returns `data.perspectiveTimeSeriesStats.stats` (or `[]` if empty).

---

## 5. `harness_list(resource_type="cost_breakdown", ...)`

**API:** GraphQL  
**Method:** `POST`  
**Path:** `/ccm/api/graphql`

**Body:** Same path as above, with:
- **operationName:** `FetchperspectiveGrid`
- **Variables:** `filters`, `groupBy`, `limit`, `offset`, `aggregateFunction`, `isClusterOnly`, `preferences`

**GraphQL fields:** `perspectiveGrid { data { name id cost costTrend } }`, `perspectiveTotalCount`

**Response:** `{ items: data.perspectiveGrid.data, total: data.perspectiveTotalCount }`

---

## 6. `harness_get(resource_type="cost_summary", perspective_id="...")` — budget

**API:** GraphQL  
**Method:** `POST`  
**Path:** `/ccm/api/graphql`

**Body:**
- **operationName:** `FetchPerspectiveBudget`
- **variables:** `{ perspectiveId: "<perspective_id>" }`

**GraphQL fields:** `budgetSummaryList(perspectiveId) { id name budgetAmount actualCost timeLeft ... }`

**Response:** Budget list for that perspective.

---

## Summary table

| MCP call | HTTP | Path | GraphQL operation (if POST) |
|----------|------|------|-----------------------------|
| `harness_list` cost_perspective | GET | `/ccm/api/perspectives` | — |
| `harness_get` cost_perspective | GET | `/ccm/api/perspective/{id}` | — |
| `harness_list` cost_summary (no perspective_id) | POST | `/ccm/api/graphql` | FetchCcmMetaData |
| `harness_list` cost_summary (with perspective_id) | POST | `/ccm/api/graphql` | FetchPerspectiveDetailsSummaryWithBudget |
| `harness_get` cost_summary (budget) | POST | `/ccm/api/graphql` | FetchPerspectiveBudget |
| `harness_list` cost_timeseries | POST | `/ccm/api/graphql` | FetchPerspectiveTimeSeries |
| `harness_list` cost_breakdown | POST | `/ccm/api/graphql` | FetchperspectiveGrid |

All requests use headers: `x-api-key: <HARNESS_API_KEY>`, `Harness-Account: <HARNESS_ACCOUNT_ID>`, and `Content-Type: application/json` for POST.
