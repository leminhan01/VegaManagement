"use client";

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { CHART_COLORS, axisTickStyle } from "./chart-theme";
import { formatCurrency } from "@/lib/format";

interface DailyPoint {
  day: string;
  orders: number;
  revenue: number;
}

interface Props {
  current: DailyPoint[];
  previous?: DailyPoint[];
}

function fmtLabel(day: string): string {
  const d = new Date(day + "T00:00:00");
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export function RevenueAreaChart({ current, previous }: Props) {
  const n = Math.max(current.length, previous?.length ?? 0);
  const data = Array.from({ length: n }, (_, i) => ({
    label: current[i] ? fmtLabel(current[i].day) : `T+${i + 1}`,
    current: current[i]?.revenue ?? 0,
    previous: previous?.[i]?.revenue ?? null,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart
        data={data}
        margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={CHART_COLORS.primary}
              stopOpacity={0.32}
            />
            <stop
              offset="100%"
              stopColor={CHART_COLORS.primary}
              stopOpacity={0.02}
            />
          </linearGradient>
        </defs>
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
        />
        <YAxis
          tick={axisTickStyle}
          tickLine={false}
          axisLine={false}
          width={58}
          tickFormatter={(v) => formatCurrency(Number(v))}
        />
        <Tooltip
          formatter={(value) => [formatCurrency(Number(value)), ""]}
          labelFormatter={(label) => `Ngày ${label}`}
          contentStyle={tooltipStyle}
        />
        <Area
          type="monotone"
          dataKey="current"
          name="Kỳ này"
          stroke={CHART_COLORS.primary}
          strokeWidth={2}
          fill="url(#revGrad)"
        />
        {previous && previous.length > 0 && (
          <Line
            type="monotone"
            dataKey="previous"
            name="Kỳ trước"
            stroke={CHART_COLORS.outline}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            connectNulls
          />
        )}
      </ComposedChart>
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
