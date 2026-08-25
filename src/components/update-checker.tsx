"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

type UpdateState =
  | { status: "idle" | "none" }
  | { status: "available"; version: string }
  | { status: "installing" }
  | { status: "error"; message: string };

export function UpdateChecker() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    check()
      .then((update) => {
        if (cancelled) return;
        setState(update ? { status: "available", version: update.version } : { status: "none" });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleInstall() {
    setState({ status: "installing" });
    try {
      const update = await check();
      if (!update) {
        setState({ status: "none" });
        return;
      }
      await update.downloadAndInstall();
      await relaunch();
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  if (dismissed || state.status === "idle" || state.status === "none") {
    return null;
  }

  if (state.status === "error") {
    return null;
  }

  return (
    <div className="flex items-center gap-3 bg-primary/10 border-b border-border px-4 py-2 text-sm">
      <Download size={16} className="text-primary shrink-0" />
      {state.status === "available" && (
        <>
          <span>En ny version ({state.version}) är tillgänglig.</span>
          <Button size="sm" onClick={handleInstall} className="ml-auto">
            Uppdatera nu
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="text-muted hover:text-foreground"
            aria-label="Stäng"
          >
            <X size={16} />
          </button>
        </>
      )}
      {state.status === "installing" && (
        <span className="flex items-center gap-2">
          <Spinner /> Laddar ner och installerar uppdateringen…
        </span>
      )}
    </div>
  );
}
