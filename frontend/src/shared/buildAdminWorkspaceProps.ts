import { type ComponentProps, type Dispatch, type SetStateAction } from "react";
import { WorkspaceAdminPanels } from "../components/WorkspaceAdminPanels";

type WorkspaceAdminPanelsProps = ComponentProps<typeof WorkspaceAdminPanels>;
type AdminWorkspaceProps = WorkspaceAdminPanelsProps["adminWorkspaceProps"];
type TechAdminWorkspaceProps = WorkspaceAdminPanelsProps["techAdminWorkspaceProps"];
type EmployeesProps = WorkspaceAdminPanelsProps["employeesProps"];
type ServicesProps = WorkspaceAdminPanelsProps["servicesProps"];
type BackupsProps = WorkspaceAdminPanelsProps["backupsProps"];
type ReviewRulesProps = WorkspaceAdminPanelsProps["reviewRulesProps"];
type OcrLearningProps = WorkspaceAdminPanelsProps["ocrLearningProps"];
type OcrMatchersProps = WorkspaceAdminPanelsProps["ocrMatchersProps"];
type OcrRulesProps = WorkspaceAdminPanelsProps["ocrRulesProps"];
type HistoricalImportsProps = WorkspaceAdminPanelsProps["historicalImportsProps"];
type LaborNormsProps = WorkspaceAdminPanelsProps["laborNormsProps"];
type SystemStatus = {
  password_recovery_email_configured?: boolean | null;
  ocr_backend: TechAdminWorkspaceProps["ocrBackend"];
  pdf_renderer: TechAdminWorkspaceProps["pdfRenderer"];
  image_ocr_available?: boolean | null;
  pdf_scan_ocr_available?: boolean | null;
};

