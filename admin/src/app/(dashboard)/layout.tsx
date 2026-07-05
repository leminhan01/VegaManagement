import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { Suspense } from "react";

// Các page dashboard dùng useSearchParams() (customers/detail, products/detail, warehouse)
// → bỏ static prerender để tránh lỗi "Cannot read properties of null (reading 'useContext')".
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <TopBar />
      <main className="ml-64 min-h-screen pt-16">{children}</main>
    </div>
  );
}
