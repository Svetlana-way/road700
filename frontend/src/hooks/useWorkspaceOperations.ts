import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AuditLogItem, AuditLogResponse } from "../contracts/api/audit";
import { apiRequest } from "../shared/apiCore";
import { type WorkspaceTab } from "../shared/appRoute";
import { buildAuditLogQueryString, buildGlobalSearchQueryString } from "../features/operations/queryBuilders";
import type { GlobalSearchResponse, UserRole } from "../contracts/domain/workspace";

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
      const payload = await fetchAllGlobalSearch(normalizedQuery);
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

  async function fetchGlobalSearchPage(query: string, limitPerSection: number, offsetPerSection: number) {
    return apiRequest<GlobalSearchResponse>(
      `/search/global?${buildGlobalSearchQueryString(query, limitPerSection, offsetPerSection)}`,
      { method: "GET" },
      token,
    );
  }

  async function fetchAllGlobalSearch(query: string) {
    const pageSize = 25;
    const firstPage = await fetchGlobalSearchPage(query, pageSize, 0);
    const needsMoreDocuments = firstPage.documents_total > firstPage.documents.length;
    const needsMoreRepairs = firstPage.repairs_total > firstPage.repairs.length;
    const needsMoreVehicles = firstPage.vehicles_total > firstPage.vehicles.length;
    if (!needsMoreDocuments && !needsMoreRepairs && !needsMoreVehicles) {
      return firstPage;
    }

    const documents = [...firstPage.documents];
    const repairs = [...firstPage.repairs];
    const vehicles = [...firstPage.vehicles];
    const maxTotal = Math.max(firstPage.documents_total, firstPage.repairs_total, firstPage.vehicles_total);

    for (let offset = pageSize; offset < maxTotal; offset += pageSize) {
      const nextPage = await fetchGlobalSearchPage(query, pageSize, offset);
      documents.push(...nextPage.documents);
      repairs.push(...nextPage.repairs);
      vehicles.push(...nextPage.vehicles);
    }

    return {
      ...firstPage,
      documents,
      repairs,
      vehicles,
    };
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
      const payload = await fetchAllAuditLog(filters);
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

  async function fetchAuditLogPage(filters: AuditLogFilters, limit: number, offset: number) {
    return apiRequest<AuditLogResponse>(
      `/audit?${buildAuditLogQueryString(
        filters.search,
        filters.entityType,
        filters.actionType,
        filters.userId,
        filters.dateFrom,
        filters.dateTo,
        limit,
        offset,
      )}`,
      { method: "GET" },
      token,
    );
  }

  async function fetchAllAuditLog(filters: AuditLogFilters) {
    const pageSize = 200;
    const firstPage = await fetchAuditLogPage(filters, pageSize, 0);
    if (firstPage.total <= firstPage.items.length) {
      return firstPage;
    }

    const items = [...firstPage.items];
    for (let offset = firstPage.items.length; offset < firstPage.total; offset += pageSize) {
      const nextPage = await fetchAuditLogPage(filters, pageSize, offset);
      items.push(...nextPage.items);
    }

    return {
      ...firstPage,
      items,
      limit: pageSize,
    };
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
