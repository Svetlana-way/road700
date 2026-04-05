import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { LoadRepairDetailResult } from "./useRepairDetailLoader";
import type { WorkspaceTab } from "../shared/appRoute";
import {
  loadWorkspaceBootstrapData,
  loadWorkspaceDataQualityDetails,
  loadWorkspaceMetricsData,
  loadWorkspaceOperationalData,
  loadWorkspaceReviewData,
  type WorkspaceRefreshScope,
} from "../shared/loadWorkspaceBootstrap";
import { repairHasDocumentsAwaitingOcr, type RepairDetailForDraft } from "../shared/repairUiHelpers";
import type {
  DashboardDataQuality,
  DashboardDataQualityDetails,
  DashboardSummary,
  DocumentItem,
  ReviewQueueCategory,
  ReviewQueueItem,
  User,
} from "../shared/workspaceBootstrapTypes";
import { documentHasActiveImportJob, isDocumentAwaitingOcr } from "../shared/displayFormatters";

type ReviewQueueCounts = Record<ReviewQueueCategory, number>;

type RepairDetailForLifecycle = RepairDetailForDraft & {
  id: number;
};

export type WorkspaceStateAppliers = {
  setUser: (value: User | null) => void;
  setSummary: (value: DashboardSummary | null) => void;
  setDataQuality: (value: DashboardDataQuality | null) => void;
  setDataQualityDetails: (value: DashboardDataQualityDetails | null) => void;
  setDocuments: (value: DocumentItem[]) => void;
  setReviewQueue: (value: ReviewQueueItem[]) => void;
  setReviewQueueCounts: (value: ReviewQueueCounts) => void;
  setSelectedDocumentId: (value: number | null) => void;
  clearSelectedRepair: () => void;
  setLastUploadedDocument: Dispatch<SetStateAction<DocumentItem | null>>;
  setErrorMessage: (value: string) => void;
};

export type WorkspaceResetters = {
  setShowTechAdminTab: (value: false) => void;
  setShowPasswordChange: (value: false) => void;
  setActiveTechAdminTab: (value: "learning") => void;
  setActiveQualityTab: (value: "documents") => void;
  resetFleetState: () => void;
  resetOperationsState: () => void;
  resetLaborNormsState: () => void;
  resetReviewRulesState: () => void;
  resetReviewWorkflowState: () => void;
  resetRepairDocumentsWorkflowState: () => void;
  resetRepairEditingState: () => void;
  resetDocumentsWorkspaceState: () => void;
  resetUsersState: () => void;
  resetServicesState: () => void;
  resetOcrAdminState: () => void;
  resetBackupsState: () => void;
  resetHistoricalImportsState: () => void;
  setDocumentVehicleFormToEmpty: () => void;
};

type LoadRepairDetailOptions = {
  silent?: boolean;
  resetTransientState?: boolean;
};

type UseWorkspaceDataLifecycleParams = {
  token: string | null;
  activeWorkspaceTab: WorkspaceTab;
  selectedReviewCategory: ReviewQueueCategory;
  selectedDocumentId: number | null;
  documents: DocumentItem[];
  reviewQueue: ReviewQueueItem[];
  dataQualityDetails: DashboardDataQualityDetails | null;
  selectedRepair: RepairDetailForLifecycle | null;
  isEditingRepair: boolean;
  lastUploadedDocument: DocumentItem | null;
  invalidateSession: (options?: { message?: string; reload?: boolean }) => void;
  loadRepairDetail: (
    token: string,
    repairId: number,
    preferredDocumentId: number | null,
    options?: LoadRepairDetailOptions,
  ) => Promise<LoadRepairDetailResult>;
  workspaceState: WorkspaceStateAppliers;
  resetters: WorkspaceResetters;
};

