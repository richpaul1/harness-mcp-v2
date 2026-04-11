# CCM drilldown via MCP

## Higher business metrics — **group by Business Domains**

**Cost categories** (business mappings) define the dimensions you **group by** when reporting upward—e.g. **Business Domains**, portfolios, or other CCM cost categories. Use:

- **`harness_list`** → **`cost_trend`** or **`cost_timeseries`** with **`group_by: "business_domains"`** (and **`perspective_id`**, **`time_filter`**). **AWS Usage-only:** add **`filter_aws_line_item_type: "Usage"`** to those filters (and to **`cost_drilldown`**) so totals match CUR **Line Item Type = Usage** (excludes RIFee, Tax, etc., on that slice).
- **`use_cost_category_stamped_data: true`** (default) so numbers match the UI and historical lines stay consistent after mapping changes (**backfill + stamp**).

**`cost_category`** (list/get) is for **which** business mappings exist and their ids/names when wiring reports—not for debugging day spikes.

Day spikes under a domain are usually **AWS billing / CUR timing**; explain them with **`cost_drilldown`** below (product / service / account), not by re-reading mapping rules.

---

## Drilldown — fixed days + optional domain + **Product / Service / Account**

**`cost_drilldown`** mirrors Perspectives → AWS → UTC day(s) → optional Business Domain → group by **product**, **service**, or **account**. **`compact: false`** keeps **`cost`** on each row.

### Mar 1 — InfoSec — by **Product**
```json
{
  "resource_type": "cost_drilldown",
  "compact": false,
  "filters": {
    "perspective_id": "<defaultAwsPerspectiveId>",
    "start_date": "2026-03-01",
    "end_date": "2026-03-01",
    "filter_business_domain": "InfoSec",
    "drill_group_by": "product",
    "limit": 40
  }
}
```

### Mar 4 — same window
```json
"start_date": "2026-03-04",
"end_date": "2026-03-04"
```

### By **AWS service** / **Account**
```json
"drill_group_by": "awsServicecode"
```
```json
"drill_group_by": "awsUsageAccountId"
```

### **Line Item Type** — account filter + `awsLineItemType`

Same GraphQL as Perspectives → AWS → time range → **filter Account** → group by **Line Item Type** (`awsLineItemType`). **`use_cost_category_stamped_data`** defaults to **true** everywhere (including MCP); set **`false`** only if you need raw CUR-style rows.

```json
{
  "resource_type": "cost_drilldown",
  "compact": false,
  "filters": {
    "perspective_id": "<defaultAwsPerspectiveId>",
    "start_date": "2026-02-03",
    "end_date": "2026-03-05",
    "filter_aws_usage_account_id": "101852341822",
    "drill_group_by": "awsLineItemType",
    "limit": 25
  }
}
```

GraphQL shape (for custom curls): **`groupBy`** = `{ "entityGroupBy": { "fieldId": "awsLineItemType", "fieldName": "Line Item Type", "identifier": "AWS", "identifierName": "AWS" } }`; **`filters`** include **`idFilter`** on **`awsUsageAccountId`** with **`operator": "IN"`**, **`values": ["<12-digit id>"]`**. Prefer **`HARNESS_API_KEY`** in automation—do not commit session **Bearer** tokens.

## Resource types

Include **`cost_drilldown`**, **`cost_trend`**, **`cost_timeseries`** (and optionally **`cost_category`**) in `HARNESS_RESOURCE_TYPES` if you filter types. Restart `npm run start:http` after deploy.
