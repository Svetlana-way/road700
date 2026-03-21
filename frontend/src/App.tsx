import { useEffect, useRef, useState } from "react";
import {
  buildUserPayload,
} from "./shared/adminPayloadBuilders";
import { MenuItem } from "@mui/material";
import { AuthLandingView } from "./components/AuthLandingView";
import { HistoryDetailsPreview } from "./components/HistoryDetailsPreview";
import { WorkspaceMainView } from "./components/WorkspaceMainView";
import { useAuthSession } from "./hooks/useAuthSession";
import { useBackupsAdmin } from "./hooks/useBackupsAdmin";
import { useDocumentsWorkspace } from "./hooks/useDocumentsWorkspace";
import { useEmployeesAdmin } from "./hooks/useEmployeesAdmin";
import { useLaborNormsAdmin } from "./hooks/useLaborNormsAdmin";
import { useOcrAdmin } from "./hooks/useOcrAdmin";
import { useReviewRulesAdmin } from "./hooks/useReviewRulesAdmin";
import { useRepairDocumentsWorkflow } from "./hooks/useRepairDocumentsWorkflow";
import { useRepairEditingWorkflow } from "./hooks/useRepairEditingWorkflow";
import { useFleetWorkspace } from "./hooks/useFleetWorkspace";
import { useHistoricalImportsAdmin } from "./hooks/useHistoricalImportsAdmin";
import { useRepairReviewWorkflow } from "./hooks/useRepairReviewWorkflow";
import { useServicesAdmin } from "./hooks/useServicesAdmin";
import { useWorkspaceOperations } from "./hooks/useWorkspaceOperations";
import { apiRequest, downloadApiFile } from "./shared/api";
import {
  createVehicleFormFromPayload,
  formatQualityVehicle,
  formatVehicle,
  getLatestRepairDocumentConfidenceMap,
  getLatestRepairDocumentPayload,
  getPayloadExtractedFields,
  getPayloadExtractedItems,
  inferVehicleTypeFromIdentifiers,
  isAssignmentActive,
  isPlaceholderVehicle,
  matchesTextSearch,
} from "./shared/fleetDocumentHelpers";
import {
  buildAttentionVisualBars,
  buildDashboardVisualBarWidth,
  buildQualityVisualBars,
  buildRepairVisualBars,
} from "./shared/dashboardVisuals";
import {
  areAppRoutesEqual,
  buildAppRouteFromState,
  buildAppRouteUrl,
  readAppRoute,
  type AdminTab,
  type AppRoute,
  type RepairTab,
  type TechAdminTab,
  type WorkspaceTab,
} from "./shared/appRoute";
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
  groupRepairChecksForReport,
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
import { loadWorkspaceBootstrapData } from "./shared/loadWorkspaceBootstrap";
import {
  buildAuditLogQueryString,
  buildServiceQueryString,
  buildUsersQueryString,
} from "./shared/queryBuilders";
import {
  getReviewComparisonColor,
  getReviewComparisonLabel,
  getReviewComparisonStatus,
  readConfidenceValue,
  repairHasDocumentsAwaitingOcr,
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
  DocumentsResponse,
  GlobalSearchResponse,
  ImportJobStatus,
  ReviewQueueCategory,
  ReviewQueueItem,
  ReviewQueueResponse,
  ServiceItem,
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
  ReviewRequiredFieldComparisonItem,
  ServiceFormState,
  UploadFormState,
  UserAssignmentFormState,
  UserFormState,
} from "./shared/workspaceFormTypes";

type HistoryFilter = "all" | "repair" | "documents" | "uploads" | "primary" | "comparison";
type QualityDetailTab = "documents" | "services" | "works" | "parts" | "conflicts";

