"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { SERIES_PALETTE, CHART_COLORS } from "./chart-theme";
import { formatCurrency } from "@/lib/format";

interface Props {
  data: Array<{ categoryName: string; value: number; stock: number }>;
}

export function InventoryValueByCategory({ data }: Props) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const chartData = data.map((d) => ({
    name: d.categoryName,
    value: d.value,
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-on-surface-variant">
        Chưa có dữ liệu tồn kho
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={2}
              stroke="none"
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={SERIES_PALETTE[i % SERIES_PALETTE.length]}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value)), "Giá trị"]}
              contentStyle={tooltipStyle}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-on-surface-variant">Tổng giá trị</span>
          <span className="font-[family-name:var(--font-hanken)] text-base font-semibold text-on-surface">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {data.slice(0, 6).map((d, i) => (
          <div key={d.categoryName} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor: SERIES_PALETTE[i % SERIES_PALETTE.length],
              }}
            />
            <span className="flex-1 truncate text-on-surface-variant">
              {d.categoryName}
            </span>
            <span className="font-medium text-on-surface">
              {formatCurrency(d.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${CHART_COLORS.outlineVariant}`,
  background: "#ffffff",
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
} as const;
