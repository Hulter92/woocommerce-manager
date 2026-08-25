import { LazyStore } from "@tauri-apps/plugin-store";

export interface WooSettings {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

export const EMPTY_SETTINGS: WooSettings = {
  storeUrl: "",
  consumerKey: "",
  consumerSecret: "",
};

const SETTINGS_KEY = "woocommerce-connection";

const store = new LazyStore("settings.json");

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function loadSettings(): Promise<WooSettings> {
  if (!isTauri()) return EMPTY_SETTINGS;
  const value = await store.get<WooSettings>(SETTINGS_KEY);
  return value ?? EMPTY_SETTINGS;
}

export async function saveSettings(settings: WooSettings): Promise<void> {
  if (!isTauri()) return;
  await store.set(SETTINGS_KEY, settings);
  await store.save();
}

export function isConfigured(settings: WooSettings): boolean {
  return Boolean(settings.storeUrl && settings.consumerKey && settings.consumerSecret);
}

export function normalizeStoreUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}
