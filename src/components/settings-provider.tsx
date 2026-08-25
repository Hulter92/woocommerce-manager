"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { EMPTY_SETTINGS, isConfigured, loadSettings, saveSettings, type WooSettings } from "@/lib/settings";

interface SettingsContextValue {
  settings: WooSettings;
  loading: boolean;
  configured: boolean;
  update: (settings: WooSettings) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<WooSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadSettings()
      .then((loaded) => {
        if (!cancelled) setSettings(loaded);
      })
      .catch((err) => {
        console.error("Kunde inte läsa sparade inställningar:", err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (next: WooSettings) => {
    await saveSettings(next);
    setSettings(next);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, configured: isConfigured(settings), update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings måste användas inuti SettingsProvider");
  return ctx;
}
