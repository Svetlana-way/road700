import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { loadWorkspaceBootstrapData, type LoadedWorkspaceData } from "../shared/loadWorkspaceBootstrap";
import { repairHasDocumentsAwaitingOcr, type RepairDetailForDraft } from "../shared/repairUiHelpers";
import type {
  DashboardDataQuality,
  DashboardDataQualityDetails,
  DashboardSummary,
  DocumentItem,
  DocumentsResponse,
  ReviewQueueCategory,
  ReviewQueueItem,
  User,
  Vehicle,
} from "../shared/workspaceBootstrapTypes";
import { apiRequest } from "../shared/api";
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
  setVehicles: (value: Vehicle[]) => void;
  setDocuments: (value: DocumentItem[]) => void;
  setReviewQueue: (value: ReviewQueueItem[]) => void;
  setReviewQueueCounts: (value: ReviewQueueCounts) => void;
  setSelectedDocumentId: (value: number | null) => void;
  clearSelectedRepair: () => void;
  setLastUploadedDocument: Dispatch<SetStateAction<DocumentItem | null>>;
  setErrorMessage: (value: string) => void;
  applyBootstrapVehicleList: (value: LoadedWorkspaceData["vehicleList"]) => void;
  applyBootstrapUsers: (value: LoadedWorkspaceData["usersPayload"]) => void;
  applyBootstrapLaborNorms: (value: {
    laborNormCatalog: LoadedWorkspaceData["laborNormCatalog"];
    laborNormCatalogConfigs: LoadedWorkspaceData["laborNormCatalogConfigs"];
  }) => void;
  applyBootstrapServices: (value: LoadedWorkspaceData["servicesPayload"]) => void;
  applyBootstrapReviewRules: (value: LoadedWorkspaceData["reviewRulesPayload"]) => void;
  applyBootstrapOcrAdmin: (value: {
    ocrRulesPayload: LoadedWorkspaceData["ocrRulesPayload"];
    ocrProfileMatchersPayload: LoadedWorkspaceData["ocrProfileMatchersPayload"];
    ocrLearningPayload: LoadedWorkspaceData["ocrLearningPayload"];
    systemStatusPayload: LoadedWorkspaceData["systemStatusPayload"];
  }) => void;
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
  selectedReviewCategory: ReviewQueueCategory;
  laborNormQuery: string;
  laborNormScope: string;
  laborNormCategory: string;
  selectedDocumentId: number | null;
  documents: DocumentItem[];
  reviewQueue: ReviewQueueItem[];
  selectedRepair: RepairDetailForLifecycle | null;
  isEditingRepair: boolean;
  lastUploadedDocument: DocumentItem | null;
  invalidateSession: () => void;
  loadRepairDetail: (
    token: string,
    repairId: number,
    preferredDocumentId: number | null,
    options?: LoadRepairDetailOptions,
  ) => Promise<void>;
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
  const latestRef = useRef(params);
  latestRef.current = params;

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
    options?: { silent?: boolean },
  ) {
    const { laborNormQuery, laborNormScope, laborNormCategory, selectedDocumentId, invalidateSession, workspaceState } =
      latestRef.current;
    const silent = options?.silent ?? false;
    if (!silent) {
      setBootLoading(true);
    }
    try {
      const data = await loadWorkspaceBootstrapData(activeToken, reviewCategory, {
        query: laborNormQuery,
        scope: laborNormScope,
        category: laborNormCategory,
      });

      workspaceState.setUser(data.me);
      workspaceState.setSummary(data.dashboard);
      workspaceState.setDataQuality(data.dataQualityPayload);
      workspaceState.setDataQualityDetails(data.dataQualityDetailsPayload);
      workspaceState.setVehicles(data.vehicleList.items);
      workspaceState.applyBootstrapVehicleList(data.vehicleList);
      syncRecentDocuments(data.recentDocuments.items);
      workspaceState.applyBootstrapUsers(data.usersPayload);
      workspaceState.applyBootstrapLaborNorms({
        laborNormCatalog: data.laborNormCatalog,
        laborNormCatalogConfigs: data.laborNormCatalogConfigs,
      });
      workspaceState.setReviewQueue(data.reviewQueueData.items);
      workspaceState.setReviewQueueCounts(data.reviewQueueData.counts);
      workspaceState.applyBootstrapServices(data.servicesPayload);
      workspaceState.applyBootstrapReviewRules(data.reviewRulesPayload);
      workspaceState.applyBootstrapOcrAdmin({
        ocrRulesPayload: data.ocrRulesPayload,
        ocrProfileMatchersPayload: data.ocrProfileMatchersPayload,
        ocrLearningPayload: data.ocrLearningPayload,
        systemStatusPayload: data.systemStatusPayload,
      });
      if (selectedDocumentId === null) {
        const defaultDocumentId = data.reviewQueueData.items[0]?.document.id ?? data.recentDocuments.items[0]?.id ?? null;
        if (defaultDocumentId !== null) {
          workspaceState.setSelectedDocumentId(defaultDocumentId);
        }
      }
      if (!silent) {
        workspaceState.setErrorMessage("");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось загрузить рабочее пространство";
      if (!silent) {
        workspaceState.setErrorMessage(message);
      }
      if (message.toLowerCase().includes("validate credentials")) {
        invalidateSession();
        workspaceState.setUser(null);
      }
    } finally {
      if (!silent) {
        setBootLoading(false);
      }
    }
  }

  async function loadRecentDocuments(activeToken: string) {
    const recentDocuments = await apiRequest<DocumentsResponse>("/documents?limit=8", { method: "GET" }, activeToken);
    syncRecentDocuments(recentDocuments.items);
  }

  useEffect(() => {
    const { token, selectedReviewCategory, resetters, workspaceState } = latestRef.current;
    if (!token) {
      workspaceState.setUser(null);
      resetters.setShowTechAdminTab(false);
      resetters.setShowPasswordChange(false);
      resetters.setActiveTechAdminTab("learning");
      resetters.setActiveQualityTab("documents");
      workspaceState.setSummary(null);
      workspaceState.setDataQuality(null);
      workspaceState.setDataQualityDetails(null);
      workspaceState.setVehicles([]);
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
    void loadWorkspace(token, selectedReviewCategory);
  }, [params.selectedReviewCategory, params.token]);

  useEffect(() => {
    const { token, selectedDocumentId, documents, reviewQueue, selectedRepair, loadRepairDetail, isEditingRepair, workspaceState } =
      latestRef.current;
    if (!token) {
      workspaceState.clearSelectedRepair();
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
      workspaceState.clearSelectedRepair();
      return;
    }

    const repairAlreadyLoaded = selectedRepair?.id === selectedRepairId;
    void loadRepairDetail(token, selectedRepairId, selectedDocumentId, {
      silent: repairAlreadyLoaded,
      resetTransientState: !repairAlreadyLoaded,
    });
  }, [params.documents, params.isEditingRepair, params.reviewQueue, params.selectedDocumentId, params.selectedRepair, params.token]);

  useEffect(() => {
    const { token, documents, lastUploadedDocument, selectedRepair, selectedDocumentId, loadRepairDetail } = latestRef.current;
    if (!token) {
      workspaceAutoRefreshInFlightRef.current = false;
      repairAutoRefreshInFlightRef.current = false;
      return;
    }

    const shouldRefreshWorkspace =
      documents.some((document) => isDocumentAwaitingOcr(document.status) || documentHasActiveImportJob(document)) ||
      (lastUploadedDocument !== null &&
        (isDocumentAwaitingOcr(lastUploadedDocument.status) || documentHasActiveImportJob(lastUploadedDocument)));
    const shouldRefreshRepair = repairHasDocumentsAwaitingOcr(selectedRepair);

    if (!shouldRefreshWorkspace && !shouldRefreshRepair) {
      workspaceAutoRefreshInFlightRef.current = false;
      repairAutoRefreshInFlightRef.current = false;
      return;
    }

    const intervalId = window.setInterval(() => {
      const current = latestRef.current;
      if (shouldRefreshWorkspace && !workspaceAutoRefreshInFlightRef.current) {
        workspaceAutoRefreshInFlightRef.current = true;
        void loadRecentDocuments(current.token as string).finally(() => {
          workspaceAutoRefreshInFlightRef.current = false;
        });
      }

      if (shouldRefreshRepair && current.selectedRepair && !repairAutoRefreshInFlightRef.current) {
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
  }, [params.documents, params.lastUploadedDocument, params.selectedDocumentId, params.selectedRepair, params.token]);

  return {
    bootLoading,
    loadWorkspace,
  };
}
