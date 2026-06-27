function daysBetween(date: string) {
  const target = new Date(date).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target - today.getTime()) / 86400000);
}

export function ExpirationBadge({ expirationDate }: { expirationDate?: string }) {
  if (!expirationDate) {
    return (
      <span className="inline-flex rounded-full bg-surface-container px-3 py-1 text-xs font-bold text-on-surface-variant">
        Không hạn
      </span>
    );
  }

  const days = daysBetween(expirationDate);
  const className =
    days < 0
      ? "bg-error-container text-on-error-container"
      : days <= 7
        ? "bg-error-container text-on-error-container"
        : days <= 30
          ? "bg-tertiary-fixed text-on-tertiary-fixed"
          : "bg-secondary-container text-on-secondary-container";
  const label = days < 0 ? `Quá hạn ${Math.abs(days)} ngày` : `Còn ${days} ngày`;

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}
