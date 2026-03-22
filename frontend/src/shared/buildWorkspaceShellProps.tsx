import { type ComponentProps, type Dispatch, type SetStateAction } from "react";
import { DataQualityOverviewPanel } from "../components/DataQualityOverviewPanel";
import { ImportConflictDialog } from "../components/ImportConflictDialog";
import { WorkspaceChromePanels } from "../components/WorkspaceChromePanels";

type WorkspaceChromePanelsProps = ComponentProps<typeof WorkspaceChromePanels>;
type DataQualityOverviewPanelProps = ComponentProps<typeof DataQualityOverviewPanel>;
type ImportConflictDialogProps = ComponentProps<typeof ImportConflictDialog>;
type BuildWorkspaceChromePropsParams = {
  user: WorkspaceChromePanelsProps["user"];
  showPasswordChange: WorkspaceChromePanelsProps["showPasswordChange"];
  currentPasswordValue: WorkspaceChromePanelsProps["currentPasswordValue"];
  newPasswordValue: WorkspaceChromePanelsProps["newPasswordValue"];
  passwordChangeLoading: WorkspaceChromePanelsProps["passwordChangeLoading"];
  errorMessage: WorkspaceChromePanelsProps["errorMessage"];
  successMessage: WorkspaceChromePanelsProps["successMessage"];
  bootLoading: WorkspaceChromePanelsProps["bootLoading"];
  activeWorkspaceTab: WorkspaceChromePanelsProps["activeWorkspaceTab"];
  documents: ArrayLike<unknown>;
  selectedRepair: { id: number } | null;
  showTechAdminTab: WorkspaceChromePanelsProps["showTechAdminTab"];
  vehicles: ArrayLike<unknown>;
  workspaceTabDescriptions: Record<WorkspaceChromePanelsProps["activeWorkspaceTab"], string>;
  summary: WorkspaceChromePanelsProps["summary"];
  summaryCards: WorkspaceChromePanelsProps["summaryCards"];
  setShowPasswordChange: Dispatch<SetStateAction<boolean>>;
  setCurrentPasswordValue: WorkspaceChromePanelsProps["onCurrentPasswordValueChange"];
  setNewPasswordValue: WorkspaceChromePanelsProps["onNewPasswordValueChange"];
  handleChangePassword: () => void | Promise<void>;
  cancelPasswordChange: WorkspaceChromePanelsProps["onCancelPasswordChange"];
  handleLogout: WorkspaceChromePanelsProps["onLogout"];
  handleWorkspaceTabChange: WorkspaceChromePanelsProps["onWorkspaceTabChange"];
};
type BuildDataQualityPropsParams = {
  dataQuality: DataQualityOverviewPanelProps["dataQuality"];
  qualityCards: DataQualityOverviewPanelProps["qualityCards"];
  repairVisualBars: DataQualityOverviewPanelProps["repairVisualBars"];
  repairVisualMax: DataQualityOverviewPanelProps["repairVisualMax"];
  qualityVisualBars: DataQualityOverviewPanelProps["qualityVisualBars"];
  qualityVisualMax: DataQualityOverviewPanelProps["qualityVisualMax"];
  attentionVisualBars: DataQualityOverviewPanelProps["attentionVisualBars"];
  attentionVisualMax: DataQualityOverviewPanelProps["attentionVisualMax"];
  topAttentionServices: DataQualityOverviewPanelProps["topAttentionServices"];
  dataQualityDetails: DataQualityOverviewPanelProps["dataQualityDetails"];
  showQualityDialog: DataQualityOverviewPanelProps["showQualityDialog"];
  activeQualityTab: DataQualityOverviewPanelProps["activeQualityTab"];
  userRole: DataQualityOverviewPanelProps["userRole"];
  setShowQualityDialog: Dispatch<SetStateAction<boolean>>;
  setActiveQualityTab: DataQualityOverviewPanelProps["onQualityTabChange"];
  openQualityRepair: (...args: Parameters<DataQualityOverviewPanelProps["onOpenQualityRepair"]>) => void | Promise<void>;
  openQualityService: (...args: Parameters<DataQualityOverviewPanelProps["onOpenQualityService"]>) => void | Promise<void>;
  openImportConflict: (...args: Parameters<DataQualityOverviewPanelProps["onOpenImportConflict"]>) => void | Promise<void>;
  buildDashboardVisualBarWidth: DataQualityOverviewPanelProps["buildDashboardVisualBarWidth"];
  formatConfidence: DataQualityOverviewPanelProps["formatConfidence"];
  formatMoney: DataQualityOverviewPanelProps["formatMoney"];
  formatQualityVehicle: DataQualityOverviewPanelProps["formatQualityVehicle"];
  statusColor: DataQualityOverviewPanelProps["statusColor"];
  formatDocumentStatusLabel: DataQualityOverviewPanelProps["formatDocumentStatusLabel"];
  formatRepairStatus: DataQualityOverviewPanelProps["formatRepairStatus"];
  formatDateTime: DataQualityOverviewPanelProps["formatDateTime"];
};
type BuildImportConflictDialogPropsParams = {
  showImportConflictDialog: ImportConflictDialogProps["open"];
  importConflictLoading: ImportConflictDialogProps["importConflictLoading"];
  importConflictSaving: ImportConflictDialogProps["importConflictSaving"];
  selectedImportConflict: ImportConflictDialogProps["selectedImportConflict"];
  importConflictComment: ImportConflictDialogProps["importConflictComment"];
  setShowImportConflictDialog: Dispatch<SetStateAction<boolean>>;
  setImportConflictComment: ImportConflictDialogProps["onCommentChange"];
  handleResolveImportConflict: (action: "ignored" | "resolved") => void | Promise<void>;
  formatStatus: ImportConflictDialogProps["formatStatus"];
  formatDateTime: ImportConflictDialogProps["formatDateTime"];
  formatJsonPretty: ImportConflictDialogProps["formatJsonPretty"];
};

