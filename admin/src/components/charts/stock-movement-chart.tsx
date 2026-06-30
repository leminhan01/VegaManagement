"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { CHART_COLORS, axisTickStyle } from "./chart-theme";

interface Props {
  data: Array<{ day: string; in: number; out: number; adjustment: number }>;
}

function fmtLabel(day: string): string {
  const d = new Date(day + "T00:00:00");
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export function StockMovementChart({ data }: Props) {
  const chartData = data.map((d) => ({
    label: fmtLabel(d.day),
    Nhập: d.in,
    Xuất: d.out,
    "Điều chỉnh": Math.abs(d.adjustment),
  }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-on-surface-variant">
        Chưa có biến động tồn kho trong kỳ này
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={CHART_COLORS.outlineVariant}
          vertical={false}
        />
        <XAxis
          dataKey="label"
          tick={axisTickStyle}
          tickLine={false}
          axisLine={{ stroke: CHART_COLORS.outlineVariant }}
          minTickGap={12}
        />
        <YAxis
          tick={axisTickStyle}
          tickLine={false}
          axisLine={false}
          width={40}
          allowDecimals={false}
        />
        <Tooltip
          formatter={(value, name) => [`${value} sp`, name]}
          contentStyle={tooltipStyle}
        />
        <Legend
          iconType="circle"
          formatter={(value) => (
            <span style={{ color: "#3d4a42", fontSize: 12 }}>{value}</span>
          )}
        />
        <Bar dataKey="Nhập" fill={CHART_COLORS.primary} radius={[3, 3, 0, 0]} barSize={10} />
        <Bar dataKey="Xuất" fill={CHART_COLORS.error} radius={[3, 3, 0, 0]} barSize={10} />
        <Bar dataKey="Điều chỉnh" fill={CHART_COLORS.outline} radius={[3, 3, 0, 0]} barSize={10} />
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
