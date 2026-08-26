export interface WooImage {
  id: number;
  src: string;
  alt: string;
}

export interface WooLineItem {
  id: number;
  name: string;
  quantity: number;
  price: number;
  total: string;
  sku: string;
}

export interface WooAddress {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

export interface WooOrder {
  id: number;
  number: string;
  status: WooOrderStatus;
  date_created: string;
  currency: string;
  total: string;
  shipping_total: string;
  total_tax: string;
  discount_total: string;
  customer_note: string;
  payment_method_title: string;
  customer_id: number;
  billing: WooAddress & { email: string; phone: string };
  shipping: WooAddress;
  line_items: WooLineItem[];
  meta_data: { id: number; key: string; value: unknown }[];
}

export type WooOrderStatus =
  | "pending"
  | "processing"
  | "on-hold"
  | "completed"
  | "cancelled"
  | "refunded"
  | "failed"
  | "trash";

export interface WooProduct {
  id: number;
  name: string;
  sku: string;
  permalink: string;
  type: "simple" | "variable" | "grouped" | "external";
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  stock_status: "instock" | "outofstock" | "onbackorder";
  manage_stock: boolean;
  status: "publish" | "draft" | "pending" | "private";
  images: WooImage[];
}

export interface WooVariationAttribute {
  id: number;
  name: string;
  option: string;
}

export interface WooVariation {
  id: number;
  sku: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  stock_status: "instock" | "outofstock" | "onbackorder";
  manage_stock: boolean;
  attributes: WooVariationAttribute[];
  image: WooImage | null;
}

export interface WooCustomer {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  date_created: string;
  billing: {
    phone: string;
    city: string;
    country: string;
  };
}

export interface WooRevenueStats {
  total_sales: number;
  net_revenue: number;
  gross_sales: number;
  orders_count: number;
  num_items_sold: number;
  coupons: number;
  coupons_count: number;
  refunds: number;
  shipping: number;
  taxes: number;
  products: number;
}

export interface WooTopSeller {
  product_id: number;
  name: string;
  quantity: number;
  netRevenue: number;
}

export type WooReportPeriod = "today" | "week" | "month" | "last_month" | "year";

export interface WooMonthlyReportLocation {
  name: string;
  netSales: number;
}

export interface WooMonthlyReport {
  yearMonth: string;
  currency: string;
  bankTotal: number;
  vatTotal: number;
  locations: WooMonthlyReportLocation[];
  refundsTotal: number;
  orderCount: number;
}
