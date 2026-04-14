import { formatDocumentKind } from "../../entities/document/formatters";
import { formatMoney } from "../../shared/formattersCore";
import { useRepairDerivedViewModel } from "../../hooks/useRepairDerivedViewModel";
import { useRepairDocumentsWorkflow } from "../../hooks/useRepairDocumentsWorkflow";
import { useRepairEditingWorkflow } from "../../hooks/useRepairEditingWorkflow";
import { useRepairHistoryFilters } from "../../hooks/useRepairHistoryFilters";
import { useRepairPresentationState } from "../../hooks/useRepairPresentationState";
import { useRepairReviewWorkflow } from "../../hooks/useRepairReviewWorkflow";
import { useRepairWorkspaceActions } from "../../hooks/useRepairWorkspaceActions";
import { useSelectedDocumentReport } from "../../hooks/useSelectedDocumentReport";

type AppRootState = ReturnType<typeof import("../../hooks/useAppRootState").useAppRootState>;
type DocumentsWorkspaceState = ReturnType<typeof import("../../hooks/useDocumentsWorkspace").useDocumentsWorkspace>;
type WorkspaceSupportModulesState =
  ReturnType<typeof import("../../hooks/useWorkspaceSupportModules").useWorkspaceSupportModules>;
type AppNavigationState = ReturnType<typeof import("../../hooks/useAppNavigation").useAppNavigation>;

type UseRepairWorkspaceParams = {
  token: string;
  rootState: AppRootState;
  documentsWorkspace: DocumentsWorkspaceState;
  workspaceSupportModules: WorkspaceSupportModulesState;
  navigation: AppNavigationState;
  refreshWorkspace: (scope?: "full" | "documents" | "metrics" | "review") => Promise<void>;
};

