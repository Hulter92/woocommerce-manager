import { fetch } from "@tauri-apps/plugin-http";
import { normalizeStoreUrl, type WooSettings } from "./settings";
import type {
  WooCategory,
  WooCustomer,
  WooMonthlyReport,
  WooOrder,
  WooOrderStatus,
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
  categoryId?: number;
}

export function listProducts(settings: WooSettings, options: ListProductsOptions = {}) {
  const { page = 1, perPage = 20, search, stockStatus, categoryId } = options;
  return requestList<WooProduct>(settings, "/products", {
    page,
    per_page: perPage,
    search: search || undefined,
    stock_status: stockStatus,
    category: categoryId,
  });
}

export async function listCategories(settings: WooSettings): Promise<WooCategory[]> {
  const { data } = await request<WooCategory[]>(settings, "/products/categories", {
    params: { per_page: 100, orderby: "name", order: "asc", hide_empty: true },
  });
  return data;
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

async function getRevenueStatsForRange(
  settings: WooSettings,
  after: string,
  before: string
): Promise<WooRevenueStats> {
  const { data } = await request<{ totals: WooRevenueStats }>(settings, "/reports/revenue/stats", {
    params: { after, before, interval: "day" },
    namespace: "wc-analytics",
  });
  return data.totals;
}

export async function getRecentOrders(settings: WooSettings, count = 5): Promise<WooOrder[]> {
  const { items } = await listOrders(settings, { perPage: count });
  return items;
}

// Dashboard stats — computed directly from live orders (wc/v3) rather than
// wc-analytics. wc-analytics' report tables are populated by a background
// sync and lag behind real orders, so "Idag"/very recent periods came back
// empty even with real orders present. Orders are always current.

export interface WooDashboardRevenue {
  totalSales: number;
  netRevenue: number;
  grossSales: number;
  taxes: number;
  ordersCount: number;
}

function summarizeRevenue(orders: WooOrder[]): WooDashboardRevenue {
  let totalSales = 0;
  let taxes = 0;
  let discountTotal = 0;
  for (const order of orders) {
    totalSales += Number(order.total);
    taxes += Number(order.total_tax);
    discountTotal += Number(order.discount_total);
  }
  return {
    totalSales,
    netRevenue: totalSales - taxes,
    grossSales: totalSales + discountTotal,
    taxes,
    ordersCount: orders.length,
  };
}

function summarizeTopSellers(orders: WooOrder[], count: number): WooTopSeller[] {
  const byProduct = new Map<number, WooTopSeller>();
  for (const order of orders) {
    for (const item of order.line_items) {
      const entry = byProduct.get(item.product_id) ?? {
        product_id: item.product_id,
        name: item.name,
        quantity: 0,
        netRevenue: 0,
      };
      entry.quantity += item.quantity;
      entry.netRevenue += Number(item.total);
      byProduct.set(item.product_id, entry);
    }
  }
  return Array.from(byProduct.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, count);
}

export async function getDashboardStats(
  settings: WooSettings,
  period: WooReportPeriod
): Promise<{ revenue: WooDashboardRevenue; topSellers: WooTopSeller[] }> {
  const { after, before } = getPeriodRange(period);
  const orders = await getAllOrdersInRange(settings, after, before, ["completed", "processing"]);
  return {
    revenue: summarizeRevenue(orders),
    topSellers: summarizeTopSellers(orders, 8),
  };
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

  const [orders, revenueStats] = await Promise.all([
    getAllOrdersInRange(settings, after, before, ["completed", "processing"]),
    getRevenueStatsForRange(settings, after, before),
  ]);

  let bankTotal = 0;
  let vatTotal = 0;
  const locationTotals = new Map<string, number>();

  for (const order of orders) {
    const total = Number(order.total);
    const tax = Number(order.total_tax);
    bankTotal += total;
    vatTotal += tax;

    const location =
      getOrderMeta(order, "pickup_store") ?? getOrderMeta(order, "pickup_store_id") ?? "Okänd";
    locationTotals.set(location, (locationTotals.get(location) ?? 0) + (total - tax));
  }

  // "refunds" from the analytics totals is a positive magnitude — negate it
  // for a bookkeeping-style negative line. Pulled from wc-analytics rather
  // than the /orders/{id}/refunds sub-resource because fetching that per
  // order (100+ requests for a typical month) was tripping rate limits.
  const refundsTotal = -revenueStats.refunds;

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
