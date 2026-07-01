"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { EmailReportConfig, EmailReportSection } from "@/lib/types";

// ── Mục nội dung báo cáo (mapping backend SECTION_WHITELIST) ──
const SECTION_OPTIONS: { key: EmailReportSection; label: string; description: string }[] = [
  { key: "sales", label: "Tổng quan bán hàng", description: "Doanh thu, số đơn, AOV, đang chờ xử lý" },
  { key: "top_products", label: "Sản phẩm bán chạy", description: "Top sản phẩm theo số lượng" },
  { key: "order_status", label: "Đơn hàng theo trạng thái", description: "Phân bố đơn theo trạng thái" },
  { key: "payment_methods", label: "Phương thức thanh toán", description: "Phân bố theo phương thức" },
  { key: "low_stock", label: "Cảnh báo tồn kho thấp", description: "Sản phẩm sắp hết (stock ≤ tối thiểu)" },
  { key: "expiration", label: "Cảnh báo hạn sử dụng", description: "Lô hết hạn / sắp hết hạn (30 ngày)" },
];

const INTERVAL_PRESETS = [1, 3, 5, 12, 24];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormState {
  name: string;
  recipients: string[];
  recipientInput: string;
  intervalHours: number; // 0 = custom
  customHours: number;
  sections: EmailReportSection[];
  isActive: boolean;
}

const emptyForm: FormState = {
  name: "",
  recipients: [],
  recipientInput: "",
  intervalHours: 3,
  customHours: 1,
  sections: ["sales", "top_products"],
  isActive: true,
};

function resolveInterval(form: FormState): number {
  return form.intervalHours === 0 ? form.customHours : form.intervalHours;
}

function intervalLabel(hours: number): string {
  if (hours >= 24 && hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "Mỗi ngày" : `Mỗi ${days} ngày`;
  }
  return `Mỗi ${hours} giờ`;
}

