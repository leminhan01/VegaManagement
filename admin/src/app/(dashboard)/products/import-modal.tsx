"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { apiClient } from "@/lib/api-client";
import type { ImportReport, ImportRowReport } from "@/lib/types";

type Step = "select" | "preview" | "result";

export function ImportProductsModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<Step>("select");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<ImportReport | null>(null);
  const [result, setResult] = useState<ImportReport | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const reset = () => {
    setStep("select");
    setFile(null);
    setError("");
    setPreview(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const downloadTemplate = async () => {
    setError("");
    try {
      const blob = await apiClient.downloadImportTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mau-import-san-pham.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được file mẫu");
    }
  };

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError("");
  };

  const doPreview = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const report = await apiClient.previewImport(file);
      setPreview(report);
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xem trước được file");
    } finally {
      setBusy(false);
    }
  };

  const doConfirm = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const report = await apiClient.confirmImport(file);
      setResult(report);
      setStep("result");
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import thất bại");
    } finally {
      setBusy(false);
    }
  };

  const report = step === "result" ? result : preview;
  const hasValid = (report?.summary.valid ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/50 px-6 py-5">
          <div>
            <h3 className="text-lg font-semibold text-on-surface">
              Nhập sản phẩm từ Excel
            </h3>
            <p className="mt-0.5 text-sm text-on-surface-variant">
              {step === "select" && "Tải mẫu, điền dữ liệu rồi xem trước trước khi lưu."}
              {step === "preview" && "Kiểm tra kết quả phân tích. Các dòng lỗi sẽ bị bỏ qua."}
              {step === "result" && "Hoàn tất nhập sản phẩm."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 border-b border-error/20 bg-error-container/80 px-6 py-3">
            <span className="material-symbols-outlined text-[18px] text-error">error</span>
            <p className="text-sm font-medium text-on-error-container">{error}</p>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto p-6">
          {step === "select" && (
            <div className="space-y-5">
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
              >
                <span className="material-symbols-outlined text-[20px]">download</span>
                Tải file mẫu (.xlsx)
              </button>

              <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container/40 p-6 text-center">
                <span className="material-symbols-outlined text-[32px] text-on-surface-variant">
                  upload_file
                </span>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Chọn file Excel đã điền theo mẫu
                </p>
                <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary transition-all hover:bg-primary/90 active:scale-[0.97]">
                  <span className="material-symbols-outlined text-[20px]">folder_open</span>
                  {file ? file.name : "Chọn file .xlsx"}
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={onPickFile}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="rounded-lg bg-surface-container/60 p-4 text-sm text-on-surface-variant">
                <p className="font-medium text-on-surface">Lưu ý</p>
                <ul className="mt-1.5 list-inside list-disc space-y-1">
                  <li>Cột bắt buộc được tô màu trong file mẫu.</li>
                  <li>SKU trùng sẽ <b>ghi đè</b> sản phẩm cũ.</li>
                  <li>Tối đa 500 dòng mỗi file.</li>
                </ul>
              </div>
            </div>
          )}

          {(step === "preview" || step === "result") && report && (
            <div className="space-y-5">
              <SummaryBar step={step} report={report} />
              {step === "preview" && report.summary.invalid > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-error/30 bg-error-container/40 px-4 py-2.5 text-sm text-on-error-container">
                  <span className="material-symbols-outlined text-[18px] text-error">warning</span>
                  Có {report.summary.invalid} dòng lỗi — sẽ bị bỏ qua khi nhập.
                </div>
              )}
              <RowsTable rows={report.rows} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-outline-variant/50 px-6 py-4">
          {step === "select" && (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={doPreview}
                disabled={!file || busy}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-on-primary transition-all hover:bg-primary/90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy && (
                  <span className="material-symbols-outlined animate-spin text-[20px]">
                    progress_activity
                  </span>
                )}
                Xem trước
              </button>
            </>
          )}

          {step === "preview" && (
            <>
              <button
                type="button"
                onClick={() => setStep("select")}
                disabled={busy}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={doConfirm}
                disabled={!hasValid || busy}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-on-primary transition-all hover:bg-primary/90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <span className="material-symbols-outlined animate-spin text-[20px]">
                    progress_activity
                  </span>
                ) : (
                  <span className="material-symbols-outlined text-[20px]">save</span>
                )}
                Xác nhận nhập
              </button>
            </>
          )}

          {step === "result" && (
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-on-primary transition-all hover:bg-primary/90 active:scale-[0.97]"
            >
              Đóng
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryBar({ step, report }: { step: Step; report: ImportReport }) {
  const { summary } = report;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Chip label="Tổng dòng" value={summary.total} tone="neutral" />
      {step === "preview" ? (
        <>
          <Chip label="Hợp lệ" value={summary.valid} tone="ok" />
          <Chip label="Lỗi" value={summary.invalid} tone="err" />
        </>
      ) : (
        <>
          <Chip label="Tạo mới" value={summary.created} tone="ok" />
          <Chip label="Cập nhật" value={summary.updated} tone="info" />
          <Chip label="Thất bại" value={summary.failed} tone="err" />
        </>
      )}
    </div>
  );
}

function Chip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "ok" | "info" | "err";
}) {
  const toneClass = {
    neutral: "bg-surface-container text-on-surface",
    ok: "bg-primary-container text-on-primary-container",
    info: "bg-secondary-container text-on-secondary-container",
    err: "bg-error-container text-on-error-container",
  }[tone];
  return (
    <div className={`rounded-lg px-4 py-2.5 ${toneClass}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function RowsTable({ rows }: { rows: ImportRowReport[] }) {
  return (
    <div className="max-h-[40vh] overflow-auto rounded-lg border border-outline-variant/50">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-surface-container text-on-surface-variant">
          <tr>
            <th className="px-3 py-2 font-semibold">#</th>
            <th className="px-3 py-2 font-semibold">SKU</th>
            <th className="px-3 py-2 font-semibold">Tên</th>
            <th className="px-3 py-2 font-semibold">Hành động</th>
            <th className="px-3 py-2 font-semibold">Lỗi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/40">
          {rows.map((r) => (
            <tr key={r.rowNo} className="align-top">
              <td className="px-3 py-2 text-on-surface-variant">{r.rowNo}</td>
              <td className="px-3 py-2 font-mono text-xs text-on-surface">
                {r.sku || "—"}
              </td>
              <td className="px-3 py-2 text-on-surface">{r.name || "—"}</td>
              <td className="px-3 py-2">
                <ActionBadge action={r.action} />
              </td>
              <td className="px-3 py-2 text-xs text-error">
                {r.errors.length ? r.errors.join("; ") : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionBadge({ action }: { action: ImportRowReport["action"] }) {
  const map = {
    create: { label: "Tạo mới", cls: "bg-primary-container text-on-primary-container" },
    update: { label: "Cập nhật", cls: "bg-secondary-container text-on-secondary-container" },
    error: { label: "Lỗi", cls: "bg-error-container text-on-error-container" },
  }[action];
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${map.cls}`}>
      {map.label}
    </span>
  );
}
