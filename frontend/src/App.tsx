import { useEffect, useRef, useState } from "react";
import {
  buildUserPayload,
} from "./shared/adminPayloadBuilders";
import { MenuItem } from "@mui/material";
import { AuthLandingView } from "./components/AuthLandingView";
import { HistoryDetailsPreview } from "./components/HistoryDetailsPreview";
import { WorkspaceMainView } from "./components/WorkspaceMainView";
import { useAppNavigation } from "./hooks/useAppNavigation";
import { useAuthSession } from "./hooks/useAuthSession";
import { useBackupsAdmin } from "./hooks/useBackupsAdmin";
import { useDocumentsWorkspace } from "./hooks/useDocumentsWorkspace";
import { useEmployeesAdmin } from "./hooks/useEmployeesAdmin";
import { useLaborNormsAdmin } from "./hooks/useLaborNormsAdmin";
import { useOcrAdmin } from "./hooks/useOcrAdmin";
import { useReviewRulesAdmin } from "./hooks/useReviewRulesAdmin";
import { useRepairDerivedViewModel } from "./hooks/useRepairDerivedViewModel";
import { useRepairDetailLoader } from "./hooks/useRepairDetailLoader";
import { useRepairDocumentsWorkflow } from "./hooks/useRepairDocumentsWorkflow";
import { useRepairEditingWorkflow } from "./hooks/useRepairEditingWorkflow";
import { useRepairHistoryFilters } from "./hooks/useRepairHistoryFilters";
import { useRepairWorkspaceActions } from "./hooks/useRepairWorkspaceActions";
import { useFleetWorkspace } from "./hooks/useFleetWorkspace";
import { useHistoricalImportsAdmin } from "./hooks/useHistoricalImportsAdmin";
import { useRepairReviewWorkflow } from "./hooks/useRepairReviewWorkflow";
import { useServicesAdmin } from "./hooks/useServicesAdmin";
import { useWorkspaceDataLifecycle } from "./hooks/useWorkspaceDataLifecycle";
import { useWorkspaceOperations } from "./hooks/useWorkspaceOperations";
import {
  createVehicleFormFromPayload,
  formatQualityVehicle,
  formatVehicle,
  inferVehicleTypeFromIdentifiers,
  isAssignmentActive,
  isPlaceholderVehicle,
} from "./shared/fleetDocumentHelpers";
import {
  buildDashboardVisualBarWidth,
} from "./shared/dashboardVisuals";
import { type AdminTab, type AppRoute, type RepairTab, type TechAdminTab, type WorkspaceTab } from "./shared/appRoute";
import {
  buildAuditEntryDetails,
  buildDocumentHistoryDetails,
  buildRepairHistoryDetails,
  type HistoryDetailFormatters,
} from "./shared/historyDetails";
import {
  buildCheckPayloadDetails,
  formatOcrLineUnit,
  formatWorkLaborNormMeta,
  getCheckLinkedRepairId,
  readCheckResolutionMeta,
  readComparisonReviewMeta,
  readNumberValue,
  readStringValue,
} from "./shared/repairReportHelpers";
import {
  checkSeverityColor,
  documentHasActiveImportJob,
  executiveRiskColor,
  formatAuditEntityLabel,
  formatCatalogCodeLabel,
  formatCompactNumber,
  formatConfidence,
  formatConfidenceLabel,
  formatDateTime,
  formatDateValue,
  formatDocumentKind,
  formatDocumentStatusLabel,
  formatExecutiveRiskLabel,
  formatFileSize,
  formatHistoryActionLabel,
  formatHours,
  formatJsonPretty,
  formatLaborNormApplicability,
  formatManualReviewReasons,
  formatMoney,
  formatOcrFieldLabel,
  formatOcrLearningStatusLabel,
  formatOcrProfileMeta,
  formatOcrProfileName,
  formatOcrSignalTypeLabel,
  formatRepairStatus,
  formatReviewBucketLabel,
  formatReviewPriority,
  formatReviewRuleTypeLabel,
  formatSourceTypeLabel,
  formatStatus,
  formatUserRoleLabel,
  formatValueParserLabel,
  formatVehicleStatusLabel,
  formatVehicleTypeLabel,
  getConfidenceColor,
  importJobStatusColor,
  isDocumentAwaitingOcr,
  readOcrProfileMeta,
  reviewPriorityColor,
  statusColor,
  vehicleStatusColor,
} from "./shared/displayFormatters";
import {
  createEmptyDocumentVehicleForm,
  createEmptyUserAssignmentForm,
  createEmptyUserForm,
  createServiceFormFromItem,
  createUserFormFromItem,
} from "./shared/formStateFactories";
import {
  adminTabDescriptions,
  documentKindOptions,
  historyFilters,
  qualityCards,
  repairTabDescriptions,
  reviewQueueFilters,
  rootDocumentKindOptions,
  summaryCards,
  techAdminTabDescriptions,
  VEHICLES_FULL_LIST_LIMIT,
  workspaceTabDescriptions,
  workspaceTabReturnLabels,
} from "./shared/appUiConfig";
import {
  buildAuditLogQueryString,
  buildServiceQueryString,
  buildUsersQueryString,
} from "./shared/queryBuilders";
import {
  getReviewComparisonColor,
  getReviewComparisonLabel,
  resolveRepairDocumentId,
  type ReviewComparisonStatus,
} from "./shared/repairUiHelpers";
import type {
  HistoricalRepairImportResponse,
  HistoricalWorkReferenceItem,
  HistoricalWorkReferenceResponse,
  ImportConflictItem,
  ImportConflictResolveResponse,
  ImportConflictsResponse,
  ImportJobItem,
  ImportJobsResponse,
} from "./shared/importAdminTypes";
import type {
  DashboardDataQuality,
  DashboardDataQualityDetails,
  DashboardSummary,
  DocumentItem,
  DocumentKind,
  DocumentStatus,
  GlobalSearchResponse,
  ImportJobStatus,
  ReviewQueueCategory,
  ReviewQueueItem,
  ReviewQueueResponse,
  ServiceStatus,
  ServicesResponse,
  User,
  UserAssignment,
  UserItem,
  UserRole,
  UsersResponse,
  Vehicle,
} from "./shared/workspaceBootstrapTypes";
import type {
  DocumentVehicleFormState,
  ReviewRepairFieldsDraft,
  ServiceFormState,
  UploadFormState,
  UserAssignmentFormState,
  UserFormState,
} from "./shared/workspaceFormTypes";

type HistoryFilter = "all" | "repair" | "documents" | "uploads" | "primary" | "comparison";
type QualityDetailTab = "documents" | "services" | "works" | "parts" | "conflicts";

type CheckSeverity = "normal" | "warning" | "suspicious" | "error";

type RepairDetail = {
  id: number;
  order_number: string | null;
  repair_date: string;
  mileage: number;
  reason: string | null;
  employee_comment: string | null;
  work_total: number;
  parts_total: number;
  vat_total: number;
  grand_total: number;
  expected_total: number | null;
  status: string;
  is_preliminary: boolean;
  is_partially_recognized: boolean;
  is_manually_completed: boolean;
  created_at: string;
  updated_at: string;
  vehicle: {
    id: number;
    external_id: string | null;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  };
  service: {
    id: number;
    name: string;
    city: string | null;
  } | null;
  works: Array<{
    id: number;
    work_code: string | null;
    work_name: string;
    quantity: number;
    standard_hours: number | null;
    actual_hours: number | null;
    price: number;
    line_total: number;
    status: string;
    reference_payload: Record<string, unknown> | null;
  }>;
  parts: Array<{
    id: number;
    article: string | null;
    part_name: string;
    quantity: number;
    unit_name: string | null;
    price: number;
    line_total: number;
    status: string;
  }>;
  checks: Array<{
    id: number;
    check_type: string;
    severity: CheckSeverity;
    title: string;
    details: string | null;
    calculation_payload: Record<string, unknown> | null;
    is_resolved: boolean;
    created_at: string;
  }>;
  documents: Array<{
    id: number;
    original_filename: string;
    source_type: string;
    kind: DocumentKind;
    mime_type: string | null;
    status: string;
    is_primary: boolean;
    ocr_confidence: number | null;
    review_queue_priority: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
    latest_import_job?: {
      id: number;
      status: ImportJobStatus;
      error_message?: string | null;
      attempts: number;
      started_at?: string | null;
      finished_at?: string | null;
      created_at: string;
      updated_at: string;
    } | null;
    versions: Array<{
      id: number;
      version_number: number;
      created_at: string;
      change_summary: string | null;
      parsed_payload: Record<string, unknown> | null;
      field_confidence_map: Record<string, unknown> | null;
    }>;
  }>;
  document_history: Array<{
    id: number;
    action_type: string;
    created_at: string;
    user_name: string | null;
    document_id: number | null;
    document_filename: string | null;
    document_kind: DocumentKind | null;
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
  }>;
  history: Array<{
    id: number;
    action_type: string;
    created_at: string;
    user_name: string | null;
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
  }>;
  executive_report: {
    headline: string;
    summary: string;
    status: string;
    overall_risk: "low" | "medium" | "high";
    highlights: string[];
    findings: Array<{
      title: string;
      severity: "low" | "medium" | "high";
      category: string;
      summary: string;
      rationale: string | null;
      evidence: string[];
      recommendation: string | null;
    }>;
    risk_matrix: Array<{
      zone: string;
      level: "low" | "medium" | "high";
      comment: string;
    }>;
    recommendations: string[];
  };
};

