import { useEffect, useState } from "react";
import { apiRequest } from "../shared/api";
import type { AdminTab, WorkspaceTab } from "../shared/appRoute";
import {
  buildHistoricalWorkReferenceQueryString,
  buildImportConflictsQueryString,
} from "../shared/queryBuilders";
import type {
  HistoricalRepairImportResponse,
  HistoricalWorkReferenceItem,
  HistoricalWorkReferenceResponse,
  ImportConflictItem,
  ImportConflictResolveResponse,
  ImportConflictsResponse,
  ImportJobItem,
  ImportJobsResponse,
} from "../shared/importAdminTypes";
import type { UserRole } from "../shared/workspaceBootstrapTypes";

type UseHistoricalImportsAdminParams = {
  token: string;
  userRole: UserRole | null | undefined;
  activeWorkspaceTab: WorkspaceTab;
  activeAdminTab: AdminTab;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  refreshWorkspace: () => Promise<void>;
};

export function useHistoricalImportsAdmin({
  token,
  userRole,
  activeWorkspaceTab,
  activeAdminTab,
  setErrorMessage,
  setSuccessMessage,
  refreshWorkspace,
}: UseHistoricalImportsAdminParams) {
  const [historicalImportLoading, setHistoricalImportLoading] = useState(false);
  const [historicalImportFile, setHistoricalImportFile] = useState<File | null>(null);
  const [historicalImportLimit, setHistoricalImportLimit] = useState("1000");
  const [historicalImportResult, setHistoricalImportResult] = useState<HistoricalRepairImportResponse | null>(null);
  const [historicalImportJobs, setHistoricalImportJobs] = useState<ImportJobItem[]>([]);
  const [historicalImportJobsLoading, setHistoricalImportJobsLoading] = useState(false);
  const [historicalWorkReference, setHistoricalWorkReference] = useState<HistoricalWorkReferenceItem[]>([]);
  const [historicalWorkReferenceLoading, setHistoricalWorkReferenceLoading] = useState(false);
  const [historicalWorkReferenceTotal, setHistoricalWorkReferenceTotal] = useState(0);
  const [historicalWorkReferenceQuery, setHistoricalWorkReferenceQuery] = useState("");
  const [historicalWorkReferenceMinSamples, setHistoricalWorkReferenceMinSamples] = useState("2");
  const [importConflicts, setImportConflicts] = useState<ImportConflictItem[]>([]);
  const [importConflictsLoading, setImportConflictsLoading] = useState(false);
  const [selectedImportConflict, setSelectedImportConflict] = useState<ImportConflictItem | null>(null);
  const [showImportConflictDialog, setShowImportConflictDialog] = useState(false);
  const [importConflictLoading, setImportConflictLoading] = useState(false);
  const [importConflictSaving, setImportConflictSaving] = useState(false);
  const [importConflictComment, setImportConflictComment] = useState("");

  async function loadHistoricalImportJobs() {
    if (!token) {
      return;
    }
    setHistoricalImportJobsLoading(true);
    try {
      const payload = await apiRequest<ImportJobsResponse>(
        "/imports/jobs?import_type=historical_repairs&limit=12",
        { method: "GET" },
        token,
      );
      setHistoricalImportJobs(payload.items);
    } finally {
      setHistoricalImportJobsLoading(false);
    }
  }

  async function loadHistoricalWorkReference(
    query: string = historicalWorkReferenceQuery,
    minSamplesValue: string = historicalWorkReferenceMinSamples,
  ) {
    if (!token) {
      return;
    }
    setHistoricalWorkReferenceLoading(true);
    try {
      const payload = await apiRequest<HistoricalWorkReferenceResponse>(
        `/imports/historical-work-reference?${buildHistoricalWorkReferenceQueryString(query, minSamplesValue)}`,
        { method: "GET" },
        token,
      );
      setHistoricalWorkReference(payload.items);
      setHistoricalWorkReferenceTotal(payload.total);
    } finally {
      setHistoricalWorkReferenceLoading(false);
    }
  }

  async function loadImportConflicts(status: string = "pending") {
    if (!token) {
      return;
    }
    setImportConflictsLoading(true);
    try {
      const payload = await apiRequest<ImportConflictsResponse>(
        `/imports/conflicts?${buildImportConflictsQueryString(status)}`,
        { method: "GET" },
        token,
      );
      setImportConflicts(payload.items);
    } finally {
      setImportConflictsLoading(false);
    }
  }

  async function refreshHistoricalImportsJournal() {
    await Promise.all([
      loadHistoricalImportJobs(),
      loadHistoricalWorkReference(),
      loadImportConflicts(),
    ]);
  }

  async function openImportConflict(conflictId: number) {
    if (!token || userRole !== "admin") {
      return;
    }
    setImportConflictLoading(true);
    setImportConflictComment("");
    setSelectedImportConflict(null);
    setShowImportConflictDialog(true);
    try {
      const payload = await apiRequest<ImportConflictItem>(`/imports/conflicts/${conflictId}`, { method: "GET" }, token);
      setSelectedImportConflict(payload);
    } catch (error) {
      setShowImportConflictDialog(false);
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить конфликт импорта");
    } finally {
      setImportConflictLoading(false);
    }
  }

  async function handleHistoricalRepairImport() {
    if (!token || userRole !== "admin" || !historicalImportFile) {
      setErrorMessage("Выберите .xlsx файл истории ремонтов");
      return;
    }

    setHistoricalImportLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const body = new FormData();
      body.append("file", historicalImportFile);
      const normalizedLimit = historicalImportLimit.trim();
      if (normalizedLimit) {
        body.append("repair_limit", normalizedLimit);
      }

      const result = await apiRequest<HistoricalRepairImportResponse>(
        "/imports/historical-repairs",
        {
          method: "POST",
          body,
        },
        token,
      );

      setHistoricalImportResult(result);
      setSuccessMessage(
        `${result.message}. Создано ремонтов ${result.created_repairs}, конфликтов ${result.conflicts_created}, дублей ${result.duplicate_repairs}.`,
      );
      setHistoricalImportFile(null);
      await refreshHistoricalImportsJournal();
      await refreshWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось импортировать историю ремонтов");
    } finally {
      setHistoricalImportLoading(false);
    }
  }

  async function handleResolveImportConflict(nextStatus: "resolved" | "ignored") {
    if (!token || userRole !== "admin" || !selectedImportConflict) {
      return;
    }

    setImportConflictSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = await apiRequest<ImportConflictResolveResponse>(
        `/imports/conflicts/${selectedImportConflict.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: nextStatus,
            comment: importConflictComment.trim() || null,
          }),
        },
        token,
      );
      setSelectedImportConflict(payload.conflict);
      setSuccessMessage(payload.message);
      setShowImportConflictDialog(false);
      setImportConflictComment("");
      await Promise.all([loadImportConflicts(), refreshWorkspace()]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось обновить конфликт импорта");
    } finally {
      setImportConflictSaving(false);
    }
  }

  function resetHistoricalImportsState() {
    setHistoricalImportLoading(false);
    setHistoricalImportFile(null);
    setHistoricalImportLimit("1000");
    setHistoricalImportResult(null);
    setHistoricalImportJobs([]);
    setHistoricalImportJobsLoading(false);
    setHistoricalWorkReference([]);
    setHistoricalWorkReferenceLoading(false);
    setHistoricalWorkReferenceTotal(0);
    setHistoricalWorkReferenceQuery("");
    setHistoricalWorkReferenceMinSamples("2");
    setImportConflicts([]);
    setImportConflictsLoading(false);
    setSelectedImportConflict(null);
    setShowImportConflictDialog(false);
    setImportConflictLoading(false);
    setImportConflictSaving(false);
    setImportConflictComment("");
  }

  useEffect(() => {
    if (!token || userRole !== "admin" || activeWorkspaceTab !== "admin" || activeAdminTab !== "imports") {
      return;
    }
    void refreshHistoricalImportsJournal().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить историю импортов");
    });
  }, [activeAdminTab, activeWorkspaceTab, setErrorMessage, token, userRole]);

  return {
    historicalImportLoading,
    historicalImportFile,
    setHistoricalImportFile,
    historicalImportLimit,
    setHistoricalImportLimit,
    historicalImportResult,
    historicalImportJobs,
    historicalImportJobsLoading,
    historicalWorkReference,
    historicalWorkReferenceLoading,
    historicalWorkReferenceTotal,
    historicalWorkReferenceQuery,
    setHistoricalWorkReferenceQuery,
    historicalWorkReferenceMinSamples,
    setHistoricalWorkReferenceMinSamples,
    importConflicts,
    importConflictsLoading,
    selectedImportConflict,
    showImportConflictDialog,
    importConflictLoading,
    importConflictSaving,
    importConflictComment,
    setImportConflictComment,
    setShowImportConflictDialog,
    loadHistoricalWorkReference,
    refreshHistoricalImportsJournal,
    openImportConflict,
    handleHistoricalRepairImport,
    handleResolveImportConflict,
    resetHistoricalImportsState,
  };
}
