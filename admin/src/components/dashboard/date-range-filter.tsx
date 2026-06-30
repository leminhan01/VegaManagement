"use client";

import { useState, useMemo } from "react";
import type { DateRange } from "@/lib/format";
import { toYMD, rangeDays } from "@/lib/format";

interface Props {
  value: DateRange;
  onChange: (range: DateRange, daysCount: number) => void;
}

type PresetKey =
  | "today"
  | "7d"
  | "30d"
  | "thisMonth"
  | "lastMonth"
  | "custom";

interface Preset {
  key: PresetKey;
  label: string;
  range: () => DateRange;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function presets(): Preset[] {
  const now = new Date();
  const today = startOfDay(now);

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  return [
    { key: "today", label: "Hôm nay", range: () => ({ dateFrom: toYMD(today), dateTo: toYMD(today) }) },
    {
      key: "7d",
      label: "7 ngày qua",
      range: () => {
        const from = new Date(today);
        from.setDate(from.getDate() - 6);
        return { dateFrom: toYMD(from), dateTo: toYMD(today) };
      },
    },
    {
      key: "30d",
      label: "30 ngày qua",
      range: () => {
        const from = new Date(today);
        from.setDate(from.getDate() - 29);
        return { dateFrom: toYMD(from), dateTo: toYMD(today) };
      },
    },
    {
      key: "thisMonth",
      label: "Tháng này",
      range: () => ({ dateFrom: toYMD(thisMonthStart), dateTo: toYMD(today) }),
    },
    {
      key: "lastMonth",
      label: "Tháng trước",
      range: () => ({
        dateFrom: toYMD(lastMonthStart),
        dateTo: toYMD(lastMonthEnd),
      }),
    },
  ];
}

function detectPreset(value: DateRange): PresetKey {
  for (const p of presets()) {
    const r = p.range();
    if (r.dateFrom === value.dateFrom && r.dateTo === value.dateTo) return p.key;
  }
  return "custom";
}

export function DateRangeFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const list = useMemo(() => presets(), []);
  const activeKey = detectPreset(value);

  const buttonText =
    activeKey === "custom"
      ? `${value.dateFrom.split("-").reverse().join("/")} – ${value.dateTo
          .split("-")
          .reverse()
          .join("/")}`
      : list.find((p) => p.key === activeKey)?.label ?? "Khoảng thời gian";

  const apply = (range: DateRange) => {
    onChange(range, rangeDays(range));
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm text-on-surface transition-colors hover:bg-surface-container-low"
      >
        <span className="material-symbols-outlined text-lg">calendar_today</span>
        <span className="font-medium">{buttonText}</span>
        <span className="material-symbols-outlined text-lg text-on-surface-variant">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <>
          {/* Backdrop đóng dropdown khi click ra ngoài */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl border border-outline-variant/60 bg-surface-container-lowest p-3 shadow-lg">
            <div className="space-y-1">
              {list.map((p) => (
                <button
                  key={p.key}
                  onClick={() => apply(p.range())}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                    activeKey === p.key
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-on-surface hover:bg-surface-container-low"
                  }`}
                >
                  <span>{p.label}</span>
                  {activeKey === p.key && (
                    <span className="material-symbols-outlined text-base">
                      check
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="mt-3 border-t border-outline-variant/40 pt-3">
              <p className="mb-2 px-1 text-xs font-medium text-on-surface-variant">
                Tùy chọn khoảng
              </p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <span className="w-10">Từ</span>
                  <input
                    type="date"
                    value={value.dateFrom}
                    max={value.dateTo}
                    onChange={(e) =>
                      apply({
                        dateFrom: e.target.value || value.dateFrom,
                        dateTo: value.dateTo,
                      })
                    }
                    className="flex-1 rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-on-surface-variant">
                  <span className="w-10">Đến</span>
                  <input
                    type="date"
                    value={value.dateTo}
                    min={value.dateFrom}
                    onChange={(e) =>
                      apply({
                        dateFrom: value.dateFrom,
                        dateTo: e.target.value || value.dateTo,
                      })
                    }
                    className="flex-1 rounded-lg border border-outline-variant bg-surface px-2 py-1.5 text-sm text-on-surface focus:border-primary focus:outline-none"
                  />
                </label>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
