import { type ComponentProps } from "react";
import { WorkspaceMainView } from "../components/WorkspaceMainView";
import {
  qualityCards,
  summaryCards,
  workspaceTabDescriptions,
} from "./appUiConfig";
import { buildWorkspaceContentSectionParams } from "./buildWorkspaceContentSectionParams";
import { buildWorkspaceContentProps } from "./buildWorkspaceContentProps";
import {
  buildDataQualityProps,
  buildImportConflictDialogProps,
  buildWorkspaceChromeProps,
} from "./buildWorkspaceShellProps";
import { buildDashboardVisualBarWidth } from "./dashboardVisuals";
import {
  formatConfidence,
  formatDateTime,
  formatDocumentStatusLabel,
  formatJsonPretty,
  formatMoney,
  formatRepairStatus,
  formatStatus,
  statusColor,
} from "./displayFormatters";
import { formatQualityVehicle } from "./fleetDocumentHelpers";

type WorkspaceMainViewProps = ComponentProps<typeof WorkspaceMainView>;
type AppRootState = ReturnType<typeof import("../hooks/useAppRootState").useAppRootState>;
type AuthSessionState = ReturnType<typeof import("../hooks/useAuthSession").useAuthSession>;
type DocumentsWorkspaceState = ReturnType<typeof import("../hooks/useDocumentsWorkspace").useDocumentsWorkspace>;
type EmployeesAdminState = ReturnType<typeof import("../hooks/useEmployeesAdmin").useEmployeesAdmin>;
type ServicesAdminState = ReturnType<typeof import("../hooks/useServicesAdmin").useServicesAdmin>;
type ReviewRulesAdminState = ReturnType<typeof import("../hooks/useReviewRulesAdmin").useReviewRulesAdmin>;
type LaborNormsAdminState = ReturnType<typeof import("../hooks/useLaborNormsAdmin").useLaborNormsAdmin>;
type OcrAdminState = ReturnType<typeof import("../hooks/useOcrAdmin").useOcrAdmin>;
type HistoricalImportsAdminState =
  ReturnType<typeof import("../hooks/useHistoricalImportsAdmin").useHistoricalImportsAdmin>;
type WorkspaceOperationsState = ReturnType<typeof import("../hooks/useWorkspaceOperations").useWorkspaceOperations>;
type BackupsAdminState = ReturnType<typeof import("../hooks/useBackupsAdmin").useBackupsAdmin>;
type FleetWorkspaceState = ReturnType<typeof import("../hooks/useFleetWorkspace").useFleetWorkspace>;
type AppNavigationState = ReturnType<typeof import("../hooks/useAppNavigation").useAppNavigation>;
type RepairDerivedViewModelState =
  ReturnType<typeof import("../hooks/useRepairDerivedViewModel").useRepairDerivedViewModel>;
type RepairEditingWorkflowState =
  ReturnType<typeof import("../hooks/useRepairEditingWorkflow").useRepairEditingWorkflow>;
type RepairReviewWorkflowState =
  ReturnType<typeof import("../hooks/useRepairReviewWorkflow").useRepairReviewWorkflow>;
type RepairWorkspaceActionsState =
  ReturnType<typeof import("../hooks/useRepairWorkspaceActions").useRepairWorkspaceActions>;
type RepairDocumentsWorkflowState =
  ReturnType<typeof import("../hooks/useRepairDocumentsWorkflow").useRepairDocumentsWorkflow>;
type RepairHistoryFiltersState = ReturnType<typeof import("../hooks/useRepairHistoryFilters").useRepairHistoryFilters>;
type WorkspaceDataLifecycleState =
  ReturnType<typeof import("../hooks/useWorkspaceDataLifecycle").useWorkspaceDataLifecycle>;

type BuildWorkspaceMainViewPropsParams = {
  rootState: AppRootState;
  authSession: AuthSessionState;
  documentsWorkspace: DocumentsWorkspaceState;
  employeesAdmin: EmployeesAdminState;
  servicesAdmin: ServicesAdminState;
  reviewRulesAdmin: ReviewRulesAdminState;
  laborNormsAdmin: LaborNormsAdminState;
  ocrAdmin: OcrAdminState;
  historicalImportsAdmin: HistoricalImportsAdminState;
  operationsWorkspace: WorkspaceOperationsState;
  backupsAdmin: BackupsAdminState;
  fleetWorkspace: FleetWorkspaceState;
  navigation: AppNavigationState;
  repairLoading: boolean;
  repairDerivedViewModel: RepairDerivedViewModelState;
  repairEditingWorkflow: RepairEditingWorkflowState;
  repairReviewWorkflow: RepairReviewWorkflowState;
  repairWorkspaceActions: RepairWorkspaceActionsState;
  repairDocumentsWorkflow: RepairDocumentsWorkflowState;
  repairHistoryFilters: RepairHistoryFiltersState;
  workspaceDataLifecycle: WorkspaceDataLifecycleState;
};