export type BuildAdminWorkspacePropsParams = {
  activeWorkspaceTab: WorkspaceAdminPanelsProps["activeWorkspaceTab"];
  activeAdminTab: WorkspaceAdminPanelsProps["activeAdminTab"];
  activeTechAdminTab: WorkspaceAdminPanelsProps["activeTechAdminTab"];
  userRole: WorkspaceAdminPanelsProps["userRole"];
  adminTabDescriptions: Record<WorkspaceAdminPanelsProps["activeAdminTab"], AdminWorkspaceProps["description"]>;
  handleAdminTabChange: AdminWorkspaceProps["onAdminTabChange"];
  openTechAdmin: AdminWorkspaceProps["onOpenTechAdmin"];
  techAdminTabDescriptions: Record<WorkspaceAdminPanelsProps["activeTechAdminTab"], TechAdminWorkspaceProps["description"]>;
  systemStatus: SystemStatus | null;
  handleTechAdminTabChange: TechAdminWorkspaceProps["onTechAdminTabChange"];
  closeTechAdmin: TechAdminWorkspaceProps["onCloseTechAdmin"];
  userSearch: EmployeesProps["userSearch"];
  userLoading: EmployeesProps["userLoading"];
  showUserEditor: EmployeesProps["showUserEditor"];
  userForm: EmployeesProps["userForm"];
  userSaving: EmployeesProps["userSaving"];
  usersTotal: EmployeesProps["usersTotal"];
  usersList: EmployeesProps["usersList"];
  selectedManagedUserId: EmployeesProps["selectedManagedUserId"];
  selectedManagedUser: EmployeesProps["selectedManagedUser"];
  adminResetPasswordValue: EmployeesProps["adminResetPasswordValue"];
  userVehicleSearch: EmployeesProps["userVehicleSearch"];
  userVehicleSearchLoading: EmployeesProps["userVehicleSearchLoading"];
  userVehicleSearchResults: EmployeesProps["userVehicleSearchResults"];
  userAssignmentForm: EmployeesProps["userAssignmentForm"];
  userAssignmentSaving: EmployeesProps["userAssignmentSaving"];
  setUserSearch: EmployeesProps["onUserSearchChange"];
  handleUserSearch: () => void | Promise<void>;
  resetUsersSearch: EmployeesProps["onResetUsersSearch"];
  setShowUserEditor: Dispatch<SetStateAction<EmployeesProps["showUserEditor"]>>;
  updateUserFormField: EmployeesProps["onUserFormChange"];
  handleSaveUser: () => void | Promise<void>;
  resetUserEditor: () => void;
  setSelectedManagedUserId: EmployeesProps["onSelectUser"];
  editUser: EmployeesProps["onEditUser"];
  setAdminResetPasswordValue: EmployeesProps["onAdminResetPasswordValueChange"];
  handleAdminResetUserPassword: () => void | Promise<void>;
  setUserVehicleSearch: EmployeesProps["onUserVehicleSearchChange"];
  updateUserAssignmentFormField: EmployeesProps["onUserAssignmentFormChange"];
  handleSearchVehiclesForAssignment: () => void | Promise<void>;
  handleCreateUserAssignment: (vehicleId: Parameters<EmployeesProps["onCreateUserAssignment"]>[0]) => void | Promise<void>;
  handleCloseUserAssignment: (assignment: Parameters<EmployeesProps["onCloseUserAssignment"]>[0]) => void | Promise<void>;
  formatUserRoleLabel: EmployeesProps["formatUserRoleLabel"];
  formatVehicle: EmployeesProps["formatVehicle"];
  formatVehicleTypeLabel: EmployeesProps["formatVehicleTypeLabel"];
  isAssignmentActive: EmployeesProps["isAssignmentActive"];
  serviceQuery: ServicesProps["serviceQuery"];
  serviceCityFilter: ServicesProps["serviceCityFilter"];
  serviceCities: ServicesProps["serviceCities"];
  serviceLoading: ServicesProps["serviceLoading"];
  showServiceEditor: ServicesProps["showServiceEditor"];
  serviceForm: ServicesProps["serviceForm"];
  serviceSaving: ServicesProps["serviceSaving"];
  services: ServicesProps["services"];
  showServiceListDialog: ServicesProps["showServiceListDialog"];
  setServiceQuery: ServicesProps["onServiceQueryChange"];
  setServiceCityFilter: ServicesProps["onServiceCityFilterChange"];
  handleServiceSearch: () => void | Promise<void>;
  resetServicesFilters: ServicesProps["onReset"];
  setShowServiceEditor: Dispatch<SetStateAction<ServicesProps["showServiceEditor"]>>;
  updateServiceFormField: ServicesProps["onServiceFormChange"];
  handleSaveService: () => void | Promise<void>;
  resetServiceEditor: () => void;
  setShowServiceListDialog: Dispatch<SetStateAction<ServicesProps["showServiceListDialog"]>>;
  handleEditService: ServicesProps["onEditService"];
  formatStatus: BackupsProps["formatStatus"] & HistoricalImportsProps["formatStatus"] & LaborNormsProps["formatStatus"];
  backupActionLoading: BackupsProps["backupActionLoading"];
  backupsLoading: BackupsProps["backupsLoading"];
  backups: BackupsProps["backups"];
  backupRestoreDialogOpen: BackupsProps["backupRestoreDialogOpen"];
  backupRestoreTarget: BackupsProps["backupRestoreTarget"];
  backupRestoreConfirmValue: BackupsProps["backupRestoreConfirmValue"];
  handleCreateBackup: () => void | Promise<void>;
  loadBackups: () => void | Promise<void>;
  handleDownloadBackup: (item: Parameters<BackupsProps["onDownloadBackup"]>[0]) => void | Promise<void>;
  openBackupRestoreDialog: BackupsProps["onOpenRestoreDialog"];
  closeBackupRestoreDialog: BackupsProps["onCloseRestoreDialog"];
  setBackupRestoreConfirmValue: BackupsProps["onBackupRestoreConfirmValueChange"];
  handleRestoreBackup: () => void | Promise<void>;
  formatDateTime: BackupsProps["formatDateTime"] & HistoricalImportsProps["formatDateTime"];
  formatFileSize: BackupsProps["formatFileSize"];
  showReviewRuleEditor: ReviewRulesProps["showReviewRuleEditor"];
  reviewRuleForm: ReviewRulesProps["reviewRuleForm"];
  reviewRuleSaving: ReviewRulesProps["reviewRuleSaving"];
  reviewRules: ReviewRulesProps["reviewRules"];
  reviewRuleTypes: ReviewRulesProps["reviewRuleTypes"];
  showReviewRuleListDialog: ReviewRulesProps["showReviewRuleListDialog"];
  openReviewRulesAdmin: () => void;
  setShowReviewRuleEditor: Dispatch<SetStateAction<ReviewRulesProps["showReviewRuleEditor"]>>;
  updateReviewRuleFormField: ReviewRulesProps["onReviewRuleFormChange"];
  handleSaveReviewRule: () => void | Promise<void>;
  resetReviewRuleEditor: () => void;
  setShowReviewRuleListDialog: Dispatch<SetStateAction<ReviewRulesProps["showReviewRuleListDialog"]>>;
  editReviewRule: ReviewRulesProps["onEditReviewRule"];
  formatReviewRuleTypeLabel: ReviewRulesProps["formatReviewRuleTypeLabel"];
  formatReviewBucketLabel: ReviewRulesProps["formatReviewBucketLabel"];
  ocrLearningStatusFilter: OcrLearningProps["ocrLearningStatusFilter"];
  ocrLearningTargetFieldFilter: OcrLearningProps["ocrLearningTargetFieldFilter"];
  ocrLearningProfileScopeFilter: OcrLearningProps["ocrLearningProfileScopeFilter"];
  ocrLearningStatuses: OcrLearningProps["ocrLearningStatuses"];
  ocrLearningTargetFields: OcrLearningProps["ocrLearningTargetFields"];
  ocrLearningProfileScopes: OcrLearningProps["ocrLearningProfileScopes"];
  ocrLearningLoading: OcrLearningProps["ocrLearningLoading"];
  ocrLearningSummaries: OcrLearningProps["ocrLearningSummaries"];
  ocrLearningSignals: OcrLearningProps["ocrLearningSignals"];
  showOcrLearningListDialog: OcrLearningProps["showOcrLearningListDialog"];
  ocrLearningDraftId: OcrLearningProps["ocrLearningDraftId"];
  ocrLearningUpdateId: OcrLearningProps["ocrLearningUpdateId"];
  setOcrLearningStatusFilter: OcrLearningProps["onOcrLearningStatusFilterChange"];
  setOcrLearningTargetFieldFilter: OcrLearningProps["onOcrLearningTargetFieldFilterChange"];
  setOcrLearningProfileScopeFilter: OcrLearningProps["onOcrLearningProfileScopeFilterChange"];
  token: string | null | undefined;
  loadOcrLearningSignals: (
    statusFilter?: OcrLearningProps["ocrLearningStatusFilter"],
    targetFieldFilter?: OcrLearningProps["ocrLearningTargetFieldFilter"],
    profileScopeFilter?: OcrLearningProps["ocrLearningProfileScopeFilter"],
  ) => void | Promise<void>;
  setShowOcrLearningListDialog: Dispatch<SetStateAction<OcrLearningProps["showOcrLearningListDialog"]>>;
  handleLoadOcrLearningDraft: (
    signalId: Parameters<OcrLearningProps["onLoadDraft"]>[0],
    draftType: Parameters<OcrLearningProps["onLoadDraft"]>[1],
  ) => void | Promise<void>;
  handleUpdateOcrLearningSignal: (
    signalId: Parameters<OcrLearningProps["onUpdateSignalStatus"]>[0],
    nextStatus: Parameters<OcrLearningProps["onUpdateSignalStatus"]>[1],
  ) => void | Promise<void>;
  formatOcrLearningStatusLabel: OcrLearningProps["formatOcrLearningStatusLabel"];
  formatOcrProfileName: OcrLearningProps["formatOcrProfileName"] & OcrMatchersProps["formatOcrProfileName"] & OcrRulesProps["formatOcrProfileName"];
  formatOcrFieldLabel: OcrLearningProps["formatOcrFieldLabel"] & OcrRulesProps["formatOcrFieldLabel"];
  formatOcrSignalTypeLabel: OcrLearningProps["formatOcrSignalTypeLabel"];
  ocrProfileMatcherProfileFilter: OcrMatchersProps["ocrProfileMatcherProfileFilter"];
  ocrProfileMatcherProfiles: OcrMatchersProps["ocrProfileMatcherProfiles"];
  ocrProfileMatchers: OcrMatchersProps["ocrProfileMatchers"];
  ocrProfileMatcherForm: OcrMatchersProps["ocrProfileMatcherForm"];
  ocrProfileMatcherSaving: OcrMatchersProps["ocrProfileMatcherSaving"];
  setOcrProfileMatcherProfileFilter: OcrMatchersProps["onProfileFilterChange"];
  loadOcrProfileMatchers: (profileFilter?: OcrMatchersProps["ocrProfileMatcherProfileFilter"]) => void | Promise<void>;
  updateOcrProfileMatcherFormField: OcrMatchersProps["onFormChange"];
  handleSaveOcrProfileMatcher: () => void | Promise<void>;
  resetOcrProfileMatcherEditor: OcrMatchersProps["onResetForm"];
  editOcrProfileMatcher: OcrMatchersProps["onEdit"];
  formatSourceTypeLabel: OcrMatchersProps["formatSourceTypeLabel"];
  ocrRuleProfileFilter: OcrRulesProps["ocrRuleProfileFilter"];
  ocrRuleProfiles: OcrRulesProps["ocrRuleProfiles"];
  ocrRuleTargetFields: OcrRulesProps["ocrRuleTargetFields"];
  ocrRules: OcrRulesProps["ocrRules"];
  ocrRuleForm: OcrRulesProps["ocrRuleForm"];
  ocrRuleSaving: OcrRulesProps["ocrRuleSaving"];
  setOcrRuleProfileFilter: OcrRulesProps["onProfileFilterChange"];
  loadOcrRules: (profileFilter?: OcrRulesProps["ocrRuleProfileFilter"]) => void | Promise<void>;
  updateOcrRuleFormField: OcrRulesProps["onFormChange"];
  handleSaveOcrRule: () => void | Promise<void>;
  resetOcrRuleEditor: OcrRulesProps["onResetForm"];
  editOcrRule: OcrRulesProps["onEdit"];
  formatValueParserLabel: OcrRulesProps["formatValueParserLabel"];
  historicalImportLoading: HistoricalImportsProps["historicalImportLoading"];
  historicalImportFile: HistoricalImportsProps["historicalImportFile"];
  historicalImportLimit: HistoricalImportsProps["historicalImportLimit"];
  historicalImportResult: HistoricalImportsProps["historicalImportResult"];
  historicalImportJobs: HistoricalImportsProps["historicalImportJobs"];
  historicalImportJobsLoading: HistoricalImportsProps["historicalImportJobsLoading"];
  historicalWorkReference: HistoricalImportsProps["historicalWorkReference"];
  historicalWorkReferenceLoading: HistoricalImportsProps["historicalWorkReferenceLoading"];
  historicalWorkReferenceTotal: HistoricalImportsProps["historicalWorkReferenceTotal"];
  historicalWorkReferenceQuery: HistoricalImportsProps["historicalWorkReferenceQuery"];
  historicalWorkReferenceMinSamples: HistoricalImportsProps["historicalWorkReferenceMinSamples"];
  importConflicts: HistoricalImportsProps["importConflicts"];
  importConflictsLoading: HistoricalImportsProps["importConflictsLoading"];
  setHistoricalImportFile: HistoricalImportsProps["onHistoricalImportFileChange"];
  setHistoricalImportLimit: HistoricalImportsProps["onHistoricalImportLimitChange"];
  handleHistoricalRepairImport: () => void | Promise<void>;
  refreshHistoricalImportsJournal: () => void | Promise<void>;
  openRepairByIds: (
    documentId: number | null,
    repairId: Parameters<HistoricalImportsProps["onOpenImportedRepair"]>[0],
  ) => void | Promise<void>;
  setHistoricalWorkReferenceQuery: HistoricalImportsProps["onHistoricalWorkReferenceQueryChange"];
  setHistoricalWorkReferenceMinSamples: HistoricalImportsProps["onHistoricalWorkReferenceMinSamplesChange"];
  loadHistoricalWorkReference: () => void | Promise<void>;
  openImportConflict: HistoricalImportsProps["onOpenImportConflict"];
  formatMoney: HistoricalImportsProps["formatMoney"];
  formatCompactNumber: HistoricalImportsProps["formatCompactNumber"];
  formatHours: HistoricalImportsProps["formatHours"] & LaborNormsProps["formatHours"];
  formatDateValue: HistoricalImportsProps["formatDateValue"];
  showLaborNormCatalogEditor: LaborNormsProps["showLaborNormCatalogEditor"];
  showLaborNormImport: LaborNormsProps["showLaborNormImport"];
  showLaborNormEntryEditor: LaborNormsProps["showLaborNormEntryEditor"];
  editingLaborNormCatalogId: LaborNormsProps["editingLaborNormCatalogId"];
  laborNormCatalogForm: LaborNormsProps["laborNormCatalogForm"];
  laborNormCatalogSaving: LaborNormsProps["laborNormCatalogSaving"];
  laborNormCatalogs: LaborNormsProps["laborNormCatalogs"];
  laborNormQuery: LaborNormsProps["laborNormQuery"];
  laborNormScope: LaborNormsProps["laborNormScope"];
  laborNormScopes: LaborNormsProps["laborNormScopes"];
  laborNormCategory: LaborNormsProps["laborNormCategory"];
  laborNormCategories: LaborNormsProps["laborNormCategories"];
  laborNormLoading: LaborNormsProps["laborNormLoading"];
  laborNormImportScope: LaborNormsProps["laborNormImportScope"];
  laborNormImportBrandFamily: LaborNormsProps["laborNormImportBrandFamily"];
  laborNormImportCatalogName: LaborNormsProps["laborNormImportCatalogName"];
  laborNormFile: LaborNormsProps["laborNormFile"];
  laborNormImportLoading: LaborNormsProps["laborNormImportLoading"];
  laborNormEntryForm: LaborNormsProps["laborNormEntryForm"];
  laborNormEntrySaving: LaborNormsProps["laborNormEntrySaving"];
  laborNormTotal: LaborNormsProps["laborNormTotal"];
  laborNormSourceFiles: LaborNormsProps["laborNormSourceFiles"];
  showLaborNormListDialog: LaborNormsProps["showLaborNormListDialog"];
  laborNorms: LaborNormsProps["laborNorms"];
  openLaborNormsAdmin: () => void;
  setShowLaborNormCatalogEditor: Dispatch<SetStateAction<LaborNormsProps["showLaborNormCatalogEditor"]>>;
  setShowLaborNormImport: Dispatch<SetStateAction<LaborNormsProps["showLaborNormImport"]>>;
  setShowLaborNormEntryEditor: Dispatch<SetStateAction<LaborNormsProps["showLaborNormEntryEditor"]>>;
  updateLaborNormCatalogFormField: LaborNormsProps["onCatalogFormChange"];
  handleSaveLaborNormCatalog: () => void | Promise<void>;
  resetLaborNormCatalogEditor: () => void;
  editLaborNormCatalog: LaborNormsProps["onEditCatalog"];
  selectCatalogScope: LaborNormsProps["onSelectCatalogScope"];
  setLaborNormQuery: LaborNormsProps["onQueryChange"];
  setLaborNormScope: LaborNormsProps["onScopeChange"];
  setLaborNormCategory: LaborNormsProps["onCategoryChange"];
  handleLaborNormSearch: () => void | Promise<void>;
  resetLaborNormFilters: LaborNormsProps["onResetFilters"];
  setLaborNormImportBrandFamily: LaborNormsProps["onImportBrandFamilyChange"];
  setLaborNormImportCatalogName: LaborNormsProps["onImportCatalogNameChange"];
  setLaborNormFile: LaborNormsProps["onImportFileChange"];
  handleLaborNormImport: () => void | Promise<void>;
  updateLaborNormEntryFormField: LaborNormsProps["onEntryFormChange"];
  handleSaveLaborNormEntry: () => void | Promise<void>;
  resetLaborNormEntryEditor: () => void;
  setShowLaborNormListDialog: Dispatch<SetStateAction<LaborNormsProps["showLaborNormListDialog"]>>;
  editLaborNormItem: LaborNormsProps["onEditItem"];
  handleArchiveLaborNormItem: (item: Parameters<LaborNormsProps["onArchiveItem"]>[0]) => void | Promise<void>;
  formatCatalogCodeLabel: LaborNormsProps["formatCatalogCodeLabel"];
};

