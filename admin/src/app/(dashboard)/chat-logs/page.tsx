"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatMessage, ChatSession, PaginatedResponse } from "@/lib/types";
import { apiClient } from "@/lib/api-client";

type PlatformFilter = "ALL" | "ZALO" | "MESSENGER" | "WEB";

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${hh}:${mm} ${dd}/${mo}/${yyyy}`;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function ChatLogsPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("ALL");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
      });
      if (platformFilter !== "ALL") {
        params.set("platform", platformFilter);
      }
      const res = (await apiClient.getChatSessions(
        params.toString()
      )) as PaginatedResponse<ChatSession> | null;
      if (res) {
        setSessions(res.data);
        setTotalPages(res.meta.totalPages);
        setTotal(res.meta.total);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  }, [page, platformFilter]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleExpandSession = async (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
      setMessages([]);
      return;
    }
    setExpandedSession(sessionId);
    setLoadingMessages(true);
    try {
      const res = (await apiClient.getChatSession(
        sessionId
      )) as ChatSession | null;
      if (res && res.messages) {
        setMessages(res.messages);
      }
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const getMessageCount = (session: ChatSession) =>
    session.messages?.length ?? 0;

  const renderPagination = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push("...");
      for (
        let i = Math.max(2, page - 1);
        i <= Math.min(totalPages - 1, page + 1);
        i++
      )
        pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }

    return (
      <div className="flex items-center justify-between border-t border-outline-variant/30 p-6">
        <p className="text-sm text-on-surface-variant">
          Hiển thị{" "}
          <span className="font-bold text-on-surface">{sessions.length}</span>{" "}
          trong tổng số{" "}
          <span className="font-bold text-on-surface">{total}</span> phiên chat
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant transition-all hover:bg-surface-container disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-[18px]">
              chevron_left
            </span>
          </button>
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`dots-${i}`} className="flex items-center px-1 text-on-surface-variant">
                ...
              </span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p as number)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                  page === p
                    ? "border border-primary bg-primary text-on-primary"
                    : "border border-outline-variant hover:bg-surface-container"
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant transition-all hover:bg-surface-container disabled:opacity-30"
          >
            <span className="material-symbols-outlined text-[18px]">
              chevron_right
            </span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="font-[family-name:var(--font-hanken)] text-[32px] leading-10 font-semibold tracking-tight text-on-surface">
            Nhật ký chat
          </h2>
          <p className="mt-1 text-on-surface-variant">
            Xem lịch sử trò chuyện từ Web, Zalo và Facebook Messenger.
          </p>
        </div>
      </div>

      {/* Nền tảng Filter Tabs */}
      <div className="scrollbar-hide flex overflow-x-auto border-b border-outline-variant">
        {(
          [
            { key: "ALL", label: "Tất cả" },
            { key: "WEB", label: "Web" },
            { key: "ZALO", label: "Zalo" },
            { key: "MESSENGER", label: "Messenger" },
          ] as { key: PlatformFilter; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setPlatformFilter(tab.key);
              setPage(1);
              setExpandedSession(null);
            }}
            className={`whitespace-nowrap px-8 py-4 text-sm transition-all ${
              platformFilter === tab.key
                ? "border-b-2 border-primary font-bold text-primary"
                : "font-medium text-on-surface-variant transition-colors hover:text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table Card */}
      <div className="overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <span className="material-symbols-outlined animate-spin text-[32px] text-primary">
                progress_activity
              </span>
              <p className="text-sm text-on-surface-variant">
                Đang tải dữ liệu...
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead className="bg-surface-container-low text-on-surface-variant">
                  <tr className="border-b border-outline-variant">
                    <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider">
                      Nền tảng
                    </th>
                    <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider">
                      Khách hàng
                    </th>
                    <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider">
                      Trạng thái
                    </th>
                    <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider">
                      Số tin nhắn
                    </th>
                    <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider">
                      Cập nhật lúc
                    </th>
                    <th className="px-6 py-4 text-sm font-bold uppercase tracking-wider text-right">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {sessions.map((session) => {
                    const isExpanded = expandedSession === session.id;
                    return (
                      <tr key={session.id} className="group">
                        <td
                          colSpan={isExpanded ? 6 : 1}
                          className={`${isExpanded ? "p-0" : "contents"}`}
                        >
                          {isExpanded ? (
                            /* Expanded message history */
                            <div className="border-b border-outline-variant bg-surface-container-low/50">
                              {/* Header bar */}
                              <div className="flex items-center justify-between border-b border-outline-variant/30 px-6 py-3">
                                <div className="flex items-center gap-3">
                                  <span
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                                      session.platform === "ZALO"
                                        ? "bg-blue-100 text-blue-700"
                                        : session.platform === "MESSENGER"
                                        ? "bg-violet-100 text-violet-700"
                                        : "bg-emerald-100 text-emerald-700"
                                    }`}
                                  >
                                    {session.platform === "ZALO" ? (
                                      <span className="material-symbols-outlined text-[14px]">
                                        chat
                                      </span>
                                    ) : session.platform === "MESSENGER" ? (
                                      <span className="material-symbols-outlined text-[14px]">
                                        forum
                                      </span>
                                    ) : (
                                      <span className="material-symbols-outlined text-[14px]">
                                        language
                                      </span>
                                    )}
                                    {session.platform}
                                  </span>
                                  <span className="text-sm font-medium text-on-surface">
                                    {session.customer?.name ||
                                      `Người dùng ${session.platformUserId.slice(-6)}`}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleExpandSession(session.id)}
                                  className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
                                >
                                  <span className="material-symbols-outlined text-[20px]">
                                    expand_less
                                  </span>
                                </button>
                              </div>
                              {/* Chat bubbles */}
                              <div className="custom-scrollbar max-h-96 space-y-3 overflow-y-auto p-6">
                                {loadingMessages ? (
                                  <div className="flex justify-center py-8">
                                    <span className="material-symbols-outlined animate-spin text-primary">
                                      progress_activity
                                    </span>
                                  </div>
                                ) : messages.length === 0 ? (
                                  <p className="py-8 text-center text-sm text-on-surface-variant">
                                    Không có tin nhắn nào.
                                  </p>
                                ) : (
                                  messages.map((msg) => (
                                    <div
                                      key={msg.id}
                                      className={`flex ${
                                        msg.role === "USER"
                                          ? "justify-end"
                                          : "justify-start"
                                      }`}
                                    >
                                      <div
                                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                                          msg.role === "USER"
                                            ? "rounded-br-sm bg-surface-container text-on-surface"
                                            : "rounded-bl-sm bg-secondary-container text-on-secondary-container"
                                        }`}
                                      >
                                        <p className="whitespace-pre-wrap">
                                          {msg.content}
                                        </p>
                                        <p
                                          className={`mt-1 text-[10px] ${
                                            msg.role === "USER"
                                              ? "text-on-surface-variant text-right"
                                              : "text-on-secondary-container/70"
                                          }`}
                                        >
                                          {formatTime(msg.createdAt)}
                                        </p>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Nền tảng badge */
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                                  session.platform === "ZALO"
                                    ? "bg-blue-100 text-blue-700"
                                    : session.platform === "MESSENGER"
                                    ? "bg-violet-100 text-violet-700"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {session.platform === "ZALO" ? (
                                  <span className="material-symbols-outlined text-[14px]">
                                    chat
                                  </span>
                                ) : session.platform === "MESSENGER" ? (
                                  <span className="material-symbols-outlined text-[14px]">
                                    forum
                                  </span>
                                ) : (
                                  <span className="material-symbols-outlined text-[14px]">
                                    language
                                  </span>
                                )}
                                {session.platform}
                              </span>
                            </td>
                          )}
                        </td>
                        {!isExpanded && (
                          <>
                            {/* Customer */}
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-container text-xs font-bold text-primary">
                                  {(session.customer?.name || "UK")
                                    .split(" ")
                                    .map((w) => w[0])
                                    .filter(Boolean)
                                    .slice(-2)
                                    .join("")
                                    .toUpperCase()}
                                </div>
                                <span className="text-sm font-medium text-on-surface">
                                  {session.customer?.name ||
                                    `Người dùng ${session.platformUserId.slice(-6)}`}
                                </span>
                              </div>
                            </td>
                            {/* Status */}
                            <td className="px-6 py-4">
                              {session.isActive ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-1 text-xs font-bold text-on-secondary-container">
                                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                  Hoạt động
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container px-3 py-1 text-xs font-medium text-on-surface-variant">
                                  <span className="h-1.5 w-1.5 rounded-full bg-on-surface-variant" />
                                  Ngừng hoạt động
                                </span>
                              )}
                            </td>
                            {/* Message Count */}
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                                {getMessageCount(session)}
                              </span>
                            </td>
                            {/* Updated At */}
                            <td className="px-6 py-4 text-sm text-on-surface-variant">
                              {formatDateTime(session.updatedAt)}
                            </td>
                            {/* Thao tác */}
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => handleExpandSession(session.id)}
                                className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-primary/10 hover:text-primary"
                              >
                                <span className="material-symbols-outlined text-[20px]">
                                  expand_more
                                </span>
                              </button>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                  {sessions.length === 0 && !loading && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-16 text-center text-on-surface-variant"
                      >
                        Không có phiên chat nào.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {renderPagination()}
          </>
        )}
      </div>
    </div>
  );
}