type DocumentCreateVehicleResponse = {
  message: string;
  repair_id: number;
  created_new_vehicle: boolean;
  document: DocumentItem;
};

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
  const [routeSnapshot, setRouteSnapshot] = useState<AppRoute>(() => readAppRoute(window.location));
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
  const repairReturnTabRef = useRef<WorkspaceTab>("documents");
  const repairReturnRouteRef = useRef<AppRoute>({ workspace: "documents" });
  const repairScrollPositionRef = useRef(0);
  const [repairHasReturnTarget, setRepairHasReturnTarget] = useState(false);
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
  const workspaceAutoRefreshInFlightRef = useRef(false);
  const repairAutoRefreshInFlightRef = useRef(false);
  const attachedFileInputRef = useRef<HTMLInputElement | null>(null);
  const [bootLoading, setBootLoading] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);
  const [repairExportLoading, setRepairExportLoading] = useState(false);
  const [documentVehicleSaving, setDocumentVehicleSaving] = useState(false);
  const [checkActionLoadingId, setCheckActionLoadingId] = useState<number | null>(null);
  const [checkComments, setCheckComments] = useState<Record<number, string>>({});
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historySearch, setHistorySearch] = useState("");
  const [showRepairOverviewDetails, setShowRepairOverviewDetails] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
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
  const selectedReviewItem =
    reviewQueue.find((item) => item.document.id === selectedDocumentId) ?? null;
  const selectedRepairDocument = selectedRepair?.documents.find((item) => item.id === selectedDocumentId) ?? null;
  const selectedRepairDocumentPayload = getLatestRepairDocumentPayload(selectedRepair, selectedDocumentId);
  const selectedRepairDocumentConfidenceMap = getLatestRepairDocumentConfidenceMap(selectedRepair, selectedDocumentId);
  const selectedRepairDocumentExtractedFields = getPayloadExtractedFields(selectedRepairDocumentPayload);
  const selectedRepairDocumentExtractedItems = getPayloadExtractedItems(selectedRepairDocumentPayload);
  const selectedRepairDocumentOcrServiceName =
    typeof selectedRepairDocumentExtractedFields?.service_name === "string"
      ? selectedRepairDocumentExtractedFields.service_name.trim()
      : "";
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
  const selectedRepairDocumentWorks = Array.isArray(selectedRepairDocumentExtractedItems?.works)
    ? selectedRepairDocumentExtractedItems.works
    : [];
  const selectedRepairDocumentParts = Array.isArray(selectedRepairDocumentExtractedItems?.parts)
    ? selectedRepairDocumentExtractedItems.parts
    : [];
  const selectedRepairUnresolvedChecks = selectedRepair
    ? selectedRepair.checks.filter((item) => !item.is_resolved)
    : [];
  const selectedRepairAwaitingOcr = repairHasDocumentsAwaitingOcr(selectedRepair);
  const selectedRepairHasBlockingFindings = selectedRepairUnresolvedChecks.some(
    (item) => item.severity === "suspicious" || item.severity === "error",
  );
  const selectedRepairReportSections = groupRepairChecksForReport(selectedRepairUnresolvedChecks);
  const selectedRepairDocumentManualReviewReasons =
    Array.isArray(selectedRepairDocumentPayload?.manual_review_reasons)
      ? selectedRepairDocumentPayload.manual_review_reasons.filter((item): item is string => typeof item === "string")
      : [];
  const repairVisualBars = buildRepairVisualBars(summary, dataQuality);
  const repairVisualMax = Math.max(...repairVisualBars.map((item) => item.value), 0);
  const qualityVisualBars = buildQualityVisualBars(dataQuality);
  const qualityVisualMax = Math.max(...qualityVisualBars.map((item) => item.value), 0);
  const attentionVisualBars = buildAttentionVisualBars(dataQualityDetails);
  const attentionVisualMax = Math.max(...attentionVisualBars.map((item) => item.value), 0);
  const topAttentionServices = dataQualityDetails?.services.slice(0, 5) || [];
  const reviewRequiredFieldComparisons: ReviewRequiredFieldComparisonItem[] = selectedRepair
    ? [
        {
          key: "vehicle",
          label: "Машина",
          currentValue:
            !isPlaceholderVehicle(selectedRepair.vehicle.external_id) &&
            (selectedRepair.vehicle.plate_number || selectedRepair.vehicle.model || selectedRepair.vehicle.id)
              ? selectedRepair.vehicle.plate_number || selectedRepair.vehicle.model || `ID ${selectedRepair.vehicle.id}`
              : "",
          ocrValue:
            typeof selectedRepairDocumentExtractedFields?.plate_number === "string"
              ? selectedRepairDocumentExtractedFields.plate_number
              : typeof selectedRepairDocumentExtractedFields?.vin === "string"
                ? selectedRepairDocumentExtractedFields.vin
                : "",
          currentDisplay:
            !isPlaceholderVehicle(selectedRepair.vehicle.external_id) &&
            (selectedRepair.vehicle.plate_number || selectedRepair.vehicle.model || selectedRepair.vehicle.id)
              ? selectedRepair.vehicle.plate_number || selectedRepair.vehicle.model || `ID ${selectedRepair.vehicle.id}`
              : "Не привязана",
          ocrDisplay:
            typeof selectedRepairDocumentExtractedFields?.plate_number === "string"
              ? selectedRepairDocumentExtractedFields.plate_number
              : typeof selectedRepairDocumentExtractedFields?.vin === "string"
                ? selectedRepairDocumentExtractedFields.vin
                : "—",
          status:
            !isPlaceholderVehicle(selectedRepair.vehicle.external_id) &&
            (selectedRepair.vehicle.plate_number || selectedRepair.vehicle.model || selectedRepair.vehicle.id)
              ? "match"
              : "missing",
          confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "plate_number", "vin"),
        },
        {
          key: "order_number",
          label: "Номер заказ-наряда",
          currentValue: selectedRepair.order_number || "",
          ocrValue: selectedRepairDocumentExtractedFields?.order_number,
          currentDisplay: selectedRepair.order_number || "—",
          ocrDisplay: String(selectedRepairDocumentExtractedFields?.order_number || "—"),
          confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "order_number"),
          status: getReviewComparisonStatus(selectedRepair.order_number, selectedRepairDocumentExtractedFields?.order_number),
        },
        {
          key: "repair_date",
          label: "Дата ремонта",
          currentValue: selectedRepair.repair_date || "",
          ocrValue: selectedRepairDocumentExtractedFields?.repair_date,
          currentDisplay: selectedRepair.repair_date || "—",
          ocrDisplay: String(selectedRepairDocumentExtractedFields?.repair_date || "—"),
          confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "repair_date"),
          status: getReviewComparisonStatus(selectedRepair.repair_date, selectedRepairDocumentExtractedFields?.repair_date),
        },
        {
          key: "service",
          label: "Сервис",
          currentValue: selectedRepair.service?.name || "",
          ocrValue: selectedRepairDocumentExtractedFields?.service_name,
          currentDisplay: selectedRepair.service?.name || "—",
          ocrDisplay: String(selectedRepairDocumentExtractedFields?.service_name || "—"),
          confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "service_name"),
          status: getReviewComparisonStatus(selectedRepair.service?.name, selectedRepairDocumentExtractedFields?.service_name),
        },
        {
          key: "mileage",
          label: "Пробег",
          currentValue: selectedRepair.mileage,
          ocrValue: selectedRepairDocumentExtractedFields?.mileage,
          currentDisplay: selectedRepair.mileage > 0 ? String(selectedRepair.mileage) : "—",
          ocrDisplay: String(selectedRepairDocumentExtractedFields?.mileage || "—"),
          confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "mileage"),
          status: getReviewComparisonStatus(selectedRepair.mileage, selectedRepairDocumentExtractedFields?.mileage, "int"),
        },
        {
          key: "grand_total",
          label: "Итоговая сумма",
          currentValue: selectedRepair.grand_total,
          ocrValue: selectedRepairDocumentExtractedFields?.grand_total,
          currentDisplay: formatMoney(selectedRepair.grand_total) || "—",
          ocrDisplay:
            typeof selectedRepairDocumentExtractedFields?.grand_total === "number"
              ? formatMoney(selectedRepairDocumentExtractedFields.grand_total) || "—"
              : "—",
          confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "grand_total"),
          status: getReviewComparisonStatus(selectedRepair.grand_total, selectedRepairDocumentExtractedFields?.grand_total, "money"),
        },
      ]
    : [];
  const selectedRepairDocumentFieldSnapshots = [
    {
      key: "order_number",
      label: "Номер заказ-наряда",
      value: String(selectedRepairDocumentExtractedFields?.order_number || "—"),
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "order_number"),
    },
    {
      key: "repair_date",
      label: "Дата ремонта",
      value: String(selectedRepairDocumentExtractedFields?.repair_date || "—"),
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "repair_date"),
    },
    {
      key: "service_name",
      label: "Сервис по OCR",
      value: selectedRepairDocumentOcrServiceName || "—",
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "service_name"),
    },
    {
      key: "mileage",
      label: "Пробег",
      value: String(selectedRepairDocumentExtractedFields?.mileage || "—"),
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "mileage"),
    },
    {
      key: "plate_number",
      label: "Госномер",
      value: String(selectedRepairDocumentExtractedFields?.plate_number || "—"),
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "plate_number"),
    },
    {
      key: "vin",
      label: "VIN",
      value: String(selectedRepairDocumentExtractedFields?.vin || "—"),
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "vin"),
    },
    {
      key: "grand_total",
      label: "Итоговая сумма",
      value:
        typeof selectedRepairDocumentExtractedFields?.grand_total === "number"
          ? formatMoney(selectedRepairDocumentExtractedFields.grand_total) || "—"
          : "—",
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "grand_total"),
    },
    {
      key: "work_total",
      label: "Работы",
      value:
        typeof selectedRepairDocumentExtractedFields?.work_total === "number"
          ? formatMoney(selectedRepairDocumentExtractedFields.work_total) || "—"
          : "—",
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "work_total"),
    },
    {
      key: "parts_total",
      label: "Запчасти",
      value:
        typeof selectedRepairDocumentExtractedFields?.parts_total === "number"
          ? formatMoney(selectedRepairDocumentExtractedFields.parts_total) || "—"
          : "—",
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "parts_total"),
    },
    {
      key: "vat_total",
      label: "НДС",
      value:
        typeof selectedRepairDocumentExtractedFields?.vat_total === "number"
          ? formatMoney(selectedRepairDocumentExtractedFields.vat_total) || "—"
          : "—",
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "vat_total"),
    },
  ].filter((item) => item.value !== "—" || item.confidenceValue !== null);
  const reviewMissingRequiredFields = reviewRequiredFieldComparisons
    .filter((item) => item.status === "missing")
    .map((item) => item.label);
  const selectedRepairComparisonAttentionCount = reviewRequiredFieldComparisons.filter(
    (item) => item.status === "missing" || item.status === "mismatch",
  ).length;
  const reviewReadyFieldsCount = reviewRequiredFieldComparisons.filter((item) => item.status !== "missing").length;
  const canConfirmSelectedReview = reviewMissingRequiredFields.length === 0;
  const uploadMissingRequirements = [
    !selectedFile ? "файл" : null,
  ].filter(Boolean) as string[];
  const canLinkVehicleFromSelectedDocument =
    selectedDocumentId !== null &&
    Boolean(selectedRepair) &&
    isPlaceholderVehicle(selectedRepair?.vehicle.external_id);
  const canCreateVehicleFromSelectedDocument =
    user?.role === "admin" &&
    isPlaceholderVehicle(selectedRepair?.vehicle.external_id) &&
    selectedDocumentId !== null;
  const filteredRepairHistory = selectedRepair
    ? selectedRepair.history.filter((entry) => {
        if (historyFilter === "documents" || historyFilter === "uploads") {
          return false;
        }
        if (historyFilter === "primary" && entry.action_type !== "primary_document_changed") {
          return false;
        }
        if (historyFilter === "comparison" && entry.action_type !== "document_comparison_reviewed") {
          return false;
        }
        return matchesTextSearch(
          [
            entry.user_name,
            entry.action_type,
            JSON.stringify(entry.old_value),
            JSON.stringify(entry.new_value),
          ],
          historySearch,
        );
      })
    : [];
  const filteredDocumentHistory = selectedRepair
    ? selectedRepair.document_history.filter((entry) => {
        if (historyFilter === "repair") {
          return false;
        }
        if (
          historyFilter === "uploads" &&
          entry.action_type !== "document_uploaded" &&
          entry.action_type !== "document_attached"
        ) {
          return false;
        }
        if (
          historyFilter === "primary" &&
          entry.action_type !== "set_primary" &&
          entry.action_type !== "primary_document_changed"
        ) {
          return false;
        }
        if (historyFilter === "comparison" && !entry.action_type.startsWith("comparison_")) {
          return false;
        }
        return matchesTextSearch(
          [
            entry.user_name,
            entry.action_type,
            entry.document_filename,
            entry.document_kind ? formatDocumentKind(entry.document_kind) : null,
            JSON.stringify(entry.old_value),
            JSON.stringify(entry.new_value),
          ],
          historySearch,
        );
      })
    : [];

  function buildRouteFromState(targetWorkspaceTab: WorkspaceTab = activeWorkspaceTab): AppRoute {
    return buildAppRouteFromState(
      {
        activeWorkspaceTab,
        activeAdminTab,
        activeTechAdminTab,
        activeRepairTab,
        fleetViewMode,
        selectedFleetVehicleId,
        selectedRepairId: selectedRepair?.id ?? null,
        selectedDocumentId,
      },
      targetWorkspaceTab,
    );
  }

  function updateBrowserRoute(route: AppRoute, mode: "push" | "replace" = "replace") {
    const nextUrl = buildAppRouteUrl(route);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      if (mode === "push") {
        window.history.pushState({}, "", nextUrl);
      } else {
        window.history.replaceState({}, "", nextUrl);
      }
    }
    setRouteSnapshot((current) => (areAppRoutesEqual(current, route) ? current : route));
  }

  function handleWorkspaceTabChange(value: WorkspaceTab) {
    if (value === activeWorkspaceTab) {
      return;
    }
    setActiveWorkspaceTab(value);
    updateBrowserRoute(buildRouteFromState(value), "push");
  }

  function handleAdminTabChange(value: AdminTab) {
    setActiveAdminTab(value);
    if (activeWorkspaceTab === "admin") {
      updateBrowserRoute({ workspace: "admin", adminTab: value });
    }
  }

  function handleTechAdminTabChange(value: TechAdminTab) {
    setActiveTechAdminTab(value);
    if (activeWorkspaceTab === "tech_admin") {
      updateBrowserRoute({ workspace: "tech_admin", techAdminTab: value });
    }
  }

  function handleRepairTabChange(value: RepairTab) {
    setActiveRepairTab(value);
    if (activeWorkspaceTab === "repair") {
      updateBrowserRoute({
        workspace: "repair",
        repairId: selectedRepair?.id ?? null,
        repairTab: value,
        documentId: selectedDocumentId,
      });
    }
  }

  useEffect(() => {
    if (user?.role === "admin") {
      return;
    }
    if (activeWorkspaceTab === "admin" || activeWorkspaceTab === "tech_admin") {
      setActiveWorkspaceTab("documents");
    }
    if (showTechAdminTab) {
      setShowTechAdminTab(false);
    }
  }, [activeWorkspaceTab, showTechAdminTab, user?.role]);

  useEffect(() => {
    const handlePopState = () => {
      setRouteSnapshot(readAppRoute(window.location));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (routeSnapshot.workspace === "documents") {
      if (activeWorkspaceTab !== "documents") {
        setActiveWorkspaceTab("documents");
      }
      return;
    }

    if (routeSnapshot.workspace === "search") {
      if (activeWorkspaceTab !== "search") {
        setActiveWorkspaceTab("search");
      }
      return;
    }

    if (routeSnapshot.workspace === "audit") {
      if (activeWorkspaceTab !== "audit") {
        setActiveWorkspaceTab("audit");
      }
      return;
    }

    if (routeSnapshot.workspace === "admin") {
      if (user?.role !== "admin") {
        updateBrowserRoute({ workspace: "documents" });
        return;
      }
      if (activeWorkspaceTab !== "admin") {
        setActiveWorkspaceTab("admin");
      }
      if (activeAdminTab !== routeSnapshot.adminTab) {
        setActiveAdminTab(routeSnapshot.adminTab);
      }
      return;
    }

    if (routeSnapshot.workspace === "tech_admin") {
      if (user?.role !== "admin") {
        updateBrowserRoute({ workspace: "documents" });
        return;
      }
      if (!showTechAdminTab) {
        setShowTechAdminTab(true);
      }
      if (activeWorkspaceTab !== "tech_admin") {
        setActiveWorkspaceTab("tech_admin");
      }
      if (activeTechAdminTab !== routeSnapshot.techAdminTab) {
        setActiveTechAdminTab(routeSnapshot.techAdminTab);
      }
      return;
    }

    if (routeSnapshot.workspace === "fleet") {
      if (activeWorkspaceTab !== "fleet") {
        setActiveWorkspaceTab("fleet");
      }
      if (routeSnapshot.vehicleId !== null && selectedFleetVehicleId !== routeSnapshot.vehicleId) {
        setSelectedFleetVehicleId(routeSnapshot.vehicleId);
      }
      if (fleetViewMode !== (routeSnapshot.vehicleId !== null ? "detail" : "list")) {
        setFleetViewMode(routeSnapshot.vehicleId !== null ? "detail" : "list");
      }
      return;
    }

    if (activeWorkspaceTab !== "repair") {
      setActiveWorkspaceTab("repair");
    }
    if (activeRepairTab !== routeSnapshot.repairTab) {
      setActiveRepairTab(routeSnapshot.repairTab);
    }
    if (routeSnapshot.documentId !== null && selectedDocumentId !== routeSnapshot.documentId) {
      setSelectedDocumentId(routeSnapshot.documentId);
    }
    if (!token || routeSnapshot.repairId === null) {
      return;
    }
    const repairMatches = selectedRepair?.id === routeSnapshot.repairId;
    const documentMatches = routeSnapshot.documentId === null || selectedDocumentId === routeSnapshot.documentId;
    if (!repairMatches || !documentMatches) {
      void loadRepairDetail(token, routeSnapshot.repairId, routeSnapshot.documentId, {
        silent: repairMatches,
        resetTransientState: !repairMatches,
      });
    }
  }, [
    activeAdminTab,
    activeRepairTab,
    activeTechAdminTab,
    activeWorkspaceTab,
    fleetViewMode,
    selectedDocumentId,
    selectedFleetVehicleId,
    selectedRepair?.id,
    showTechAdminTab,
    token,
    routeSnapshot,
    user?.role,
  ]);

  async function loadWorkspace(
    activeToken: string,
    reviewCategory: ReviewQueueCategory = selectedReviewCategory,
    options?: { silent?: boolean },
  ) {
    const silent = options?.silent ?? false;
    if (!silent) {
      setBootLoading(true);
    }
    try {
      const {
        me,
        dashboard,
        dataQualityPayload,
        dataQualityDetailsPayload,
        vehicleList,
        recentDocuments,
        reviewQueueData,
        laborNormCatalog,
        laborNormCatalogConfigs,
        servicesPayload,
        reviewRulesPayload,
        ocrRulesPayload,
        ocrProfileMatchersPayload,
        ocrLearningPayload,
        usersPayload,
        systemStatusPayload,
      } = await loadWorkspaceBootstrapData(activeToken, reviewCategory, {
        query: laborNormQuery,
        scope: laborNormScope,
        category: laborNormCategory,
      });

      const applyRecentDocuments = (items: DocumentItem[]) => {
        setDocuments(items);
        setLastUploadedDocument((current) => {
          if (!current) {
            return current;
          }
          return items.find((item) => item.id === current.id) ?? current;
        });
      };

      setUser(me);
      setSummary(dashboard);
      setDataQuality(dataQualityPayload);
      setDataQualityDetails(dataQualityDetailsPayload);
      setVehicles(vehicleList.items);
      applyBootstrapVehicleList(vehicleList);
      applyRecentDocuments(recentDocuments.items);
      applyBootstrapUsers(usersPayload);
      applyBootstrapLaborNorms({ laborNormCatalog, laborNormCatalogConfigs });
      setReviewQueue(reviewQueueData.items);
      setReviewQueueCounts(reviewQueueData.counts);
      applyBootstrapServices(servicesPayload);
      applyBootstrapReviewRules(reviewRulesPayload);
      applyBootstrapOcrAdmin({
        ocrRulesPayload,
        ocrProfileMatchersPayload,
        ocrLearningPayload,
        systemStatusPayload,
      });
      if (selectedDocumentId === null) {
        const defaultDocumentId =
          reviewQueueData.items[0]?.document.id ?? recentDocuments.items[0]?.id ?? null;
        if (defaultDocumentId !== null) {
          setSelectedDocumentId(defaultDocumentId);
        }
      }
      if (!silent) {
        setErrorMessage("");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось загрузить рабочее пространство";
      if (!silent) {
        setErrorMessage(message);
      }
      if (message.toLowerCase().includes("validate credentials")) {
        invalidateSession();
        setUser(null);
      }
    } finally {
      if (!silent) {
        setBootLoading(false);
      }
    }
  }

  async function loadRecentDocuments(activeToken: string) {
    const recentDocuments = await apiRequest<DocumentsResponse>("/documents?limit=8", { method: "GET" }, activeToken);
    setDocuments(recentDocuments.items);
    setLastUploadedDocument((current) => {
      if (!current) {
        return current;
      }
      return recentDocuments.items.find((item) => item.id === current.id) ?? current;
    });
  }

  async function loadRepairDetail(
    activeToken: string,
    repairId: number,
    preferredDocumentId: number | null,
    options?: { silent?: boolean; resetTransientState?: boolean },
  ) {
    const silent = options?.silent ?? false;
    const resetTransientState = options?.resetTransientState ?? true;

    if (!silent) {
      setRepairLoading(true);
      setErrorMessage("");
    }
    try {
      const payload = await apiRequest<RepairDetail>(`/repairs/${repairId}`, { method: "GET" }, activeToken);
      setSelectedRepair(payload);
      if (resetTransientState) {
        setCheckComments({});
        resetRepairDocumentsWorkflowState();
        setHistoryFilter("all");
        setHistorySearch("");
      }
      setSelectedDocumentId((current) => resolveRepairDocumentId(payload, preferredDocumentId ?? current));
      if (!isEditingRepair) {
        syncRepairDraftFromRepair(payload);
      }
      setLastUploadedDocument((current) => {
        if (!current) {
          return current;
        }
        const refreshedDocument = payload.documents.find((item) => item.id === current.id);
        if (!refreshedDocument) {
          return current;
        }
        const latestVersion = refreshedDocument.versions[refreshedDocument.versions.length - 1];
        return {
          ...current,
          mime_type: refreshedDocument.mime_type,
          status: refreshedDocument.status as DocumentStatus,
          is_primary: refreshedDocument.is_primary,
          ocr_confidence: refreshedDocument.ocr_confidence,
          review_queue_priority: refreshedDocument.review_queue_priority,
          notes: refreshedDocument.notes,
          created_at: refreshedDocument.created_at,
          parsed_payload: (latestVersion?.parsed_payload as DocumentItem["parsed_payload"]) ?? current.parsed_payload,
          repair: {
            id: payload.id,
            order_number: payload.order_number,
            repair_date: payload.repair_date,
            mileage: payload.mileage,
            status: payload.status,
          },
        };
      });
    } catch (error) {
      if (!silent) {
        setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить ремонт");
      }
    } finally {
      if (!silent) {
        setRepairLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!token) {
      setUser(null);
      setShowTechAdminTab(false);
      setShowPasswordChange(false);
      setActiveTechAdminTab("learning");
      setActiveQualityTab("documents");
      setSummary(null);
      setDataQuality(null);
      setDataQualityDetails(null);
      setVehicles([]);
      resetFleetState();
      resetOperationsState();
      resetLaborNormsState();
      resetReviewRulesState();
      resetReviewWorkflowState();
      resetRepairDocumentsWorkflowState();
      resetRepairEditingState();
      setDocuments([]);
      resetDocumentsWorkspaceState();
      resetUsersState();
      resetServicesState();
      resetOcrAdminState();
      resetBackupsState();
      resetHistoricalImportsState();
      setReviewQueue([]);
      setReviewQueueCounts({
        all: 0,
        suspicious: 0,
        ocr_error: 0,
        partial_recognition: 0,
        employee_confirmation: 0,
        manual_review: 0,
      });
      setSelectedDocumentId(null);
      setSelectedRepair(null);
      setDocumentVehicleForm(createEmptyDocumentVehicleForm());
      return;
    }
    void loadWorkspace(token, selectedReviewCategory);
  }, [selectedReviewCategory, token]);

  useEffect(() => {
    if (!token) {
      setSelectedRepair(null);
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
      setSelectedRepair(null);
      return;
    }

    const repairAlreadyLoaded = selectedRepair?.id === selectedRepairId;
    void loadRepairDetail(token, selectedRepairId, selectedDocumentId, {
      silent: repairAlreadyLoaded,
      resetTransientState: !repairAlreadyLoaded,
    });
  }, [documents, isEditingRepair, reviewQueue, selectedDocumentId, token]);

  useEffect(() => {
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
      if (shouldRefreshWorkspace && !workspaceAutoRefreshInFlightRef.current) {
        workspaceAutoRefreshInFlightRef.current = true;
        void loadRecentDocuments(token).finally(() => {
          workspaceAutoRefreshInFlightRef.current = false;
        });
      }

      if (shouldRefreshRepair && selectedRepair && !repairAutoRefreshInFlightRef.current) {
        repairAutoRefreshInFlightRef.current = true;
        void loadRepairDetail(token, selectedRepair.id, selectedDocumentId, {
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
  }, [documents, lastUploadedDocument, selectedDocumentId, selectedRepair, selectedReviewCategory, token]);

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

  async function openRepairByIds(documentId: number | null, repairId: number) {
    if (activeWorkspaceTab !== "repair") {
      repairReturnTabRef.current = activeWorkspaceTab;
      repairReturnRouteRef.current = buildRouteFromState(activeWorkspaceTab);
      repairScrollPositionRef.current = window.scrollY;
      setRepairHasReturnTarget(true);
    }
    setActiveWorkspaceTab("repair");
    setActiveRepairTab("overview");
    updateBrowserRoute({ workspace: "repair", repairId, repairTab: "overview", documentId }, "push");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (!token) {
      return;
    }
    await loadRepairDetail(token, repairId, documentId, { resetTransientState: true });
  }

  function returnFromRepairPage() {
    const nextTab = repairHasReturnTarget ? repairReturnTabRef.current : "documents";
    const nextRoute = repairHasReturnTarget ? repairReturnRouteRef.current : ({ workspace: "documents" } as const);
    setActiveWorkspaceTab(nextTab);
    updateBrowserRoute(nextRoute, "push");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: repairHasReturnTarget ? repairScrollPositionRef.current : 0, behavior: "auto" });
    });
  }

  async function openQualityRepair(documentId: number | null, repairId: number | null) {
    if (!repairId) {
      return;
    }
    await openRepairByIds(documentId, repairId);
  }

  async function openQualityService(name: string) {
    setActiveWorkspaceTab("admin");
    setActiveAdminTab("services");
    updateBrowserRoute({ workspace: "admin", adminTab: "services" }, "push");
    setServiceQuery(name);
    if (!token) {
      return;
    }
    try {
      await loadServices(name, "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось открыть список сервисов");
    }
  }

  async function handleExportRepair() {
    if (!token || !selectedRepair) {
      return;
    }
    setRepairExportLoading(true);
    setErrorMessage("");
    try {
      await downloadApiFile(`/repairs/${selectedRepair.id}/export`, token, `repair_${selectedRepair.id}.xlsx`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось выгрузить карточку ремонта");
    } finally {
      setRepairExportLoading(false);
    }
  }

  async function handleOpenRepair(document: DocumentItem) {
    await openRepairByIds(document.id, document.repair.id);
  }

  async function handleOpenReviewQueueItem(item: ReviewQueueItem) {
    await openRepairByIds(item.document.id, item.repair.id);
  }

  async function handleCheckResolution(checkId: number, isResolved: boolean) {
    if (!token || !selectedRepair) {
      return;
    }

    setCheckActionLoadingId(checkId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const updatedRepair = await apiRequest<RepairDetail>(
        `/repairs/${selectedRepair.id}/checks/${checkId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            is_resolved: isResolved,
            comment: checkComments[checkId]?.trim() || null,
          }),
        },
        token,
      );
      setSelectedRepair(updatedRepair);
      setCheckComments((current) => ({ ...current, [checkId]: "" }));
      setSuccessMessage(isResolved ? "Проверка закрыта" : "Проверка возвращена в работу");
      await loadWorkspace(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось обновить проверку ремонта");
    } finally {
      setCheckActionLoadingId(null);
    }
  }

  async function handleCreateVehicleFromDocument() {
    if (!token || !selectedRepair || selectedDocumentId === null || user?.role !== "admin") {
      return;
    }

    const normalizedPlate = documentVehicleForm.plate_number.trim();
    const normalizedVin = documentVehicleForm.vin.trim();
    if (!normalizedPlate && !normalizedVin) {
      setErrorMessage("Для создания карточки техники нужен хотя бы госномер или VIN");
      return;
    }

    setDocumentVehicleSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<DocumentCreateVehicleResponse>(
        `/documents/${selectedDocumentId}/create-vehicle`,
        {
          method: "POST",
          body: JSON.stringify({
            vehicle_type: documentVehicleForm.vehicle_type,
            plate_number: normalizedPlate || null,
            vin: normalizedVin || null,
            brand: documentVehicleForm.brand.trim() || null,
            model: documentVehicleForm.model.trim() || null,
            year: documentVehicleForm.year.trim() ? Number(documentVehicleForm.year.trim()) : null,
            comment: documentVehicleForm.comment.trim() || null,
          }),
        },
        token,
      );
      setSuccessMessage(result.message);
      await loadWorkspace(token);
      await openRepairByIds(result.document.id, result.repair_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось создать карточку техники");
    } finally {
      setDocumentVehicleSaving(false);
    }
  }

  function openTechAdmin(tab: TechAdminTab = "learning") {
    setShowTechAdminTab(true);
    setActiveWorkspaceTab("tech_admin");
    setActiveTechAdminTab(tab);
    updateBrowserRoute({ workspace: "tech_admin", techAdminTab: tab }, "push");
  }

  function closeTechAdmin() {
    setShowTechAdminTab(false);
    setActiveTechAdminTab("learning");
    setActiveWorkspaceTab("admin");
    updateBrowserRoute({ workspace: "admin", adminTab: activeAdminTab }, "push");
  }

  function openReviewRulesAdmin() {
    setActiveWorkspaceTab("admin");
    setActiveAdminTab("control");
    updateBrowserRoute({ workspace: "admin", adminTab: "control" }, "push");
  }

  function openLaborNormsAdmin() {
    setActiveWorkspaceTab("admin");
    setActiveAdminTab("labor_norms");
    updateBrowserRoute({ workspace: "admin", adminTab: "labor_norms" }, "push");
  }

  function handleEditService(item: ServiceItem) {
    setActiveWorkspaceTab("admin");
    setActiveAdminTab("services");
    updateBrowserRoute({ workspace: "admin", adminTab: "services" }, "push");
    editService(item);
  }

  function handleStartRepairEdit() {
    setActiveRepairTab("overview");
    startRepairEdit();
  }

  function handleCancelRepairEdit() {
    cancelRepairEdit();
  }

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
                  void handleOpenReviewQueueItem(item);
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
                  void handleOpenRepair(document);
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
              returnLabel: repairHasReturnTarget ? workspaceTabReturnLabels[repairReturnTabRef.current] : null,
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
