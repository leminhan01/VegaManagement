"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface NavItem {
  label: string;
  icon: string;
  href: string;
  match?: string;
}

interface NavSection {
  label?: string;
  icon?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Tổng quan",
    items: [{ label: "Dashboard", icon: "space_dashboard", href: "/" }],
  },
  {
    label: "Sản phẩm",
    items: [
      { label: "Quản lý sản phẩm", icon: "inventory_2", href: "/products" },
      { label: "Danh mục", icon: "category", href: "/categories" },
    ],
  },
  {
    label: "Bán hàng",
    items: [
      { label: "Đơn hàng", icon: "shopping_cart", href: "/orders" },
      { label: "Duyệt đơn hàng", icon: "pending_actions", href: "/order-approval" },
      { label: "Khách hàng", icon: "group", href: "/customers" },
    ],
  },
  {
    label: "Kho hàng",
    items: [
      {
        label: "Nghiệp vụ kho",
        icon: "fact_check",
        href: "/warehouse?view=operations",
        match: "/warehouse?view=operations",
      },
      {
        label: "Tồn kho",
        icon: "inventory_2",
        href: "/warehouse?view=inventory",
        match: "/warehouse?view=inventory",
      },
      { label: "Lô hàng", icon: "inventory", href: "/batches" },
      { label: "Hạn sử dụng", icon: "event_busy", href: "/expiration" },
      {
        label: "Nhà cung cấp",
        icon: "local_shipping",
        href: "/warehouse?view=suppliers",
        match: "/warehouse?view=suppliers",
      },
      { label: "Báo cáo", icon: "analytics", href: "/reports" },
    ],
  },
  {
    label: "Chăm sóc khách hàng",
    items: [{ label: "Nhật ký chat", icon: "chat", href: "/chat-logs" }],
  },
  {
    label: "Cài đặt",
    items: [
      { label: "Thông tin cửa hàng", icon: "store", href: "/store-info" },
      { label: "Báo cáo qua email", icon: "mark_email_unread", href: "/email-reports" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = searchParams.get("view");

  const isActive = (item: NavItem) => {
    if (item.match?.startsWith("/warehouse?view=")) {
      return pathname === "/warehouse" && item.match.endsWith(`=${currentView}`);
    }
    if (item.href === "/") return pathname === "/";
    return pathname.startsWith(item.href.split("?")[0]);
  };

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-outline-variant bg-surface-container-lowest">
      <div className="flex flex-col gap-1 px-6 pb-4 pt-6">
        <h1 className="font-[family-name:var(--font-hanken)] text-xl font-bold text-primary">
          VegiFlow Admin
        </h1>
        <p className="text-sm text-on-surface-variant">
          Hệ thống quản lý thực phẩm chay
        </p>
      </div>

      <nav className="custom-scrollbar flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-2">
        {navSections.map((section) => (
          <div key={section.label} className="space-y-1">
            <div className="mb-1 flex items-center gap-2 px-3 py-1 text-xs font-bold uppercase tracking-wide text-on-surface-variant/70">
              <span className="material-symbols-outlined text-[17px]">
                {section.icon}
              </span>
              {section.label}
            </div>
            {section.items.map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg border-l px-3 py-2.5 pl-4 text-sm transition-colors ${
                    active
                      ? "border-primary bg-secondary-container font-semibold text-on-secondary-container"
                      : "border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-highest"
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-outline-variant px-3 py-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Đăng xuất
        </button>
      </div>
    </aside>
  );
}
