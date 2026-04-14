import { useWorkspaceDataLifecycle } from "../hooks/useWorkspaceDataLifecycle";
import { buildWorkspaceLifecycleAdapters } from "./buildWorkspaceLifecycleAdapters";
import type { DocumentVehicleFormState } from "../shared/workspaceFormTypes";

type AppRootState = ReturnType<typeof import("../hooks/useAppRootState").useAppRootState>;
type AuthSessionState = ReturnType<typeof import("../hooks/useAuthSession").useAuthSession>;
type AppBridgeCallbacksState = ReturnType<typeof import("../hooks/useAppBridgeCallbacks").useAppBridgeCallbacks>;
type DocumentsWorkspaceState = ReturnType<typeof import("../hooks/useDocumentsWorkspace").useDocumentsWorkspace>;
type WorkspaceSupportModulesState =
  ReturnType<typeof import("../hooks/useWorkspaceSupportModules").useWorkspaceSupportModules>;
type RepairWorkspaceState = ReturnType<typeof import("../features/repair/useRepairWorkspace").useRepairWorkspace>;
type AppNavigationState = ReturnType<typeof import("../hooks/useAppNavigation").useAppNavigation>;

type UseWorkspaceBootstrappingParams = {
  token: string;
  rootState: AppRootState;
  authSession: AuthSessionState;
  appBridgeCallbacks: AppBridgeCallbacksState;
  documentsWorkspace: DocumentsWorkspaceState;
  workspaceSupportModules: WorkspaceSupportModulesState;
  repairWorkspace: RepairWorkspaceState;
  navigation: AppNavigationState;
  loadRepairDetail: (
    token: string,
    repairId: number,
    preferredDocumentId: number | null,
    options?: { silent?: boolean; resetTransientState?: boolean },
  ) => Promise<"loaded" | "not_found" | "error">;
  invalidateRepairDetailLoaderState: () => void;
  createEmptyDocumentVehicleForm: () => DocumentVehicleFormState;
};

export function useWorkspaceBootstrapping({
  token,
  rootState,
  authSession,
  appBridgeCallbacks,
  documentsWorkspace,
  workspaceSupportModules,
  repairWorkspace,
  navigation,
  loadRepairDetail,
  invalidateRepairDetailLoaderState,
  createEmptyDocumentVehicleForm,
}: UseWorkspaceBootstrappingParams) {
  const workspaceLifecycleAdapters = buildWorkspaceLifecycleAdapters({
    setUser: rootState.setUser,
    setSummary: rootState.setSummary,
    setDataQuality: rootState.setDataQuality,
    setDataQualityDetails: rootState.setDataQualityDetails,
    setDocuments: rootState.setDocuments,
    setReviewQueue: rootState.setReviewQueue,
    setReviewQueueCounts: rootState.setReviewQueueCounts,
    setReviewQueueTotal: rootState.setReviewQueueTotal,
    setReviewQueueOffset: rootState.setReviewQueueOffset,
    setSelectedDocumentId: rootState.setSelectedDocumentId,
    setSelectedRepair: rootState.setSelectedRepair,
    invalidateRepairDetailLoaderState,
    setLastUploadedDocument: documentsWorkspace.setLastUploadedDocument,
    setErrorMessage: rootState.setErrorMessage,
    setShowTechAdminTab: rootState.setShowTechAdminTab,
    setShowPasswordChange: authSession.setShowPasswordChange,
    setActiveTechAdminTab: rootState.setActiveTechAdminTab,
    setActiveQualityTab: rootState.setActiveQualityTab,
    resetFleetState: workspaceSupportModules.fleetWorkspace.resetFleetState,
    resetOperationsState: workspaceSupportModules.workspaceOperations.resetOperationsState,
    resetLaborNormsState: workspaceSupportModules.laborNormsAdmin.resetLaborNormsState,
    resetReviewRulesState: workspaceSupportModules.reviewRulesAdmin.resetReviewRulesState,
    resetReviewWorkflowState: repairWorkspace.resetReviewWorkflowState,
    resetRepairDocumentsWorkflowState: repairWorkspace.resetRepairDocumentsWorkflowState,
    resetRepairEditingState: repairWorkspace.resetRepairEditingState,
    resetDocumentsWorkspaceState: documentsWorkspace.resetDocumentsWorkspaceState,
    resetUsersState: workspaceSupportModules.employeesAdmin.resetUsersState,
    resetServicesState: workspaceSupportModules.servicesAdmin.resetServicesState,
    resetOcrAdminState: workspaceSupportModules.ocrAdmin.resetOcrAdminState,
    resetBackupsState: workspaceSupportModules.backupsAdmin.resetBackupsState,
    resetHistoricalImportsState: workspaceSupportModules.historicalImportsAdmin.resetHistoricalImportsState,
    setDocumentVehicleForm: rootState.setDocumentVehicleForm,
    createEmptyDocumentVehicleForm,
  });
  const workspaceDataLifecycle = useWorkspaceDataLifecycle({
    token,
    activeWorkspaceTab: rootState.activeWorkspaceTab,
    selectedReviewCategory: rootState.selectedReviewCategory,
    reviewQueueLimit: rootState.reviewQueueLimit,
    reviewQueueOffset: rootState.reviewQueueOffset,
    selectedDocumentId: rootState.selectedDocumentId,
    documents: rootState.documents,
    reviewQueue: rootState.reviewQueue,
    dataQualityDetails: rootState.dataQualityDetails,
    selectedRepair: rootState.selectedRepair,
    isEditingRepair: repairWorkspace.repairEditingWorkflow.isEditingRepair,
    lastUploadedDocument: documentsWorkspace.lastUploadedDocument,
    invalidateSession: authSession.invalidateSession,
    loadRepairDetail,
    workspaceState: workspaceLifecycleAdapters.workspaceState,
    resetters: workspaceLifecycleAdapters.resetters,
  });
  const { loadWorkspace } = workspaceDataLifecycle;

  appBridgeCallbacks.openRepairByIdsRef.current = navigation.openRepairByIds;
  appBridgeCallbacks.openTechAdminRef.current = navigation.openTechAdmin;
  appBridgeCallbacks.openReviewRulesAdminRef.current = navigation.openReviewRulesAdmin;
  appBridgeCallbacks.openLaborNormsAdminRef.current = navigation.openLaborNormsAdmin;
  appBridgeCallbacks.loadWorkspaceRef.current = loadWorkspace;

  return {
    workspaceDataLifecycle,
  };
}
