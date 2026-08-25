import { Badge } from "@/components/ui/badge";
import type { WooOrderStatus } from "@/lib/types";

const STATUS_MAP: Record<WooOrderStatus, { label: string; tone: "neutral" | "success" | "warning" | "danger" | "primary" }> = {
  pending: { label: "Väntar på betalning", tone: "warning" },
  processing: { label: "Behandlas", tone: "primary" },
  "on-hold": { label: "Pausad", tone: "warning" },
  completed: { label: "Slutförd", tone: "success" },
  cancelled: { label: "Avbruten", tone: "neutral" },
  refunded: { label: "Återbetald", tone: "neutral" },
  failed: { label: "Misslyckad", tone: "danger" },
  trash: { label: "Papperskorg", tone: "neutral" },
};

export const ORDER_STATUS_OPTIONS: { value: WooOrderStatus; label: string }[] = (
  Object.keys(STATUS_MAP) as WooOrderStatus[]
).map((value) => ({ value, label: STATUS_MAP[value].label }));

export function OrderStatusBadge({ status }: { status: WooOrderStatus }) {
  const entry = STATUS_MAP[status] ?? { label: status, tone: "neutral" as const };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

export function orderStatusLabel(status: WooOrderStatus): string {
  return STATUS_MAP[status]?.label ?? status;
}
