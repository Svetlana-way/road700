import { AuthLandingView } from "./components/AuthLandingView";
import { WorkspaceMainView } from "./components/WorkspaceMainView";
import { useAppBridgeCallbacks } from "./hooks/useAppBridgeCallbacks";
import { useAppNavigation } from "./hooks/useAppNavigation";
import { useAppRootState } from "./hooks/useAppRootState";
import { useAuthSession } from "./hooks/useAuthSession";
import { useDocumentsWorkspace } from "./hooks/useDocumentsWorkspace";
import { useRepairDerivedViewModel } from "./hooks/useRepairDerivedViewModel";
import { useRepairDetailLoader } from "./hooks/useRepairDetailLoader";
import { useRepairDocumentsWorkflow } from "./hooks/useRepairDocumentsWorkflow";
import { useRepairEditingWorkflow } from "./hooks/useRepairEditingWorkflow";
import { useRepairHistoryFilters } from "./hooks/useRepairHistoryFilters";
import { useRepairWorkspaceActions } from "./hooks/useRepairWorkspaceActions";
import { useRepairReviewWorkflow } from "./hooks/useRepairReviewWorkflow";
import { useRepairPresentationState } from "./hooks/useRepairPresentationState";
import { useWorkspaceDataLifecycle } from "./hooks/useWorkspaceDataLifecycle";
import { useWorkspaceSupportModules } from "./hooks/useWorkspaceSupportModules";
import { buildAuthLandingProps } from "./shared/buildAuthLandingProps";
import { buildWorkspaceLifecycleAdapters } from "./shared/buildWorkspaceLifecycleAdapters";
import { buildWorkspaceMainViewProps } from "./shared/buildWorkspaceMainViewProps";
import { resolveRepairDocumentId } from "./shared/repairUiHelpers";
import {
  formatDocumentKind,
  formatDocumentStatusLabel,
  formatMoney,
} from "./shared/displayFormatters";
import {
  createEmptyDocumentVehicleForm,
  createEmptyUploadForm,
} from "./shared/formStateFactories";
import {
  VEHICLES_FULL_LIST_LIMIT,
} from "./shared/appUiConfig";
import type { RepairDetail } from "./shared/repairDetailTypes";
import type { DocumentItem } from "./shared/workspaceBootstrapTypes";

// Predeploy marker: uploaded: "В очереди OCR"