const EMPTY_REVIEW_QUEUE_COUNTS: ReviewQueueCounts = {
  all: 0,
  suspicious: 0,
  ocr_error: 0,
  partial_recognition: 0,
  employee_confirmation: 0,
  manual_review: 0,
};

export function useWorkspaceDataLifecycle(params: UseWorkspaceDataLifecycleParams) {
  const [bootLoading, setBootLoading] = useState(false);
  const workspaceAutoRefreshInFlightRef = useRef(false);
  const repairAutoRefreshInFlightRef = useRef(false);
  const workspaceLoadRequestIdRef = useRef(0);
  const visibleWorkspaceLoadRequestIdRef = useRef(0);
  const dataQualityDetailsRequestIdRef = useRef(0);
  const lastBootstrapTokenRef = useRef<string | null>(null);
  const previousWorkspaceTabRef = useRef<WorkspaceTab | null>(null);
  const latestRef = useRef(params);
  latestRef.current = params;

  function invalidateWorkspaceLoadState() {
    workspaceLoadRequestIdRef.current += 1;
    visibleWorkspaceLoadRequestIdRef.current = workspaceLoadRequestIdRef.current;
    dataQualityDetailsRequestIdRef.current += 1;
    setBootLoading(false);
  }

  function syncRecentDocuments(items: DocumentItem[]) {
    const { workspaceState } = latestRef.current;
    workspaceState.setDocuments(items);
    workspaceState.setLastUploadedDocument((current) => {
      if (!current) {
        return current;
      }
      return items.find((item) => item.id === current.id) ?? current;
    });
  }

  async function loadWorkspace(
    activeToken: string,
    reviewCategory: ReviewQueueCategory = latestRef.current.selectedReviewCategory,
    options?: { silent?: boolean; scope?: WorkspaceRefreshScope },
  ) {
    const { invalidateSession, workspaceState } = latestRef.current;
    const silent = options?.silent ?? false;
    const scope = options?.scope ?? "full";
    const requestId = workspaceLoadRequestIdRef.current + 1;
    workspaceLoadRequestIdRef.current = requestId;
    if (!silent) {
      visibleWorkspaceLoadRequestIdRef.current = requestId;
      setBootLoading(true);
    }
    try {
      if (scope === "documents") {
        const data = await loadWorkspaceOperationalData(activeToken, reviewCategory);
        if (workspaceLoadRequestIdRef.current !== requestId) {
          return;
        }
        workspaceState.setSummary(data.dashboard);
        workspaceState.setDataQuality(data.dataQualityPayload);
        syncRecentDocuments(data.recentDocuments.items);
        workspaceState.setReviewQueue(data.reviewQueueData.items);
        workspaceState.setReviewQueueCounts(data.reviewQueueData.counts);
      } else if (scope === "metrics") {
        const data = await loadWorkspaceMetricsData(activeToken);
        if (workspaceLoadRequestIdRef.current !== requestId) {
          return;
        }
        workspaceState.setSummary(data.dashboard);
        workspaceState.setDataQuality(data.dataQualityPayload);
        workspaceState.setDataQualityDetails(data.dataQualityDetailsPayload);
      } else if (scope === "review") {
        const data = await loadWorkspaceReviewData(activeToken, reviewCategory);
        if (workspaceLoadRequestIdRef.current !== requestId) {
          return;
        }
        workspaceState.setSummary(data.dashboard);
        workspaceState.setDataQuality(data.dataQualityPayload);
        workspaceState.setReviewQueue(data.reviewQueueData.items);
        workspaceState.setReviewQueueCounts(data.reviewQueueData.counts);
      } else {
        const data = await loadWorkspaceBootstrapData(activeToken, reviewCategory);
        if (workspaceLoadRequestIdRef.current !== requestId) {
          return;
        }

        workspaceState.setUser(data.me);
        workspaceState.setSummary(data.dashboard);
        workspaceState.setDataQuality(data.dataQualityPayload);
        workspaceState.setDataQualityDetails(null);
        syncRecentDocuments(data.recentDocuments.items);
        workspaceState.setReviewQueue(data.reviewQueueData.items);
        workspaceState.setReviewQueueCounts(data.reviewQueueData.counts);
      }
      if (!silent) {
        workspaceState.setErrorMessage("");
      }
    } catch (error) {
      if (workspaceLoadRequestIdRef.current !== requestId) {
        return;
      }
      const message = error instanceof Error ? error.message : "Не удалось загрузить рабочее пространство";
      if (!silent) {
        workspaceState.setErrorMessage(message);
      }
      if (message.toLowerCase().includes("validate credentials")) {
        invalidateSession();
        workspaceState.setUser(null);
      }
    } finally {
      if (!silent && visibleWorkspaceLoadRequestIdRef.current === requestId) {
        setBootLoading(false);
      }
    }
  }

  async function loadDataQualityDetails(activeToken: string) {
    const requestId = dataQualityDetailsRequestIdRef.current + 1;
    dataQualityDetailsRequestIdRef.current = requestId;
    const payload = await loadWorkspaceDataQualityDetails(activeToken);
    if (dataQualityDetailsRequestIdRef.current !== requestId) {
      return;
    }
    latestRef.current.workspaceState.setDataQualityDetails(payload);
  }

  useEffect(() => {
    const { token, selectedReviewCategory, resetters, workspaceState } = latestRef.current;
    if (!token) {
      invalidateWorkspaceLoadState();
      lastBootstrapTokenRef.current = null;
      workspaceState.setUser(null);
      resetters.setShowTechAdminTab(false);
      resetters.setShowPasswordChange(false);
      resetters.setActiveTechAdminTab("learning");
      resetters.setActiveQualityTab("documents");
      workspaceState.setSummary(null);
      workspaceState.setDataQuality(null);
      workspaceState.setDataQualityDetails(null);
      resetters.resetFleetState();
      resetters.resetOperationsState();
      resetters.resetLaborNormsState();
      resetters.resetReviewRulesState();
      resetters.resetReviewWorkflowState();
      resetters.resetRepairDocumentsWorkflowState();
      resetters.resetRepairEditingState();
      workspaceState.setDocuments([]);
      resetters.resetDocumentsWorkspaceState();
      resetters.resetUsersState();
      resetters.resetServicesState();
      resetters.resetOcrAdminState();
      resetters.resetBackupsState();
      resetters.resetHistoricalImportsState();
      workspaceState.setReviewQueue([]);
      workspaceState.setReviewQueueCounts(EMPTY_REVIEW_QUEUE_COUNTS);
      workspaceState.setSelectedDocumentId(null);
      workspaceState.clearSelectedRepair();
      resetters.setDocumentVehicleFormToEmpty();
      return;
    }
    const nextScope = lastBootstrapTokenRef.current === token ? "documents" : "full";
    lastBootstrapTokenRef.current = token;
    void loadWorkspace(token, selectedReviewCategory, { scope: nextScope });
  }, [params.selectedReviewCategory, params.token]);

  useEffect(() => {
    const { token, dataQualityDetails } = latestRef.current;
    if (!token || dataQualityDetails !== null) {
      return;
    }
    void loadDataQualityDetails(token).catch(() => {});
  }, [params.dataQualityDetails, params.token]);

  useEffect(() => {
    const { token, activeWorkspaceTab, selectedDocumentId, documents, reviewQueue, selectedRepair, loadRepairDetail, workspaceState } =
      latestRef.current;
    if (!token) {
      workspaceState.clearSelectedRepair();
      return;
    }
    if (activeWorkspaceTab === "repair") {
      return;
    }
    if (selectedDocumentId === null) {
      return;
    }

    const selectedRepairId =
      documents.find((item) => item.id === selectedDocumentId)?.repair.id ??
      reviewQueue.find((item) => item.document.id === selectedDocumentId)?.repair.id ??
      (selectedRepair?.documents.some((item) => item.id === selectedDocumentId) ? selectedRepair.id : null);

    if (!selectedRepairId) {
      workspaceState.setSelectedDocumentId(null);
      workspaceState.clearSelectedRepair();
      return;
    }

    const repairAlreadyLoaded = selectedRepair?.id === selectedRepairId;
    const selectedDocumentAlreadyPresentInLoadedRepair =
      repairAlreadyLoaded && selectedRepair.documents.some((item) => item.id === selectedDocumentId);
    if (selectedDocumentAlreadyPresentInLoadedRepair) {
      return;
    }
    void loadRepairDetail(token, selectedRepairId, selectedDocumentId, {
      silent: repairAlreadyLoaded,
      resetTransientState: !repairAlreadyLoaded,
    });
  }, [
    params.activeWorkspaceTab,
    params.documents,
    params.isEditingRepair,
    params.reviewQueue,
    params.selectedDocumentId,
    params.selectedRepair,
    params.token,
  ]);

  useEffect(() => {
    const { token, activeWorkspaceTab, documents, lastUploadedDocument, selectedRepair, isEditingRepair, loadRepairDetail } = latestRef.current;
    if (!token) {
      workspaceAutoRefreshInFlightRef.current = false;
      repairAutoRefreshInFlightRef.current = false;
      return;
    }

    const shouldRefreshWorkspace =
      activeWorkspaceTab === "documents" &&
      (documents.some((document) => isDocumentAwaitingOcr(document.status) || documentHasActiveImportJob(document)) ||
        (lastUploadedDocument !== null &&
          (isDocumentAwaitingOcr(lastUploadedDocument.status) || documentHasActiveImportJob(lastUploadedDocument))));
    const shouldRefreshRepair =
      activeWorkspaceTab === "repair" && !isEditingRepair && repairHasDocumentsAwaitingOcr(selectedRepair);

    if (!shouldRefreshWorkspace && !shouldRefreshRepair) {
      workspaceAutoRefreshInFlightRef.current = false;
      repairAutoRefreshInFlightRef.current = false;
      return;
    }

    const intervalId = window.setInterval(() => {
      const current = latestRef.current;
      if (shouldRefreshWorkspace && !workspaceAutoRefreshInFlightRef.current) {
        workspaceAutoRefreshInFlightRef.current = true;
        void loadWorkspace(current.token as string, current.selectedReviewCategory, {
          scope: "documents",
          silent: true,
        }).finally(() => {
          workspaceAutoRefreshInFlightRef.current = false;
        });
      }

      if (shouldRefreshRepair && !current.isEditingRepair && current.selectedRepair && !repairAutoRefreshInFlightRef.current) {
        repairAutoRefreshInFlightRef.current = true;
        void loadRepairDetail(current.token as string, current.selectedRepair.id, current.selectedDocumentId, {
          silent: true,
          resetTransientState: false,
        }).finally(() => {
          repairAutoRefreshInFlightRef.current = false;
        });
      }
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [params.activeWorkspaceTab, params.documents, params.lastUploadedDocument, params.selectedDocumentId, params.selectedRepair, params.token]);

  useEffect(() => {
    const { token, activeWorkspaceTab, selectedReviewCategory } = latestRef.current;
    const previousWorkspaceTab = previousWorkspaceTabRef.current;
    previousWorkspaceTabRef.current = activeWorkspaceTab;

    if (!token) {
      return;
    }
    if (previousWorkspaceTab === null || previousWorkspaceTab === activeWorkspaceTab) {
      return;
    }
    if (activeWorkspaceTab === "documents") {
      void loadWorkspace(token, selectedReviewCategory, { scope: "documents", silent: true });
    }
  }, [params.activeWorkspaceTab, params.selectedReviewCategory, params.token]);

  return {
    bootLoading,
    loadWorkspace,
  };
}
