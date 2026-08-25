export interface WooImage {
  id: number;
  src: string;
  alt: string;
}

export interface WooLineItem {
  id: number;
  name: string;
  quantity: number;
  total: string;
  sku: string;
}

export interface WooOrder {
  id: number;
  number: string;
  status: WooOrderStatus;
  date_created: string;
  currency: string;
  total: string;
  payment_method_title: string;
  customer_id: number;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  line_items: WooLineItem[];
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
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | null;
  stock_status: "instock" | "outofstock" | "onbackorder";
  manage_stock: boolean;
  status: "publish" | "draft" | "pending" | "private";
  images: WooImage[];
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

export interface WooOrdersTotals {
  slug: string;
  name: string;
  total: number;
}

export interface WooSalesReport {
  total_sales: string;
  net_sales: string;
  total_orders: number;
  total_items: number;
  total_customers?: number;
}

export interface WooTopSeller {
  product_id: number;
  name: string;
  quantity: number;
}

export type WooReportPeriod = "today" | "week" | "month" | "year";