export function buildWorkspaceMainViewProps(params: BuildWorkspaceMainViewPropsParams): WorkspaceMainViewProps {
  const {
    rootState,
    authSession,
    historicalImportsAdmin,
    navigation,
    repairDerivedViewModel,
    repairWorkspaceActions,
    workspaceDataLifecycle,
  } = params;
  const contentSections = buildWorkspaceContentSectionParams(params);

  return {
    chromeProps: buildWorkspaceChromeProps({
      user: rootState.user,
      showPasswordChange: authSession.showPasswordChange,
      currentPasswordValue: authSession.currentPasswordValue,
      newPasswordValue: authSession.newPasswordValue,
      passwordChangeLoading: authSession.passwordChangeLoading,
      errorMessage: rootState.errorMessage,
      successMessage: rootState.successMessage,
      bootLoading: workspaceDataLifecycle.bootLoading,
      activeWorkspaceTab: rootState.activeWorkspaceTab,
      documents: rootState.documents,
      selectedRepair: rootState.selectedRepair,
      showTechAdminTab: rootState.showTechAdminTab,
      vehicles: rootState.vehicles,
      workspaceTabDescriptions,
      summary: rootState.summary,
      summaryCards,
      setShowPasswordChange: authSession.setShowPasswordChange,
      setCurrentPasswordValue: authSession.setCurrentPasswordValue,
      setNewPasswordValue: authSession.setNewPasswordValue,
      handleChangePassword: authSession.handleChangePassword,
      cancelPasswordChange: authSession.cancelPasswordChange,
      handleLogout: authSession.handleLogout,
      handleWorkspaceTabChange: navigation.handleWorkspaceTabChange,
    }),
    dataQualityProps: buildDataQualityProps({
      dataQuality: rootState.dataQuality,
      qualityCards,
      repairVisualBars: repairDerivedViewModel.repairVisualBars,
      repairVisualMax: repairDerivedViewModel.repairVisualMax,
      qualityVisualBars: repairDerivedViewModel.qualityVisualBars,
      qualityVisualMax: repairDerivedViewModel.qualityVisualMax,
      attentionVisualBars: repairDerivedViewModel.attentionVisualBars,
      attentionVisualMax: repairDerivedViewModel.attentionVisualMax,
      topAttentionServices: repairDerivedViewModel.topAttentionServices,
      dataQualityDetails: rootState.dataQualityDetails,
      showQualityDialog: rootState.showQualityDialog,
      activeQualityTab: rootState.activeQualityTab,
      userRole: rootState.user?.role,
      setShowQualityDialog: rootState.setShowQualityDialog,
      setActiveQualityTab: rootState.setActiveQualityTab,
      openQualityRepair: repairWorkspaceActions.openQualityRepair,
      openQualityService: repairWorkspaceActions.openQualityService,
      openImportConflict: historicalImportsAdmin.openImportConflict,
      buildDashboardVisualBarWidth,
      formatConfidence,
      formatMoney,
      formatQualityVehicle,
      statusColor,
      formatDocumentStatusLabel,
      formatRepairStatus,
      formatDateTime,
    }),
    importConflictDialogProps: buildImportConflictDialogProps({
      showImportConflictDialog: historicalImportsAdmin.showImportConflictDialog,
      importConflictLoading: historicalImportsAdmin.importConflictLoading,
      importConflictSaving: historicalImportsAdmin.importConflictSaving,
      selectedImportConflict: historicalImportsAdmin.selectedImportConflict,
      importConflictComment: historicalImportsAdmin.importConflictComment,
      setShowImportConflictDialog: historicalImportsAdmin.setShowImportConflictDialog,
      setImportConflictComment: historicalImportsAdmin.setImportConflictComment,
      handleResolveImportConflict: historicalImportsAdmin.handleResolveImportConflict,
      formatStatus,
      formatDateTime,
      formatJsonPretty,
    }),
    contentProps: buildWorkspaceContentProps({
      documents: contentSections.documents,
      admin: contentSections.admin,
      operations: contentSections.operations,
      repair: contentSections.repair,
    }),
  };
}
