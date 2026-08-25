import { fetch } from "@tauri-apps/plugin-http";
import { normalizeStoreUrl, type WooSettings } from "./settings";
import type {
  WooCustomer,
  WooOrder,
  WooOrderStatus,
  WooOrdersTotals,
  WooProduct,
  WooReportPeriod,
  WooSalesReport,
  WooTopSeller,
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

type QueryParams = Record<string, string | number | boolean | undefined>;

function authHeader(settings: WooSettings): string {
  const token = btoa(`${settings.consumerKey}:${settings.consumerSecret}`);
  return `Basic ${token}`;
}

function buildUrl(settings: WooSettings, path: string, params?: QueryParams): string {
  const base = normalizeStoreUrl(settings.storeUrl);
  const url = new URL(`${base}/wp-json/wc/v3${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
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

async function request<T>(
  settings: WooSettings,
  path: string,
  options: { method?: string; params?: QueryParams; body?: unknown } = {}
): Promise<{ data: T; headers: Headers }> {
  if (!settings.storeUrl || !settings.consumerKey || !settings.consumerSecret) {
    throw new WooCommerceApiError("Butiken är inte konfigurerad än.", 0);
  }
  const { method = "GET", params, body } = options;
  const url = buildUrl(settings, path, params);

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

  if (!res.ok) {
    throw new WooCommerceApiError(await parseErrorMessage(res), res.status);
  }

  const data = (await res.json()) as T;
  return { data, headers: res.headers };
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

export async function getSalesReport(
  settings: WooSettings,
  period: WooReportPeriod = "week"
): Promise<WooSalesReport> {
  const { data } = await request<WooSalesReport[]>(settings, "/reports/sales", {
    params: { period },
  });
  return (
    data[0] ?? {
      total_sales: "0",
      net_sales: "0",
      total_orders: 0,
      total_items: 0,
    }
  );
}

export async function getOrdersTotals(settings: WooSettings): Promise<WooOrdersTotals[]> {
  const { data } = await request<WooOrdersTotals[]>(settings, "/reports/orders/totals");
  return data;
}

export async function getTopSellers(
  settings: WooSettings,
  period: WooReportPeriod = "week"
): Promise<WooTopSeller[]> {
  const { data } = await request<WooTopSeller[]>(settings, "/reports/top_sellers", {
    params: { period },
  });
  return data;
}

export async function getCustomersTotal(settings: WooSettings): Promise<number> {
  const { data } = await request<WooOrdersTotals[]>(settings, "/reports/customers/totals");
  return data.reduce((sum, entry) => sum + entry.total, 0);
}

export async function getOutOfStockCount(settings: WooSettings): Promise<number> {
  const { total } = await requestList<WooProduct>(settings, "/products", {
    stock_status: "outofstock",
    per_page: 1,
  });
  return total;
}

export async function getRecentOrders(settings: WooSettings, count = 5): Promise<WooOrder[]> {
  const { items } = await listOrders(settings, { perPage: count });
  return items;
}
