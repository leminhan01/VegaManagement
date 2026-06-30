"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import {
  PAYMENT_METHOD_COLORS,
  PAYMENT_METHOD_LABELS,
  CHART_COLORS,
} from "./chart-theme";
import { formatCurrency } from "@/lib/format";

interface Props {
  data: Array<{ method: string; count: number; value: number }>;
}

export function PaymentBreakdownPie({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-on-surface-variant">
        Chưa có dữ liệu thanh toán
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: PAYMENT_METHOD_LABELS[d.method] ?? d.method,
    value: d.count,
    method: d.method,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          outerRadius={92}
          innerRadius={8}
          paddingAngle={2}
          stroke="none"
        >
          {chartData.map((entry) => (
            <Cell
              key={entry.method}
              fill={PAYMENT_METHOD_COLORS[entry.method] ?? CHART_COLORS.outline}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, _name, item) => {
            const original = data.find(
              (d) =>
                (PAYMENT_METHOD_LABELS[d.method] ?? d.method) ===
                (item as { name?: string })?.name,
            );
            return [
              `${value} đơn · ${formatCurrency(original?.value ?? 0)}`,
              (item as { name?: string })?.name ?? "",
            ];
          }}
          contentStyle={tooltipStyle}
        />
        <Legend
          iconType="circle"
          formatter={(value) => (
            <span style={{ color: "#3d4a42", fontSize: 12 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

const tooltipStyle = {
  borderRadius: 12,
  border: `1px solid ${CHART_COLORS.outlineVariant}`,
  background: "#ffffff",
  fontSize: 12,
  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
} as const;