export function buildWorkspaceChromeProps(params: BuildWorkspaceChromePropsParams): WorkspaceChromePanelsProps {
  return {
    user: params.user ? { full_name: params.user.full_name, email: params.user.email, role: params.user.role } : null,
    showPasswordChange: params.showPasswordChange,
    currentPasswordValue: params.currentPasswordValue,
    newPasswordValue: params.newPasswordValue,
    passwordChangeLoading: params.passwordChangeLoading,
    errorMessage: params.errorMessage,
    successMessage: params.successMessage,
    bootLoading: params.bootLoading,
    activeWorkspaceTab: params.activeWorkspaceTab,
    documentsCount: params.documents.length,
    selectedRepairId: params.selectedRepair?.id ?? null,
    showTechAdminTab: params.showTechAdminTab,
    vehiclesCount: params.vehicles.length,
    workspaceDescription: params.workspaceTabDescriptions[params.activeWorkspaceTab],
    summary: params.summary,
    summaryCards: params.summaryCards,
    onTogglePasswordChange: () => params.setShowPasswordChange((current: boolean) => !current),
    onCurrentPasswordValueChange: params.setCurrentPasswordValue,
    onNewPasswordValueChange: params.setNewPasswordValue,
    onChangePassword: () => {
      void params.handleChangePassword();
    },
    onCancelPasswordChange: params.cancelPasswordChange,
    onLogout: params.handleLogout,
    onWorkspaceTabChange: params.handleWorkspaceTabChange,
  };
}

export function buildDataQualityProps(params: BuildDataQualityPropsParams): DataQualityOverviewPanelProps {
  return {
    dataQuality: params.dataQuality,
    qualityCards: params.qualityCards,
    repairVisualBars: params.repairVisualBars,
    repairVisualMax: params.repairVisualMax,
    qualityVisualBars: params.qualityVisualBars,
    qualityVisualMax: params.qualityVisualMax,
    attentionVisualBars: params.attentionVisualBars,
    attentionVisualMax: params.attentionVisualMax,
    topAttentionServices: params.topAttentionServices,
    dataQualityDetails: params.dataQualityDetails,
    showQualityDialog: params.showQualityDialog,
    activeQualityTab: params.activeQualityTab,
    userRole: params.userRole,
    onOpenQualityDialog: () => {
      params.setShowQualityDialog(true);
    },
    onCloseQualityDialog: () => {
      params.setShowQualityDialog(false);
    },
    onQualityTabChange: params.setActiveQualityTab,
    onOpenQualityRepair: (documentId, repairId) => {
      params.setShowQualityDialog(false);
      void params.openQualityRepair(documentId, repairId);
    },
    onOpenQualityService: (name) => {
      params.setShowQualityDialog(false);
      void params.openQualityService(name);
    },
    onOpenImportConflict: (conflictId) => {
      void params.openImportConflict(conflictId);
    },
    buildDashboardVisualBarWidth: params.buildDashboardVisualBarWidth,
    formatConfidence: params.formatConfidence,
    formatMoney: params.formatMoney,
    formatQualityVehicle: params.formatQualityVehicle,
    statusColor: params.statusColor,
    formatDocumentStatusLabel: params.formatDocumentStatusLabel,
    formatRepairStatus: params.formatRepairStatus,
    formatDateTime: params.formatDateTime,
  };
}

export function buildImportConflictDialogProps(params: BuildImportConflictDialogPropsParams): ImportConflictDialogProps {
  return {
    open: params.showImportConflictDialog,
    importConflictLoading: params.importConflictLoading,
    importConflictSaving: params.importConflictSaving,
    selectedImportConflict: params.selectedImportConflict,
    importConflictComment: params.importConflictComment,
    onClose: () => {
      if (!params.importConflictSaving) {
        params.setShowImportConflictDialog(false);
      }
    },
    onCommentChange: params.setImportConflictComment,
    onIgnore: () => {
      void params.handleResolveImportConflict("ignored");
    },
    onResolve: () => {
      void params.handleResolveImportConflict("resolved");
    },
    formatStatus: params.formatStatus,
    formatDateTime: params.formatDateTime,
    formatJsonPretty: params.formatJsonPretty,
  };
}
