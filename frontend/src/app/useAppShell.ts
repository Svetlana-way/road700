import { useRepairWorkspace } from "../features/repair/useRepairWorkspace";
import { useAppBridgeCallbacks } from "../hooks/useAppBridgeCallbacks";
import { useAppRootState } from "../hooks/useAppRootState";
import { useAuthSession } from "../hooks/useAuthSession";
import { useDocumentsWorkspace } from "../hooks/useDocumentsWorkspace";
import { useWorkspaceSupportModules } from "../hooks/useWorkspaceSupportModules";
import { VEHICLES_FULL_LIST_LIMIT } from "../shared/appUiConfig";
import { formatStatus } from "../shared/formattersCore";
import { createEmptyDocumentVehicleForm, createEmptyUploadForm } from "../shared/formStateFactories";
import { buildAuthLandingProps } from "./buildAuthLandingProps";
import { buildWorkspaceMainViewProps } from "./buildWorkspaceMainViewProps";
import { useRepairRouting } from "./useRepairRouting";
import { useWorkspaceBootstrapping } from "./useWorkspaceBootstrapping";

export function useAppShell() {
  const appRootState = useAppRootState({
    createEmptyDocumentVehicleForm,
  });

  const authSession = useAuthSession({
    setErrorMessage: appRootState.setErrorMessage,
    setSuccessMessage: appRootState.setSuccessMessage,
    onLogoutAppReset: () => {
      appRootState.setActiveWorkspaceTab("documents");
      appRootState.setActiveAdminTab("services");
      appRootState.setActiveTechAdminTab("learning");
      appRootState.setActiveRepairTab("overview");
      appRootState.setShowTechAdminTab(false);
      documentsWorkspace.setLastUploadedDocument(null);
      appRootState.resetRepairDocumentsWorkflowStateRef.current();
    },
  });

  const appBridgeCallbacks = useAppBridgeCallbacks(authSession.token);
  const documentsWorkspace = useDocumentsWorkspace({
    token: authSession.token,
    userRole: appRootState.user?.role,
    activeWorkspaceTab: appRootState.activeWorkspaceTab,
    emptyUploadForm: createEmptyUploadForm,
    setErrorMessage: appRootState.setErrorMessage,
    setSuccessMessage: appRootState.setSuccessMessage,
    refreshWorkspace: appBridgeCallbacks.refreshWorkspace,
    openRepairByIds: appBridgeCallbacks.openRepairByIdsFromDocuments,
    selectedDocumentId: appRootState.selectedDocumentId,
    selectedRepairId: appRootState.selectedRepair?.id ?? null,
    formatStatus,
  });

  const workspaceSupportModules = useWorkspaceSupportModules({
    token: authSession.token,
    userRole: appRootState.user?.role,
    activeWorkspaceTab: appRootState.activeWorkspaceTab,
    activeAdminTab: appRootState.activeAdminTab,
    activeTechAdminTab: appRootState.activeTechAdminTab,
    setErrorMessage: appRootState.setErrorMessage,
    setSuccessMessage: appRootState.setSuccessMessage,
    refreshWorkspace: appBridgeCallbacks.refreshWorkspace,
    openTechAdmin: appBridgeCallbacks.openTechAdmin,
    openReviewRulesAdmin: appBridgeCallbacks.openReviewRulesAdmin,
    openLaborNormsAdmin: appBridgeCallbacks.openLaborNormsAdmin,
    invalidateSession: authSession.invalidateSession,
    vehiclesFullListLimit: VEHICLES_FULL_LIST_LIMIT,
  });

  const {
    repairLoading,
    loadRepairDetail,
    invalidateRepairDetailLoaderState,
    navigation,
  } = useRepairRouting({
    token: authSession.token,
    rootState: appRootState,
    documentsWorkspace,
    workspaceSupportModules,
  });

  const repairWorkspace = useRepairWorkspace({
    token: authSession.token,
    rootState: appRootState,
    documentsWorkspace,
    workspaceSupportModules,
    navigation,
    refreshWorkspace: appBridgeCallbacks.refreshWorkspace,
  });

  const { workspaceDataLifecycle } = useWorkspaceBootstrapping({
    token: authSession.token,
    rootState: appRootState,
    authSession,
    appBridgeCallbacks,
    documentsWorkspace,
    workspaceSupportModules,
    repairWorkspace,
    navigation,
    loadRepairDetail,
    invalidateRepairDetailLoaderState,
    createEmptyDocumentVehicleForm,
  });

  return {
    token: authSession.token,
    authLandingProps: buildAuthLandingProps({
      showPasswordRecoveryRequest: authSession.showPasswordRecoveryRequest,
      loginValue: authSession.loginValue,
      passwordValue: authSession.passwordValue,
      loginLoading: authSession.loginLoading,
      recoveryEmailValue: authSession.recoveryEmailValue,
      recoveryTokenValue: authSession.recoveryTokenValue,
      recoveryNewPasswordValue: authSession.recoveryNewPasswordValue,
      passwordRecoveryLoading: authSession.passwordRecoveryLoading,
      errorMessage: appRootState.errorMessage,
      successMessage: appRootState.successMessage,
      handleLogin: authSession.handleLogin,
      setLoginValue: authSession.setLoginValue,
      setPasswordValue: authSession.setPasswordValue,
      openPasswordRecovery: authSession.openPasswordRecovery,
      setRecoveryEmailValue: authSession.setRecoveryEmailValue,
      handleRequestPasswordRecovery: authSession.handleRequestPasswordRecovery,
      setRecoveryTokenValue: authSession.setRecoveryTokenValue,
      setRecoveryNewPasswordValue: authSession.setRecoveryNewPasswordValue,
      handleConfirmPasswordRecovery: authSession.handleConfirmPasswordRecovery,
      handleBackToLogin: authSession.handleBackToLogin,
    }),
    workspaceMainViewProps: buildWorkspaceMainViewProps({
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
      navigation,
      repairLoading,
      repairDerivedViewModel: repairWorkspace.repairDerivedViewModel,
      repairEditingWorkflow: repairWorkspace.repairEditingWorkflow,
      repairReviewWorkflow: repairWorkspace.repairReviewWorkflow,
      repairWorkspaceActions: repairWorkspace.repairWorkspaceActions,
      repairDocumentsWorkflow: repairWorkspace.repairDocumentsWorkflow,
      repairHistoryFilters: repairWorkspace.repairHistoryFilters,
      workspaceDataLifecycle,
    }),
  };
}
