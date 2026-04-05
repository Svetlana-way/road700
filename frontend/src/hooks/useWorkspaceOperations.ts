import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiRequest } from "../shared/api";
import { type WorkspaceTab } from "../shared/appRoute";
import type { AuditLogItem, AuditLogResponse } from "../shared/auditApiTypes";
import { buildAuditLogQueryString, buildGlobalSearchQueryString } from "../shared/queryBuilders";
import type { GlobalSearchResponse, UserRole } from "../shared/workspaceBootstrapTypes";

type UseWorkspaceOperationsParams = {
  activeWorkspaceTab: WorkspaceTab;
  token: string;
  userRole: UserRole | null | undefined;
  auditUsers: Array<{ id: number }>;
  onError: (message: string) => void;
};

type AuditLogFilters = {
  search: string;
  entityType: string;
  actionType: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
};

const DEFAULT_AUDIT_FILTERS: AuditLogFilters = {
  search: "",
  entityType: "",
  actionType: "",
  userId: "",
  dateFrom: "",
  dateTo: "",
};

export function useWorkspaceOperations({
  activeWorkspaceTab,
  token,
  userRole,
  auditUsers,
  onError,
}: UseWorkspaceOperationsParams) {
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchResult, setGlobalSearchResult] = useState<GlobalSearchResponse | null>(null);
  const globalSearchRequestIdRef = useRef(0);
  const auditLogRequestIdRef = useRef(0);
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

  function getAuditFilters(): AuditLogFilters {
    return {
      search: auditSearchQuery,
      entityType: auditEntityTypeFilter,
      actionType: auditActionTypeFilter,
      userId: auditUserIdFilter,
      dateFrom: auditDateFrom,
      dateTo: auditDateTo,
    };
  }

  async function runGlobalSearch(query: string = globalSearchQuery) {
    const normalizedQuery = query.trim();
    if (!token) {
      return;
    }
    if (normalizedQuery.length < 2) {
      globalSearchRequestIdRef.current += 1;
      setGlobalSearchResult(null);
      setGlobalSearchLoading(false);
      return;
    }
    const requestId = globalSearchRequestIdRef.current + 1;
    globalSearchRequestIdRef.current = requestId;
    setGlobalSearchLoading(true);
    try {
      const payload = await apiRequest<GlobalSearchResponse>(
        `/search/global?${buildGlobalSearchQueryString(normalizedQuery)}`,
        { method: "GET" },
        token,
      );
      if (globalSearchRequestIdRef.current !== requestId) {
        return;
      }
      setGlobalSearchResult(payload);
    } finally {
      if (globalSearchRequestIdRef.current === requestId) {
        setGlobalSearchLoading(false);
      }
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

  async function loadAuditLog(filters: AuditLogFilters = getAuditFilters()) {
    if (!token || userRole !== "admin") {
      return;
    }
    const requestId = auditLogRequestIdRef.current + 1;
    auditLogRequestIdRef.current = requestId;
    setAuditLogLoading(true);
    try {
      const payload = await apiRequest<AuditLogResponse>(
        `/audit?${buildAuditLogQueryString(
          filters.search,
          filters.entityType,
          filters.actionType,
          filters.userId,
          filters.dateFrom,
          filters.dateTo,
        )}`,
        { method: "GET" },
        token,
      );
      if (auditLogRequestIdRef.current !== requestId) {
        return;
      }
      setAuditLogItems(payload.items);
      setAuditLogTotal(payload.total);
      setAuditEntityTypes(payload.entity_types);
      setAuditActionTypes(payload.action_types);
    } finally {
      if (auditLogRequestIdRef.current === requestId) {
        setAuditLogLoading(false);
      }
    }
  }

  function resetGlobalSearch() {
    globalSearchRequestIdRef.current += 1;
    setGlobalSearchQuery("");
    setGlobalSearchResult(null);
    setGlobalSearchLoading(false);
  }

  function resetAudit() {
    auditLogRequestIdRef.current += 1;
    setAuditLogItems([]);
    setAuditLogLoading(false);
    setAuditLogTotal(0);
    setAuditEntityTypes([]);
    setAuditActionTypes([]);
    setAuditSearchQuery(DEFAULT_AUDIT_FILTERS.search);
    setAuditEntityTypeFilter(DEFAULT_AUDIT_FILTERS.entityType);
    setAuditActionTypeFilter(DEFAULT_AUDIT_FILTERS.actionType);
    setAuditUserIdFilter(DEFAULT_AUDIT_FILTERS.userId);
    setAuditDateFrom(DEFAULT_AUDIT_FILTERS.dateFrom);
    setAuditDateTo(DEFAULT_AUDIT_FILTERS.dateTo);
  }

  async function handleRefreshAuditLog() {
    if (!token || userRole !== "admin") {
      return;
    }
    try {
      await loadAuditLog();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось загрузить журнал действий");
    }
  }

  async function handleResetAuditFilters() {
    if (!token || userRole !== "admin") {
      resetAudit();
      return;
    }
    setAuditSearchQuery(DEFAULT_AUDIT_FILTERS.search);
    setAuditEntityTypeFilter(DEFAULT_AUDIT_FILTERS.entityType);
    setAuditActionTypeFilter(DEFAULT_AUDIT_FILTERS.actionType);
    setAuditUserIdFilter(DEFAULT_AUDIT_FILTERS.userId);
    setAuditDateFrom(DEFAULT_AUDIT_FILTERS.dateFrom);
    setAuditDateTo(DEFAULT_AUDIT_FILTERS.dateTo);
    try {
      await loadAuditLog(DEFAULT_AUDIT_FILTERS);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Не удалось загрузить журнал действий");
    }
  }

  function resetOperationsState() {
    resetGlobalSearch();
    resetAudit();
  }

  useEffect(() => {
    if (!token || userRole !== "admin" || activeWorkspaceTab !== "audit") {
      return;
    }
    void loadAuditLog().catch((error) => {
      onError(error instanceof Error ? error.message : "Не удалось загрузить журнал действий");
    });
  }, [activeWorkspaceTab, onError, token, userRole]);

  useEffect(() => {
    const nextEntityTypeFilter =
      auditEntityTypeFilter && !auditEntityTypes.includes(auditEntityTypeFilter) ? DEFAULT_AUDIT_FILTERS.entityType : auditEntityTypeFilter;
    const nextActionTypeFilter =
      auditActionTypeFilter && !auditActionTypes.includes(auditActionTypeFilter) ? DEFAULT_AUDIT_FILTERS.actionType : auditActionTypeFilter;
    const nextUserIdFilter =
      auditUserIdFilter && !auditUsers.some((item) => String(item.id) === auditUserIdFilter)
        ? DEFAULT_AUDIT_FILTERS.userId
        : auditUserIdFilter;

    if (
      nextEntityTypeFilter === auditEntityTypeFilter &&
      nextActionTypeFilter === auditActionTypeFilter &&
      nextUserIdFilter === auditUserIdFilter
    ) {
      return;
    }

    setAuditEntityTypeFilter(nextEntityTypeFilter);
    setAuditActionTypeFilter(nextActionTypeFilter);
    setAuditUserIdFilter(nextUserIdFilter);

    if (!token || userRole !== "admin" || activeWorkspaceTab !== "audit") {
      return;
    }

    void loadAuditLog({
      search: auditSearchQuery,
      entityType: nextEntityTypeFilter,
      actionType: nextActionTypeFilter,
      userId: nextUserIdFilter,
      dateFrom: auditDateFrom,
      dateTo: auditDateTo,
    }).catch((error) => {
      onError(error instanceof Error ? error.message : "Не удалось загрузить журнал действий");
    });
  }, [
    activeWorkspaceTab,
    auditActionTypeFilter,
    auditActionTypes,
    auditDateFrom,
    auditDateTo,
    auditEntityTypeFilter,
    auditEntityTypes,
    auditSearchQuery,
    auditUserIdFilter,
    auditUsers,
    onError,
    token,
    userRole,
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
    handleRefreshAuditLog,
    handleResetAuditFilters,
    resetAudit,
    resetOperationsState,
  };
}