export function useRepairWorkspace({
  token,
  rootState,
  documentsWorkspace,
  workspaceSupportModules,
  navigation,
  refreshWorkspace,
}: UseRepairWorkspaceParams) {
  const documentReportState = useSelectedDocumentReport({
    token,
    selectedDocumentId: rootState.selectedDocumentId,
    selectedRepair: rootState.selectedRepair,
    setErrorMessage: rootState.setErrorMessage,
  });
  const repairDerivedViewModel = useRepairDerivedViewModel({
    selectedDocumentId: rootState.selectedDocumentId,
    selectedFiles: documentsWorkspace.selectedFiles,
    userRole: rootState.user?.role,
    selectedRepair: rootState.selectedRepair,
    selectedDocumentReport: documentReportState.selectedDocumentReport,
    selectedDocumentReportLoading: documentReportState.selectedDocumentReportLoading,
    reviewQueue: rootState.reviewQueue,
    summary: rootState.summary,
    dataQuality: rootState.dataQuality,
    dataQualityDetails: rootState.dataQualityDetails,
    formatMoney,
  });
  const repairEditingWorkflow = useRepairEditingWorkflow({
    token,
    userRole: rootState.user?.role,
    selectedRepair: rootState.selectedRepair,
    refreshWorkspace,
    setSelectedRepair: rootState.setSelectedRepair,
    setSelectedDocumentId: rootState.setSelectedDocumentId,
    navigateToDocuments: () => {
      navigation.handleWorkspaceTabChange("documents");
    },
    setErrorMessage: rootState.setErrorMessage,
    setSuccessMessage: rootState.setSuccessMessage,
  });
  const {
    isEditingRepair,
    startRepairEdit,
    cancelRepairEdit,
    syncRepairDraftFromRepair,
    resetRepairEditingState,
  } = repairEditingWorkflow;
  rootState.isEditingRepairRef.current = isEditingRepair;
  rootState.syncRepairDraftFromRepairRef.current = syncRepairDraftFromRepair;

  const repairReviewWorkflow = useRepairReviewWorkflow({
    token,
    userRole: rootState.user?.role,
    selectedRepair: rootState.selectedRepair,
    selectedRepairDocument: repairDerivedViewModel.selectedRepairDocument,
    selectedReviewItem: repairDerivedViewModel.selectedReviewItem,
    selectedDocumentId: rootState.selectedDocumentId,
    selectedRepairDocumentOcrServiceName: repairDerivedViewModel.selectedRepairDocumentOcrServiceName,
    selectedRepairDocumentExtractedFields: repairDerivedViewModel.selectedRepairDocumentExtractedFields,
    defaultReviewServiceStatus: rootState.user?.role === "admin" ? "confirmed" : "preliminary",
    isEditingRepair,
    loadServiceOptions: workspaceSupportModules.servicesAdmin.loadServiceOptions,
    refreshWorkspace,
    openRepairByIds: navigation.openRepairByIds,
    setSelectedRepair: rootState.setSelectedRepair,
    setRepairDraft: syncRepairDraftFromRepair,
    setErrorMessage: rootState.setErrorMessage,
    setSuccessMessage: rootState.setSuccessMessage,
  });
  const { resetReviewWorkflowState } = repairReviewWorkflow;

  const repairWorkspaceActions = useRepairWorkspaceActions({
    token,
    userRole: rootState.user?.role,
    selectedRepairId: rootState.selectedRepair?.id ?? null,
    selectedDocumentId: rootState.selectedDocumentId,
    selectedRepairStatus: rootState.selectedRepair?.status ?? null,
    selectedDocumentStatus: repairDerivedViewModel.selectedRepairDocument?.status ?? null,
    documentVehicleForm: rootState.documentVehicleForm,
    checkComments: rootState.checkComments,
    setCheckComments: rootState.setCheckComments,
    setServiceQuery: workspaceSupportModules.servicesAdmin.setServiceQuery,
    setServiceCityFilter: workspaceSupportModules.servicesAdmin.setServiceCityFilter,
    setServiceStatusFilter: workspaceSupportModules.servicesAdmin.setServiceStatusFilter,
    setErrorMessage: rootState.setErrorMessage,
    setSuccessMessage: rootState.setSuccessMessage,
    refreshWorkspace,
    openRepairByIds: navigation.openRepairByIds,
    openServicesAdmin: () => {
      navigation.openAdminTab("services");
    },
    loadServices: workspaceSupportModules.servicesAdmin.loadServices,
    editService: workspaceSupportModules.servicesAdmin.editService,
    openRepairOverviewTab: () => {
      navigation.handleRepairTabChange("overview");
    },
    startRepairEdit,
    cancelRepairEdit,
    setSelectedRepairFromApi: rootState.setSelectedRepair,
  });

  const repairDocumentsWorkflow = useRepairDocumentsWorkflow({
    token,
    userRole: rootState.user?.role,
    selectedRepair: rootState.selectedRepair,
    refreshWorkspace,
    openRepairByIds: navigation.openRepairByIds,
    setErrorMessage: rootState.setErrorMessage,
    setSuccessMessage: rootState.setSuccessMessage,
  });
  const { resetRepairDocumentsWorkflowState } = repairDocumentsWorkflow;
  rootState.resetRepairDocumentsWorkflowStateRef.current = resetRepairDocumentsWorkflowState;

  const repairHistoryFilters = useRepairHistoryFilters({
    selectedRepair: rootState.selectedRepair,
    historyFilter: rootState.historyFilter,
    historySearch: rootState.historySearch,
    formatDocumentKind,
  });

  useRepairPresentationState({
    selectedDocumentId: rootState.selectedDocumentId,
    selectedRepairId: rootState.selectedRepair?.id ?? null,
    selectedRepairServiceName: rootState.selectedRepair?.service?.name,
    selectedRepairDocumentPayload: repairDerivedViewModel.selectedRepairDocumentPayload,
    selectedRepairDocumentPlateNumber: repairDerivedViewModel.selectedRepairDocumentExtractedFields?.plate_number,
    selectedRepairDocumentVin: repairDerivedViewModel.selectedRepairDocumentExtractedFields?.vin,
    selectedRepairDocumentOcrServiceName: repairDerivedViewModel.selectedRepairDocumentOcrServiceName,
    setDocumentVehicleForm: rootState.setDocumentVehicleForm,
    setShowRepairOverviewDetails: rootState.setShowRepairOverviewDetails,
  });

  return {
    repairDerivedViewModel,
    repairEditingWorkflow,
    repairReviewWorkflow,
    repairWorkspaceActions,
    repairDocumentsWorkflow,
    repairHistoryFilters,
    resetReviewWorkflowState,
    resetRepairEditingState,
    resetRepairDocumentsWorkflowState,
  };
}
