import { fetch } from "@tauri-apps/plugin-http";
import { normalizeStoreUrl, type WooSettings } from "./settings";
import type {
  WooCustomer,
  WooMonthlyReport,
  WooOrder,
  WooOrderStatus,
  WooOrdersTotals,
  WooProduct,
  WooReportPeriod,
  WooRevenueStats,
  WooTopSeller,
  WooVariation,
} from "./types";

export class WooCommerceApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "WooCommerceApiError";
    this.status = status;
  }
}

export interface ListResult<T> {
  items: T[];
  total: number;
  totalPages: number;
}

type QueryParams = Record<string, string | number | boolean | string[] | undefined>;

function authHeader(settings: WooSettings): string {
  const token = btoa(`${settings.consumerKey}:${settings.consumerSecret}`);
  return `Basic ${token}`;
}

function buildUrl(
  settings: WooSettings,
  path: string,
  params?: QueryParams,
  namespace = "wc/v3"
): string {
  const base = normalizeStoreUrl(settings.storeUrl);
  const url = new URL(`${base}/wp-json/${namespace}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(`${key}[]`, v);
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string };
    if (data?.message) return data.message;
  } catch {
    // response body wasn't JSON
  }
  return `${res.status} ${res.statusText}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RATE_LIMIT_RETRIES = 5;

async function request<T>(
  settings: WooSettings,
  path: string,
  options: { method?: string; params?: QueryParams; body?: unknown; namespace?: string } = {}
): Promise<{ data: T; headers: Headers }> {
  if (!settings.storeUrl || !settings.consumerKey || !settings.consumerSecret) {
    throw new WooCommerceApiError("Butiken är inte konfigurerad än.", 0);
  }
  const { method = "GET", params, body, namespace } = options;
  const url = buildUrl(settings, path, params, namespace);

  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: authHeader(settings),
          "Content-Type": "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new WooCommerceApiError(
        "Kunde inte nå butiken. Kontrollera webbadressen och din internetanslutning.",
        0
      );
    }

    if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
      await sleep(delay);
      continue;
    }

    if (!res.ok) {
      throw new WooCommerceApiError(await parseErrorMessage(res), res.status);
    }

    const data = (await res.json()) as T;
    return { data, headers: res.headers };
  }
}

async function requestList<T>(
  settings: WooSettings,
  path: string,
  params?: QueryParams
): Promise<ListResult<T>> {
  const { data, headers } = await request<T[]>(settings, path, { params });
  const total = Number(headers.get("x-wp-total") ?? data.length);
  const totalPages = Number(headers.get("x-wp-totalpages") ?? 1);
  return { items: data, total, totalPages };
}

export async function testConnection(settings: WooSettings): Promise<void> {
  await request(settings, "/products", { params: { per_page: 1 } });
}

// Orders

export interface ListOrdersOptions {
  page?: number;
  perPage?: number;
  status?: WooOrderStatus | "any";
  search?: string;
  customerId?: number;
}

export function listOrders(settings: WooSettings, options: ListOrdersOptions = {}) {
  const { page = 1, perPage = 20, status = "any", search, customerId } = options;
  return requestList<WooOrder>(settings, "/orders", {
    page,
    per_page: perPage,
    status,
    search: search || undefined,
    customer: customerId,
    orderby: "date",
    order: "desc",
  });
}

export async function updateOrderStatus(
  settings: WooSettings,
  orderId: number,
  status: WooOrderStatus
): Promise<WooOrder> {
  const { data } = await request<WooOrder>(settings, `/orders/${orderId}`, {
    method: "PUT",
    body: { status },
  });
  return data;
}

export async function trashOrder(settings: WooSettings, orderId: number): Promise<void> {
  await request(settings, `/orders/${orderId}`, {
    method: "DELETE",
    params: { force: false },
  });
}

export async function getOrder(settings: WooSettings, orderId: number): Promise<WooOrder> {
  const { data } = await request<WooOrder>(settings, `/orders/${orderId}`);
  return data;
}

