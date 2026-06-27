import type { OrderStatus } from "@/lib/types";

type BadgeVariant = "default" | "active" | "inactive";

interface StatusBadgeConfig {
  label: string;
  bgColor: string;
  textColor: string;
}

const orderStatusConfig: Record<OrderStatus, StatusBadgeConfig> = {
  PENDING: {
    label: "Chờ xác nhận",
    bgColor: "bg-surface-container",
    textColor: "text-on-surface-variant",
  },
  CONFIRMED: {
    label: "Đã xác nhận",
    bgColor: "bg-secondary-container",
    textColor: "text-on-secondary-container",
  },
  PROCESSING: {
    label: "Đang chuẩn bị",
    bgColor: "bg-primary-fixed",
    textColor: "text-on-primary-fixed-variant",
  },
  SHIPPED: {
    label: "Đang giao",
    bgColor: "bg-primary",
    textColor: "text-on-primary",
  },
  DELIVERED: {
    label: "Đã giao",
    bgColor: "bg-secondary-container",
    textColor: "text-on-secondary-container",
  },
  CANCELLED: {
    label: "Đã hủy",
    bgColor: "bg-error-container",
    textColor: "text-on-error-container",
  },
  REFUNDING: {
    label: "Đang hoàn tiền",
    bgColor: "bg-error-container",
    textColor: "text-on-error-container",
  },
  REFUNDED: {
    label: "Đã hoàn tiền",
    bgColor: "bg-surface-container",
    textColor: "text-on-surface-variant",
  },
};

const variantConfig: Record<BadgeVariant, StatusBadgeConfig> = {
  default: {
    label: "",
    bgColor: "bg-surface-container",
    textColor: "text-on-surface-variant",
  },
  active: {
    label: "Hoạt động",
    bgColor: "bg-secondary-container",
    textColor: "text-on-secondary-container",
  },
  inactive: {
    label: "Ngừng hoạt động",
    bgColor: "bg-error-container",
    textColor: "text-on-error-container",
  },
};

interface StatusBadgeProps {
  status?: OrderStatus;
  variant?: BadgeVariant;
  showDot?: boolean;
}

export function StatusBadge({
  status,
  variant = "default",
  showDot,
}: StatusBadgeProps) {
  const config = status
    ? orderStatusConfig[status]
    : variantConfig[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgColor} ${config.textColor}`}
    >
      {showDot && (
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            variant === "active"
              ? "bg-primary animate-pulse"
              : "bg-error"
          }`}
        />
      )}
      {status ? config.label : config.label}
    </span>
  );
}
