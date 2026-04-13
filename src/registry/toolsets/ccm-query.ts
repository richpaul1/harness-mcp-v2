/**
 * Shared query helpers for CCM list operations (cost_breakdown, cost_timeseries, cost_summary, …).
 *
 * **`CCM_TIME_FILTERS`** and **`CCM_GROUP_BY_FIELDS`** are the **static** presets (time windows and
 * built-in dimensions: region, product, AWS fields, etc.).
 *
 * **Cost category / business-mapping group-by is not static:** dimensions such as “Business Domains”
 * come from **`harness_ccm_finops_list` `cost_category`** (live names and uuids). The server resolves those
 * when you use `group_by: "business_domain"` plus optional `business_mapping_name` / ids — do not
 * add them to `CCM_GROUP_BY_FIELDS`.
 *
 * **Resource tags (QLCE LABEL_V2):** use `group_by: "resource_tag"` (or `tag`, `tags`, `labels`, …) and
 * **`tag_key`** (the tag key to aggregate by). Optional **`tag_field_id`** defaults to `labels.value`.
 * Legacy aliases: `label_v2` + `label_key` / `label_field_id` still work.
 */

/** Static time-range presets aligned with CCM `buildTimeFilters` in `ccm.ts`. */
export const CCM_TIME_FILTERS = [
  "LAST_7",
  "LAST_14",
  "THIS_MONTH",
  "LAST_30_DAYS",
  "THIS_QUARTER",
  "THIS_YEAR",
  "LAST_MONTH",
  "LAST_QUARTER",
  "LAST_YEAR",
  "LAST_3_MONTHS",
  "LAST_6_MONTHS",
  "LAST_12_MONTHS",
] as const;

/**
 * Static **built-in** group-by field keys (region, product, AWS dimensions, …).
 * Cost-category / BUSINESS_MAPPING dimensions are **dynamic** — discover via `cost_category`, not this list.
 */
export const CCM_GROUP_BY_FIELDS = [
  "region",
  "awsUsageaccountid",
  "awsUsageAccountId",
  "awsServicecode",
  "awsBillingEntity",
  "awsInstancetype",
  "awsLineItemType",
  "awspayeraccountid",
  "awsUsageType",
  "cloudProvider",
  "none",
  "product",
  /** GCP billing project (perspective grid / timeseries). */
  "gcpprojectid",
  "gcpProjectId",
  "gcp_project_id",
  /** GCP billing account. */
  "gcpbillingaccountid",
  "gcpBillingAccountId",
  "gcp_billing_account_id",
  /** GCP invoice month. */
  "gcpinvoicemonth",
  "gcpInvoiceMonth",
  "gcp_invoice_month",
  /** GCP product (not the same as cross-cloud COMMON `product`). */
  "gcpproduct",
  "gcpProduct",
  "gcp_product",
  /** GCP resource global name. */
  "gcpresource.global_name",
  "gcpresource_global_name",
  "gcpResourceGlobalName",
  /** GCP SKUs (description). */
  "gcpskudescription",
  "gcpSkuDescription",
  "gcp_sku_description",
  /** Resource tags (LABEL_V2); requires `tag_key` (or legacy `label_key`). */
  "resource_tag",
  "resource_tags",
  "tag",
  "tags",
  "labels",
  "label_v2",
  "labelv2",
] as const;

/** Query shape for cost_breakdown and cost_timeseries. Used by harness_ccm_finops_list tool input. */
export interface CCMListQuery {
  /** Required. Get from harness_ccm_finops_list cost_summary (no perspective_id) → default perspective ids, or harness_ccm_finops_list cost_perspective. */
  perspective_id: string;
  /** Time range — typically one of {@link CCM_TIME_FILTERS}; see harness_ccm_finops_describe for the full enum wired to the API. */
  time_filter?: string;
  /** Custom UTC window (epoch ms); when set with {@link end_time_ms}, overrides `time_filter`. */
  start_time_ms?: number;
  end_time_ms?: number;
  /**
   * Scope perspective queries via QLCE `idFilter` (IN): GCP billing project id(s), GCP product name(s),
   * and/or COMMON product name(s). Use strings (comma-separated for multiple) or `*_ids` / `*_products` arrays.
   */
  filter_gcp_project_id?: string | string[];
  filter_gcp_project_ids?: string[];
  filter_gcp_product?: string | string[];
  filter_gcp_products?: string[];
  filter_product?: string | string[];
  filter_products?: string[];
  /**
   * Built-in group dimension — typically one of {@link CCM_GROUP_BY_FIELDS}, or use `business_domain`
   * for cost-category dimensions resolved live (not listed in `CCM_GROUP_BY_FIELDS`).
   * For resource tags, use `resource_tag` and {@link tag_key}.
   */
  group_by?: string;
  /** Resource tag key when grouping by tag (QLCE fieldName). Aliases: `resource_tag_key`, `label_key`, `label_field_name`. */
  tag_key?: string;
  resource_tag_key?: string;
  label_key?: string;
  label_field_name?: string;
  /** QLCE label field id; default `labels.value`. Aliases: `resource_tag_field_id`, `label_field_id`. */
  tag_field_id?: string;
  resource_tag_field_id?: string;
  label_field_id?: string;
  /** Max items. Default 25 (breakdown) / 12 (timeseries). */
  limit?: number;
  /** Pagination offset (breakdown only). Default 0. */
  offset?: number;
  /** Use cost category stamped data to match CCM UI. Default true for breakdown. */
  use_cost_category_stamped_data?: boolean;
  /** Time bucket for trend (timeseries only): "DAY" | "MONTH" | "WEEK". Default "DAY". */
  time_resolution?: "DAY" | "MONTH" | "WEEK";
}

/**
 * Validates that perspective_id is present for cost_breakdown / cost_timeseries.
 * Throws a clear error telling the caller to resolve the perspective first.
 */
export function requirePerspectiveId(
  input: Record<string, unknown>,
  resourceType: "cost_breakdown" | "cost_timeseries" | "cost_trend" | "cost_drilldown",
): asserts input is Record<string, unknown> & { perspective_id: string } {
  const id = input.perspective_id;
  if (id !== undefined && id !== null && String(id).trim() !== "") {
    return;
  }
  throw new Error(
    `${resourceType} requires perspective_id. ` +
      "Resolve it first: call harness_ccm_finops_list with resource_type 'cost_summary' and no perspective_id to get default perspective IDs (e.g. defaultAwsPerspectiveId), or harness_ccm_finops_list resource_type 'cost_perspective' to list all; then pass perspective_id in the query object to this tool.",
  );
}