// Products

export interface ListProductsOptions {
  page?: number;
  perPage?: number;
  search?: string;
  stockStatus?: "instock" | "outofstock" | "onbackorder";
}

export function listProducts(settings: WooSettings, options: ListProductsOptions = {}) {
  const { page = 1, perPage = 20, search, stockStatus } = options;
  return requestList<WooProduct>(settings, "/products", {
    page,
    per_page: perPage,
    search: search || undefined,
    stock_status: stockStatus,
  });
}

export async function updateProduct(
  settings: WooSettings,
  productId: number,
  changes: Partial<Pick<WooProduct, "regular_price" | "sale_price" | "stock_quantity">>
): Promise<WooProduct> {
  const { data } = await request<WooProduct>(settings, `/products/${productId}`, {
    method: "PUT",
    body: changes,
  });
  return data;
}

export async function listVariations(
  settings: WooSettings,
  productId: number
): Promise<WooVariation[]> {
  const { data } = await request<WooVariation[]>(settings, `/products/${productId}/variations`, {
    params: { per_page: 100 },
  });
  return data;
}

export async function updateVariation(
  settings: WooSettings,
  productId: number,
  variationId: number,
  changes: Partial<Pick<WooVariation, "regular_price" | "sale_price" | "stock_quantity">>
): Promise<WooVariation> {
  const { data } = await request<WooVariation>(
    settings,
    `/products/${productId}/variations/${variationId}`,
    { method: "PUT", body: changes }
  );
  return data;
}

// Customers

export interface ListCustomersOptions {
  page?: number;
  perPage?: number;
  search?: string;
}

export function listCustomers(settings: WooSettings, options: ListCustomersOptions = {}) {
  const { page = 1, perPage = 20, search } = options;
  return requestList<WooCustomer>(settings, "/customers", {
    page,
    per_page: perPage,
    search: search || undefined,
  });
}

// Reports / dashboard
//
// These use the newer "wc-analytics" REST API (WooCommerce Admin/Analytics,
// bundled since WooCommerce 4.0) instead of the legacy wc/v3 "reports"
// endpoints. It accepts arbitrary before/after date ranges (so "today" is
// possible, unlike the legacy endpoints' fixed week/month/year presets) and
// returns richer per-product data.

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  return startOfDay(monday);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

export function getPeriodRange(period: WooReportPeriod): { after: string; before: string } {
  const now = new Date();
  switch (period) {
    case "today":
      return { after: startOfDay(now).toISOString(), before: now.toISOString() };
    case "week":
      return { after: startOfWeek(now).toISOString(), before: now.toISOString() };
    case "month":
      return { after: startOfMonth(now).toISOString(), before: now.toISOString() };
    case "last_month": {
      const lastMonthEnd = new Date(startOfMonth(now).getTime() - 1);
      return { after: startOfMonth(lastMonthEnd).toISOString(), before: lastMonthEnd.toISOString() };
    }
    case "year":
      return { after: startOfYear(now).toISOString(), before: now.toISOString() };
  }
}

export async function getRevenueStats(
  settings: WooSettings,
  period: WooReportPeriod = "week"
): Promise<WooRevenueStats> {
  const { after, before } = getPeriodRange(period);
  const { data } = await request<{ totals: WooRevenueStats }>(settings, "/reports/revenue/stats", {
    params: { after, before, interval: "day" },
    namespace: "wc-analytics",
  });
  return data.totals;
}

interface WooAnalyticsProductRow {
  product_id: number;
  items_sold: number;
  net_revenue: number;
  extended_info: { name: string };
}

export async function getTopSellers(
  settings: WooSettings,
  period: WooReportPeriod = "week",
  count = 8
): Promise<WooTopSeller[]> {
  const { after, before } = getPeriodRange(period);
  const { data } = await request<WooAnalyticsProductRow[]>(settings, "/reports/products", {
    params: {
      after,
      before,
      orderby: "items_sold",
      order: "desc",
      per_page: count,
      extended_info: true,
    },
    namespace: "wc-analytics",
  });
  return data.map((row) => ({
    product_id: row.product_id,
    name: row.extended_info.name,
    quantity: row.items_sold,
    netRevenue: row.net_revenue,
  }));
}

