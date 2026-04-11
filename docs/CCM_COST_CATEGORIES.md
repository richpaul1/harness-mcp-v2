# CCM cost categories (business mappings)

Cost categories in Harness CE are backed by **business mappings**: each mapping has a **uuid**, display metadata, and **rules** (conditions, targets, ordering) that decide how spend is allocated to dimensions such as *Business Domains* or *Business Units*.

## MCP usage

| Goal | Tool | Example |
|------|------|--------|
| Page through all mappings | `harness_list` | `resource_type: "cost_category"`, optional `filters`: `limit`, `offset`, `search_key`, `sort_order`, `sort_type` |
| Same with harness pagination | `harness_list` | `page` + `size` are mapped to `offset` / `limit` automatically |
| Full list row payload | `harness_list` | `compact: false` |
| Load one mapping’s rules | `harness_get` | `resource_type: "cost_category"`, `resource_id: "<uuid>"` (uuid from list item) |

## Query params (list)

Aligned with the CE UI list API:

- `searchKey` ← `search_key` or `search_term`
- `limit`, `offset`
- `sortOrder` ← `sort_order` (`ASCENDING` | `DESCENDING`)
- `sortType` ← `sort_type` (`LAST_EDIT` | `NAME` | `CREATION_TIME`)
- `routingId` + `accountIdentifier` are set by the MCP client from config

## Get by uuid

`harness_get` calls `GET /ccm/api/business-mapping?uuid=<category_id>`.

If your Harness build expects a different detail route, adjust `cost_category` → `get` in `src/registry/toolsets/ccm.ts`.

## Triage workflow

1. `harness_list` `cost_category` → find the mapping name / uuid for the dimension you care about.
2. `harness_get` that uuid → inspect conditions (accounts, services, tags, etc.) and rule order.
3. Compare with **`cost_drilldown`** for the same window (product / service / account) to see which CUR rows would match which rule.

Do **not** paste browser **Bearer** tokens into chat or commits; use `HARNESS_API_KEY` (PAT) or `HARNESS_BEARER_TOKEN` in `.env` only.
