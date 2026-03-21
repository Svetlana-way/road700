import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../shared/api";
import { type WorkspaceTab } from "../shared/appRoute";
import { buildAuditLogQueryString, buildGlobalSearchQueryString } from "../shared/queryBuilders";
import type { GlobalSearchResponse } from "../shared/workspaceBootstrapTypes";

type AuditLogItem = {
  id: number;
  created_at: string;
  user_id: number | null;
  user_name: string | null;
  entity_type: string;
  entity_id: string;
  action_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

type AuditLogResponse = {
  items: AuditLogItem[];
  total: number;
  limit: number;
  offset: number;
  action_types: string[];
  entity_types: string[];
};

type UseWorkspaceOperationsParams = {
  activeWorkspaceTab: WorkspaceTab;
  token: string;
  onError: (message: string) => void;
};

export function useWorkspaceOperations({
  activeWorkspaceTab,
  token,
  onError,
}: UseWorkspaceOperationsParams) {
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchResult, setGlobalSearchResult] = useState<GlobalSearchResponse | null>(null);
  const [auditLogItems, setAuditLogItems] = useState<AuditLogItem[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [auditLogTotal, setAuditLogTotal] = useState(0);
  const [auditEntityTypes, setAuditEntityTypes] = useState<string[]>([]);
  const [auditActionTypes, setAuditActionTypes] = useState<string[]>([]);
  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [auditEntityTypeFilter, setAuditEntityTypeFilter] = useState("");
  const [auditActionTypeFilter, setAuditActionTypeFilter] = useState("");
  const [auditUserIdFilter, setAuditUserIdFilter] = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");

  async function runGlobalSearch(query: string = globalSearchQuery) {
    const normalizedQuery = query.trim();
    if (!token) {
      return;
    }
    if (normalizedQuery.length < 2) {
      setGlobalSearchResult(null);
      return;
    }
    setGlobalSearchLoading(true);
    try {
      const payload = await apiRequest<GlobalSearchResponse>(
        `/search/global?${buildGlobalSearchQueryString(normalizedQuery)}`,
        { method: "GET" },
        token,
      );
      setGlobalSearchResult(payload);
    } finally {
      setGlobalSearchLoading(false);
    }
  }

  async function handleGlobalSearchSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!token) {
      return;
    }
    try {
      await runGlobalSearch();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось выполнить поиск");
    }
  }

  async function loadAuditLog() {
    if (!token) {
      return;
    }
    setAuditLogLoading(true);
    try {
      const payload = await apiRequest<AuditLogResponse>(
        `/audit?${buildAuditLogQueryString(
          auditSearchQuery,
          auditEntityTypeFilter,
          auditActionTypeFilter,
          auditUserIdFilter,
          auditDateFrom,
          auditDateTo,
        )}`,
        { method: "GET" },
        token,
      );
      setAuditLogItems(payload.items);
      setAuditLogTotal(payload.total);
      setAuditEntityTypes(payload.entity_types);
      setAuditActionTypes(payload.action_types);
    } finally {
      setAuditLogLoading(false);
    }
  }

  function resetGlobalSearch() {
    setGlobalSearchQuery("");
    setGlobalSearchResult(null);
    setGlobalSearchLoading(false);
  }

  function resetAudit() {
    setAuditLogItems([]);
    setAuditLogLoading(false);
    setAuditLogTotal(0);
    setAuditEntityTypes([]);
    setAuditActionTypes([]);
    setAuditSearchQuery("");
    setAuditEntityTypeFilter("");
    setAuditActionTypeFilter("");
    setAuditUserIdFilter("");
    setAuditDateFrom("");
    setAuditDateTo("");
  }

  function resetOperationsState() {
    resetGlobalSearch();
    resetAudit();
  }

  useEffect(() => {
    if (!token || activeWorkspaceTab !== "audit") {
      return;
    }
    void loadAuditLog().catch((error) => {
      onError(error instanceof Error ? error.message : "Не удалось загрузить журнал действий");
    });
  }, [
    activeWorkspaceTab,
    auditActionTypeFilter,
    auditDateFrom,
    auditDateTo,
    auditEntityTypeFilter,
    auditSearchQuery,
    auditUserIdFilter,
    onError,
    token,
  ]);

  return {
    globalSearchQuery,
    setGlobalSearchQuery,
    globalSearchLoading,
    globalSearchResult,
    handleGlobalSearchSubmit,
    resetGlobalSearch,
    auditLogItems,
    auditLogLoading,
    auditLogTotal,
    auditEntityTypes,
    auditActionTypes,
    auditSearchQuery,
    setAuditSearchQuery,
    auditEntityTypeFilter,
    setAuditEntityTypeFilter,
    auditActionTypeFilter,
    setAuditActionTypeFilter,
    auditUserIdFilter,
    setAuditUserIdFilter,
    auditDateFrom,
    setAuditDateFrom,
    auditDateTo,
    setAuditDateTo,
    loadAuditLog,
    resetAudit,
    resetOperationsState,
  };
}