export function buildAdminWorkspaceProps(params: BuildAdminWorkspacePropsParams): WorkspaceAdminPanelsProps {
  return {
    activeWorkspaceTab: params.activeWorkspaceTab,
    activeAdminTab: params.activeAdminTab,
    activeTechAdminTab: params.activeTechAdminTab,
    userRole: params.userRole,
    adminWorkspaceProps: {
      activeAdminTab: params.activeAdminTab,
      description: params.adminTabDescriptions[params.activeAdminTab],
      onAdminTabChange: params.handleAdminTabChange,
      onOpenTechAdmin: params.openTechAdmin,
    },
    techAdminWorkspaceProps: {
      activeTechAdminTab: params.activeTechAdminTab,
      description: params.techAdminTabDescriptions[params.activeTechAdminTab],
      isPasswordRecoveryEmailConfigured: Boolean(params.systemStatus?.password_recovery_email_configured),
      ocrBackend: params.systemStatus?.ocr_backend,
      pdfRenderer: params.systemStatus?.pdf_renderer,
      isImageOcrAvailable: Boolean(params.systemStatus?.image_ocr_available),
      isPdfScanOcrAvailable: Boolean(params.systemStatus?.pdf_scan_ocr_available),
      onTechAdminTabChange: params.handleTechAdminTabChange,
      onCloseTechAdmin: params.closeTechAdmin,
    },
    employeesProps: {
      userSearch: params.userSearch,
      userLoading: params.userLoading,
      showUserEditor: params.showUserEditor,
      userForm: params.userForm,
      userSaving: params.userSaving,
      usersTotal: params.usersTotal,
      usersList: params.usersList,
      selectedManagedUserId: params.selectedManagedUserId,
      selectedManagedUser: params.selectedManagedUser,
      adminResetPasswordValue: params.adminResetPasswordValue,
      userVehicleSearch: params.userVehicleSearch,
      userVehicleSearchLoading: params.userVehicleSearchLoading,
      userVehicleSearchResults: params.userVehicleSearchResults,
      userAssignmentForm: params.userAssignmentForm,
      userAssignmentSaving: params.userAssignmentSaving,
      onUserSearchChange: params.setUserSearch,
      onRefreshUsers: () => {
        void params.handleUserSearch();
      },
      onResetUsersSearch: () => {
        void params.resetUsersSearch();
      },
      onToggleUserEditor: () => {
        params.setShowUserEditor((current) => !current);
      },
      onUserFormChange: params.updateUserFormField,
      onSaveUser: () => {
        void params.handleSaveUser();
      },
      onResetUserForm: () => {
        params.resetUserEditor();
        params.setShowUserEditor(false);
      },
      onSelectUser: params.setSelectedManagedUserId,
      onEditUser: params.editUser,
      onAdminResetPasswordValueChange: params.setAdminResetPasswordValue,
      onAdminResetUserPassword: () => {
        void params.handleAdminResetUserPassword();
      },
      onUserVehicleSearchChange: params.setUserVehicleSearch,
      onUserAssignmentFormChange: params.updateUserAssignmentFormField,
      onSearchVehiclesForAssignment: () => {
        void params.handleSearchVehiclesForAssignment();
      },
      onCreateUserAssignment: (vehicleId) => {
        void params.handleCreateUserAssignment(vehicleId);
      },
      onCloseUserAssignment: (assignment) => {
        void params.handleCloseUserAssignment(assignment);
      },
      formatUserRoleLabel: params.formatUserRoleLabel,
      formatVehicle: params.formatVehicle,
      formatVehicleTypeLabel: params.formatVehicleTypeLabel,
      isAssignmentActive: params.isAssignmentActive,
    },
    servicesProps: {
      serviceQuery: params.serviceQuery,
      serviceCityFilter: params.serviceCityFilter,
      serviceCities: params.serviceCities,
      serviceLoading: params.serviceLoading,
      showServiceEditor: params.showServiceEditor,
      serviceForm: params.serviceForm,
      serviceSaving: params.serviceSaving,
      services: params.services,
      showServiceListDialog: params.showServiceListDialog,
      onServiceQueryChange: params.setServiceQuery,
      onServiceCityFilterChange: params.setServiceCityFilter,
      onRefresh: () => {
        void params.handleServiceSearch();
      },
      onReset: () => {
        void params.resetServicesFilters();
      },
      onToggleEditor: () => {
        params.setShowServiceEditor((current) => !current);
      },
      onServiceFormChange: params.updateServiceFormField,
      onSaveService: () => {
        void params.handleSaveService();
      },
      onResetEditor: () => {
        params.resetServiceEditor();
        params.setShowServiceEditor(false);
      },
      onOpenListDialog: () => {
        params.setShowServiceListDialog(true);
      },
      onCloseListDialog: () => {
        params.setShowServiceListDialog(false);
      },
      onEditService: params.handleEditService,
      formatStatus: params.formatStatus,
    },
    backupsProps: {
      backupActionLoading: params.backupActionLoading,
      backupsLoading: params.backupsLoading,
      backups: params.backups,
      backupRestoreDialogOpen: params.backupRestoreDialogOpen,
      backupRestoreTarget: params.backupRestoreTarget,
      backupRestoreConfirmValue: params.backupRestoreConfirmValue,
      onCreateBackup: () => {
        void params.handleCreateBackup();
      },
      onRefresh: () => {
        void params.loadBackups();
      },
      onDownloadBackup: (item) => {
        void params.handleDownloadBackup(item);
      },
      onOpenRestoreDialog: params.openBackupRestoreDialog,
      onCloseRestoreDialog: params.closeBackupRestoreDialog,
      onBackupRestoreConfirmValueChange: params.setBackupRestoreConfirmValue,
      onRestoreBackup: () => {
        void params.handleRestoreBackup();
      },
      formatStatus: params.formatStatus,
      formatDateTime: params.formatDateTime,
      formatFileSize: params.formatFileSize,
    },
    reviewRulesProps: {
      showReviewRuleEditor: params.showReviewRuleEditor,
      reviewRuleForm: params.reviewRuleForm,
      reviewRuleSaving: params.reviewRuleSaving,
      reviewRules: params.reviewRules,
      reviewRuleTypes: params.reviewRuleTypes,
      showReviewRuleListDialog: params.showReviewRuleListDialog,
      onToggleEditor: () => {
        params.openReviewRulesAdmin();
        params.setShowReviewRuleEditor((current) => !current);
      },
      onReviewRuleFormChange: params.updateReviewRuleFormField,
      onSaveReviewRule: () => {
        void params.handleSaveReviewRule();
      },
      onResetReviewRuleEditor: () => {
        params.resetReviewRuleEditor();
        params.setShowReviewRuleEditor(false);
      },
      onOpenListDialog: () => {
        params.setShowReviewRuleListDialog(true);
      },
      onCloseListDialog: () => {
        params.setShowReviewRuleListDialog(false);
      },
      onEditReviewRule: params.editReviewRule,
      formatReviewRuleTypeLabel: params.formatReviewRuleTypeLabel,
      formatReviewBucketLabel: params.formatReviewBucketLabel,
    },
    ocrLearningProps: {
      ocrLearningStatusFilter: params.ocrLearningStatusFilter,
      ocrLearningTargetFieldFilter: params.ocrLearningTargetFieldFilter,
      ocrLearningProfileScopeFilter: params.ocrLearningProfileScopeFilter,
      ocrLearningStatuses: params.ocrLearningStatuses,
      ocrLearningTargetFields: params.ocrLearningTargetFields,
      ocrLearningProfileScopes: params.ocrLearningProfileScopes,
      ocrLearningLoading: params.ocrLearningLoading,
      ocrLearningSummaries: params.ocrLearningSummaries,
      ocrLearningSignals: params.ocrLearningSignals,
      showOcrLearningListDialog: params.showOcrLearningListDialog,
      ocrLearningDraftId: params.ocrLearningDraftId,
      ocrLearningUpdateId: params.ocrLearningUpdateId,
      onOcrLearningStatusFilterChange: params.setOcrLearningStatusFilter,
      onOcrLearningTargetFieldFilterChange: params.setOcrLearningTargetFieldFilter,
      onOcrLearningProfileScopeFilterChange: params.setOcrLearningProfileScopeFilter,
      onRefresh: () => {
        if (params.token) {
          void params.loadOcrLearningSignals();
        }
      },
      onReset: () => {
        params.setOcrLearningStatusFilter("");
        params.setOcrLearningTargetFieldFilter("");
        params.setOcrLearningProfileScopeFilter("");
        if (params.token) {
          void params.loadOcrLearningSignals("", "", "");
        }
      },
      onOpenListDialog: () => {
        params.setShowOcrLearningListDialog(true);
      },
      onCloseListDialog: () => {
        params.setShowOcrLearningListDialog(false);
      },
      onLoadDraft: (signalId, draftType) => {
        void params.handleLoadOcrLearningDraft(signalId, draftType);
      },
      onUpdateSignalStatus: (signalId, nextStatus) => {
        void params.handleUpdateOcrLearningSignal(signalId, nextStatus);
      },
      formatOcrLearningStatusLabel: params.formatOcrLearningStatusLabel,
      formatOcrProfileName: params.formatOcrProfileName,
      formatOcrFieldLabel: params.formatOcrFieldLabel,
      formatOcrSignalTypeLabel: params.formatOcrSignalTypeLabel,
    },
    ocrMatchersProps: {
      ocrProfileMatcherProfileFilter: params.ocrProfileMatcherProfileFilter,
      ocrProfileMatcherProfiles: params.ocrProfileMatcherProfiles,
      ocrProfileMatchers: params.ocrProfileMatchers,
      ocrProfileMatcherForm: params.ocrProfileMatcherForm,
      ocrProfileMatcherSaving: params.ocrProfileMatcherSaving,
      onProfileFilterChange: params.setOcrProfileMatcherProfileFilter,
      onRefresh: () => {
        if (params.token) {
          void params.loadOcrProfileMatchers();
        }
      },
      onResetFilter: () => {
        params.setOcrProfileMatcherProfileFilter("");
        if (params.token) {
          void params.loadOcrProfileMatchers("");
        }
      },
      onFormChange: params.updateOcrProfileMatcherFormField,
      onSave: () => {
        void params.handleSaveOcrProfileMatcher();
      },
      onResetForm: params.resetOcrProfileMatcherEditor,
      onEdit: params.editOcrProfileMatcher,
      formatOcrProfileName: params.formatOcrProfileName,
      formatSourceTypeLabel: params.formatSourceTypeLabel,
    },
    ocrRulesProps: {
      ocrRuleProfileFilter: params.ocrRuleProfileFilter,
      ocrRuleProfiles: params.ocrRuleProfiles,
      ocrRuleTargetFields: params.ocrRuleTargetFields,
      ocrRules: params.ocrRules,
      ocrRuleForm: params.ocrRuleForm,
      ocrRuleSaving: params.ocrRuleSaving,
      onProfileFilterChange: params.setOcrRuleProfileFilter,
      onRefresh: () => {
        if (params.token) {
          void params.loadOcrRules();
        }
      },
      onResetFilter: () => {
        params.setOcrRuleProfileFilter("");
        if (params.token) {
          void params.loadOcrRules("");
        }
      },
      onFormChange: params.updateOcrRuleFormField,
      onSave: () => {
        void params.handleSaveOcrRule();
      },
      onResetForm: params.resetOcrRuleEditor,
      onEdit: params.editOcrRule,
      formatOcrProfileName: params.formatOcrProfileName,
      formatOcrFieldLabel: params.formatOcrFieldLabel,
      formatValueParserLabel: params.formatValueParserLabel,
    },
    historicalImportsProps: {
      historicalImportLoading: params.historicalImportLoading,
      historicalImportFile: params.historicalImportFile,
      historicalImportLimit: params.historicalImportLimit,
      historicalImportResult: params.historicalImportResult,
      historicalImportJobs: params.historicalImportJobs,
      historicalImportJobsLoading: params.historicalImportJobsLoading,
      historicalWorkReference: params.historicalWorkReference,
      historicalWorkReferenceLoading: params.historicalWorkReferenceLoading,
      historicalWorkReferenceTotal: params.historicalWorkReferenceTotal,
      historicalWorkReferenceQuery: params.historicalWorkReferenceQuery,
      historicalWorkReferenceMinSamples: params.historicalWorkReferenceMinSamples,
      importConflicts: params.importConflicts,
      importConflictsLoading: params.importConflictsLoading,
      canRefreshJournal:
        !(params.historicalImportJobsLoading || params.historicalWorkReferenceLoading || params.importConflictsLoading)
        && !!params.token,
      onHistoricalImportFileChange: params.setHistoricalImportFile,
      onHistoricalImportLimitChange: params.setHistoricalImportLimit,
      onStartHistoricalImport: () => {
        void params.handleHistoricalRepairImport();
      },
      onRefreshJournal: () => {
        void params.refreshHistoricalImportsJournal();
      },
      onOpenImportedRepair: (repairId) => {
        void params.openRepairByIds(null, repairId);
      },
      onHistoricalWorkReferenceQueryChange: params.setHistoricalWorkReferenceQuery,
      onHistoricalWorkReferenceMinSamplesChange: params.setHistoricalWorkReferenceMinSamples,
      onRefreshHistoricalWorkReference: () => {
        void params.loadHistoricalWorkReference();
      },
      onOpenImportConflict: (conflictId) => {
        void params.openImportConflict(conflictId);
      },
      formatStatus: params.formatStatus,
      formatMoney: params.formatMoney,
      formatCompactNumber: params.formatCompactNumber,
      formatHours: params.formatHours,
      formatDateValue: params.formatDateValue,
      formatDateTime: params.formatDateTime,
    },
    laborNormsProps: {
      showLaborNormCatalogEditor: params.showLaborNormCatalogEditor,
      showLaborNormImport: params.showLaborNormImport,
      showLaborNormEntryEditor: params.showLaborNormEntryEditor,
      editingLaborNormCatalogId: params.editingLaborNormCatalogId,
      laborNormCatalogForm: params.laborNormCatalogForm,
      laborNormCatalogSaving: params.laborNormCatalogSaving,
      laborNormCatalogs: params.laborNormCatalogs,
      laborNormQuery: params.laborNormQuery,
      laborNormScope: params.laborNormScope,
      laborNormScopes: params.laborNormScopes,
      laborNormCategory: params.laborNormCategory,
      laborNormCategories: params.laborNormCategories,
      laborNormLoading: params.laborNormLoading,
      laborNormImportScope: params.laborNormImportScope,
      laborNormImportBrandFamily: params.laborNormImportBrandFamily,
      laborNormImportCatalogName: params.laborNormImportCatalogName,
      laborNormFile: params.laborNormFile,
      laborNormImportLoading: params.laborNormImportLoading,
      laborNormEntryForm: params.laborNormEntryForm,
      laborNormEntrySaving: params.laborNormEntrySaving,
      laborNormTotal: params.laborNormTotal,
      laborNormSourceFiles: params.laborNormSourceFiles,
      showLaborNormListDialog: params.showLaborNormListDialog,
      laborNorms: params.laborNorms,
      onToggleCatalogEditor: () => {
        params.openLaborNormsAdmin();
        params.setShowLaborNormCatalogEditor((current) => !current);
      },
      onToggleImport: () => {
        params.openLaborNormsAdmin();
        params.setShowLaborNormImport((current) => !current);
      },
      onToggleEntryEditor: () => {
        params.openLaborNormsAdmin();
        params.setShowLaborNormEntryEditor((current) => !current);
      },
      onCatalogFormChange: params.updateLaborNormCatalogFormField,
      onSaveCatalog: () => {
        void params.handleSaveLaborNormCatalog();
      },
      onResetCatalogForm: () => {
        params.resetLaborNormCatalogEditor();
        params.setShowLaborNormCatalogEditor(false);
      },
      onEditCatalog: params.editLaborNormCatalog,
      onSelectCatalogScope: params.selectCatalogScope,
      onQueryChange: params.setLaborNormQuery,
      onScopeChange: params.setLaborNormScope,
      onCategoryChange: params.setLaborNormCategory,
      onSearch: () => {
        void params.handleLaborNormSearch();
      },
      onResetFilters: () => {
        void params.resetLaborNormFilters();
      },
      onImportBrandFamilyChange: params.setLaborNormImportBrandFamily,
      onImportCatalogNameChange: params.setLaborNormImportCatalogName,
      onImportFileChange: params.setLaborNormFile,
      onImport: () => {
        void params.handleLaborNormImport();
      },
      onEntryFormChange: params.updateLaborNormEntryFormField,
      onSaveEntry: () => {
        void params.handleSaveLaborNormEntry();
      },
      onResetEntryForm: () => {
        params.resetLaborNormEntryEditor();
        params.setShowLaborNormEntryEditor(false);
      },
      onOpenListDialog: () => {
        params.setShowLaborNormListDialog(true);
      },
      onCloseListDialog: () => {
        params.setShowLaborNormListDialog(false);
      },
      onEditItem: params.editLaborNormItem,
      onArchiveItem: (item) => {
        void params.handleArchiveLaborNormItem(item);
      },
      formatCatalogCodeLabel: params.formatCatalogCodeLabel,
      formatStatus: params.formatStatus,
      formatHours: params.formatHours,
    },
  };
}
