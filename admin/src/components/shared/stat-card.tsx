interface StatCardProps {
  icon: string;
  iconBgColor: string;
  iconTextColor?: string;
  label: string;
  value: string;
  subtitle?: string;
  trend?: string;
  trendColor?: string;
  trendBg?: string;
  trendIcon?: string;
  variant?: "default" | "error";
}

export function StatCard({
  icon,
  iconBgColor,
  iconTextColor = "text-primary",
  label,
  value,
  subtitle,
  trend,
  trendColor = "text-primary",
  trendBg = "bg-primary/5",
  trendIcon,
  variant = "default",
}: StatCardProps) {
  return (
    <div
      className={`group relative overflow-hidden rounded-xl border p-6 shadow-sm transition-all duration-200 hover:shadow-md ${
        variant === "error"
          ? "border-error/20 bg-error-container/10"
          : "border-outline-variant/60 bg-surface-container-lowest"
      }`}
    >
      {/* Subtle accent line at top */}
      <div
        className={`absolute left-0 top-0 h-[3px] w-full ${
          variant === "error"
            ? "bg-error/60"
            : "bg-gradient-to-r from-primary/70 via-primary/30 to-transparent"
        }`}
      />

      {/* Top row: icon circle + trend badge */}
      <div className="flex items-start justify-between">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconBgColor} ${iconTextColor} transition-transform duration-200 group-hover:scale-105`}
        >
          <span className="material-symbols-outlined text-[20px]">
            {icon}
          </span>
        </div>
        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${trendColor} ${trendBg}`}
          >
            {trendIcon && (
              <span className="material-symbols-outlined text-[14px]">
                {trendIcon}
              </span>
            )}
            {trend}
          </span>
        )}
      </div>

      {/* Bottom: label + value */}
      <div className={variant === "error" ? "relative z-10 mt-4" : "mt-4"}>
        <p className="text-[13px] font-medium tracking-wide text-on-surface-variant">
          {label}
        </p>
        <p
          className={`font-[family-name:var(--font-hanken)] mt-1 text-[26px] font-semibold leading-tight ${
            variant === "error" ? "text-error" : "text-on-surface"
          }`}
        >
          {value}
        </p>
        {subtitle && (
          <div
            className={`mt-1.5 flex items-center gap-1 ${
              variant === "error" ? "text-error" : trendColor
            }`}
          >
            {variant === "error" && (
              <span className="material-symbols-outlined text-[16px]">
                warning
              </span>
            )}
            <span className="font-[family-name:var(--font-jetbrains)] text-[11px] font-medium">
              {subtitle}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