type RepairHistoryEntry = RepairDetail["history"][number];
type RepairDocumentHistoryEntry = RepairDetail["document_history"][number];

const emptyUploadForm = (): UploadFormState => ({
  vehicleId: "",
  documentKind: "order",
  repairDate: "",
  mileage: "",
  orderNumber: "",
  reason: "",
  employeeComment: "",
  notes: "",
});

// Predeploy marker: uploaded: "В очереди OCR"


const historyDetailFormatters: HistoryDetailFormatters = {
  formatStatus,
  formatRepairStatus,
  formatDocumentStatusLabel,
  formatDocumentKind,
  formatMoney,
  formatDateValue,
  formatJsonPretty,
  readComparisonReviewMeta,
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("documents");
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>("services");
  const [activeTechAdminTab, setActiveTechAdminTab] = useState<TechAdminTab>("learning");
  const [activeRepairTab, setActiveRepairTab] = useState<RepairTab>("overview");
  const [activeQualityTab, setActiveQualityTab] = useState<QualityDetailTab>("documents");
  const [showQualityDialog, setShowQualityDialog] = useState(false);
  const [showTechAdminTab, setShowTechAdminTab] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [dataQuality, setDataQuality] = useState<DashboardDataQuality | null>(null);
  const [dataQualityDetails, setDataQualityDetails] = useState<DashboardDataQualityDetails | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [reviewQueueCounts, setReviewQueueCounts] = useState<Record<ReviewQueueCategory, number>>({
    all: 0,
    suspicious: 0,
    ocr_error: 0,
    partial_recognition: 0,
    employee_confirmation: 0,
    manual_review: 0,
  });
  const [selectedReviewCategory, setSelectedReviewCategory] = useState<ReviewQueueCategory>("all");
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedRepair, setSelectedRepair] = useState<RepairDetail | null>(null);
  const [documentVehicleForm, setDocumentVehicleForm] = useState<DocumentVehicleFormState>(createEmptyDocumentVehicleForm);
  const attachedFileInputRef = useRef<HTMLInputElement | null>(null);
  const [checkComments, setCheckComments] = useState<Record<number, string>>({});
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historySearch, setHistorySearch] = useState("");
  const [showRepairOverviewDetails, setShowRepairOverviewDetails] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const isEditingRepairRef = useRef(false);
  const syncRepairDraftFromRepairRef = useRef<(repair: RepairDetail) => void>(() => {});
  const resetRepairDocumentsWorkflowStateRef = useRef<() => void>(() => {});
  const {
    token,
    showPasswordChange,
    setShowPasswordChange,
    showPasswordRecoveryRequest,
    loginValue,
    setLoginValue,
    passwordValue,
    setPasswordValue,
    currentPasswordValue,
    setCurrentPasswordValue,
    newPasswordValue,
    setNewPasswordValue,
    recoveryEmailValue,
    setRecoveryEmailValue,
    recoveryTokenValue,
    setRecoveryTokenValue,
    recoveryNewPasswordValue,
    setRecoveryNewPasswordValue,
    loginLoading,
    passwordChangeLoading,
    passwordRecoveryLoading,
    invalidateSession,
    handleLogin,
    handleChangePassword,
    handleRequestPasswordRecovery,
    handleConfirmPasswordRecovery,
    openPasswordRecovery,
    handleBackToLogin,
    cancelPasswordChange,
    handleLogout,
  } = useAuthSession({
    setErrorMessage,
    setSuccessMessage,
    onLogoutAppReset: () => {
      setActiveWorkspaceTab("documents");
      setActiveAdminTab("services");
      setActiveTechAdminTab("learning");
      setActiveRepairTab("overview");
      setShowTechAdminTab(false);
      setLastUploadedDocument(null);
      resetRepairDocumentsWorkflowState();
    },
  });
  const {
    uploadForm,
    selectedFile,
    lastUploadedDocument,
    setLastUploadedDocument,
    uploadFileInputRef,
    uploadLoading,
    reprocessLoading,
    batchReprocessLoading,
    batchReprocessLimit,
    setBatchReprocessLimit,
    batchReprocessStatusFilter,
    setBatchReprocessStatusFilter,
    batchReprocessPrimaryOnly,
    setBatchReprocessPrimaryOnly,
    documentArchiveLoadingId,
    handleUpload,
    updateUploadFormField,
    handleUploadFileSelect,
    handleReprocessDocumentById,
    handleReprocessDocument,
    handleBatchReprocessDocuments,
    handleArchiveDocument,
    resetDocumentsWorkspaceState,
  } = useDocumentsWorkspace({
    token,
    userRole: user?.role,
    emptyUploadForm,
    setErrorMessage,
    setSuccessMessage,
    refreshWorkspace: async () => {
      if (token) {
        await loadWorkspace(token);
      }
    },
    openRepairByIds: async (documentId, repairId) => {
      await openRepairByIds(documentId, repairId);
    },
    selectedDocumentId,
    selectedRepairId: selectedRepair?.id ?? null,
    formatDocumentStatusLabel,
  });
  const {
    usersList,
    usersTotal,
    userLoading,
    userSaving,
    userSearch,
    setUserSearch,
    showUserEditor,
    setShowUserEditor,
    userForm,
    selectedManagedUserId,
    setSelectedManagedUserId,
    selectedManagedUser,
    adminResetPasswordValue,
    setAdminResetPasswordValue,
    userVehicleSearch,
    setUserVehicleSearch,
    userVehicleSearchLoading,
    userVehicleSearchResults,
    userAssignmentForm,
    userAssignmentSaving,
    applyBootstrapUsers,
    resetUserEditor,
    editUser,
    updateUserFormField,
    updateUserAssignmentFormField,
    handleUserSearch,
    resetUsersSearch,
    handleSaveUser,
    handleSearchVehiclesForAssignment,
    handleCreateUserAssignment,
    handleAdminResetUserPassword,
    handleCloseUserAssignment,
    resetUsersState,
  } = useEmployeesAdmin({
    token,
    userRole: user?.role,
    setErrorMessage,
    setSuccessMessage,
  });
  const {
    services,
    serviceCities,
    serviceQuery,
    setServiceQuery,
    serviceCityFilter,
    setServiceCityFilter,
    serviceLoading,
    serviceSaving,
    serviceForm,
    showServiceEditor,
    setShowServiceEditor,
    showServiceListDialog,
    setShowServiceListDialog,
    applyBootstrapServices,
    loadServices,
    updateServiceFormField,
    editService,
    resetServiceEditor,
    handleServiceSearch,
    resetServicesFilters,
    handleSaveService,
    resetServicesState,
  } = useServicesAdmin({
    token,
    userRole: user?.role,
    setErrorMessage,
    setSuccessMessage,
  });
  const {
    showReviewRuleEditor,
    setShowReviewRuleEditor,
    showReviewRuleListDialog,
    setShowReviewRuleListDialog,
    reviewRules,
    reviewRuleTypes,
    reviewRuleSaving,
    reviewRuleForm,
    applyBootstrapReviewRules,
    updateReviewRuleFormField,
    editReviewRule,
    resetReviewRuleEditor,
    handleSaveReviewRule,
    resetReviewRulesState,
  } = useReviewRulesAdmin({
    token,
    userRole: user?.role,
    setErrorMessage,
    setSuccessMessage,
    openReviewRulesAdmin,
  });
  const {
    showLaborNormCatalogEditor,
    setShowLaborNormCatalogEditor,
    showLaborNormImport,
    setShowLaborNormImport,
    showLaborNormEntryEditor,
    setShowLaborNormEntryEditor,
    showLaborNormListDialog,
    setShowLaborNormListDialog,
    laborNorms,
    laborNormCatalogs,
    laborNormTotal,
    laborNormScopes,
    laborNormCategories,
    laborNormSourceFiles,
    laborNormQuery,
    setLaborNormQuery,
    laborNormScope,
    setLaborNormScope,
    laborNormCategory,
    setLaborNormCategory,
    laborNormLoading,
    laborNormImportLoading,
    laborNormFile,
    setLaborNormFile,
    laborNormImportScope,
    laborNormImportBrandFamily,
    setLaborNormImportBrandFamily,
    laborNormImportCatalogName,
    setLaborNormImportCatalogName,
    laborNormCatalogSaving,
    laborNormEntrySaving,
    editingLaborNormCatalogId,
    laborNormCatalogForm,
    laborNormEntryForm,
    applyBootstrapLaborNorms,
    updateLaborNormCatalogFormField,
    handleLaborNormSearch,
    resetLaborNormFilters,
    handleLaborNormImport,
    editLaborNormCatalog,
    resetLaborNormCatalogEditor,
    selectCatalogScope,
    handleSaveLaborNormCatalog,
    updateLaborNormEntryFormField,
    editLaborNormItem,
    resetLaborNormEntryEditor,
    handleSaveLaborNormEntry,
    handleArchiveLaborNormItem,
    resetLaborNormsState,
  } = useLaborNormsAdmin({
    token,
    userRole: user?.role,
    setErrorMessage,
    setSuccessMessage,
    openLaborNormsAdmin,
  });
  const {
    ocrRules,
    ocrRuleProfiles,
    ocrRuleTargetFields,
    ocrRuleProfileFilter,
    setOcrRuleProfileFilter,
    ocrRuleSaving,
    ocrRuleForm,
    ocrProfileMatchers,
    ocrProfileMatcherProfiles,
    ocrProfileMatcherProfileFilter,
    setOcrProfileMatcherProfileFilter,
    ocrProfileMatcherSaving,
    ocrProfileMatcherForm,
    ocrLearningSignals,
    ocrLearningSummaries,
    ocrLearningStatuses,
    ocrLearningTargetFields,
    ocrLearningProfileScopes,
    systemStatus,
    ocrLearningStatusFilter,
    setOcrLearningStatusFilter,
    ocrLearningTargetFieldFilter,
    setOcrLearningTargetFieldFilter,
    ocrLearningProfileScopeFilter,
    setOcrLearningProfileScopeFilter,
    showOcrLearningListDialog,
    setShowOcrLearningListDialog,
    ocrLearningLoading,
    ocrLearningUpdateId,
    ocrLearningDraftId,
    applyBootstrapOcrAdmin,
    loadOcrRules,
    loadOcrProfileMatchers,
    loadOcrLearningSignals,
    updateOcrRuleFormField,
    editOcrRule,
    resetOcrRuleEditor,
    handleSaveOcrRule,
    updateOcrProfileMatcherFormField,
    editOcrProfileMatcher,
    resetOcrProfileMatcherEditor,
    handleSaveOcrProfileMatcher,
    handleUpdateOcrLearningSignal,
    handleLoadOcrLearningDraft,
    resetOcrAdminState,
  } = useOcrAdmin({
    token,
    userRole: user?.role,
    setErrorMessage,
    setSuccessMessage,
    openTechAdmin,
  });
  const {
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
  } = useHistoricalImportsAdmin({
    token,
    userRole: user?.role,
    activeWorkspaceTab,
    activeAdminTab,
    setErrorMessage,
    setSuccessMessage,
    refreshWorkspace: async () => {
      if (token) {
        await loadWorkspace(token);
      }
    },
  });
  const {
    globalSearchQuery,
    setGlobalSearchQuery,
    globalSearchLoading,
    globalSearchResult,
    handleGlobalSearchSubmit,
    resetGlobalSearch,
    auditLogItems,
    auditLogLoading,
    auditLogTotal,
    auditEntityTypes,
    auditActionTypes,
    auditSearchQuery,
    setAuditSearchQuery,
    auditEntityTypeFilter,
    setAuditEntityTypeFilter,
    auditActionTypeFilter,
    setAuditActionTypeFilter,
    auditUserIdFilter,
    setAuditUserIdFilter,
    auditDateFrom,
    setAuditDateFrom,
    auditDateTo,
    setAuditDateTo,
    loadAuditLog,
    resetAudit,
    resetOperationsState,
  } = useWorkspaceOperations({
    activeWorkspaceTab,
    token,
    onError: setErrorMessage,
  });
  const {
    backups,
    backupsLoading,
    backupActionLoading,
    backupRestoreDialogOpen,
    backupRestoreTarget,
    backupRestoreConfirmValue,
    setBackupRestoreConfirmValue,
    loadBackups,
    openBackupRestoreDialog,
    closeBackupRestoreDialog,
    handleCreateBackup,
    handleDownloadBackup,
    handleRestoreBackup,
    resetBackupsState,
  } = useBackupsAdmin({
    token,
    userRole: user?.role,
    activeWorkspaceTab,
    activeAdminTab,
    setErrorMessage,
    setSuccessMessage,
  });
  const {
    fleetVehicles,
    fleetVehiclesTotal,
    fleetLoading,
    fleetQuery,
    setFleetQuery,
    fleetVehicleTypeFilter,
    setFleetVehicleTypeFilter,
    fleetStatusFilter,
    setFleetStatusFilter,
    selectedFleetVehicleId,
    setSelectedFleetVehicleId,
    selectedFleetVehicle,
    selectedFleetVehicleLoading,
    fleetViewMode,
    setFleetViewMode,
    vehicleSaving,
    vehicleExportLoading,
    loadFleetVehicles,
    applyBootstrapVehicleList,
    openFleetVehicleCard,
    returnToFleetList,
    openFleetVehicleById,
    handleUpdateVehicle,
    handleExportVehicle,
    resetFleetState,
  } = useFleetWorkspace({
    token,
    activeWorkspaceTab,
    vehiclesFullListLimit: VEHICLES_FULL_LIST_LIMIT,
    setErrorMessage,
    setSuccessMessage,
  });
  const { repairLoading, loadRepairDetail } = useRepairDetailLoader<RepairDetail, DocumentItem>({
    setErrorMessage,
    setSelectedRepair: (repair) => {
      setSelectedRepair(repair);
    },
    setSelectedDocumentId,
    setLastUploadedDocument,
    setCheckComments,
    setHistoryFilter,
    setHistorySearch,
    isEditingRepairRef,
    syncRepairDraftFromRepairRef,
    resetRepairDocumentsWorkflowStateRef,
  });
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
    fleetViewMode,
    setFleetViewMode,
    selectedFleetVehicleId,
    setSelectedFleetVehicleId,
    selectedRepairId: selectedRepair?.id ?? null,
    selectedDocumentId,
    setSelectedDocumentId,
    loadRepairDetail,
  });
  const { repairHasReturnTarget, repairReturnTab } = appNavigation;

  function updateBrowserRoute(route: AppRoute, mode: "push" | "replace" = "replace") {
    appNavigation.updateBrowserRoute(route, mode);
  }

  function handleWorkspaceTabChange(value: WorkspaceTab) {
    appNavigation.handleWorkspaceTabChange(value);
  }

  function handleAdminTabChange(value: AdminTab) {
    appNavigation.handleAdminTabChange(value);
  }

  function handleTechAdminTabChange(value: TechAdminTab) {
    appNavigation.handleTechAdminTabChange(value);
  }

  function handleRepairTabChange(value: RepairTab) {
    appNavigation.handleRepairTabChange(value);
  }

  function openTechAdmin(tab: TechAdminTab = "learning") {
    appNavigation.openTechAdmin(tab);
  }

  function closeTechAdmin() {
    appNavigation.closeTechAdmin();
  }

  function openReviewRulesAdmin() {
    appNavigation.openReviewRulesAdmin();
  }

  function openLaborNormsAdmin() {
    appNavigation.openLaborNormsAdmin();
  }

  async function openRepairByIds(documentId: number | null, repairId: number) {
    await appNavigation.openRepairByIds(documentId, repairId);
  }

  function returnFromRepairPage() {
    appNavigation.returnFromRepairPage();
  }
  const {
    selectedReviewItem,
    selectedRepairDocument,
    selectedRepairDocumentPayload,
    selectedRepairDocumentConfidenceMap,
    selectedRepairDocumentExtractedFields,
    selectedRepairDocumentOcrServiceName,
    selectedRepairDocumentWorks,
    selectedRepairDocumentParts,
    selectedRepairUnresolvedChecks,
    selectedRepairAwaitingOcr,
    selectedRepairHasBlockingFindings,
    selectedRepairReportSections,
    selectedRepairDocumentManualReviewReasons,
    repairVisualBars,
    repairVisualMax,
    qualityVisualBars,
    qualityVisualMax,
    attentionVisualBars,
    attentionVisualMax,
    topAttentionServices,
    reviewRequiredFieldComparisons,
    selectedRepairDocumentFieldSnapshots,
    reviewMissingRequiredFields,
    selectedRepairComparisonAttentionCount,
    reviewReadyFieldsCount,
    canConfirmSelectedReview,
    uploadMissingRequirements,
    canLinkVehicleFromSelectedDocument,
    canCreateVehicleFromSelectedDocument,
  } = useRepairDerivedViewModel({
    selectedDocumentId,
    selectedFile,
    userRole: user?.role,
    selectedRepair,
    reviewQueue,
    summary,
    dataQuality,
    dataQualityDetails,
    formatMoney,
  });
  const {
    repairDraft,
    setRepairDraft,
    isEditingRepair,
    saveRepairLoading,
    repairArchiveLoading,
    repairDeleteLoading,
    startRepairEdit,
    cancelRepairEdit,
    updateRepairDraftField,
    updateWorkDraft,
    updatePartDraft,
    addWorkDraft,
    addPartDraft,
    removeWorkDraft,
    removePartDraft,
    handleSaveRepair,
    handleArchiveRepair,
    handleDeleteRepair,
    syncRepairDraftFromRepair,
    resetRepairEditingState,
  } = useRepairEditingWorkflow({
    token,
    userRole: user?.role,
    selectedRepair,
    refreshWorkspace: async () => {
      if (token) {
        await loadWorkspace(token);
      }
    },
    setSelectedRepair: (repair) => {
      setSelectedRepair(repair as RepairDetail | null);
    },
    setSelectedDocumentId,
    setActiveWorkspaceTab,
    setErrorMessage,
    setSuccessMessage,
  });
  isEditingRepairRef.current = isEditingRepair;
  syncRepairDraftFromRepairRef.current = syncRepairDraftFromRepair;
  const {
    reviewActionLoading,
    reviewActionComment,
    setReviewActionComment,
    reviewFieldSaving,
    reviewVehicleSearch,
    setReviewVehicleSearch,
    reviewVehicleSearchLoading,
    reviewVehicleSearchResults,
    reviewVehicleLinkingId,
    reviewServiceAssigning,
    reviewServiceSaving,
    reviewServiceName,
    setReviewServiceName,
    reviewServiceForm,
    setReviewServiceForm,
    showReviewServiceEditor,
    setShowReviewServiceEditor,
    reviewFieldDraft,
    showReviewFieldEditor,
    setShowReviewFieldEditor,
    reviewDocumentPreviewUrl,
    reviewDocumentPreviewLoading,
    reviewDocumentPreviewKind,
    handleReviewAction,
    assignReviewService,
    handleAssignReviewService,
    handleCreateReviewService,
    handleSearchReviewVehicles,
    handleLinkReviewVehicle,
    updateReviewFieldDraft,
    fillReviewFieldDraftFromOcr,
    handleSaveReviewFields,
    resetReviewWorkflowState,
  } = useRepairReviewWorkflow({
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
    loadServices,
    refreshWorkspace: async () => {
      if (token) {
        await loadWorkspace(token);
      }
    },
    openRepairByIds,
    setSelectedRepair: (repair) => {
      setSelectedRepair(repair as RepairDetail);
    },
    setRepairDraft: (repair) => {
      syncRepairDraftFromRepair(repair);
    },
    setErrorMessage,
    setSuccessMessage,
  });
  const {
    repairExportLoading,
    documentVehicleSaving,
    checkActionLoadingId,
    openQualityRepair,
    openQualityService,
    handleExportRepair,
    handleOpenRepair,
    handleCheckResolution,
    handleCreateVehicleFromDocument,
    handleEditService,
    handleStartRepairEdit,
    handleCancelRepairEdit,
  } = useRepairWorkspaceActions({
    token,
    userRole: user?.role,
    selectedRepairId: selectedRepair?.id ?? null,
    selectedDocumentId,
    documentVehicleForm,
    checkComments,
    setCheckComments,
    setServiceQuery,
    setErrorMessage,
    setSuccessMessage,
    refreshWorkspace: async () => {
      if (token) {
        await loadWorkspace(token);
      }
    },
    openRepairByIds,
    openServicesAdmin: () => {
      appNavigation.openAdminTab("services");
    },
    loadServices,
    editService,
    openRepairOverviewTab: () => {
      handleRepairTabChange("overview");
    },
    startRepairEdit,
    cancelRepairEdit,
    setSelectedRepairFromApi: (repair) => {
      setSelectedRepair(repair as RepairDetail);
    },
  });
  const {
    attachDocumentLoading,
    documentOpenLoadingId,
    primaryDocumentLoadingId,
    documentComparisonLoadingId,
    documentComparisonReviewLoading,
    attachedDocumentKind,
    setAttachedDocumentKind,
    attachedDocumentNotes,
    setAttachedDocumentNotes,
    attachedDocumentFile,
    setAttachedDocumentFile,
    documentComparison,
    setDocumentComparison,
    documentComparisonComment,
    setDocumentComparisonComment,
    handleOpenDocumentFile,
    handleAttachDocumentToRepair,
    handleSetPrimaryDocument,
    handleCompareWithPrimary,
    handleReviewDocumentComparison,
    resetRepairDocumentsWorkflowState,
  } = useRepairDocumentsWorkflow({
    token,
    selectedRepair,
    selectedDocumentId,
    refreshWorkspace: async () => {
      if (token) {
        await loadWorkspace(token);
      }
    },
    openRepairByIds,
    setErrorMessage,
    setSuccessMessage,
  });
  resetRepairDocumentsWorkflowStateRef.current = resetRepairDocumentsWorkflowState;
  const { bootLoading, loadWorkspace: loadWorkspaceInternal } = useWorkspaceDataLifecycle({
    token,
    selectedReviewCategory,
    laborNormQuery,
    laborNormScope,
    laborNormCategory,
    selectedDocumentId,
    documents,
    reviewQueue,
    selectedRepair,
    isEditingRepair,
    lastUploadedDocument,
    invalidateSession,
    loadRepairDetail,
    workspaceState: {
      setUser,
      setSummary,
      setDataQuality,
      setDataQualityDetails,
      setVehicles,
      setDocuments,
      setReviewQueue,
      setReviewQueueCounts,
      setSelectedDocumentId,
      clearSelectedRepair: () => {
        setSelectedRepair(null);
      },
      setLastUploadedDocument,
      setErrorMessage,
      applyBootstrapVehicleList,
      applyBootstrapUsers,
      applyBootstrapLaborNorms,
      applyBootstrapServices,
      applyBootstrapReviewRules,
      applyBootstrapOcrAdmin,
    },
    resetters: {
      setShowTechAdminTab,
      setShowPasswordChange,
      setActiveTechAdminTab,
      setActiveQualityTab,
      resetFleetState,
      resetOperationsState,
      resetLaborNormsState,
      resetReviewRulesState,
      resetReviewWorkflowState,
      resetRepairDocumentsWorkflowState,
      resetRepairEditingState,
      resetDocumentsWorkspaceState,
      resetUsersState,
      resetServicesState,
      resetOcrAdminState,
      resetBackupsState,
      resetHistoricalImportsState,
      setDocumentVehicleFormToEmpty: () => {
        setDocumentVehicleForm(createEmptyDocumentVehicleForm());
      },
    },
  });
  const { filteredRepairHistory, filteredDocumentHistory } = useRepairHistoryFilters({
    selectedRepair,
    historyFilter,
    historySearch,
    formatDocumentKind: (kind) => formatDocumentKind(kind as DocumentKind),
  });

  async function loadWorkspace(
    activeToken: string,
    reviewCategory: ReviewQueueCategory = selectedReviewCategory,
    options?: { silent?: boolean },
  ) {
    await loadWorkspaceInternal(activeToken, reviewCategory, options);
  }

  useEffect(() => {
    setDocumentVehicleForm(createVehicleFormFromPayload(selectedRepairDocumentPayload));
  }, [selectedDocumentId, selectedRepairDocumentPayload]);

  useEffect(() => {
    setShowRepairOverviewDetails(false);
  }, [
    selectedRepair?.id,
    selectedRepair?.service?.name,
    selectedRepairDocumentExtractedFields?.plate_number,
    selectedRepairDocumentExtractedFields?.vin,
    selectedRepairDocumentOcrServiceName,
  ]);

  if (!token) {
    return (
      <AuthLandingView
        showPasswordRecoveryRequest={showPasswordRecoveryRequest}
        loginValue={loginValue}
        passwordValue={passwordValue}
        loginLoading={loginLoading}
        recoveryEmailValue={recoveryEmailValue}
        recoveryTokenValue={recoveryTokenValue}
        recoveryNewPasswordValue={recoveryNewPasswordValue}
        passwordRecoveryLoading={passwordRecoveryLoading}
        errorMessage={errorMessage}
        successMessage={successMessage}
        onLoginSubmit={handleLogin}
        onLoginValueChange={setLoginValue}
        onPasswordValueChange={setPasswordValue}
        onOpenPasswordRecovery={openPasswordRecovery}
        onRecoveryEmailValueChange={setRecoveryEmailValue}
        onRequestPasswordRecovery={() => {
          void handleRequestPasswordRecovery();
        }}
        onRecoveryTokenValueChange={setRecoveryTokenValue}
        onRecoveryNewPasswordValueChange={setRecoveryNewPasswordValue}
        onConfirmPasswordRecovery={() => {
          void handleConfirmPasswordRecovery();
        }}
        onBackToLogin={handleBackToLogin}
      />
    );
  }

  return (
    <WorkspaceMainView
      chromeProps={{
        user: user ? { full_name: user.full_name, email: user.email, role: user.role } : null,
        showPasswordChange,
        currentPasswordValue,
        newPasswordValue,
        passwordChangeLoading,
        errorMessage,
        successMessage,
        bootLoading,
        activeWorkspaceTab,
        documentsCount: documents.length,
        selectedRepairId: selectedRepair?.id ?? null,
        showTechAdminTab,
        vehiclesCount: vehicles.length,
        workspaceDescription: workspaceTabDescriptions[activeWorkspaceTab],
        summary,
        summaryCards,
        onTogglePasswordChange: () => setShowPasswordChange((current) => !current),
        onCurrentPasswordValueChange: setCurrentPasswordValue,
        onNewPasswordValueChange: setNewPasswordValue,
        onChangePassword: () => {
          void handleChangePassword();
        },
        onCancelPasswordChange: cancelPasswordChange,
        onLogout: handleLogout,
        onWorkspaceTabChange: handleWorkspaceTabChange,
      }}
      dataQualityProps={{
        dataQuality,
        qualityCards,
        repairVisualBars,
        repairVisualMax,
        qualityVisualBars,
        qualityVisualMax,
        attentionVisualBars,
        attentionVisualMax,
        topAttentionServices,
        dataQualityDetails,
        showQualityDialog,
        activeQualityTab,
        userRole: user?.role,
        onOpenQualityDialog: () => setShowQualityDialog(true),
        onCloseQualityDialog: () => setShowQualityDialog(false),
        onQualityTabChange: setActiveQualityTab,
        onOpenQualityRepair: (documentId, repairId) => {
          setShowQualityDialog(false);
          void openQualityRepair(documentId, repairId);
        },
        onOpenQualityService: (name) => {
          setShowQualityDialog(false);
          void openQualityService(name);
        },
        onOpenImportConflict: (conflictId) => {
          void openImportConflict(conflictId);
        },
        buildDashboardVisualBarWidth,
        formatConfidence,
        formatMoney,
        formatQualityVehicle,
        statusColor,
        formatDocumentStatusLabel,
        formatRepairStatus,
        formatDateTime,
      }}
      importConflictDialogProps={{
        open: showImportConflictDialog,
        importConflictLoading,
        importConflictSaving,
        selectedImportConflict,
        importConflictComment,
        onClose: () => {
          if (!importConflictSaving) {
            setShowImportConflictDialog(false);
          }
        },
        onCommentChange: setImportConflictComment,
        onIgnore: () => {
          void handleResolveImportConflict("ignored");
        },
        onResolve: () => {
          void handleResolveImportConflict("resolved");
        },
        formatStatus,
        formatDateTime,
        formatJsonPretty,
      }}
      contentProps={{
        activeWorkspaceTab,
        documentsProps: {
              active: activeWorkspaceTab === "documents",
              uploadProps: {
                uploadForm,
                vehicles,
                rootDocumentKindOptions,
                selectedFile,
                uploadMissingRequirements,
                uploadLoading,
                lastUploadedDocument,
                uploadFileInputRef,
                onSubmit: handleUpload,
                onUploadFieldChange: updateUploadFormField,
                onFileSelect: handleUploadFileSelect,
                onOpenFilePicker: () => uploadFileInputRef.current?.click(),
                onOpenUploadedRepair: (documentId, repairId) => {
                  void openRepairByIds(documentId, repairId);
                },
                onHideUploadedResult: () => {
                  setLastUploadedDocument(null);
                },
                formatVehicle,
                formatDocumentKind,
                importJobStatusColor,
                formatStatus,
                statusColor,
                formatDocumentStatusLabel,
                isDocumentAwaitingOcr,
                documentHasActiveImportJob,
                isPlaceholderVehicle,
                formatConfidence,
              },
              reviewQueueProps: {
                reviewQueueFilters,
                reviewQueueCounts,
                selectedReviewCategory,
                reviewQueue,
                userRole: user?.role,
                reprocessLoading,
                selectedDocumentId,
                onSelectCategory: setSelectedReviewCategory,
                onOpenReviewQueueItem: (item) => {
                  void handleOpenRepair(item.document.id, item.repair.id);
                },
                onReprocessDocumentById: (documentId, repairId) => {
                  void handleReprocessDocumentById(documentId, repairId);
                },
                formatDocumentKind,
                reviewPriorityColor,
                formatReviewPriority,
                statusColor,
                formatDocumentStatusLabel,
                formatVehicle,
                formatConfidence,
                formatMoney,
              },
              documentsListProps: {
                userRole: user?.role,
                documents,
                selectedDocumentId,
                batchReprocessLimit,
                batchReprocessStatusFilter,
                batchReprocessPrimaryOnly,
                batchReprocessLoading,
                reprocessLoading,
                repairDeleteLoading,
                documentArchiveLoadingId,
                onBatchReprocessLimitChange: setBatchReprocessLimit,
                onBatchReprocessStatusFilterChange: setBatchReprocessStatusFilter,
                onBatchReprocessPrimaryOnlyChange: setBatchReprocessPrimaryOnly,
                onBatchReprocess: () => {
                  void handleBatchReprocessDocuments();
                },
                onOpenRepair: (document) => {
                  void handleOpenRepair(document.id, document.repair.id);
                },
                onReprocessDocument: (document) => {
                  void handleReprocessDocument(document);
                },
                onDeleteRepair: (repairId) => {
                  void handleDeleteRepair(repairId);
                },
                onArchiveDocument: (documentId, repairId) => {
                  void handleArchiveDocument(documentId, repairId);
                },
                formatDocumentKind,
                importJobStatusColor,
                formatStatus,
                statusColor,
                formatDocumentStatusLabel,
                formatVehicle,
                formatMoney,
                formatManualReviewReasons,
                formatOcrProfileMeta,
                formatLaborNormApplicability,
              },
            },
            adminProps: {
              activeWorkspaceTab,
              activeAdminTab,
              activeTechAdminTab,
              userRole: user?.role,
              adminWorkspaceProps: {
                activeAdminTab,
                description: adminTabDescriptions[activeAdminTab],
                onAdminTabChange: handleAdminTabChange,
                onOpenTechAdmin: openTechAdmin,
              },
              techAdminWorkspaceProps: {
                activeTechAdminTab,
                description: techAdminTabDescriptions[activeTechAdminTab],
                isPasswordRecoveryEmailConfigured: Boolean(systemStatus?.password_recovery_email_configured),
                ocrBackend: systemStatus?.ocr_backend,
                pdfRenderer: systemStatus?.pdf_renderer,
                isImageOcrAvailable: Boolean(systemStatus?.image_ocr_available),
                isPdfScanOcrAvailable: Boolean(systemStatus?.pdf_scan_ocr_available),
                onTechAdminTabChange: handleTechAdminTabChange,
                onCloseTechAdmin: closeTechAdmin,
              },
              employeesProps: {
                userSearch,
                userLoading,
                showUserEditor,
                userForm,
                userSaving,
                usersTotal,
                usersList,
                selectedManagedUserId,
                selectedManagedUser,
                adminResetPasswordValue,
                userVehicleSearch,
                userVehicleSearchLoading,
                userVehicleSearchResults,
                userAssignmentForm,
                userAssignmentSaving,
                onUserSearchChange: setUserSearch,
                onRefreshUsers: () => {
                  void handleUserSearch();
                },
                onResetUsersSearch: () => {
                  void resetUsersSearch();
                },
                onToggleUserEditor: () => {
                  setShowUserEditor((current) => !current);
                },
                onUserFormChange: updateUserFormField,
                onSaveUser: () => {
                  void handleSaveUser();
                },
                onResetUserForm: () => {
                  resetUserEditor();
                  setShowUserEditor(false);
                },
                onSelectUser: setSelectedManagedUserId,
                onEditUser: editUser,
                onAdminResetPasswordValueChange: setAdminResetPasswordValue,
                onAdminResetUserPassword: () => {
                  void handleAdminResetUserPassword();
                },
                onUserVehicleSearchChange: setUserVehicleSearch,
                onUserAssignmentFormChange: updateUserAssignmentFormField,
                onSearchVehiclesForAssignment: () => {
                  void handleSearchVehiclesForAssignment();
                },
                onCreateUserAssignment: (vehicleId) => {
                  void handleCreateUserAssignment(vehicleId);
                },
                onCloseUserAssignment: (assignment) => {
                  void handleCloseUserAssignment(assignment);
                },
                formatUserRoleLabel,
                formatVehicle,
                formatVehicleTypeLabel,
                isAssignmentActive,
              },
              servicesProps: {
                serviceQuery,
                serviceCityFilter,
                serviceCities,
                serviceLoading,
                showServiceEditor,
                serviceForm,
                serviceSaving,
                services,
                showServiceListDialog,
                onServiceQueryChange: setServiceQuery,
                onServiceCityFilterChange: setServiceCityFilter,
                onRefresh: () => {
                  void handleServiceSearch();
                },
                onReset: () => {
                  void resetServicesFilters();
                },
                onToggleEditor: () => {
                  setShowServiceEditor((current) => !current);
                },
                onServiceFormChange: updateServiceFormField,
                onSaveService: () => {
                  void handleSaveService();
                },
                onResetEditor: () => {
                  resetServiceEditor();
                  setShowServiceEditor(false);
                },
                onOpenListDialog: () => {
                  setShowServiceListDialog(true);
                },
                onCloseListDialog: () => {
                  setShowServiceListDialog(false);
                },
                onEditService: handleEditService,
                formatStatus,
              },
              backupsProps: {
                backupActionLoading,
                backupsLoading,
                backups,
                backupRestoreDialogOpen,
                backupRestoreTarget,
                backupRestoreConfirmValue,
                onCreateBackup: () => {
                  void handleCreateBackup();
                },
                onRefresh: () => {
                  void loadBackups();
                },
                onDownloadBackup: (item) => {
                  void handleDownloadBackup(item);
                },
                onOpenRestoreDialog: openBackupRestoreDialog,
                onCloseRestoreDialog: closeBackupRestoreDialog,
                onBackupRestoreConfirmValueChange: setBackupRestoreConfirmValue,
                onRestoreBackup: () => {
                  void handleRestoreBackup();
                },
                formatStatus,
                formatDateTime,
                formatFileSize,
              },
              reviewRulesProps: {
                showReviewRuleEditor,
                reviewRuleForm,
                reviewRuleSaving,
                reviewRules,
                reviewRuleTypes,
                showReviewRuleListDialog,
                onToggleEditor: () => {
                  openReviewRulesAdmin();
                  setShowReviewRuleEditor((current) => !current);
                },
                onReviewRuleFormChange: updateReviewRuleFormField,
                onSaveReviewRule: () => {
                  void handleSaveReviewRule();
                },
                onResetReviewRuleEditor: () => {
                  resetReviewRuleEditor();
                  setShowReviewRuleEditor(false);
                },
                onOpenListDialog: () => {
                  setShowReviewRuleListDialog(true);
                },
                onCloseListDialog: () => {
                  setShowReviewRuleListDialog(false);
                },
                onEditReviewRule: editReviewRule,
                formatReviewRuleTypeLabel,
                formatReviewBucketLabel,
              },
              ocrLearningProps: {
                ocrLearningStatusFilter,
                ocrLearningTargetFieldFilter,
                ocrLearningProfileScopeFilter,
                ocrLearningStatuses,
                ocrLearningTargetFields,
                ocrLearningProfileScopes,
                ocrLearningLoading,
                ocrLearningSummaries,
                ocrLearningSignals,
                showOcrLearningListDialog,
                ocrLearningDraftId,
                ocrLearningUpdateId,
                onOcrLearningStatusFilterChange: setOcrLearningStatusFilter,
                onOcrLearningTargetFieldFilterChange: setOcrLearningTargetFieldFilter,
                onOcrLearningProfileScopeFilterChange: setOcrLearningProfileScopeFilter,
                onRefresh: () => {
                  if (token) {
                    void loadOcrLearningSignals();
                  }
                },
                onReset: () => {
                  setOcrLearningStatusFilter("");
                  setOcrLearningTargetFieldFilter("");
                  setOcrLearningProfileScopeFilter("");
                  if (token) {
                    void loadOcrLearningSignals("", "", "");
                  }
                },
                onOpenListDialog: () => {
                  setShowOcrLearningListDialog(true);
                },
                onCloseListDialog: () => {
                  setShowOcrLearningListDialog(false);
                },
                onLoadDraft: (signalId, draftType) => {
                  void handleLoadOcrLearningDraft(signalId, draftType);
                },
                onUpdateSignalStatus: (signalId, nextStatus) => {
                  void handleUpdateOcrLearningSignal(signalId, nextStatus);
                },
                formatOcrLearningStatusLabel,
                formatOcrProfileName,
                formatOcrFieldLabel,
                formatOcrSignalTypeLabel,
              },
              ocrMatchersProps: {
                ocrProfileMatcherProfileFilter,
                ocrProfileMatcherProfiles,
                ocrProfileMatchers,
                ocrProfileMatcherForm,
                ocrProfileMatcherSaving,
                onProfileFilterChange: setOcrProfileMatcherProfileFilter,
                onRefresh: () => {
                  if (token) {
                    void loadOcrProfileMatchers();
                  }
                },
                onResetFilter: () => {
                  setOcrProfileMatcherProfileFilter("");
                  if (token) {
                    void loadOcrProfileMatchers("");
                  }
                },
                onFormChange: updateOcrProfileMatcherFormField,
                onSave: () => {
                  void handleSaveOcrProfileMatcher();
                },
                onResetForm: resetOcrProfileMatcherEditor,
                onEdit: editOcrProfileMatcher,
                formatOcrProfileName,
                formatSourceTypeLabel,
              },
              ocrRulesProps: {
                ocrRuleProfileFilter,
                ocrRuleProfiles,
                ocrRuleTargetFields,
                ocrRules,
                ocrRuleForm,
                ocrRuleSaving,
                onProfileFilterChange: setOcrRuleProfileFilter,
                onRefresh: () => {
                  if (token) {
                    void loadOcrRules();
                  }
                },
                onResetFilter: () => {
                  setOcrRuleProfileFilter("");
                  if (token) {
                    void loadOcrRules("");
                  }
                },
                onFormChange: updateOcrRuleFormField,
                onSave: () => {
                  void handleSaveOcrRule();
                },
                onResetForm: resetOcrRuleEditor,
                onEdit: editOcrRule,
                formatOcrProfileName,
                formatOcrFieldLabel,
                formatValueParserLabel,
              },
              historicalImportsProps: {
                historicalImportLoading,
                historicalImportFile,
                historicalImportLimit,
                historicalImportResult,
                historicalImportJobs,
                historicalImportJobsLoading,
                historicalWorkReference,
                historicalWorkReferenceLoading,
                historicalWorkReferenceTotal,
                historicalWorkReferenceQuery,
                historicalWorkReferenceMinSamples,
                importConflicts,
                importConflictsLoading,
                canRefreshJournal:
                  !(historicalImportJobsLoading || historicalWorkReferenceLoading || importConflictsLoading) && !!token,
                onHistoricalImportFileChange: setHistoricalImportFile,
                onHistoricalImportLimitChange: setHistoricalImportLimit,
                onStartHistoricalImport: () => {
                  void handleHistoricalRepairImport();
                },
                onRefreshJournal: () => {
                  void refreshHistoricalImportsJournal();
                },
                onOpenImportedRepair: (repairId) => {
                  void openRepairByIds(null, repairId);
                },
                onHistoricalWorkReferenceQueryChange: setHistoricalWorkReferenceQuery,
                onHistoricalWorkReferenceMinSamplesChange: setHistoricalWorkReferenceMinSamples,
                onRefreshHistoricalWorkReference: () => {
                  void loadHistoricalWorkReference();
                },
                onOpenImportConflict: (conflictId) => {
                  void openImportConflict(conflictId);
                },
                formatStatus,
                formatMoney,
                formatCompactNumber,
                formatHours,
                formatDateValue,
                formatDateTime,
              },
              laborNormsProps: {
                showLaborNormCatalogEditor,
                showLaborNormImport,
                showLaborNormEntryEditor,
                editingLaborNormCatalogId,
                laborNormCatalogForm,
                laborNormCatalogSaving,
                laborNormCatalogs,
                laborNormQuery,
                laborNormScope,
                laborNormScopes,
                laborNormCategory,
                laborNormCategories,
                laborNormLoading,
                laborNormImportScope,
                laborNormImportBrandFamily,
                laborNormImportCatalogName,
                laborNormFile,
                laborNormImportLoading,
                laborNormEntryForm,
                laborNormEntrySaving,
                laborNormTotal,
                laborNormSourceFiles,
                showLaborNormListDialog,
                laborNorms,
                onToggleCatalogEditor: () => {
                  openLaborNormsAdmin();
                  setShowLaborNormCatalogEditor((current) => !current);
                },
                onToggleImport: () => {
                  openLaborNormsAdmin();
                  setShowLaborNormImport((current) => !current);
                },
                onToggleEntryEditor: () => {
                  openLaborNormsAdmin();
                  setShowLaborNormEntryEditor((current) => !current);
                },
                onCatalogFormChange: updateLaborNormCatalogFormField,
                onSaveCatalog: () => {
                  void handleSaveLaborNormCatalog();
                },
                onResetCatalogForm: () => {
                  resetLaborNormCatalogEditor();
                  setShowLaborNormCatalogEditor(false);
                },
                onEditCatalog: editLaborNormCatalog,
                onSelectCatalogScope: selectCatalogScope,
                onQueryChange: setLaborNormQuery,
                onScopeChange: setLaborNormScope,
                onCategoryChange: setLaborNormCategory,
                onSearch: () => {
                  void handleLaborNormSearch();
                },
                onResetFilters: () => {
                  void resetLaborNormFilters();
                },
                onImportBrandFamilyChange: setLaborNormImportBrandFamily,
                onImportCatalogNameChange: setLaborNormImportCatalogName,
                onImportFileChange: setLaborNormFile,
                onImport: () => {
                  void handleLaborNormImport();
                },
                onEntryFormChange: updateLaborNormEntryFormField,
                onSaveEntry: () => {
                  void handleSaveLaborNormEntry();
                },
                onResetEntryForm: () => {
                  resetLaborNormEntryEditor();
                  setShowLaborNormEntryEditor(false);
                },
                onOpenListDialog: () => setShowLaborNormListDialog(true),
                onCloseListDialog: () => setShowLaborNormListDialog(false),
                onEditItem: editLaborNormItem,
                onArchiveItem: (item) => {
                  void handleArchiveLaborNormItem(item);
                },
                formatCatalogCodeLabel,
                formatStatus,
                formatHours,
              },
            },
            repairProps: {
              returnLabel: repairHasReturnTarget ? workspaceTabReturnLabels[repairReturnTab] : null,
              onReturn: repairHasReturnTarget ? returnFromRepairPage : null,
              contentProps: {
                userRole: user?.role,
                repairLoading,
                selectedRepair,
                selectedReviewItem,
                isEditingRepair,
                saveRepairLoading,
                hasRepairDraft: Boolean(repairDraft),
                repairExportLoading,
                repairArchiveLoading,
                repairDeleteLoading,
                onCancelEdit: handleCancelRepairEdit,
                onSaveRepair: () => {
                  void handleSaveRepair();
                },
                onExportRepair: () => {
                  void handleExportRepair();
                },
                onStartEdit: handleStartRepairEdit,
                onArchiveRepair: () => {
                  void handleArchiveRepair();
                },
                onDeleteRepair: (repairId) => {
                  void handleDeleteRepair(repairId);
                },
                reviewDecisionProps:
                  selectedRepair
                    ? {
                        userRole: user?.role,
                        selectedRepairStatus: selectedRepair.status,
                        selectedReviewItem,
                        selectedRepair,
                        selectedRepairDocument,
                        reviewDocumentPreviewLoading,
                        reviewDocumentPreviewKind,
                        reviewDocumentPreviewUrl,
                        documentOpenLoadingId,
                        canLinkVehicleFromSelectedDocument,
                        selectedRepairDocumentExtractedFields,
                        reviewVehicleSearch,
                        reviewVehicleSearchLoading,
                        reviewVehicleLinkingId,
                        reviewVehicleSearchResults,
                        selectedRepairDocumentOcrServiceName,
                        reviewServiceName,
                        services,
                        reviewServiceAssigning,
                        reviewServiceSaving,
                        reviewFieldSaving,
                        showReviewServiceEditor,
                        reviewServiceForm,
                        canConfirmSelectedReview,
                        reviewReadyFieldsCount,
                        reviewRequiredFieldComparisons,
                        showReviewFieldEditor,
                        reviewFieldDraft,
                        reviewMissingRequiredFields,
                        selectedRepairDocumentFieldSnapshots,
                        selectedRepairDocumentPayload,
                        selectedRepairDocumentWorks,
                        selectedRepairDocumentParts,
                        reviewActionComment,
                        reviewActionLoading,
                        canCreateVehicleFromSelectedDocument,
                        isEditingRepair,
                        documentVehicleForm,
                        documentVehicleSaving,
                        onOpenDocumentFile: (documentId) => {
                          void handleOpenDocumentFile(documentId);
                        },
                        onSearchVehicleChange: setReviewVehicleSearch,
                        onSearchVehicles: () => {
                          void handleSearchReviewVehicles();
                        },
                        onLinkVehicle: (vehicleId) => {
                          void handleLinkReviewVehicle(vehicleId);
                        },
                        onServiceNameChange: setReviewServiceName,
                        onToggleServiceCreate: () => {
                          setShowReviewServiceEditor((current) => !current);
                          setReviewServiceForm((current) => ({
                            ...current,
                            name: current.name || reviewServiceName || selectedRepairDocumentOcrServiceName,
                          }));
                        },
                        onClearService: () => {
                          setReviewServiceName("");
                          void assignReviewService("");
                        },
                        onServiceFormChange: (field, value) => {
                          setReviewServiceForm((current) => ({
                            ...current,
                            [field]: value,
                          }));
                        },
                        onAssignService: () => {
                          void handleAssignReviewService();
                        },
                        onCreateService: () => {
                          void handleCreateReviewService();
                        },
                        onToggleFieldEditor: () => {
                          setShowReviewFieldEditor((current) => !current);
                        },
                        onFillFieldsFromOcr: fillReviewFieldDraftFromOcr,
                        onReviewFieldDraftChange: updateReviewFieldDraft,
                        onSaveReviewFields: () => {
                          void handleSaveReviewFields();
                        },
                        onReviewActionCommentChange: setReviewActionComment,
                        onConfirm: () => {
                          void handleReviewAction(user?.role === "admin" ? "confirm" : "employee_confirm");
                        },
                        onSendToReview: () => {
                          void handleReviewAction("send_to_review");
                        },
                        onDocumentVehicleFormChange: (field, value) => {
                          setDocumentVehicleForm((current) => ({
                            ...current,
                            [field]: value,
                          }));
                        },
                        onCreateVehicle: () => {
                          void handleCreateVehicleFromDocument();
                        },
                        getReviewComparisonColor,
                        getReviewComparisonLabel,
                        getConfidenceColor,
                        formatConfidenceLabel,
                        formatMoney,
                        formatCompactNumber,
                        formatHours,
                        formatManualReviewReasons,
                        formatOcrProfileMeta,
                        formatLaborNormApplicability,
                        readStringValue,
                        readNumberValue,
                        formatOcrLineUnit,
                        formatDocumentKind,
                        statusColor,
                        formatDocumentStatusLabel,
                        formatDateTime,
                        formatSourceTypeLabel,
                        formatConfidence,
                        formatVehicle,
                        formatVehicleTypeLabel,
                      }
                    : null,
                repairTabsProps:
                  selectedRepair
                    ? {
                        activeRepairTab,
                        repairTabDescriptions,
                        isEditingRepair,
                        selectedRepair,
                        onRepairTabChange: handleRepairTabChange,
                        editProps:
                          isEditingRepair && repairDraft
                            ? {
                                activeRepairTab,
                                repairDraft,
                                services,
                                onRepairFieldChange: updateRepairDraftField,
                                onAddWorkDraft: addWorkDraft,
                                onUpdateWorkDraft: updateWorkDraft,
                                onRemoveWorkDraft: removeWorkDraft,
                                onAddPartDraft: addPartDraft,
                                onUpdatePartDraft: updatePartDraft,
                                onRemovePartDraft: removePartDraft,
                              }
                            : null,
                        overviewProps: {
                          selectedRepair,
                          selectedRepairDocument,
                          selectedRepairAwaitingOcr,
                          selectedRepairUnresolvedChecksCount: selectedRepairUnresolvedChecks.length,
                          selectedRepairHasBlockingFindings,
                          reviewRequiredFieldComparisons,
                          selectedRepairComparisonAttentionCount,
                          selectedRepairDocumentWorksCount: selectedRepairDocumentWorks.length,
                          selectedRepairDocumentPartsCount: selectedRepairDocumentParts.length,
                          selectedRepairDocumentManualReviewReasons,
                          selectedRepairReportSections,
                          showRepairOverviewDetails,
                          onToggleShowDetails: () => setShowRepairOverviewDetails((current) => !current),
                          onOpenLinkedRepair: (repairId) => {
                            void openRepairByIds(null, repairId);
                          },
                          isPlaceholderVehicle,
                          formatVehicle,
                          formatRepairStatus,
                          executiveRiskColor,
                          formatExecutiveRiskLabel,
                          statusColor,
                          formatDocumentStatusLabel,
                          formatCompactNumber,
                          formatMoney,
                          formatConfidence,
                          formatManualReviewReasons,
                          buildCheckPayloadDetails,
                          getCheckLinkedRepairId,
                          checkSeverityColor,
                          formatStatus,
                        },
                        documentsProps: {
                          userRole: user?.role,
                          selectedRepair,
                          documentKindOptions,
                          attachedDocumentKind,
                          attachedDocumentNotes,
                          attachedDocumentFile,
                          attachedFileInputRef,
                          attachDocumentLoading,
                          documentOpenLoadingId,
                          reprocessLoading,
                          selectedDocumentId,
                          documentComparisonLoadingId,
                          primaryDocumentLoadingId,
                          documentArchiveLoadingId,
                          documentComparison,
                          documentComparisonComment,
                          documentComparisonReviewLoading,
                          onAttachedDocumentKindChange: setAttachedDocumentKind,
                          onAttachedDocumentNotesChange: setAttachedDocumentNotes,
                          onAttachedDocumentFileChange: setAttachedDocumentFile,
                          onOpenAttachedFilePicker: () => attachedFileInputRef.current?.click(),
                          onAttachDocument: () => {
                            void handleAttachDocumentToRepair();
                          },
                          onOpenDocumentFile: (documentId) => {
                            void handleOpenDocumentFile(documentId);
                          },
                          onReprocessDocumentById: (documentId, repairId) => {
                            void handleReprocessDocumentById(documentId, repairId);
                          },
                          onCompareWithPrimary: (documentId) => {
                            void handleCompareWithPrimary(documentId);
                          },
                          onSetPrimaryDocument: (documentId) => {
                            void handleSetPrimaryDocument(documentId);
                          },
                          onArchiveDocument: (documentId, repairId) => {
                            void handleArchiveDocument(documentId, repairId);
                          },
                          onCloseDocumentComparison: () => {
                            setDocumentComparison(null);
                          },
                          onDocumentComparisonCommentChange: setDocumentComparisonComment,
                          onReviewDocumentComparison: (action) => {
                            void handleReviewDocumentComparison(action);
                          },
                          formatDocumentKind,
                          importJobStatusColor,
                          formatStatus,
                          statusColor,
                          formatDocumentStatusLabel,
                          formatDateTime,
                          formatSourceTypeLabel,
                          formatConfidence,
                          formatManualReviewReasons,
                          formatOcrProfileMeta,
                          formatLaborNormApplicability,
                        },
                        readOnlyProps: {
                          activeRepairTab,
                          selectedRepair,
                          filteredDocumentHistory,
                          filteredRepairHistory,
                          historySearch,
                          historyFilter,
                          historyFilters,
                          checkComments,
                          checkActionLoadingId,
                          onHistorySearchChange: setHistorySearch,
                          onHistoryFilterChange: setHistoryFilter,
                          onCheckCommentChange: (checkId, value) =>
                            setCheckComments((current) => ({
                              ...current,
                              [checkId]: value,
                            })),
                          onCheckResolution: (checkId, isResolved) => {
                            void handleCheckResolution(checkId, isResolved);
                          },
                          onOpenLinkedRepair: (repairId) => {
                            void openRepairByIds(null, repairId);
                          },
                          formatMoney,
                          formatHours,
                          formatStatus,
                          formatWorkLaborNormMeta,
                          buildCheckPayloadDetails,
                          getCheckLinkedRepairId,
                          checkSeverityColor,
                          readCheckResolutionMeta,
                          formatDateTime,
                          formatHistoryActionLabel,
                          formatDocumentKind,
                          buildDocumentHistoryDetails: (entry) =>
                            buildDocumentHistoryDetails(entry, historyDetailFormatters),
                          buildRepairHistoryDetails: (entry) =>
                            buildRepairHistoryDetails(entry, historyDetailFormatters),
                          renderHistoryDetails: (_entryKey, lines) => <HistoryDetailsPreview lines={lines} />,
                        },
                      }
                    : null,
                formatRepairStatus,
                reviewPriorityColor,
                formatReviewPriority,
              },
            },
            operationsProps: {
              activeWorkspaceTab,
              searchProps: {
                query: globalSearchQuery,
                loading: globalSearchLoading,
                result: globalSearchResult,
                onQueryChange: setGlobalSearchQuery,
                onSubmit: (event) => {
                  void handleGlobalSearchSubmit(event);
                },
                onReset: resetGlobalSearch,
                onOpenRepair: (documentId, repairId) => {
                  void openRepairByIds(documentId, repairId);
                },
                onOpenVehicle: (vehicleId) => {
                  openFleetVehicleById(vehicleId, setActiveWorkspaceTab, updateBrowserRoute);
                },
                statusColor,
                vehicleStatusColor,
                formatDocumentStatusLabel,
                formatRepairStatus,
                formatVehicleTypeLabel,
                formatVehicleStatusLabel,
                formatConfidence,
                formatDateTime,
                formatMoney,
              },
              auditProps: {
                userRole: user?.role,
                auditSearchQuery,
                auditEntityTypeFilter,
                auditActionTypeFilter,
                auditUserIdFilter,
                auditDateFrom,
                auditDateTo,
                auditEntityTypes,
                auditActionTypes,
                users: usersList,
                auditLogLoading,
                auditLogItems,
                auditLogTotal,
                onAuditSearchQueryChange: setAuditSearchQuery,
                onAuditEntityTypeFilterChange: setAuditEntityTypeFilter,
                onAuditActionTypeFilterChange: setAuditActionTypeFilter,
                onAuditUserIdFilterChange: setAuditUserIdFilter,
                onAuditDateFromChange: setAuditDateFrom,
                onAuditDateToChange: setAuditDateTo,
                onRefresh: () => {
                  void loadAuditLog();
                },
                onReset: resetAudit,
                formatAuditEntityLabel,
                formatHistoryActionLabel,
                formatDateTime,
                renderEntryDetails: (entry) =>
                  <HistoryDetailsPreview lines={buildAuditEntryDetails(entry, historyDetailFormatters)} />,
              },
              fleetProps: {
                viewMode: fleetViewMode,
                detailProps: {
                  selectedFleetVehicleLoading,
                  selectedFleetVehicle,
                  userRole: user?.role,
                  vehicleSaving,
                  vehicleExportLoading,
                  vehicles,
                  fleetVehicles,
                  onUpdateVehicleStatus: (status) => {
                    void handleUpdateVehicle({ status });
                  },
                  onExportVehicle: () => {
                    void handleExportVehicle();
                  },
                  onOpenRepair: (repairId) => {
                    void openRepairByIds(null, repairId);
                  },
                  formatVehicle,
                  formatVehicleTypeLabel,
                  formatVehicleStatusLabel,
                  formatDateValue,
                  formatDateTime,
                  formatMoney,
                  formatUserRoleLabel,
                  formatRepairStatus,
                  vehicleStatusColor,
                },
                fleetQuery,
                fleetVehicleTypeFilter,
                fleetStatusFilter,
                fleetVehiclesTotal,
                selectedFleetVehicleId,
                fleetVehicles,
                fleetLoading,
                onFleetQueryChange: setFleetQuery,
                onFleetVehicleTypeFilterChange: setFleetVehicleTypeFilter,
                onFleetStatusFilterChange: setFleetStatusFilter,
                onRefresh: () => {
                  void loadFleetVehicles();
                },
                onReset: () => {
                  setFleetQuery("");
                  setFleetVehicleTypeFilter("");
                  setFleetStatusFilter("");
                  void loadFleetVehicles("", "", "");
                },
                onReturnToList: () => {
                  returnToFleetList(updateBrowserRoute);
                },
                onOpenVehicleCard: (vehicleId) => {
                  openFleetVehicleCard(vehicleId, updateBrowserRoute);
                },
                formatVehicle,
                formatVehicleTypeLabel,
                formatVehicleStatusLabel,
                formatDateValue,
                vehicleStatusColor,
              },
            },
          }}
          />
  );
}
