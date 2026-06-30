"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from "./chart-theme";

interface Props {
  data: Array<{ status: string; count: number; value: number }>;
}

export function OrderStatusDonut({ data }: Props) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const chartData = data.map((d) => ({
    name: ORDER_STATUS_LABELS[d.status] ?? d.status,
    value: d.count,
    status: d.status,
  }));

  return (
    <div>
      <div className="relative">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={66}
              outerRadius={92}
              paddingAngle={2}
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.status}
                  fill={ORDER_STATUS_COLORS[entry.status] ?? "#6d7a72"}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} đơn`, name]}
              contentStyle={tooltipStyle}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-[family-name:var(--font-hanken)] text-3xl font-semibold text-on-surface">
            {total}
          </span>
          <span className="text-xs text-on-surface-variant">đơn hàng</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {chartData.map((entry) => (
          <div key={entry.status} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor:
                  ORDER_STATUS_COLORS[entry.status] ?? "#6d7a72",
              }}
            />
            <span className="flex-1 truncate text-on-surface-variant">
              {entry.name}
            </span>
            <span className="font-medium text-on-surface">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #bccac0",
  background: "#ffffff",
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
} as const;
