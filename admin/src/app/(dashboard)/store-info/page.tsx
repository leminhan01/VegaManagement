"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

// ── Types ──

interface StoreConfigItem {
  id: string;
  key: string;
  value: string;
  label?: string;
  updatedAt: string;
}

interface StoreBranch {
  id: string;
  name: string;
  address: string;
  phone?: string;
  email?: string;
  openHours?: Record<string, string>;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

type TabId = "main" | "branches" | "social" | "policies";

const DAYS = [
  { key: "mon", label: "Thứ 2" },
  { key: "tue", label: "Thứ 3" },
  { key: "wed", label: "Thứ 4" },
  { key: "thu", label: "Thứ 5" },
  { key: "fri", label: "Thứ 6" },
  { key: "sat", label: "Thứ 7" },
  { key: "sun", label: "Chủ nhật" },
];

const DEFAULT_OPEN_HOURS: Record<string, string> = {
  mon: "8:00-21:00",
  tue: "8:00-21:00",
  wed: "8:00-21:00",
  thu: "8:00-21:00",
  fri: "8:00-21:00",
  sat: "8:00-21:00",
  sun: "9:00-18:00",
};

// ── Main config keys (Tab 1) ──
const MAIN_CONFIG_KEYS = [
  { key: "store_name", label: "Tên cửa hàng", type: "text" as const },
  { key: "store_description", label: "Giới thiệu", type: "textarea" as const },
  { key: "address", label: "Địa chỉ", type: "text" as const },
  { key: "phone", label: "Số điện thoại", type: "text" as const },
  { key: "hotline", label: "Hotline", type: "text" as const },
  { key: "email", label: "Email", type: "text" as const },
  { key: "logo", label: "Logo URL", type: "text" as const },
];

// ── Social config keys (Tab 3) ──
const SOCIAL_CONFIG_KEYS = [
  { key: "fanpage", label: "Fanpage Facebook", icon: "thumb_up", placeholder: "https://facebook.com/..." },
  { key: "zalo_oa", label: "Zalo OA", icon: "chat", placeholder: "https://zalo.me/..." },
  { key: "tiktok", label: "TikTok", icon: "music_note", placeholder: "https://tiktok.com/@..." },
  { key: "website", label: "Website", icon: "language", placeholder: "https://..." },
];

// ── Policy config keys (Tab 4) ──
const POLICY_CONFIG_KEYS = [
  { key: "return_policy", label: "Chính sách đổi trả" },
  { key: "shipping_policy", label: "Chính sách giao hàng" },
  { key: "warranty_policy", label: "Chính sách bảo hành" },
];

const emptyBranchForm = {
  name: "",
  address: "",
  phone: "",
  email: "",
  openHours: { ...DEFAULT_OPEN_HOURS },
  latitude: "",
  longitude: "",
  sortOrder: "0",
};

export default function StoreInfoPage() {
  const [activeTab, setActiveTab] = useState<TabId>("main");
  const [configs, setConfigs] = useState<Record<string, StoreConfigItem>>({});
  const [branches, setBranches] = useState<StoreBranch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Branch modal state
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<StoreBranch | null>(null);
  const [branchForm, setBranchForm] = useState({ ...emptyBranchForm });
  const [deleteTarget, setDeleteTarget] = useState<StoreBranch | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states for config tabs
  const [mainForm, setMainForm] = useState<Record<string, string>>({});
  const [socialForm, setSocialForm] = useState<Record<string, string>>({});
  const [policyForm, setPolicyForm] = useState<Record<string, string>>({});
  const [openHours, setOpenHours] = useState<Record<string, string>>({ ...DEFAULT_OPEN_HOURS });

  // ── Fetch data ──

  const fetchConfigs = useCallback(async () => {
    try {
      const data = await apiClient.getStoreConfigs();
      if (!data) return;
      const items = data as StoreConfigItem[];
      const map: Record<string, StoreConfigItem> = {};
      const formValues: Record<string, string> = {};
      for (const item of items) {
        map[item.key] = item;
        formValues[item.key] = item.value;
      }
      setConfigs(map);

      // Initialize forms from loaded config
      const mainVals: Record<string, string> = {};
      for (const k of MAIN_CONFIG_KEYS) {
        mainVals[k.key] = formValues[k.key] || "";
      }
      setMainForm(mainVals);

      const socialVals: Record<string, string> = {};
      for (const k of SOCIAL_CONFIG_KEYS) {
        socialVals[k.key] = formValues[k.key] || "";
      }
      setSocialForm(socialVals);

      const policyVals: Record<string, string> = {};
      for (const k of POLICY_CONFIG_KEYS) {
        policyVals[k.key] = formValues[k.key] || "";
      }
      setPolicyForm(policyVals);

      // Parse open_hours JSON
      if (formValues["open_hours"]) {
        try {
          setOpenHours(JSON.parse(formValues["open_hours"]));
        } catch {
          /* keep default */
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được cấu hình");
    }
  }, []);

  const fetchBranches = useCallback(async () => {
    try {
      const data = await apiClient.getStoreBranches();
      if (data) setBranches(data as StoreBranch[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được chi nhánh");
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    await Promise.all([fetchConfigs(), fetchBranches()]);
    setLoading(false);
  }, [fetchConfigs, fetchBranches]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Clear success after 3s
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(""), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  // ── Save config ──

  async function saveConfigKeys(
    keys: { key: string }[],
    form: Record<string, string>,
    extraFields?: Record<string, string>
  ) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const allEntries = [
        ...keys.map((k) => ({ key: k.key, value: form[k.key] ?? "" })),
        ...(extraFields ? Object.entries(extraFields).map(([key, value]) => ({ key, value })) : []),
      ];
      await Promise.all(
        allEntries.map((entry) =>
          apiClient.updateStoreConfig(entry.key, {
            value: entry.value,
            label: configs[entry.key]?.label,
          })
        )
      );
      setSuccess("Đã lưu thành công!");
      await fetchConfigs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }

  // ── Branch CRUD ──

  function openCreateBranch() {
    setEditingBranch(null);
    setBranchForm({ ...emptyBranchForm, openHours: { ...DEFAULT_OPEN_HOURS } });
    setBranchModalOpen(true);
  }

  function openEditBranch(branch: StoreBranch) {
    setEditingBranch(branch);
    setBranchForm({
      name: branch.name,
      address: branch.address,
      phone: branch.phone || "",
      email: branch.email || "",
      openHours: branch.openHours ? { ...(branch.openHours as Record<string, string>) } : { ...DEFAULT_OPEN_HOURS },
      latitude: branch.latitude?.toString() || "",
      longitude: branch.longitude?.toString() || "",
      sortOrder: branch.sortOrder.toString(),
    });
    setBranchModalOpen(true);
  }

  async function handleSaveBranch(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = {
        name: branchForm.name.trim(),
        address: branchForm.address.trim(),
        phone: branchForm.phone.trim() || undefined,
        email: branchForm.email.trim() || undefined,
        openHours: branchForm.openHours,
        latitude: branchForm.latitude ? parseFloat(branchForm.latitude) : undefined,
        longitude: branchForm.longitude ? parseFloat(branchForm.longitude) : undefined,
        sortOrder: parseInt(branchForm.sortOrder) || 0,
      };
      if (editingBranch) {
        await apiClient.updateStoreBranch(editingBranch.id, data);
      } else {
        await apiClient.createStoreBranch(data);
      }
      setBranchModalOpen(false);
      await fetchBranches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu chi nhánh thất bại");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBranch() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.deleteStoreBranch(deleteTarget.id);
      setDeleteTarget(null);
      await fetchBranches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa chi nhánh thất bại");
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleBranch(branch: StoreBranch) {
    try {
      await apiClient.toggleStoreBranch(branch.id);
      await fetchBranches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật thất bại");
    }
  }

  // ── Render helpers ──

  function formatOpenHours(hours: Record<string, string> | undefined | null): string {
    if (!hours || typeof hours !== "object") return "—";
    return Object.entries(hours)
      .map(([k, v]) => {
        const day = DAYS.find((d) => d.key === k);
        return day ? `${day.label}: ${v}` : `${k}: ${v}`;
      })
      .join(", ");
  }

  // ── Loading skeleton ──

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-64 animate-pulse rounded bg-surface-container-highest" />
        <div className="h-10 w-96 animate-pulse rounded bg-surface-container-highest" />
        <div className="space-y-4">
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
      <div>
        <h1 className="text-2xl font-bold text-on-surface">Thông tin cửa hàng</h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Quản lý thông tin liên hệ, chi nhánh, mạng xã hội và chính sách cửa hàng
        </p>
      </div>

      {/* Error / Success messages */}
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

      {/* Tab Navigation */}
      <div className="flex gap-1 rounded-xl bg-surface-container-highest p-1">
        {([
          { id: "main" as TabId, label: "Thông tin chính", icon: "store" },
          { id: "branches" as TabId, label: "Chi nhánh", icon: "location_on" },
          { id: "social" as TabId, label: "Mạng xã hội", icon: "share" },
          { id: "policies" as TabId, label: "Chính sách", icon: "policy" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ Tab 1: Thông tin chính ═══ */}
      {activeTab === "main" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveConfigKeys(MAIN_CONFIG_KEYS, mainForm, {
              open_hours: JSON.stringify(openHours),
            });
          }}
          className="space-y-5"
        >
          <div className="rounded-xl border border-outline-variant bg-surface p-6">
            <h2 className="mb-4 text-lg font-semibold text-on-surface">Thông tin cơ bản</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {MAIN_CONFIG_KEYS.map((field) => (
                <div key={field.key} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                  <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">
                    {field.label}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      value={mainForm[field.key] || ""}
                      onChange={(e) => setMainForm((f) => ({ ...f, [field.key]: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                    />
                  ) : (
                    <input
                      type="text"
                      value={mainForm[field.key] || ""}
                      onChange={(e) => setMainForm((f) => ({ ...f, [field.key]: e.target.value }))}
                      className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Giờ mở cửa */}
          <div className="rounded-xl border border-outline-variant bg-surface p-6">
            <h2 className="mb-4 text-lg font-semibold text-on-surface">Giờ mở cửa</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DAYS.map((day) => (
                <div key={day.key} className="flex items-center gap-3">
                  <span className="w-20 text-sm font-medium text-on-surface-variant">{day.label}</span>
                  <input
                    type="text"
                    value={openHours[day.key] || ""}
                    onChange={(e) => setOpenHours((h) => ({ ...h, [day.key]: e.target.value }))}
                    placeholder="8:00-21:00"
                    className="flex-1 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[18px]">save</span>
              )}
              {saving ? "Đang lưu..." : "Lưu thông tin"}
            </button>
          </div>
        </form>
      )}

      {/* ═══ Tab 2: Chi nhánh ═══ */}
      {activeTab === "branches" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-on-surface-variant">
              Quản lý các chi nhánh cửa hàng ({branches.length} chi nhánh)
            </p>
            <button
              onClick={openCreateBranch}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              Thêm chi nhánh
            </button>
          </div>

          {branches.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant py-12 text-center">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">location_off</span>
              <p className="mt-2 text-sm text-on-surface-variant">Chưa có chi nhánh nào</p>
            </div>
          ) : (
            <div className="space-y-3">
              {branches.map((branch) => (
                <div
                  key={branch.id}
                  className={`rounded-xl border bg-surface p-5 transition-colors ${
                    branch.isActive ? "border-outline-variant" : "border-error/30 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-on-surface">{branch.name}</h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            branch.isActive
                              ? "bg-primary-fixed text-on-primary-fixed"
                              : "bg-error-container text-on-error-container"
                          }`}
                        >
                          {branch.isActive ? "Hoạt động" : "Tạm đóng"}
                        </span>
                      </div>
                      <p className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                        <span className="material-symbols-outlined text-[16px]">location_on</span>
                        {branch.address}
                      </p>
                      {branch.phone && (
                        <p className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                          <span className="material-symbols-outlined text-[16px]">phone</span>
                          {branch.phone}
                        </p>
                      )}
                      <p className="text-xs text-on-surface-variant/70">
                        {formatOpenHours(branch.openHours as Record<string, string>)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleBranch(branch)}
                        className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                        title={branch.isActive ? "Tạm đóng" : "Kích hoạt"}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {branch.isActive ? "toggle_on" : "toggle_off"}
                        </span>
                      </button>
                      <button
                        onClick={() => openEditBranch(branch)}
                        className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                        title="Chỉnh sửa"
                      >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </button>
                      <button
                        onClick={() => setDeleteTarget(branch)}
                        className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
                        title="Xóa"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ Tab 3: Mạng xã hội ═══ */}
      {activeTab === "social" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveConfigKeys(SOCIAL_CONFIG_KEYS, socialForm);
          }}
          className="space-y-5"
        >
          <div className="rounded-xl border border-outline-variant bg-surface p-6">
            <h2 className="mb-4 text-lg font-semibold text-on-surface">Liên kết mạng xã hội</h2>
            <div className="space-y-4">
              {SOCIAL_CONFIG_KEYS.map((field) => (
                <div key={field.key}>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-on-surface-variant">
                    <span className="material-symbols-outlined text-[18px]">{field.icon}</span>
                    {field.label}
                  </label>
                  <input
                    type="text"
                    value={socialForm[field.key] || ""}
                    onChange={(e) => setSocialForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[18px]">save</span>
              )}
              {saving ? "Đang lưu..." : "Lưu liên kết"}
            </button>
          </div>
        </form>
      )}

      {/* ═══ Tab 4: Chính sách ═══ */}
      {activeTab === "policies" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveConfigKeys(POLICY_CONFIG_KEYS, policyForm);
          }}
          className="space-y-5"
        >
          <div className="rounded-xl border border-outline-variant bg-surface p-6">
            <h2 className="mb-4 text-lg font-semibold text-on-surface">Chính sách cửa hàng</h2>
            <div className="space-y-5">
              {POLICY_CONFIG_KEYS.map((field) => (
                <div key={field.key}>
                  <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">
                    {field.label}
                  </label>
                  <textarea
                    value={policyForm[field.key] || ""}
                    onChange={(e) => setPolicyForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    rows={4}
                    className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? (
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[18px]">save</span>
              )}
              {saving ? "Đang lưu..." : "Lưu chính sách"}
            </button>
          </div>
        </form>
      )}

      {/* ═══ Branch Modal ═══ */}
      {branchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface shadow-xl">
            <form onSubmit={handleSaveBranch}>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-outline-variant px-6 py-5">
                <h3 className="text-lg font-semibold text-on-surface">
                  {editingBranch ? "Sửa chi nhánh" : "Thêm chi nhánh"}
                </h3>
                <button
                  type="button"
                  onClick={() => setBranchModalOpen(false)}
                  className="rounded-lg p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              {/* Body */}
              <div className="space-y-4 p-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">
                      Tên chi nhánh <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={branchForm.name}
                      onChange={(e) => setBranchForm((f) => ({ ...f, name: e.target.value }))}
                      required
                      className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                      placeholder="VD: VegiFlow Quận 1"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">
                      Địa chỉ <span className="text-error">*</span>
                    </label>
                    <input
                      type="text"
                      value={branchForm.address}
                      onChange={(e) => setBranchForm((f) => ({ ...f, address: e.target.value }))}
                      required
                      className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                      placeholder="VD: 123 Nguyễn Huệ, Quận 1, TP.HCM"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">Số điện thoại</label>
                    <input
                      type="text"
                      value={branchForm.phone}
                      onChange={(e) => setBranchForm((f) => ({ ...f, phone: e.target.value }))}
                      className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">Email</label>
                    <input
                      type="text"
                      value={branchForm.email}
                      onChange={(e) => setBranchForm((f) => ({ ...f, email: e.target.value }))}
                      className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">Thứ tự hiển thị</label>
                    <input
                      type="number"
                      value={branchForm.sortOrder}
                      onChange={(e) => setBranchForm((f) => ({ ...f, sortOrder: e.target.value }))}
                      min="0"
                      className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                    />
                  </div>
                </div>

                {/* Giờ mở cửa */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-on-surface-variant">Giờ mở cửa</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {DAYS.map((day) => (
                      <div key={day.key} className="flex items-center gap-2">
                        <span className="w-20 text-xs font-medium text-on-surface-variant">{day.label}</span>
                        <input
                          type="text"
                          value={branchForm.openHours[day.key] || ""}
                          onChange={(e) =>
                            setBranchForm((f) => ({
                              ...f,
                              openHours: { ...f.openHours, [day.key]: e.target.value },
                            }))
                          }
                          placeholder="8:00-21:00"
                          className="flex-1 rounded-lg border border-outline-variant bg-surface-container px-3 py-1.5 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tọa độ */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">Vĩ độ (Latitude)</label>
                    <input
                      type="text"
                      value={branchForm.latitude}
                      onChange={(e) => setBranchForm((f) => ({ ...f, latitude: e.target.value }))}
                      className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                      placeholder="VD: 10.772315"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-on-surface-variant">Kinh độ (Longitude)</label>
                    <input
                      type="text"
                      value={branchForm.longitude}
                      onChange={(e) => setBranchForm((f) => ({ ...f, longitude: e.target.value }))}
                      className="w-full rounded-lg border border-outline-variant bg-surface-container px-4 py-2.5 text-sm text-on-surface outline-none transition-colors focus:border-primary"
                      placeholder="VD: 106.704175"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-outline-variant px-6 py-4">
                <button
                  type="button"
                  onClick={() => setBranchModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {saving ? "Đang lưu..." : editingBranch ? "Cập nhật" : "Tạo chi nhánh"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Delete Confirmation ═══ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-full bg-error-container p-2">
                <span className="material-symbols-outlined text-on-error-container">warning</span>
              </div>
              <h3 className="text-lg font-semibold text-on-surface">Xóa chi nhánh</h3>
            </div>
            <p className="mb-6 text-sm text-on-surface-variant">
              Bạn có chắc muốn xóa chi nhánh <strong>{deleteTarget.name}</strong>? Hành động này không thể hoàn tác.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-highest"
              >
                Hủy
              </button>
              <button
                onClick={handleDeleteBranch}
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
