"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { SERIES_PALETTE, axisTickStyle, CHART_COLORS } from "./chart-theme";

interface Props {
  data: Array<{ name: string; quantity: number }>;
}

function truncate(name: string, max = 22): string {
  return name.length > max ? name.slice(0, max - 1) + "…" : name;
}

export function TopProductsBarChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-on-surface-variant">
        Chưa có dữ liệu bán hàng trong kỳ này
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 40)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 20, left: 8, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={CHART_COLORS.outlineVariant}
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={axisTickStyle}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={axisTickStyle}
          tickLine={false}
          axisLine={false}
          width={150}
          tickFormatter={(v) => truncate(String(v))}
        />
        <Tooltip
          formatter={(value) => [`${value} sản phẩm`, "Số lượng bán"]}
          contentStyle={tooltipStyle}
        />
        <Bar dataKey="quantity" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={SERIES_PALETTE[i % SERIES_PALETTE.length]}
            />
          ))}
        </Bar>
      </BarChart>
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