export default function App() {
  const appRootState = useAppRootState({
    createEmptyDocumentVehicleForm,
  });
  const {
    user,
    setUser,
    activeWorkspaceTab,
    setActiveWorkspaceTab,
    activeAdminTab,
    setActiveAdminTab,
    activeTechAdminTab,
    setActiveTechAdminTab,
    activeRepairTab,
    setActiveRepairTab,
    setActiveQualityTab,
    showTechAdminTab,
    setShowTechAdminTab,
    summary,
    setSummary,
    dataQuality,
    setDataQuality,
    dataQualityDetails,
    setDataQualityDetails,
    documents,
    setDocuments,
    reviewQueue,
    setReviewQueue,
    setReviewQueueCounts,
    selectedReviewCategory,
    selectedDocumentId,
    setSelectedDocumentId,
    selectedRepair,
    setSelectedRepair,
    documentVehicleForm,
    setDocumentVehicleForm,
    checkComments,
    setCheckComments,
    historyFilter,
    setHistoryFilter,
    historySearch,
    setHistorySearch,
    setShowRepairOverviewDetails,
    errorMessage,
    setErrorMessage,
    successMessage,
    setSuccessMessage,
    isEditingRepairRef,
    syncRepairDraftFromRepairRef,
    resetRepairDocumentsWorkflowStateRef,
  } = appRootState;

  const authSession = useAuthSession({
    setErrorMessage,
    setSuccessMessage,
    onLogoutAppReset: () => {
      setActiveWorkspaceTab("documents");
      setActiveAdminTab("services");
      setActiveTechAdminTab("learning");
      setActiveRepairTab("overview");
      setShowTechAdminTab(false);
      setLastUploadedDocument(null);
      resetRepairDocumentsWorkflowStateRef.current();
    },
  });
  const {
    token,
    setShowPasswordChange,
    showPasswordRecoveryRequest,
    loginValue,
    setLoginValue,
    passwordValue,
    setPasswordValue,
    recoveryEmailValue,
    setRecoveryEmailValue,
    recoveryTokenValue,
    setRecoveryTokenValue,
    recoveryNewPasswordValue,
    setRecoveryNewPasswordValue,
    loginLoading,
    passwordRecoveryLoading,
    invalidateSession,
    handleLogin,
    handleRequestPasswordRecovery,
    handleConfirmPasswordRecovery,
    openPasswordRecovery,
    handleBackToLogin,
  } = authSession;
  const {
    openRepairByIdsRef,
    openTechAdminRef,
    openReviewRulesAdminRef,
    openLaborNormsAdminRef,
    loadWorkspaceRef,
    openRepairByIdsFromDocuments,
    openTechAdmin,
    openReviewRulesAdmin,
    openLaborNormsAdmin,
    refreshWorkspace,
  } = useAppBridgeCallbacks(token);
  const documentsWorkspace = useDocumentsWorkspace({
    token,
    userRole: user?.role,
    activeWorkspaceTab,
    emptyUploadForm: createEmptyUploadForm,
    setErrorMessage,
    setSuccessMessage,
    refreshWorkspace,
    openRepairByIds: openRepairByIdsFromDocuments,
    selectedDocumentId,
    selectedRepairId: selectedRepair?.id ?? null,
    formatDocumentStatusLabel,
  });
  const {
    selectedFiles,
    lastUploadedDocument,
    setLastUploadedDocument,
    resetDocumentsWorkspaceState,
  } = documentsWorkspace;
  const workspaceSupportModules = useWorkspaceSupportModules({
    token,
    userRole: user?.role,
    activeWorkspaceTab,
    activeAdminTab,
    activeTechAdminTab,
    setErrorMessage,
    setSuccessMessage,
    refreshWorkspace,
    openTechAdmin,
    openReviewRulesAdmin,
    openLaborNormsAdmin,
    invalidateSession,
    vehiclesFullListLimit: VEHICLES_FULL_LIST_LIMIT,
  });
  const repairDetailLoader = useRepairDetailLoader<RepairDetail, DocumentItem>({
    setErrorMessage,
    setSelectedRepair,
    setSelectedDocumentId,
    setLastUploadedDocument,
    setCheckComments,
    setHistoryFilter,
    setHistorySearch,
    isEditingRepairRef,
    syncRepairDraftFromRepairRef,
    resetRepairDocumentsWorkflowStateRef,
  });
  const { repairLoading, loadRepairDetail, invalidateRepairDetailLoaderState } = repairDetailLoader;
  const selectedRepairDefaultDocumentId = selectedRepair ? resolveRepairDocumentId(selectedRepair, null) : null;
  const appNavigation = useAppNavigation({
    userRole: user?.role,
    token,
    activeWorkspaceTab,
    setActiveWorkspaceTab,
    activeAdminTab,
    setActiveAdminTab,
    activeTechAdminTab,
    setActiveTechAdminTab,
    activeRepairTab,
    setActiveRepairTab,
    showTechAdminTab,
    setShowTechAdminTab,
    fleetViewMode: workspaceSupportModules.fleetWorkspace.fleetViewMode,
    setFleetViewMode: workspaceSupportModules.fleetWorkspace.setFleetViewMode,
    selectedFleetVehicleId: workspaceSupportModules.fleetWorkspace.selectedFleetVehicleId,
    selectedFleetVehicleMissing: workspaceSupportModules.fleetWorkspace.selectedFleetVehicleMissing,
    setSelectedFleetVehicleId: workspaceSupportModules.fleetWorkspace.setSelectedFleetVehicleId,
    selectedRepairId: selectedRepair?.id ?? null,
    selectedRepairDefaultDocumentId,
    selectedDocumentId,
    setSelectedDocumentId,
    clearSelectedRepair: () => {
      invalidateRepairDetailLoaderState();
      setSelectedRepair(null);
    },
    loadRepairDetail,
  });
  const {
    handleRepairTabChange,
    openAdminTab,
    openTechAdmin: openTechAdminInternal,
    openReviewRulesAdmin: openReviewRulesAdminInternal,
    openLaborNormsAdmin: openLaborNormsAdminInternal,
    openRepairByIds,
  } = appNavigation;
  const repairDerivedViewModel = useRepairDerivedViewModel({
    selectedDocumentId,
    selectedFiles,
    userRole: user?.role,
    selectedRepair,
    reviewQueue,
    summary,
    dataQuality,
    dataQualityDetails,
    formatMoney,
  });
  const {
    selectedReviewItem,
    selectedRepairDocument,
    selectedRepairDocumentPayload,
    selectedRepairDocumentExtractedFields,
    selectedRepairDocumentOcrServiceName,
  } = repairDerivedViewModel;
  const repairEditingWorkflow = useRepairEditingWorkflow({
    token,
    userRole: user?.role,
    selectedRepair,
    refreshWorkspace,
    setSelectedRepair,
    setSelectedDocumentId,
    navigateToDocuments: () => {
      appNavigation.handleWorkspaceTabChange("documents");
    },
    setErrorMessage,
    setSuccessMessage,
  });
  const {
    isEditingRepair,
    startRepairEdit,
    cancelRepairEdit,
    syncRepairDraftFromRepair,
    resetRepairEditingState,
  } = repairEditingWorkflow;
  isEditingRepairRef.current = isEditingRepair;
  syncRepairDraftFromRepairRef.current = syncRepairDraftFromRepair;
  const repairReviewWorkflow = useRepairReviewWorkflow({
    token,
    userRole: user?.role,
    selectedRepair,
    selectedRepairDocument,
    selectedReviewItem,
    selectedDocumentId,
    selectedRepairDocumentOcrServiceName,
    selectedRepairDocumentExtractedFields,
    defaultReviewServiceStatus: user?.role === "admin" ? "confirmed" : "preliminary",
    isEditingRepair,
    loadServiceOptions: workspaceSupportModules.servicesAdmin.loadServiceOptions,
    refreshWorkspace,
    openRepairByIds,
    setSelectedRepair,
    setRepairDraft: syncRepairDraftFromRepair,
    setErrorMessage,
    setSuccessMessage,
  });
  const { resetReviewWorkflowState } = repairReviewWorkflow;
  const repairWorkspaceActions = useRepairWorkspaceActions({
    token,
    userRole: user?.role,
    selectedRepairId: selectedRepair?.id ?? null,
    selectedDocumentId,
    selectedRepairStatus: selectedRepair?.status ?? null,
    selectedDocumentStatus: selectedRepairDocument?.status ?? null,
    documentVehicleForm,
    checkComments,
    setCheckComments,
    setServiceQuery: workspaceSupportModules.servicesAdmin.setServiceQuery,
    setServiceCityFilter: workspaceSupportModules.servicesAdmin.setServiceCityFilter,
    setServiceStatusFilter: workspaceSupportModules.servicesAdmin.setServiceStatusFilter,
    setErrorMessage,
    setSuccessMessage,
    refreshWorkspace,
    openRepairByIds,
    openServicesAdmin: () => {
      openAdminTab("services");
    },
    loadServices: workspaceSupportModules.servicesAdmin.loadServices,
    editService: workspaceSupportModules.servicesAdmin.editService,
    openRepairOverviewTab: () => {
      handleRepairTabChange("overview");
    },
    startRepairEdit,
    cancelRepairEdit,
    setSelectedRepairFromApi: setSelectedRepair,
  });
  const repairDocumentsWorkflow = useRepairDocumentsWorkflow({
    token,
    userRole: user?.role,
    selectedRepair,
    refreshWorkspace,
    openRepairByIds,
    setErrorMessage,
    setSuccessMessage,
  });
  const { resetRepairDocumentsWorkflowState } = repairDocumentsWorkflow;
  resetRepairDocumentsWorkflowStateRef.current = resetRepairDocumentsWorkflowState;
  const workspaceLifecycleAdapters = buildWorkspaceLifecycleAdapters({
    setUser,
    setSummary,
    setDataQuality,
    setDataQualityDetails,
    setDocuments,
    setReviewQueue,
    setReviewQueueCounts,
    setSelectedDocumentId,
    setSelectedRepair,
    invalidateRepairDetailLoaderState,
    setLastUploadedDocument,
    setErrorMessage,
    setShowTechAdminTab,
    setShowPasswordChange,
    setActiveTechAdminTab,
    setActiveQualityTab,
    resetFleetState: workspaceSupportModules.fleetWorkspace.resetFleetState,
    resetOperationsState: workspaceSupportModules.workspaceOperations.resetOperationsState,
    resetLaborNormsState: workspaceSupportModules.laborNormsAdmin.resetLaborNormsState,
    resetReviewRulesState: workspaceSupportModules.reviewRulesAdmin.resetReviewRulesState,
    resetReviewWorkflowState,
    resetRepairDocumentsWorkflowState,
    resetRepairEditingState,
    resetDocumentsWorkspaceState,
    resetUsersState: workspaceSupportModules.employeesAdmin.resetUsersState,
    resetServicesState: workspaceSupportModules.servicesAdmin.resetServicesState,
    resetOcrAdminState: workspaceSupportModules.ocrAdmin.resetOcrAdminState,
    resetBackupsState: workspaceSupportModules.backupsAdmin.resetBackupsState,
    resetHistoricalImportsState: workspaceSupportModules.historicalImportsAdmin.resetHistoricalImportsState,
    setDocumentVehicleForm,
    createEmptyDocumentVehicleForm,
  });
  const workspaceDataLifecycle = useWorkspaceDataLifecycle({
    token,
    activeWorkspaceTab,
    selectedReviewCategory,
    selectedDocumentId,
    documents,
    reviewQueue,
    dataQualityDetails,
    selectedRepair,
    isEditingRepair,
    lastUploadedDocument,
    invalidateSession,
    loadRepairDetail,
    workspaceState: workspaceLifecycleAdapters.workspaceState,
    resetters: workspaceLifecycleAdapters.resetters,
  });
  const { loadWorkspace: loadWorkspaceInternal } = workspaceDataLifecycle;
  openRepairByIdsRef.current = openRepairByIds;
  openTechAdminRef.current = openTechAdminInternal;
  openReviewRulesAdminRef.current = openReviewRulesAdminInternal;
  openLaborNormsAdminRef.current = openLaborNormsAdminInternal;
  loadWorkspaceRef.current = loadWorkspaceInternal;
  const repairHistoryFilters = useRepairHistoryFilters({
    selectedRepair,
    historyFilter,
    historySearch,
    formatDocumentKind,
  });
  useRepairPresentationState({
    selectedDocumentId,
    selectedRepairId: selectedRepair?.id ?? null,
    selectedRepairServiceName: selectedRepair?.service?.name,
    selectedRepairDocumentPayload,
    selectedRepairDocumentPlateNumber: selectedRepairDocumentExtractedFields?.plate_number,
    selectedRepairDocumentVin: selectedRepairDocumentExtractedFields?.vin,
    selectedRepairDocumentOcrServiceName,
    setDocumentVehicleForm,
    setShowRepairOverviewDetails,
  });

  const workspaceMainViewProps = buildWorkspaceMainViewProps({
    rootState: appRootState,
    authSession,
    documentsWorkspace,
    employeesAdmin: workspaceSupportModules.employeesAdmin,
    servicesAdmin: workspaceSupportModules.servicesAdmin,
    reviewRulesAdmin: workspaceSupportModules.reviewRulesAdmin,
    laborNormsAdmin: workspaceSupportModules.laborNormsAdmin,
    ocrAdmin: workspaceSupportModules.ocrAdmin,
    historicalImportsAdmin: workspaceSupportModules.historicalImportsAdmin,
    operationsWorkspace: workspaceSupportModules.workspaceOperations,
    backupsAdmin: workspaceSupportModules.backupsAdmin,
    fleetWorkspace: workspaceSupportModules.fleetWorkspace,
    navigation: appNavigation,
    repairLoading,
    repairDerivedViewModel,
    repairEditingWorkflow,
    repairReviewWorkflow,
    repairWorkspaceActions,
    repairDocumentsWorkflow,
    repairHistoryFilters,
    workspaceDataLifecycle,
  });

  if (!token) {
    return (
      <AuthLandingView
        {...buildAuthLandingProps({
          showPasswordRecoveryRequest,
          loginValue,
          passwordValue,
          loginLoading,
          recoveryEmailValue,
          recoveryTokenValue,
          recoveryNewPasswordValue,
          passwordRecoveryLoading,
          errorMessage,
          successMessage,
          handleLogin,
          setLoginValue,
          setPasswordValue,
          openPasswordRecovery,
          setRecoveryEmailValue,
          handleRequestPasswordRecovery,
          setRecoveryTokenValue,
          setRecoveryNewPasswordValue,
          handleConfirmPasswordRecovery,
          handleBackToLogin,
        })}
      />
    );
  }

  return (
    <WorkspaceMainView {...workspaceMainViewProps} />
  );
}