export default function EmailReportsPage() {
  const [configs, setConfigs] = useState<EmailReportConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EmailReportConfig | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<EmailReportConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchConfigs = useCallback(async () => {
    try {
      const data = await apiClient.getEmailReports();
      if (data) setConfigs(data as EmailReportConfig[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách báo cáo");
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchConfigs();
      setLoading(false);
    })();
  }, [fetchConfigs]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // ── Modal handlers ──

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setError("");
    setModalOpen(true);
  }

  function openEdit(config: EmailReportConfig) {
    setEditing(config);
    const isPreset = INTERVAL_PRESETS.includes(config.intervalHours);
    setForm({
      name: config.name,
      recipients: [...config.recipients],
      recipientInput: "",
      intervalHours: isPreset ? config.intervalHours : 0,
      customHours: isPreset ? 1 : config.intervalHours,
      sections: [...config.sections],
      isActive: config.isActive,
    });
    setError("");
    setModalOpen(true);
  }

  function addRecipient() {
    const email = form.recipientInput.trim();
    if (!email) return;
    if (!EMAIL_REGEX.test(email)) {
      setError("Email không hợp lệ: " + email);
      return;
    }
    if (form.recipients.includes(email)) {
      setForm((f) => ({ ...f, recipientInput: "" }));
      return;
    }
    setForm((f) => ({ ...f, recipients: [...f.recipients, email], recipientInput: "" }));
    setError("");
  }

  function removeRecipient(email: string) {
    setForm((f) => ({ ...f, recipients: f.recipients.filter((r) => r !== email) }));
  }

  function toggleSection(key: EmailReportSection) {
    setForm((f) => ({
      ...f,
      sections: f.sections.includes(key)
        ? f.sections.filter((s) => s !== key)
        : [...f.sections, key],
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (form.recipients.length === 0) {
      setError("Vui lòng thêm ít nhất 1 người nhận");
      return;
    }
    if (form.sections.length === 0) {
      setError("Vui lòng chọn ít nhất 1 mục nội dung");
      return;
    }
    const intervalHours = resolveInterval(form);
    if (!intervalHours || intervalHours < 1) {
      setError("Chu kỳ gửi phải lớn hơn 0 giờ");
      return;
    }

    const payload = {
      name: form.name.trim(),
      recipients: form.recipients,
      intervalHours,
      sections: form.sections,
      isActive: form.isActive,
    };

    setSaving(true);
    try {
      if (editing) {
        await apiClient.updateEmailReport(editing.id, payload);
        setSuccess("Đã cập nhật cấu hình báo cáo");
      } else {
        await apiClient.createEmailReport(payload);
        setSuccess("Đã tạo cấu hình báo cáo");
      }
      setModalOpen(false);
      await fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(config: EmailReportConfig) {
    try {
      await apiClient.toggleEmailReport(config.id);
      await fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật thất bại");
    }
  }

  async function handleSendNow(config: EmailReportConfig) {
    setSendingId(config.id);
    setError("");
    try {
      await apiClient.sendEmailReportNow(config.id);
      setSuccess(`Đã gửi báo cáo "${config.name}" đến ${config.recipients.length} người nhận`);
      await fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gửi báo cáo thất bại");
    } finally {
      setSendingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.deleteEmailReport(deleteTarget.id);
      setDeleteTarget(null);
      await fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa thất bại");
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-64 animate-pulse rounded bg-surface-container-highest" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-container-highest" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">Báo cáo qua email</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Cấu hình gửi tự động báo cáo kinh doanh định kỳ cho người quản lý qua email
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Tạo cấu hình
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container">
          <span className="material-symbols-outlined mr-2 text-[18px] align-middle">error</span>
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg bg-primary-fixed px-4 py-3 text-sm text-on-primary-fixed">
          <span className="material-symbols-outlined mr-2 text-[18px] align-middle">check_circle</span>
          {success}
        </div>
      )}

      {/* Danh sách cấu hình */}
      {configs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant py-16 text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">mark_email_unread</span>
          <p className="mt-2 text-sm text-on-surface-variant">Chưa có cấu hình báo cáo email nào</p>
          <button
            onClick={openCreate}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
          >
            Tạo cấu hình đầu tiên
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-outline-variant bg-surface">
          <table className="w-full min-w-[960px] border-collapse text-left">
            <thead>
              <tr className="border-b border-outline-variant/60 bg-surface-container/60">
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-on-surface-variant">Tên cấu hình</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-on-surface-variant">Người nhận</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-on-surface-variant">Chu kỳ</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-on-surface-variant">Nội dung</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-on-surface-variant">Lần gửi cuối</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold text-on-surface-variant">Lần kế tiếp</th>
                <th className="px-5 py-3.5 text-center text-xs font-semibold text-on-surface-variant">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {configs.map((config) => (
                <tr key={config.id} className="align-top hover:bg-primary/[0.03]">
                  <td className="px-5 py-4">
                    <div className="font-medium text-on-surface">{config.name}</div>
                    <span
                      className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        config.isActive
                          ? "bg-primary-fixed text-on-primary-fixed"
                          : "bg-surface-container-highest text-on-surface-variant"
                      }`}
                    >
                      {config.isActive ? "Đang bật" : "Đang tắt"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex max-w-[220px] flex-wrap gap-1">
                      {config.recipients.map((email) => (
                        <span
                          key={email}
                          className="rounded bg-surface-container-highest px-2 py-0.5 text-xs text-on-surface-variant"
                        >
                          {email}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-on-surface-variant">
                    {intervalLabel(config.intervalHours)}
                  </td>
                  <td className="px-5 py-4 text-sm text-on-surface-variant">
                    {config.sections.length} mục
                  </td>
                  <td className="px-5 py-4 text-xs text-on-surface-variant">
                    {config.lastSentAt ? formatDateTime(config.lastSentAt) : "—"}
                  </td>
                  <td className="px-5 py-4 text-xs text-on-surface-variant">
                    {config.isActive ? formatDateTime(config.nextRunAt) : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleSendNow(config)}
                        disabled={sendingId === config.id}
                        title="Gửi thử ngay"
                        className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest disabled:opacity-50"
                      >
                        <span className={`material-symbols-outlined text-[20px] ${sendingId === config.id ? "animate-spin" : ""}`}>
                          {sendingId === config.id ? "progress_activity" : "send"}
                        </span>
                      </button>
                      <button
                        onClick={() => handleToggle(config)}
                        title={config.isActive ? "Tắt" : "Bật"}
                        className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {config.isActive ? "toggle_on" : "toggle_off"}
                        </span>
                      </button>
                      <button
                        onClick={() => openEdit(config)}
                        title="Chỉnh sửa"
                        className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                      >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(config)}
                        title="Xóa"
                        className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ Modal Tạo/Sửa ═══ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface shadow-xl">
            <form onSubmit={handleSubmit}>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-outline-variant px-6 py-5">
                <h3 className="text-lg font-semibold text-on-surface">
                  {editing ? "Sửa cấu hình báo cáo" : "Tạo cấu hình báo cáo"}
                </h3>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Body */}
              <div className="space-y-5 p-6">
                {/* Tên cấu hình */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">
                    Tên cấu hình <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    maxLength={100}
                    placeholder="VD: Báo cáo ngày cho quản lý"
                    className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                  />
                </div>

                {/* Người nhận */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">
                    Người nhận <span className="text-error">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={form.recipientInput}
                      onChange={(e) => setForm((f) => ({ ...f, recipientInput: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addRecipient();
                        }
                      }}
                      placeholder="email@quanly.com"
                      className="flex-1 rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={addRecipient}
                      className="flex items-center gap-1 rounded-lg bg-surface-container-highest px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      Thêm
                    </button>
                  </div>
                  {form.recipients.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {form.recipients.map((email) => (
                        <span
                          key={email}
                          className="flex items-center gap-1 rounded-full bg-secondary-container px-3 py-1 text-xs text-on-secondary-container"
                        >
                          {email}
                          <button
                            type="button"
                            onClick={() => removeRecipient(email)}
                            className="text-on-secondary-container/70 hover:text-on-secondary-container"
                          >
                            <span className="material-symbols-outlined text-[14px]">close</span>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chu kỳ gửi */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">
                    Chu kỳ gửi <span className="text-error">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {INTERVAL_PRESETS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, intervalHours: h }))}
                        className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                          form.intervalHours === h
                            ? "border-primary bg-primary text-on-primary"
                            : "border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                        }`}
                      >
                        {intervalLabel(h)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, intervalHours: 0 }))}
                      className={`flex items-center gap-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        form.intervalHours === 0
                          ? "border-primary bg-primary text-on-primary"
                          : "border-outline-variant bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                      }`}
                    >
                      Tùy chỉnh
                    </button>
                  </div>
                  {form.intervalHours === 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-sm text-on-surface-variant">Cứ mỗi</span>
                      <input
                        type="number"
                        min={1}
                        max={720}
                        value={form.customHours}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, customHours: parseInt(e.target.value) || 1 }))
                        }
                        className="w-24 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                      />
                      <span className="text-sm text-on-surface-variant">giờ gửi 1 lần</span>
                    </div>
                  )}
                </div>

                {/* Nội dung báo cáo */}
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">
                    Nội dung báo cáo <span className="text-error">*</span>
                  </label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {SECTION_OPTIONS.map((opt) => {
                      const checked = form.sections.includes(opt.key);
                      return (
                        <label
                          key={opt.key}
                          className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ${
                            checked
                              ? "border-primary bg-secondary-container/40"
                              : "border-outline-variant bg-surface-container hover:bg-surface-container-high"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSection(opt.key)}
                            className="mt-0.5 h-4 w-4 accent-primary"
                          />
                          <div>
                            <div className="text-sm font-medium text-on-surface">{opt.label}</div>
                            <div className="text-xs text-on-surface-variant">{opt.description}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Bật/tắt */}
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="h-4 w-4 accent-primary"
                  />
                  <span className="text-sm text-on-surface">
                    Kích hoạt gửi tự động (nếu tắt, cấu hình sẽ không được cron xử lý)
                  </span>
                </label>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-outline-variant px-6 py-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : editing ? "Cập nhật" : "Tạo cấu hình"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Xác nhận xóa ═══ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-error-container p-2">
                <span className="material-symbols-outlined text-on-error-container">warning</span>
              </div>
              <h3 className="text-lg font-semibold text-on-surface">Xóa cấu hình báo cáo</h3>
            </div>
            <p className="mb-6 text-sm text-on-surface-variant">
              Bạn có chắc muốn xóa cấu hình <strong>{deleteTarget.name}</strong>? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-highest"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 rounded-lg bg-error px-4 py-2 text-sm font-medium text-on-error transition-colors hover:bg-error/90 disabled:opacity-50"
              >
                {deleting ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
