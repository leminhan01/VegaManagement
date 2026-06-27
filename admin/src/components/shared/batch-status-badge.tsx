import type { BatchStatus } from "@/lib/types";

const statusConfig: Record<BatchStatus, { label: string; className: string }> = {
  ACTIVE: {
    label: "Đang dùng",
    className: "bg-secondary-container text-on-secondary-container",
  },
  EXPIRED: {
    label: "Hết hạn",
    className: "bg-error-container text-on-error-container",
  },
  CONSUMED: {
    label: "Đã dùng hết",
    className: "bg-tertiary-fixed text-on-tertiary-fixed",
  },
  RECALLED: {
    label: "Thu hồi",
    className: "bg-inverse-surface text-inverse-on-surface",
  },
};

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${config.className}`}>
      {config.label}
    </span>
  );
}