export async function getOrdersTotals(settings: WooSettings): Promise<WooOrdersTotals[]> {
  const { data } = await request<WooOrdersTotals[]>(settings, "/reports/orders/totals");
  return data;
}

export async function getCustomersTotal(settings: WooSettings): Promise<number> {
  const { data } = await request<WooOrdersTotals[]>(settings, "/reports/customers/totals");
  return data.reduce((sum, entry) => sum + entry.total, 0);
}

export async function getRecentOrders(settings: WooSettings, count = 5): Promise<WooOrder[]> {
  const { items } = await listOrders(settings, { perPage: count });
  return items;
}

// Monthly (bookkeeping) report
//
// Splits net sales (excl. VAT) by pickup location — read from the order's
// "pickup_store" meta field (set by the store's pickup-scheduling plugin),
// not a dedicated core WooCommerce field.

function getOrderMeta(order: WooOrder, key: string): string | undefined {
  const entry = order.meta_data.find((m) => m.key === key);
  if (entry === undefined || entry.value === null || entry.value === undefined) return undefined;
  const value = String(entry.value).trim();
  return value === "" ? undefined : value;
}

// Refunds aren't embedded in the order object — WooCommerce exposes them
// only via this sub-resource. "amount" is a positive magnitude, so it must
// be subtracted (not added) to get a bookkeeping-style negative total.
async function getOrderRefundTotal(settings: WooSettings, orderId: number): Promise<number> {
  const { data } = await request<{ amount: string }[]>(settings, `/orders/${orderId}/refunds`);
  return data.reduce((sum, refund) => sum + Number(refund.amount), 0);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function getAllOrdersInRange(
  settings: WooSettings,
  after: string,
  before: string,
  statuses: WooOrderStatus[]
): Promise<WooOrder[]> {
  const perPage = 100;
  const all: WooOrder[] = [];
  let page = 1;
  for (;;) {
    const { items, totalPages } = await requestList<WooOrder>(settings, "/orders", {
      after,
      before,
      status: statuses,
      per_page: perPage,
      page,
      orderby: "date",
      order: "asc",
    });
    all.push(...items);
    if (page >= totalPages || items.length === 0) break;
    page += 1;
  }
  return all;
}

export async function getMonthlyReport(
  settings: WooSettings,
  yearMonth: string
): Promise<WooMonthlyReport> {
  const [year, month] = yearMonth.split("-").map(Number);
  const after = new Date(year, month - 1, 1).toISOString();
  const before = new Date(year, month, 1).toISOString();

  const orders = await getAllOrdersInRange(settings, after, before, ["completed", "processing"]);
  const refundTotals = await mapWithConcurrency(orders, 3, (order) =>
    getOrderRefundTotal(settings, order.id)
  );

  let bankTotal = 0;
  let vatTotal = 0;
  let refundsTotal = 0;
  const locationTotals = new Map<string, number>();

  orders.forEach((order, index) => {
    const total = Number(order.total);
    const tax = Number(order.total_tax);
    bankTotal += total;
    vatTotal += tax;

    const location =
      getOrderMeta(order, "pickup_store") ?? getOrderMeta(order, "pickup_store_id") ?? "Okänd";
    locationTotals.set(location, (locationTotals.get(location) ?? 0) + (total - tax));

    refundsTotal -= refundTotals[index];
  });

  const locations = Array.from(locationTotals, ([name, netSales]) => ({ name, netSales })).sort(
    (a, b) => b.netSales - a.netSales
  );

  return {
    yearMonth,
    currency: orders[0]?.currency ?? "SEK",
    bankTotal,
    vatTotal,
    locations,
    refundsTotal,
    orderCount: orders.length,
  };
}
