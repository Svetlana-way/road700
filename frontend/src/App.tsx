import { useEffect, useRef, useState, type FormEvent } from "react";
import { MenuItem } from "@mui/material";
import { AuthLandingView } from "./components/AuthLandingView";
import { HistoryDetailsPreview } from "./components/HistoryDetailsPreview";
import { WorkspaceMainView } from "./components/WorkspaceMainView";
import { TOKEN_STORAGE_KEY, apiRequest, downloadApiFile, downloadDocumentFile, loginRequest } from "./shared/api";
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
  parseOrderNumberFromFilename,
  parseRepairDateFromFilename,
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
  createCatalogFormFromItem,
  createEmptyCatalogForm,
  createEmptyDocumentVehicleForm,
  createEmptyLaborNormEntryForm,
  createEmptyOcrProfileMatcherForm,
  createEmptyOcrRuleForm,
  createEmptyReviewRuleForm,
  createEmptyServiceForm,
  createEmptyUserAssignmentForm,
  createEmptyUserForm,
  createLaborNormEntryFormFromItem,
  createOcrProfileMatcherFormFromItem,
  createOcrRuleFormFromItem,
  createReviewRuleFormFromItem,
  createServiceFormFromItem,
  createUserFormFromItem,
  joinEditorLines,
  splitEditorLines,
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
  buildFleetVehiclesQueryString,
  buildGlobalSearchQueryString,
  buildHistoricalWorkReferenceQueryString,
  buildImportConflictsQueryString,
  buildLaborNormQueryString,
  buildOcrLearningSignalsQueryString,
  buildOcrProfileMatchersQueryString,
  buildOcrRulesQueryString,
  buildServiceQueryString,
  buildUsersQueryString,
} from "./shared/queryBuilders";
import {
  createRepairDraft,
  createReviewRepairFieldsDraft,
  getDocumentPreviewKind,
  getReviewComparisonColor,
  getReviewComparisonLabel,
  getReviewComparisonStatus,
  readConfidenceValue,
  repairHasDocumentsAwaitingOcr,
  resolveRepairDocumentId,
  type ReviewComparisonStatus,
} from "./shared/repairUiHelpers";

type UserRole = "admin" | "employee";
type VehicleType = "truck" | "trailer";
type VehicleStatus = "active" | "in_repair" | "waiting_repair" | "inactive" | "decommissioned" | "archived";
type DocumentKind = "order" | "repeat_scan" | "attachment" | "confirmation";
type ServiceStatus = "preliminary" | "confirmed" | "archived";
type ImportStatus = "draft" | "processing" | "completed" | "completed_with_conflicts" | "failed";
type ImportJobStatus = "queued" | "retry" | "draft" | "processing" | "completed" | "completed_with_conflicts" | "failed";
type DocumentStatus =
  | "uploaded"
  | "recognized"
  | "partially_recognized"
  | "needs_review"
  | "confirmed"
  | "ocr_error"
  | "archived";

type DashboardSummary = {
  vehicles_total: number;
  repairs_total: number;
  repairs_draft: number;
  repairs_suspicious: number;
  documents_total: number;
  documents_review_queue: number;
};

type DashboardDataQuality = {
  average_ocr_confidence: number | null;
  documents_low_confidence: number;
  documents_ocr_error: number;
  documents_needs_review: number;
  services_preliminary: number;
  works_preliminary: number;
  parts_preliminary: number;
  import_conflicts_pending: number;
  repairs_suspicious: number;
};

type DashboardDataQualityDetails = {
  counts: {
    documents: number;
    services: number;
    works: number;
    parts: number;
    conflicts: number;
  };
  documents: Array<{
    document_id: number;
    repair_id: number | null;
    original_filename: string;
    document_status: string;
    repair_status: string | null;
    repair_date: string | null;
    ocr_confidence: number | null;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  }>;
  services: Array<{
    service_id: number;
    name: string;
    city: string | null;
    repairs_total: number;
    last_repair_date: string | null;
  }>;
  works: Array<{
    work_id: number;
    repair_id: number;
    document_id: number | null;
    work_name: string;
    line_total: number;
    repair_date: string;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  }>;
  parts: Array<{
    part_id: number;
    repair_id: number;
    document_id: number | null;
    part_name: string;
    line_total: number;
    repair_date: string;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  }>;
  conflicts: Array<{
    conflict_id: number;
    import_job_id: number;
    entity_type: string;
    conflict_key: string;
    source_filename: string | null;
    repair_id: number | null;
    document_id: number | null;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
    created_at: string;
  }>;
};

type GlobalSearchDocumentItem = {
  document_id: number;
  repair_id: number | null;
  vehicle_id: number | null;
  original_filename: string;
  document_status: DocumentStatus;
  ocr_confidence: number | null;
  order_number: string | null;
  repair_date: string | null;
  service_name: string | null;
  plate_number: string | null;
  vin: string | null;
  matched_by: string[];
  created_at: string;
};

type GlobalSearchRepairItem = {
  repair_id: number;
  vehicle_id: number;
  order_number: string | null;
  repair_date: string;
  repair_status: string;
  service_name: string | null;
  plate_number: string | null;
  vin: string | null;
  grand_total: number;
  matched_by: string[];
  created_at: string;
};

type GlobalSearchVehicleItem = {
  vehicle_id: number;
  vehicle_type: VehicleType;
  plate_number: string | null;
  vin: string | null;
  brand: string | null;
  model: string | null;
  status: VehicleStatus;
  archived_at: string | null;
  matched_by: string[];
  updated_at: string;
};

type GlobalSearchResponse = {
  query: string;
  documents_total: number;
  repairs_total: number;
  vehicles_total: number;
  documents: GlobalSearchDocumentItem[];
  repairs: GlobalSearchRepairItem[];
  vehicles: GlobalSearchVehicleItem[];
};

type AuditLogItem = {
  id: number;
  created_at: string;
  user_id: number | null;
  user_name: string | null;
  entity_type: string;
  entity_id: string;
  action_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

type AuditLogResponse = {
  items: AuditLogItem[];
  total: number;
  limit: number;
  offset: number;
  action_types: string[];
  entity_types: string[];
};

type User = {
  id: number;
  full_name: string;
  login: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

type UserAssignment = {
  id: number;
  vehicle_id: number;
  starts_at: string;
  ends_at: string | null;
  comment: string | null;
  vehicle: {
    id: number;
    vehicle_type: VehicleType;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  };
};

type UserItem = User & {
  created_at: string;
  updated_at: string;
  assignments: UserAssignment[];
};

type UsersResponse = {
  items: UserItem[];
  total: number;
};

type UserFormState = {
  id: number | null;
  full_name: string;
  login: string;
  email: string;
  role: UserRole;
  is_active: "true" | "false";
  password: string;
};

type UserAssignmentFormState = {
  starts_at: string;
  ends_at: string;
  comment: string;
};

type Vehicle = {
  id: number;
  external_id: string | null;
  vehicle_type: VehicleType;
  vin: string | null;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  column_name: string | null;
  mechanic_name: string | null;
  current_driver_name: string | null;
  last_coordinates_at: string | null;
  comment: string | null;
  status: VehicleStatus;
  archived_at: string | null;
  historical_repairs_total: number;
  historical_last_repair_date: string | null;
  created_at: string;
  updated_at: string;
};

type VehiclesResponse = {
  items: Vehicle[];
  total: number;
  limit: number;
  offset: number;
};

type VehicleUpdatePayload = {
  status?: VehicleStatus;
  comment?: string | null;
};

type VehicleLink = {
  id: number;
  left_vehicle_id: number;
  right_vehicle_id: number;
  starts_at: string;
  ends_at: string | null;
  comment: string | null;
};

type VehicleActiveAssignment = {
  id: number;
  user_id: number;
  starts_at: string;
  ends_at: string | null;
  comment: string | null;
  user: {
    id: number;
    full_name: string;
    email: string;
    role: UserRole;
  };
};

type VehicleRepairHistoryItem = {
  repair_id: number;
  order_number: string | null;
  repair_date: string;
  mileage: number;
  status: string;
  service_name: string | null;
  grand_total: number;
  documents_total: number;
  created_at: string;
  updated_at: string;
};

type VehicleHistorySummary = {
  repairs_total: number;
  documents_total: number;
  confirmed_repairs: number;
  suspicious_repairs: number;
  last_repair_date: string | null;
  last_mileage: number | null;
};

type VehicleHistoricalRepairHistoryItem = {
  repair_id: number;
  order_number: string | null;
  repair_date: string;
  mileage: number;
  service_name: string | null;
  grand_total: number;
  employee_comment: string | null;
  created_at: string;
  updated_at: string;
};

type VehicleHistoricalHistorySummary = {
  repairs_total: number;
  services_total: number;
  total_spend: number;
  first_repair_date: string | null;
  last_repair_date: string | null;
  last_mileage: number | null;
};

type VehicleDetail = Vehicle & {
  active_links: VehicleLink[];
  active_assignments: VehicleActiveAssignment[];
  repair_history: VehicleRepairHistoryItem[];
  history_summary: VehicleHistorySummary;
  historical_repair_history: VehicleHistoricalRepairHistoryItem[];
  historical_history_summary: VehicleHistoricalHistorySummary;
};

type ServiceItem = {
  id: number;
  name: string;
  city: string | null;
  contact: string | null;
  comment: string | null;
  status: ServiceStatus;
  created_by_user_id: number | null;
  confirmed_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

type HistoricalRepairImportResponse = {
  message: string;
  job_id: number;
  status: ImportStatus;
  source_filename: string;
  rows_total: number;
  grouped_repairs: number;
  created_repairs: number;
  duplicate_repairs: number;
  conflicts_created: number;
  created_services: number;
  created_works: number;
  created_parts: number;
  repair_limit_applied: number | null;
  first_repair_id: number | null;
  recent_repair_ids: number[];
  sample_conflicts: string[];
};

type HistoricalWorkReferenceServiceItem = {
  service_id: number | null;
  service_name: string;
  samples: number;
};

type HistoricalWorkReferenceItem = {
  key: string;
  work_code: string | null;
  work_name: string;
  normalized_name: string;
  sample_repairs: number;
  sample_lines: number;
  historical_sample_repairs: number;
  historical_sample_lines: number;
  operational_sample_repairs: number;
  operational_sample_lines: number;
  services_count: number;
  vehicle_types: string[];
  median_line_total: number;
  min_line_total: number;
  max_line_total: number;
  median_price: number;
  median_quantity: number;
  median_mileage: number | null;
  min_mileage: number | null;
  max_mileage: number | null;
  median_standard_hours: number | null;
  median_actual_hours: number | null;
  recent_repair_date: string | null;
  recent_operational_repair_date: string | null;
  top_services: HistoricalWorkReferenceServiceItem[];
};

type HistoricalWorkReferenceResponse = {
  items: HistoricalWorkReferenceItem[];
  total: number;
  limit: number;
  q: string | null;
  min_samples: number;
};

type ImportJobItem = {
  id: number;
  import_type: string;
  source_filename: string;
  status: ImportStatus;
  summary: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type ImportJobsResponse = {
  items: ImportJobItem[];
};

type ImportConflictItem = {
  id: number;
  import_job_id: number;
  entity_type: string;
  conflict_key: string;
  incoming_payload: Record<string, unknown> | null;
  existing_payload: Record<string, unknown> | null;
  resolution_payload: Record<string, unknown> | null;
  status: string;
  source_filename: string | null;
  created_at: string;
  updated_at: string;
};

type ImportConflictsResponse = {
  items: ImportConflictItem[];
};

type ImportConflictResolveResponse = {
  message: string;
  conflict: ImportConflictItem;
};

type ServicesResponse = {
  items: ServiceItem[];
  total: number;
  limit: number;
  offset: number;
  cities: string[];
};

type ServiceFormState = {
  id: number | null;
  name: string;
  city: string;
  contact: string;
  comment: string;
  status: ServiceStatus;
};

type OcrRuleItem = {
  id: number;
  profile_scope: string;
  target_field: string;
  pattern: string;
  value_parser: string;
  confidence: number;
  priority: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type OcrRuleResponse = {
  items: OcrRuleItem[];
  profile_scopes: string[];
  target_fields: string[];
};

type OcrRuleFormState = {
  id: number | null;
  profile_scope: string;
  target_field: string;
  pattern: string;
  value_parser: string;
  confidence: string;
  priority: string;
  is_active: "true" | "false";
  notes: string;
};

type OcrProfileMatcherItem = {
  id: number;
  profile_scope: string;
  title: string;
  source_type: string | null;
  filename_pattern: string | null;
  text_pattern: string | null;
  service_name_pattern: string | null;
  priority: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type OcrProfileMatcherResponse = {
  items: OcrProfileMatcherItem[];
  profile_scopes: string[];
};

type OcrProfileMatcherFormState = {
  id: number | null;
  profile_scope: string;
  title: string;
  source_type: string;
  filename_pattern: string;
  text_pattern: string;
  service_name_pattern: string;
  priority: string;
  is_active: "true" | "false";
  notes: string;
};

type OcrLearningSignalItem = {
  id: number;
  repair_id: number;
  document_id: number | null;
  document_version_id: number | null;
  created_by_user_id: number | null;
  signal_type: string;
  target_field: string;
  ocr_profile_scope: string | null;
  extracted_value: string | null;
  corrected_value: string;
  service_name: string | null;
  source_type: string | null;
  document_filename: string | null;
  text_excerpt: string | null;
  suggestion_summary: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type OcrLearningSummaryItem = {
  target_field: string;
  ocr_profile_scope: string | null;
  signal_type: string;
  count: number;
  suggestion_summary: string;
  example_services: string[];
  example_filenames: string[];
};

type SystemStatus = {
  password_recovery_delivery_mode: "email" | "manual";
  password_recovery_email_configured: boolean;
};

type BackupItem = {
  backup_id: string;
  filename: string;
  created_at: string;
  backup_type: string;
  source: string;
  status: string;
  size_bytes: number;
  storage_files_total: number;
  tables_total: number;
};

type BackupListResponse = {
  items: BackupItem[];
  total: number;
};

type BackupCreateResponse = {
  message: string;
  backup: BackupItem;
};

type BackupRestoreResponse = {
  message: string;
  backup: BackupItem;
};

type OcrLearningResponse = {
  items: OcrLearningSignalItem[];
  summaries: OcrLearningSummaryItem[];
  total: number;
  statuses: string[];
  target_fields: string[];
  profile_scopes: string[];
};

type OcrLearningDraftsResponse = {
  signal: OcrLearningSignalItem;
  ocr_rule_draft: {
    profile_scope: string;
    target_field: string;
    pattern: string;
    value_parser: string;
    confidence: number;
    priority: number;
    notes: string | null;
  };
  matcher_draft: {
    profile_scope: string;
    title: string;
    source_type: string | null;
    filename_pattern: string | null;
    text_pattern: string | null;
    service_name_pattern: string | null;
    priority: number;
    notes: string | null;
  };
};

type VehiclePreview = {
  id: number;
  external_id?: string | null;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
};

type DocumentItem = {
  id: number;
  original_filename: string;
  source_type: string;
  kind: DocumentKind;
  mime_type?: string | null;
  status: DocumentStatus;
  is_primary?: boolean;
  ocr_confidence?: number | null;
  review_queue_priority?: number;
  created_at: string;
  notes: string | null;
  parsed_payload?: {
    extracted_fields?: {
      order_number?: string;
      mileage?: number;
      grand_total?: number;
      service_name?: string;
      plate_number?: string;
      vin?: string;
      repair_date?: string;
    };
    extracted_items?: {
      works?: Array<Record<string, unknown>>;
      parts?: Array<Record<string, unknown>>;
    };
    manual_review_reasons?: string[];
    labor_norm_applicability?: {
      eligible?: boolean;
      reason?: string;
      matched_count?: number;
      unmatched_count?: number;
      brand_family?: string | null;
    };
  } | null;
  repair: {
    id: number;
    order_number: string | null;
    repair_date: string;
    mileage: number;
    status: string;
  };
  vehicle: {
    id: number;
    external_id: string | null;
    vehicle_type: VehicleType;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  };
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
};

type DocumentsResponse = {
  items: DocumentItem[];
};

type DocumentUploadResponse = {
  document: DocumentItem;
  message: string;
  job_id?: number | null;
  import_status?: string | null;
};

type DocumentBatchProcessResponse = {
  processed_count: number;
  document_ids: number[];
  job_ids?: number[];
  status_counts: Record<string, number>;
  message: string;
};

type LaborNormCatalogItem = {
  id: number;
  scope: string;
  brand_family: string | null;
  catalog_name: string | null;
  code: string;
  category: string | null;
  name_ru: string;
  name_ru_alt: string | null;
  name_cn: string | null;
  name_en: string | null;
  normalized_name: string;
  standard_hours: number;
  source_sheet: string | null;
  source_file: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type LaborNormCatalogConfigItem = {
  id: number;
  scope: string;
  catalog_name: string;
  brand_family: string | null;
  vehicle_type: VehicleType | null;
  year_from: number | null;
  year_to: number | null;
  brand_keywords: string[] | null;
  model_keywords: string[] | null;
  vin_prefixes: string[] | null;
  priority: number;
  auto_match_enabled: boolean;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type LaborNormCatalogConfigResponse = {
  items: LaborNormCatalogConfigItem[];
  scopes: string[];
};

type LaborNormCatalogResponse = {
  items: LaborNormCatalogItem[];
  total: number;
  limit: number;
  offset: number;
  scopes: string[];
  categories: string[];
  source_files: string[];
};

type LaborNormImportResponse = {
  message: string;
  filename: string;
  imported_at: string;
  created: number;
  updated: number;
  skipped: number;
};

type LaborNormCatalogFormState = {
  scope: string;
  catalog_name: string;
  brand_family: string;
  vehicle_type: "" | VehicleType;
  year_from: string;
  year_to: string;
  brand_keywords: string;
  model_keywords: string;
  vin_prefixes: string;
  priority: string;
  auto_match_enabled: "true" | "false";
  status: string;
  notes: string;
};

type LaborNormEntryFormState = {
  id: number | null;
  scope: string;
  code: string;
  category: string;
  name_ru: string;
  name_ru_alt: string;
  name_cn: string;
  name_en: string;
  standard_hours: string;
  source_sheet: string;
  source_file: string;
  status: string;
};

type ReviewPriorityBucket = "review" | "critical" | "suspicious";
type HistoryFilter = "all" | "repair" | "documents" | "uploads" | "primary" | "comparison";
type QualityDetailTab = "documents" | "services" | "works" | "parts" | "conflicts";
type ReviewQueueCategory =
  | "all"
  | "suspicious"
  | "ocr_error"
  | "partial_recognition"
  | "employee_confirmation"
  | "manual_review";

type ReviewQueueItem = {
  category: ReviewQueueCategory;
  priority_score: number;
  priority_bucket: ReviewPriorityBucket;
  issue_count: number;
  issue_titles: string[];
  manual_review_reasons: string[];
  extracted_order_number: string | null;
  extracted_grand_total: number | null;
  document: {
    id: number;
    original_filename: string;
    source_type: string;
    kind: DocumentKind;
    status: DocumentStatus;
    created_at: string;
    updated_at: string;
    ocr_confidence: number | null;
    review_queue_priority: number;
  };
  repair: {
    id: number;
    order_number: string | null;
    repair_date: string;
    mileage: number;
    status: string;
    is_partially_recognized: boolean;
    unresolved_checks_total: number;
    suspicious_checks_total: number;
  };
  vehicle: {
    id: number;
    external_id: string | null;
    vehicle_type: VehicleType;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  };
};

type DocumentVehicleFormState = {
  vehicle_type: VehicleType;
  plate_number: string;
  vin: string;
  brand: string;
  model: string;
  year: string;
  comment: string;
};

type DocumentCreateVehicleResponse = {
  message: string;
  repair_id: number;
  created_new_vehicle: boolean;
  document: DocumentItem;
};

type ReviewQueueResponse = {
  items: ReviewQueueItem[];
  counts: Record<ReviewQueueCategory, number>;
  total: number;
  limit: number;
  offset: number;
};

type ReviewRuleItem = {
  id: number;
  rule_type: string;
  code: string;
  title: string;
  weight: number;
  bucket_override: string | null;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ReviewRuleResponse = {
  items: ReviewRuleItem[];
  rule_types: string[];
};

type ReviewRuleFormState = {
  id: number | null;
  rule_type: string;
  code: string;
  title: string;
  weight: string;
  bucket_override: string;
  is_active: "true" | "false";
  sort_order: string;
  notes: string;
};

type ReviewActionResponse = {
  message: string;
  document_id: number;
  repair_id: number;
  document_status: DocumentStatus;
  repair_status: string;
  queue_item: ReviewQueueItem | null;
};

type DocumentComparisonResponse = {
  left_document: DocumentItem;
  right_document: DocumentItem;
  compared_fields: Array<{
    field_name: string;
    label: string;
    left_value: string | null;
    right_value: string | null;
    is_different: boolean;
  }>;
  works_count_left: number;
  works_count_right: number;
  parts_count_left: number;
  parts_count_right: number;
};

type DocumentComparisonReviewResponse = {
  message: string;
  action: string;
  document_id: number;
  repair_id: number;
  source_document_id: number | null;
};

type LoginResponse = {
  access_token: string;
};

type ChangePasswordResponse = {
  message: string;
};

type RepairDeleteResponse = {
  message: string;
  deleted_repair_id: number;
};

type PasswordResetRequestResponse = {
  message: string;
  delivery_method: string;
};

type PasswordResetConfirmResponse = {
  message: string;
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

type EditableWorkDraft = {
  work_code: string;
  work_name: string;
  quantity: number;
  standard_hours: number | "";
  actual_hours: number | "";
  price: number;
  line_total: number;
  status: string;
};

type EditablePartDraft = {
  article: string;
  part_name: string;
  quantity: number;
  unit_name: string;
  price: number;
  line_total: number;
  status: string;
};

type EditableRepairDraft = {
  order_number: string;
  repair_date: string;
  mileage: number;
  reason: string;
  employee_comment: string;
  service_name: string;
  work_total: number;
  parts_total: number;
  vat_total: number;
  grand_total: number;
  status: string;
  is_preliminary: boolean;
  works: EditableWorkDraft[];
  parts: EditablePartDraft[];
};

type ReviewRepairFieldsDraft = {
  order_number: string;
  repair_date: string;
  mileage: string;
  work_total: string;
  parts_total: string;
  vat_total: string;
  grand_total: string;
  reason: string;
  employee_comment: string;
};

type ReviewRequiredFieldComparisonItem = {
  key: string;
  label: string;
  currentValue: unknown;
  ocrValue: unknown;
  currentDisplay: string;
  ocrDisplay: string;
  confidenceValue: number | null;
  status: ReviewComparisonStatus;
};

type UploadFormState = {
  vehicleId: string;
  documentKind: DocumentKind;
  repairDate: string;
  mileage: string;
  orderNumber: string;
  reason: string;
  employeeComment: string;
  notes: string;
};

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
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || "");
  const [routeSnapshot, setRouteSnapshot] = useState<AppRoute>(() => readAppRoute(window.location));
  const [user, setUser] = useState<User | null>(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<WorkspaceTab>("documents");
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>("services");
  const [activeTechAdminTab, setActiveTechAdminTab] = useState<TechAdminTab>("learning");
  const [activeRepairTab, setActiveRepairTab] = useState<RepairTab>("overview");
  const [activeQualityTab, setActiveQualityTab] = useState<QualityDetailTab>("documents");
  const [showQualityDialog, setShowQualityDialog] = useState(false);
  const [showTechAdminTab, setShowTechAdminTab] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showPasswordRecoveryRequest, setShowPasswordRecoveryRequest] = useState(false);
  const [showServiceEditor, setShowServiceEditor] = useState(false);
  const [showServiceListDialog, setShowServiceListDialog] = useState(false);
  const [showReviewRuleEditor, setShowReviewRuleEditor] = useState(false);
  const [showReviewRuleListDialog, setShowReviewRuleListDialog] = useState(false);
  const [showLaborNormCatalogEditor, setShowLaborNormCatalogEditor] = useState(false);
  const [showLaborNormImport, setShowLaborNormImport] = useState(false);
  const [showLaborNormEntryEditor, setShowLaborNormEntryEditor] = useState(false);
  const [showLaborNormListDialog, setShowLaborNormListDialog] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [dataQuality, setDataQuality] = useState<DashboardDataQuality | null>(null);
  const [dataQualityDetails, setDataQualityDetails] = useState<DashboardDataQualityDetails | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [fleetVehicles, setFleetVehicles] = useState<Vehicle[]>([]);
  const [fleetVehiclesTotal, setFleetVehiclesTotal] = useState(0);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [fleetQuery, setFleetQuery] = useState("");
  const [fleetVehicleTypeFilter, setFleetVehicleTypeFilter] = useState<"" | VehicleType>("");
  const [fleetStatusFilter, setFleetStatusFilter] = useState<"" | VehicleStatus>("");
  const [selectedFleetVehicleId, setSelectedFleetVehicleId] = useState<number | null>(null);
  const [selectedFleetVehicle, setSelectedFleetVehicle] = useState<VehicleDetail | null>(null);
  const [selectedFleetVehicleLoading, setSelectedFleetVehicleLoading] = useState(false);
  const [fleetViewMode, setFleetViewMode] = useState<"list" | "detail">("list");
  const fleetListScrollPositionRef = useRef(0);
  const repairReturnTabRef = useRef<WorkspaceTab>("documents");
  const repairReturnRouteRef = useRef<AppRoute>({ workspace: "documents" });
  const repairScrollPositionRef = useRef(0);
  const [repairHasReturnTarget, setRepairHasReturnTarget] = useState(false);
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState("");
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [globalSearchResult, setGlobalSearchResult] = useState<GlobalSearchResponse | null>(null);
  const [auditLogItems, setAuditLogItems] = useState<AuditLogItem[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [auditLogTotal, setAuditLogTotal] = useState(0);
  const [auditEntityTypes, setAuditEntityTypes] = useState<string[]>([]);
  const [auditActionTypes, setAuditActionTypes] = useState<string[]>([]);
  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [auditEntityTypeFilter, setAuditEntityTypeFilter] = useState("");
  const [auditActionTypeFilter, setAuditActionTypeFilter] = useState("");
  const [auditUserIdFilter, setAuditUserIdFilter] = useState("");
  const [auditDateFrom, setAuditDateFrom] = useState("");
  const [auditDateTo, setAuditDateTo] = useState("");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userLoading, setUserLoading] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [showUserEditor, setShowUserEditor] = useState(false);
  const [userForm, setUserForm] = useState<UserFormState>(createEmptyUserForm);
  const [selectedManagedUserId, setSelectedManagedUserId] = useState<number | null>(null);
  const [userVehicleSearch, setUserVehicleSearch] = useState("");
  const [userVehicleSearchLoading, setUserVehicleSearchLoading] = useState(false);
  const [userVehicleSearchResults, setUserVehicleSearchResults] = useState<Vehicle[]>([]);
  const [userAssignmentForm, setUserAssignmentForm] = useState<UserAssignmentFormState>(createEmptyUserAssignmentForm);
  const [userAssignmentSaving, setUserAssignmentSaving] = useState(false);
  const [adminResetPasswordValue, setAdminResetPasswordValue] = useState("");
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [serviceCities, setServiceCities] = useState<string[]>([]);
  const [serviceQuery, setServiceQuery] = useState("");
  const [serviceCityFilter, setServiceCityFilter] = useState("");
  const [serviceLoading, setServiceLoading] = useState(false);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [serviceForm, setServiceForm] = useState<ServiceFormState>(createEmptyServiceForm);
  const [laborNorms, setLaborNorms] = useState<LaborNormCatalogItem[]>([]);
  const [laborNormCatalogs, setLaborNormCatalogs] = useState<LaborNormCatalogConfigItem[]>([]);
  const [laborNormTotal, setLaborNormTotal] = useState(0);
  const [laborNormScopes, setLaborNormScopes] = useState<string[]>([]);
  const [laborNormCategories, setLaborNormCategories] = useState<string[]>([]);
  const [laborNormSourceFiles, setLaborNormSourceFiles] = useState<string[]>([]);
  const [laborNormQuery, setLaborNormQuery] = useState("");
  const [laborNormScope, setLaborNormScope] = useState("");
  const [laborNormCategory, setLaborNormCategory] = useState("");
  const [laborNormLoading, setLaborNormLoading] = useState(false);
  const [laborNormImportLoading, setLaborNormImportLoading] = useState(false);
  const [laborNormFile, setLaborNormFile] = useState<File | null>(null);
  const [laborNormImportScope, setLaborNormImportScope] = useState("");
  const [laborNormImportBrandFamily, setLaborNormImportBrandFamily] = useState("");
  const [laborNormImportCatalogName, setLaborNormImportCatalogName] = useState("");
  const [laborNormCatalogSaving, setLaborNormCatalogSaving] = useState(false);
  const [laborNormEntrySaving, setLaborNormEntrySaving] = useState(false);
  const [historicalImportLoading, setHistoricalImportLoading] = useState(false);
  const [historicalImportFile, setHistoricalImportFile] = useState<File | null>(null);
  const [historicalImportLimit, setHistoricalImportLimit] = useState("1000");
  const [historicalImportResult, setHistoricalImportResult] = useState<HistoricalRepairImportResponse | null>(null);
  const [historicalImportJobs, setHistoricalImportJobs] = useState<ImportJobItem[]>([]);
  const [historicalImportJobsLoading, setHistoricalImportJobsLoading] = useState(false);
  const [historicalWorkReference, setHistoricalWorkReference] = useState<HistoricalWorkReferenceItem[]>([]);
  const [historicalWorkReferenceLoading, setHistoricalWorkReferenceLoading] = useState(false);
  const [historicalWorkReferenceTotal, setHistoricalWorkReferenceTotal] = useState(0);
  const [historicalWorkReferenceQuery, setHistoricalWorkReferenceQuery] = useState("");
  const [historicalWorkReferenceMinSamples, setHistoricalWorkReferenceMinSamples] = useState("2");
  const [importConflicts, setImportConflicts] = useState<ImportConflictItem[]>([]);
  const [importConflictsLoading, setImportConflictsLoading] = useState(false);
  const [selectedImportConflict, setSelectedImportConflict] = useState<ImportConflictItem | null>(null);
  const [showImportConflictDialog, setShowImportConflictDialog] = useState(false);
  const [importConflictLoading, setImportConflictLoading] = useState(false);
  const [importConflictSaving, setImportConflictSaving] = useState(false);
  const [importConflictComment, setImportConflictComment] = useState("");
  const [editingLaborNormCatalogId, setEditingLaborNormCatalogId] = useState<number | null>(null);
  const [laborNormCatalogForm, setLaborNormCatalogForm] = useState<LaborNormCatalogFormState>(createEmptyCatalogForm);
  const [laborNormEntryForm, setLaborNormEntryForm] = useState<LaborNormEntryFormState>(createEmptyLaborNormEntryForm);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [reviewRules, setReviewRules] = useState<ReviewRuleItem[]>([]);
  const [reviewRuleTypes, setReviewRuleTypes] = useState<string[]>([]);
  const [reviewRuleSaving, setReviewRuleSaving] = useState(false);
  const [reviewRuleForm, setReviewRuleForm] = useState<ReviewRuleFormState>(createEmptyReviewRuleForm);
  const [ocrRules, setOcrRules] = useState<OcrRuleItem[]>([]);
  const [ocrRuleProfiles, setOcrRuleProfiles] = useState<string[]>([]);
  const [ocrRuleTargetFields, setOcrRuleTargetFields] = useState<string[]>([]);
  const [ocrRuleProfileFilter, setOcrRuleProfileFilter] = useState("");
  const [ocrRuleSaving, setOcrRuleSaving] = useState(false);
  const [ocrRuleForm, setOcrRuleForm] = useState<OcrRuleFormState>(createEmptyOcrRuleForm);
  const [ocrProfileMatchers, setOcrProfileMatchers] = useState<OcrProfileMatcherItem[]>([]);
  const [ocrProfileMatcherProfiles, setOcrProfileMatcherProfiles] = useState<string[]>([]);
  const [ocrProfileMatcherProfileFilter, setOcrProfileMatcherProfileFilter] = useState("");
  const [ocrProfileMatcherSaving, setOcrProfileMatcherSaving] = useState(false);
  const [ocrProfileMatcherForm, setOcrProfileMatcherForm] = useState<OcrProfileMatcherFormState>(
    createEmptyOcrProfileMatcherForm,
  );
  const [ocrLearningSignals, setOcrLearningSignals] = useState<OcrLearningSignalItem[]>([]);
  const [ocrLearningSummaries, setOcrLearningSummaries] = useState<OcrLearningSummaryItem[]>([]);
  const [ocrLearningStatuses, setOcrLearningStatuses] = useState<string[]>([]);
  const [ocrLearningTargetFields, setOcrLearningTargetFields] = useState<string[]>([]);
  const [ocrLearningProfileScopes, setOcrLearningProfileScopes] = useState<string[]>([]);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [ocrLearningStatusFilter, setOcrLearningStatusFilter] = useState("");
  const [ocrLearningTargetFieldFilter, setOcrLearningTargetFieldFilter] = useState("");
  const [ocrLearningProfileScopeFilter, setOcrLearningProfileScopeFilter] = useState("");
  const [showOcrLearningListDialog, setShowOcrLearningListDialog] = useState(false);
  const [ocrLearningLoading, setOcrLearningLoading] = useState(false);
  const [ocrLearningUpdateId, setOcrLearningUpdateId] = useState<number | null>(null);
  const [ocrLearningDraftId, setOcrLearningDraftId] = useState<number | null>(null);
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
  const [repairDraft, setRepairDraft] = useState<EditableRepairDraft | null>(null);
  const [isEditingRepair, setIsEditingRepair] = useState(false);
  const [loginValue, setLoginValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [currentPasswordValue, setCurrentPasswordValue] = useState("");
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [recoveryEmailValue, setRecoveryEmailValue] = useState("");
  const [recoveryTokenValue, setRecoveryTokenValue] = useState("");
  const [recoveryNewPasswordValue, setRecoveryNewPasswordValue] = useState("");
  const [uploadForm, setUploadForm] = useState<UploadFormState>(emptyUploadForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastUploadedDocument, setLastUploadedDocument] = useState<DocumentItem | null>(null);
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceAutoRefreshInFlightRef = useRef(false);
  const repairAutoRefreshInFlightRef = useRef(false);
  const attachedFileInputRef = useRef<HTMLInputElement | null>(null);
  const [bootLoading, setBootLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordRecoveryLoading, setPasswordRecoveryLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [attachDocumentLoading, setAttachDocumentLoading] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);
  const [repairExportLoading, setRepairExportLoading] = useState(false);
  const [vehicleExportLoading, setVehicleExportLoading] = useState(false);
  const [reprocessLoading, setReprocessLoading] = useState(false);
  const [batchReprocessLoading, setBatchReprocessLoading] = useState(false);
  const [batchReprocessLimit, setBatchReprocessLimit] = useState("50");
  const [batchReprocessStatusFilter, setBatchReprocessStatusFilter] = useState("");
  const [batchReprocessPrimaryOnly, setBatchReprocessPrimaryOnly] = useState<"false" | "true">("false");
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [reviewFieldSaving, setReviewFieldSaving] = useState(false);
  const [reviewVehicleSearch, setReviewVehicleSearch] = useState("");
  const [reviewVehicleSearchLoading, setReviewVehicleSearchLoading] = useState(false);
  const [reviewVehicleSearchResults, setReviewVehicleSearchResults] = useState<Vehicle[]>([]);
  const [reviewVehicleLinkingId, setReviewVehicleLinkingId] = useState<number | null>(null);
  const [reviewServiceAssigning, setReviewServiceAssigning] = useState(false);
  const [reviewServiceSaving, setReviewServiceSaving] = useState(false);
  const [documentVehicleSaving, setDocumentVehicleSaving] = useState(false);
  const [checkActionLoadingId, setCheckActionLoadingId] = useState<number | null>(null);
  const [documentOpenLoadingId, setDocumentOpenLoadingId] = useState<number | null>(null);
  const [primaryDocumentLoadingId, setPrimaryDocumentLoadingId] = useState<number | null>(null);
  const [documentComparisonLoadingId, setDocumentComparisonLoadingId] = useState<number | null>(null);
  const [documentComparisonReviewLoading, setDocumentComparisonReviewLoading] = useState(false);
  const [saveRepairLoading, setSaveRepairLoading] = useState(false);
  const [repairArchiveLoading, setRepairArchiveLoading] = useState(false);
  const [repairDeleteLoading, setRepairDeleteLoading] = useState(false);
  const [documentArchiveLoadingId, setDocumentArchiveLoadingId] = useState<number | null>(null);
  const [checkComments, setCheckComments] = useState<Record<number, string>>({});
  const [attachedDocumentKind, setAttachedDocumentKind] = useState<DocumentKind>("repeat_scan");
  const [attachedDocumentNotes, setAttachedDocumentNotes] = useState("");
  const [attachedDocumentFile, setAttachedDocumentFile] = useState<File | null>(null);
  const [documentComparison, setDocumentComparison] = useState<DocumentComparisonResponse | null>(null);
  const [documentComparisonComment, setDocumentComparisonComment] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historySearch, setHistorySearch] = useState("");
  const [showRepairOverviewDetails, setShowRepairOverviewDetails] = useState(false);
  const [reviewActionComment, setReviewActionComment] = useState("");
  const [reviewFieldDraft, setReviewFieldDraft] = useState<ReviewRepairFieldsDraft | null>(null);
  const [showReviewFieldEditor, setShowReviewFieldEditor] = useState(false);
  const [reviewServiceName, setReviewServiceName] = useState("");
  const [reviewServiceForm, setReviewServiceForm] = useState<ServiceFormState>(createEmptyServiceForm);
  const [showReviewServiceEditor, setShowReviewServiceEditor] = useState(false);
  const [reviewDocumentPreviewUrl, setReviewDocumentPreviewUrl] = useState("");
  const [reviewDocumentPreviewLoading, setReviewDocumentPreviewLoading] = useState(false);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupActionLoading, setBackupActionLoading] = useState(false);
  const [backupRestoreDialogOpen, setBackupRestoreDialogOpen] = useState(false);
  const [backupRestoreTarget, setBackupRestoreTarget] = useState<BackupItem | null>(null);
  const [backupRestoreConfirmValue, setBackupRestoreConfirmValue] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedReviewItem =
    reviewQueue.find((item) => item.document.id === selectedDocumentId) ?? null;
  const selectedManagedUser = usersList.find((item) => item.id === selectedManagedUserId) ?? null;
  const selectedRepairDocument = selectedRepair?.documents.find((item) => item.id === selectedDocumentId) ?? null;
  const selectedRepairDocumentPayload = getLatestRepairDocumentPayload(selectedRepair, selectedDocumentId);
  const selectedRepairDocumentConfidenceMap = getLatestRepairDocumentConfidenceMap(selectedRepair, selectedDocumentId);
  const selectedRepairDocumentExtractedFields = getPayloadExtractedFields(selectedRepairDocumentPayload);
  const selectedRepairDocumentExtractedItems = getPayloadExtractedItems(selectedRepairDocumentPayload);
  const selectedRepairDocumentOcrServiceName =
    typeof selectedRepairDocumentExtractedFields?.service_name === "string"
      ? selectedRepairDocumentExtractedFields.service_name.trim()
      : "";
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
  const reviewDocumentPreviewKind = getDocumentPreviewKind(selectedRepairDocument?.mime_type);
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

  async function loadLaborNormCatalog(
    activeToken: string,
    query: string = laborNormQuery,
    scope: string = laborNormScope,
    category: string = laborNormCategory,
  ) {
    setLaborNormLoading(true);
    try {
      const payload = await apiRequest<LaborNormCatalogResponse>(
        `/labor-norms?${buildLaborNormQueryString(query, scope, category)}`,
        { method: "GET" },
        activeToken,
      );
      setLaborNorms(payload.items);
      setLaborNormTotal(payload.total);
      setLaborNormScopes(payload.scopes);
      setLaborNormCategories(payload.categories);
      setLaborNormSourceFiles(payload.source_files);
    } finally {
      setLaborNormLoading(false);
    }
  }

  async function loadServices(
    activeToken: string,
    query: string = serviceQuery,
    city: string = serviceCityFilter,
  ) {
    setServiceLoading(true);
    try {
      const payload = await apiRequest<ServicesResponse>(
        `/services?${buildServiceQueryString(query, city)}`,
        { method: "GET" },
        activeToken,
      );
      setServices(payload.items);
      setServiceCities(payload.cities);
    } finally {
      setServiceLoading(false);
    }
  }

  async function loadHistoricalImportJobs(activeToken: string) {
    setHistoricalImportJobsLoading(true);
    try {
      const payload = await apiRequest<ImportJobsResponse>(
        "/imports/jobs?import_type=historical_repairs&limit=12",
        { method: "GET" },
        activeToken,
      );
      setHistoricalImportJobs(payload.items);
    } finally {
      setHistoricalImportJobsLoading(false);
    }
  }

  async function loadHistoricalWorkReference(
    activeToken: string,
    query: string = historicalWorkReferenceQuery,
    minSamplesValue: string = historicalWorkReferenceMinSamples,
  ) {
    setHistoricalWorkReferenceLoading(true);
    try {
      const payload = await apiRequest<HistoricalWorkReferenceResponse>(
        `/imports/historical-work-reference?${buildHistoricalWorkReferenceQueryString(query, minSamplesValue)}`,
        { method: "GET" },
        activeToken,
      );
      setHistoricalWorkReference(payload.items);
      setHistoricalWorkReferenceTotal(payload.total);
    } finally {
      setHistoricalWorkReferenceLoading(false);
    }
  }

  async function loadImportConflicts(activeToken: string, status: string = "pending") {
    setImportConflictsLoading(true);
    try {
      const payload = await apiRequest<ImportConflictsResponse>(
        `/imports/conflicts?${buildImportConflictsQueryString(status)}`,
        { method: "GET" },
        activeToken,
      );
      setImportConflicts(payload.items);
    } finally {
      setImportConflictsLoading(false);
    }
  }

  async function openImportConflict(conflictId: number) {
    if (!token || user?.role !== "admin") {
      return;
    }
    setImportConflictLoading(true);
    setImportConflictComment("");
    setSelectedImportConflict(null);
    setShowImportConflictDialog(true);
    try {
      const payload = await apiRequest<ImportConflictItem>(`/imports/conflicts/${conflictId}`, { method: "GET" }, token);
      setSelectedImportConflict(payload);
    } catch (error) {
      setShowImportConflictDialog(false);
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить конфликт импорта");
    } finally {
      setImportConflictLoading(false);
    }
  }

  async function loadReviewRules(activeToken: string) {
    const payload = await apiRequest<ReviewRuleResponse>("/review/rules", { method: "GET" }, activeToken);
    setReviewRules(payload.items);
    setReviewRuleTypes(payload.rule_types);
  }

  async function loadOcrRules(activeToken: string, profileScope: string = ocrRuleProfileFilter) {
    const queryString = buildOcrRulesQueryString(profileScope);
    const payload = await apiRequest<OcrRuleResponse>(
      `/ocr-rules${queryString ? `?${queryString}` : ""}`,
      { method: "GET" },
      activeToken,
    );
    setOcrRules(payload.items);
    setOcrRuleProfiles(payload.profile_scopes);
    setOcrRuleTargetFields(payload.target_fields);
  }

  async function loadOcrProfileMatchers(
    activeToken: string,
    profileScope: string = ocrProfileMatcherProfileFilter,
  ) {
    const queryString = buildOcrProfileMatchersQueryString(profileScope);
    const payload = await apiRequest<OcrProfileMatcherResponse>(
      `/ocr-profile-matchers${queryString ? `?${queryString}` : ""}`,
      { method: "GET" },
      activeToken,
    );
    setOcrProfileMatchers(payload.items);
    setOcrProfileMatcherProfiles(payload.profile_scopes);
  }

  async function loadOcrLearningSignals(
    activeToken: string,
    statusFilter: string = ocrLearningStatusFilter,
    targetFieldFilter: string = ocrLearningTargetFieldFilter,
    profileScopeFilter: string = ocrLearningProfileScopeFilter,
  ) {
    setOcrLearningLoading(true);
    try {
      const payload = await apiRequest<OcrLearningResponse>(
        `/ocr-learning/signals?${buildOcrLearningSignalsQueryString(statusFilter, targetFieldFilter, profileScopeFilter)}`,
        { method: "GET" },
        activeToken,
      );
      setOcrLearningSignals(payload.items);
      setOcrLearningSummaries(payload.summaries);
      setOcrLearningStatuses(payload.statuses);
      setOcrLearningTargetFields(payload.target_fields);
      setOcrLearningProfileScopes(payload.profile_scopes);
    } finally {
      setOcrLearningLoading(false);
    }
  }

  async function loadLaborNormCatalogConfigs(activeToken: string) {
    const payload = await apiRequest<LaborNormCatalogConfigResponse>(
      "/labor-norms/catalogs",
      { method: "GET" },
      activeToken,
    );
    setLaborNormCatalogs(payload.items);
    if (!editingLaborNormCatalogId) {
      setLaborNormCatalogForm((current) => {
        if (current.scope || current.catalog_name || current.brand_family || current.notes) {
          return current;
        }
        return createEmptyCatalogForm();
      });
    }
  }

  async function loadFleetVehicles(
    activeToken: string,
    query: string = fleetQuery,
    vehicleType: "" | VehicleType = fleetVehicleTypeFilter,
    statusFilter: "" | VehicleStatus = fleetStatusFilter,
  ) {
    setFleetLoading(true);
    try {
      const payload = await apiRequest<VehiclesResponse>(
        `/vehicles?${buildFleetVehiclesQueryString(VEHICLES_FULL_LIST_LIMIT, query, vehicleType, statusFilter)}`,
        { method: "GET" },
        activeToken,
      );
      setFleetVehicles(payload.items);
      setFleetVehiclesTotal(payload.total);
      setSelectedFleetVehicleId((current) => {
        if (current && payload.items.some((item) => item.id === current)) {
          return current;
        }
        return payload.items[0]?.id ?? null;
      });
    } finally {
      setFleetLoading(false);
    }
  }

  async function loadFleetVehicleDetail(activeToken: string, vehicleId: number) {
    setSelectedFleetVehicleLoading(true);
    try {
      const payload = await apiRequest<VehicleDetail>(`/vehicles/${vehicleId}`, { method: "GET" }, activeToken);
      setSelectedFleetVehicle(payload);
    } finally {
      setSelectedFleetVehicleLoading(false);
    }
  }

  function openFleetVehicleCard(vehicleId: number) {
    fleetListScrollPositionRef.current = window.scrollY;
    setSelectedFleetVehicleId(vehicleId);
    setFleetViewMode("detail");
    updateBrowserRoute({ workspace: "fleet", vehicleId }, "push");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function returnToFleetList() {
    setFleetViewMode("list");
    updateBrowserRoute({ workspace: "fleet", vehicleId: null }, "push");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: fleetListScrollPositionRef.current, behavior: "auto" });
    });
  }

  async function handleUpdateVehicle(payload: VehicleUpdatePayload) {
    if (!token || !selectedFleetVehicle) {
      return;
    }
    setVehicleSaving(true);
    setErrorMessage("");
    try {
      const result = await apiRequest<VehicleDetail>(`/vehicles/${selectedFleetVehicle.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }, token);
      setSelectedFleetVehicle(result);
      setSuccessMessage(payload.status === "archived" ? "Техника отправлена в архив" : "Карточка техники обновлена");
      await loadFleetVehicles(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось обновить карточку техники");
    } finally {
      setVehicleSaving(false);
    }
  }

  async function runGlobalSearch(activeToken: string, query: string = globalSearchQuery) {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      setGlobalSearchResult(null);
      return;
    }
    setGlobalSearchLoading(true);
    try {
      const payload = await apiRequest<GlobalSearchResponse>(
        `/search/global?${buildGlobalSearchQueryString(normalizedQuery)}`,
        { method: "GET" },
        activeToken,
      );
      setGlobalSearchResult(payload);
    } finally {
      setGlobalSearchLoading(false);
    }
  }

  async function loadAuditLog(activeToken: string) {
    setAuditLogLoading(true);
    try {
      const payload = await apiRequest<AuditLogResponse>(
        `/audit?${buildAuditLogQueryString(
          auditSearchQuery,
          auditEntityTypeFilter,
          auditActionTypeFilter,
          auditUserIdFilter,
          auditDateFrom,
          auditDateTo,
        )}`,
        { method: "GET" },
        activeToken,
      );
      setAuditLogItems(payload.items);
      setAuditLogTotal(payload.total);
      setAuditEntityTypes(payload.entity_types);
      setAuditActionTypes(payload.action_types);
    } finally {
      setAuditLogLoading(false);
    }
  }

  async function loadUsers(activeToken: string, search: string = userSearch) {
    setUserLoading(true);
    try {
      const payload = await apiRequest<UsersResponse>(
        `/users?${buildUsersQueryString(search)}`,
        { method: "GET" },
        activeToken,
      );
      setUsersList(payload.items);
      setUsersTotal(payload.total);
      setSelectedManagedUserId((current) => {
        if (current && payload.items.some((item) => item.id === current)) {
          return current;
        }
        return payload.items[0]?.id ?? null;
      });
    } finally {
      setUserLoading(false);
    }
  }

  async function loadBackups(activeToken: string) {
    setBackupsLoading(true);
    try {
      const payload = await apiRequest<BackupListResponse>("/backups", { method: "GET" }, activeToken);
      setBackups(payload.items);
    } finally {
      setBackupsLoading(false);
    }
  }

  function openBackupRestoreDialog(item: BackupItem) {
    setBackupRestoreTarget(item);
    setBackupRestoreConfirmValue("");
    setBackupRestoreDialogOpen(true);
  }

  function closeBackupRestoreDialog() {
    setBackupRestoreDialogOpen(false);
    setBackupRestoreTarget(null);
    setBackupRestoreConfirmValue("");
  }

  async function handleCreateBackup() {
    if (!token || user?.role !== "admin") {
      return;
    }
    setBackupActionLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = await apiRequest<BackupCreateResponse>("/backups", { method: "POST" }, token);
      setSuccessMessage(payload.message);
      await loadBackups(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось создать резервную копию");
    } finally {
      setBackupActionLoading(false);
    }
  }

  async function handleDownloadBackup(item: BackupItem) {
    if (!token || user?.role !== "admin") {
      return;
    }
    setBackupActionLoading(true);
    setErrorMessage("");
    try {
      await downloadApiFile(`/backups/${item.backup_id}/download`, token, item.filename);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось скачать резервную копию");
    } finally {
      setBackupActionLoading(false);
    }
  }

  async function handleRestoreBackup() {
    if (!token || user?.role !== "admin" || !backupRestoreTarget) {
      return;
    }
    setBackupActionLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = await apiRequest<BackupRestoreResponse>(
        `/backups/${backupRestoreTarget.backup_id}/restore`,
        {
          method: "POST",
          body: JSON.stringify({ confirm_backup_id: backupRestoreConfirmValue }),
        },
        token,
      );
      setSuccessMessage(payload.message);
      closeBackupRestoreDialog();
      await loadBackups(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось восстановить резервную копию");
    } finally {
      setBackupActionLoading(false);
    }
  }

  async function searchVehiclesForUserAssignment(activeToken: string, search: string) {
    if (!search.trim()) {
      setUserVehicleSearchResults([]);
      return;
    }
    setUserVehicleSearchLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      params.set("search", search.trim());
      const payload = await apiRequest<VehiclesResponse>(`/vehicles?${params.toString()}`, { method: "GET" }, activeToken);
      setUserVehicleSearchResults(payload.items);
    } finally {
      setUserVehicleSearchLoading(false);
    }
  }

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
      const me = await apiRequest<User>("/auth/me", { method: "GET" }, activeToken);
      const [
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
      ] = await Promise.all([
        apiRequest<DashboardSummary>("/dashboard/summary", { method: "GET" }, activeToken),
        apiRequest<DashboardDataQuality>("/dashboard/data-quality", { method: "GET" }, activeToken),
        apiRequest<DashboardDataQualityDetails>("/dashboard/data-quality/details?limit=8", { method: "GET" }, activeToken),
        apiRequest<VehiclesResponse>(`/vehicles?limit=${VEHICLES_FULL_LIST_LIMIT}`, { method: "GET" }, activeToken),
        apiRequest<DocumentsResponse>("/documents?limit=8", { method: "GET" }, activeToken),
        apiRequest<ReviewQueueResponse>(
          `/review/queue?limit=6&category=${reviewCategory}`,
          { method: "GET" },
          activeToken,
        ),
        me.role === "admin"
          ? apiRequest<LaborNormCatalogResponse>(
              `/labor-norms?${buildLaborNormQueryString(laborNormQuery, laborNormScope, laborNormCategory)}`,
              { method: "GET" },
              activeToken,
            )
          : Promise.resolve(null),
        me.role === "admin"
          ? apiRequest<LaborNormCatalogConfigResponse>("/labor-norms/catalogs", { method: "GET" }, activeToken)
          : Promise.resolve(null),
        apiRequest<ServicesResponse>("/services?limit=100", { method: "GET" }, activeToken),
        me.role === "admin"
          ? apiRequest<ReviewRuleResponse>("/review/rules", { method: "GET" }, activeToken)
          : Promise.resolve(null),
        me.role === "admin"
          ? apiRequest<OcrRuleResponse>("/ocr-rules", { method: "GET" }, activeToken)
          : Promise.resolve(null),
        me.role === "admin"
          ? apiRequest<OcrProfileMatcherResponse>("/ocr-profile-matchers", { method: "GET" }, activeToken)
          : Promise.resolve(null),
        me.role === "admin"
          ? apiRequest<OcrLearningResponse>("/ocr-learning/signals?limit=50", { method: "GET" }, activeToken)
          : Promise.resolve(null),
        me.role === "admin"
          ? apiRequest<UsersResponse>("/users?include_inactive=true", { method: "GET" }, activeToken)
          : Promise.resolve(null),
        me.role === "admin"
          ? apiRequest<SystemStatus>("/system/status", { method: "GET" }, activeToken)
          : Promise.resolve(null),
      ]);

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
      setFleetVehicles(vehicleList.items);
      setFleetVehiclesTotal(vehicleList.total);
      setSelectedFleetVehicleId((current) => current ?? vehicleList.items[0]?.id ?? null);
      applyRecentDocuments(recentDocuments.items);
      setUsersList(usersPayload?.items || []);
      setUsersTotal(usersPayload?.total || 0);
      setSelectedManagedUserId((current) => current ?? usersPayload?.items?.[0]?.id ?? null);
      setLaborNorms(laborNormCatalog?.items || []);
      setLaborNormTotal(laborNormCatalog?.total || 0);
      setLaborNormScopes(laborNormCatalog?.scopes || []);
      setLaborNormCategories(laborNormCatalog?.categories || []);
      setLaborNormSourceFiles(laborNormCatalog?.source_files || []);
      setLaborNormCatalogs(laborNormCatalogConfigs?.items || []);
      setReviewQueue(reviewQueueData.items);
      setReviewQueueCounts(reviewQueueData.counts);
      setServices(servicesPayload?.items || []);
      setServiceCities(servicesPayload?.cities || []);
      setReviewRules(reviewRulesPayload?.items || []);
      setReviewRuleTypes(reviewRulesPayload?.rule_types || []);
      setOcrRules(ocrRulesPayload?.items || []);
      setOcrRuleProfiles(ocrRulesPayload?.profile_scopes || []);
      setOcrRuleTargetFields(ocrRulesPayload?.target_fields || []);
      setOcrProfileMatchers(ocrProfileMatchersPayload?.items || []);
      setOcrProfileMatcherProfiles(ocrProfileMatchersPayload?.profile_scopes || []);
      setOcrLearningSignals(ocrLearningPayload?.items || []);
      setOcrLearningSummaries(ocrLearningPayload?.summaries || []);
      setOcrLearningStatuses(ocrLearningPayload?.statuses || []);
      setOcrLearningTargetFields(ocrLearningPayload?.target_fields || []);
      setOcrLearningProfileScopes(ocrLearningPayload?.profile_scopes || []);
      setSystemStatus(systemStatusPayload);
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
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken("");
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
        setDocumentComparison(null);
        setDocumentComparisonComment("");
        setHistoryFilter("all");
        setHistorySearch("");
        setAttachedDocumentKind("repeat_scan");
        setAttachedDocumentNotes("");
        setAttachedDocumentFile(null);
      }
      setSelectedDocumentId((current) => resolveRepairDocumentId(payload, preferredDocumentId ?? current));
      if (!isEditingRepair) {
        setRepairDraft(createRepairDraft(payload));
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
      setFleetVehicles([]);
      setFleetVehiclesTotal(0);
      setFleetQuery("");
      setFleetVehicleTypeFilter("");
      setSelectedFleetVehicleId(null);
      setSelectedFleetVehicle(null);
      setFleetViewMode("list");
      setAuditLogItems([]);
      setAuditLogTotal(0);
      setAuditEntityTypes([]);
      setAuditActionTypes([]);
      setAuditSearchQuery("");
      setAuditEntityTypeFilter("");
      setAuditActionTypeFilter("");
      setAuditDateFrom("");
      setAuditDateTo("");
      setDocuments([]);
      setUsersList([]);
      setUsersTotal(0);
      setUserSearch("");
      setShowUserEditor(false);
      setUserForm(createEmptyUserForm());
      setSelectedManagedUserId(null);
      setUserVehicleSearch("");
      setUserVehicleSearchResults([]);
      setUserAssignmentForm(createEmptyUserAssignmentForm());
      setAdminResetPasswordValue("");
      setServices([]);
      setServiceCities([]);
      setReviewRules([]);
      setReviewRuleTypes([]);
      setOcrRules([]);
      setOcrRuleProfiles([]);
      setOcrRuleTargetFields([]);
      setOcrProfileMatchers([]);
      setOcrProfileMatcherProfiles([]);
      setOcrLearningSignals([]);
      setOcrLearningSummaries([]);
      setOcrLearningStatuses([]);
      setOcrLearningTargetFields([]);
      setOcrLearningProfileScopes([]);
      setSystemStatus(null);
      setLaborNorms([]);
      setLaborNormCatalogs([]);
      setLaborNormTotal(0);
      setLaborNormScopes([]);
      setLaborNormCategories([]);
      setLaborNormSourceFiles([]);
      setHistoricalImportFile(null);
      setHistoricalImportLimit("1000");
      setHistoricalImportResult(null);
      setHistoricalImportJobs([]);
      setImportConflicts([]);
      setSelectedImportConflict(null);
      setShowImportConflictDialog(false);
      setImportConflictComment("");
      setLaborNormCatalogForm(createEmptyCatalogForm());
      setLaborNormEntryForm(createEmptyLaborNormEntryForm());
      setServiceForm(createEmptyServiceForm());
      setReviewRuleForm(createEmptyReviewRuleForm());
      setOcrRuleForm(createEmptyOcrRuleForm());
      setOcrProfileMatcherForm(createEmptyOcrProfileMatcherForm());
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
      setCurrentPasswordValue("");
      setNewPasswordValue("");
      return;
    }
    void loadWorkspace(token, selectedReviewCategory);
  }, [selectedReviewCategory, token]);

  useEffect(() => {
    if (!token || activeWorkspaceTab !== "fleet") {
      return;
    }
    void loadFleetVehicles(token).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить список техники");
    });
  }, [activeWorkspaceTab, token]);

  useEffect(() => {
    if (!token || activeWorkspaceTab !== "fleet" || selectedFleetVehicleId === null) {
      setSelectedFleetVehicle(null);
      return;
    }
    void loadFleetVehicleDetail(token, selectedFleetVehicleId).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить карточку техники");
    });
  }, [activeWorkspaceTab, selectedFleetVehicleId, token]);

  useEffect(() => {
    if (!token || activeWorkspaceTab !== "audit") {
      return;
    }
    void loadAuditLog(token).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить журнал действий");
    });
  }, [
    activeWorkspaceTab,
    auditActionTypeFilter,
    auditDateFrom,
    auditDateTo,
    auditEntityTypeFilter,
    auditSearchQuery,
    auditUserIdFilter,
    token,
  ]);

  useEffect(() => {
    if (!token || user?.role !== "admin" || activeWorkspaceTab !== "admin" || activeAdminTab !== "imports") {
      return;
    }
    void Promise.all([loadHistoricalImportJobs(token), loadHistoricalWorkReference(token), loadImportConflicts(token)]).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить историю импортов");
    });
  }, [activeAdminTab, activeWorkspaceTab, token, user?.role]);

  useEffect(() => {
    if (!token || user?.role !== "admin" || activeWorkspaceTab !== "admin" || activeAdminTab !== "backups") {
      return;
    }
    void loadBackups(token).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить резервные копии");
    });
  }, [activeAdminTab, activeWorkspaceTab, token, user?.role]);

  useEffect(() => {
    if (laborNormCatalogs.length === 0) {
      return;
    }
    if (!laborNormEntryForm.scope) {
      setLaborNormEntryForm((current) => ({ ...current, scope: laborNormCatalogs[0].scope }));
    }
    if (!laborNormImportScope) {
      handleCatalogScopeSelected(laborNormCatalogs[0].scope);
    }
  }, [laborNormCatalogs, laborNormEntryForm.scope, laborNormImportScope]);

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
    const nextServiceName = selectedRepair?.service?.name || selectedRepairDocumentOcrServiceName || "";
    setReviewVehicleSearch(
      typeof selectedRepairDocumentExtractedFields?.plate_number === "string"
        ? selectedRepairDocumentExtractedFields.plate_number
        : typeof selectedRepairDocumentExtractedFields?.vin === "string"
          ? selectedRepairDocumentExtractedFields.vin
          : "",
    );
    setReviewVehicleSearchResults([]);
    setReviewServiceName(nextServiceName);
    setReviewFieldDraft(selectedRepair ? createReviewRepairFieldsDraft(selectedRepair) : null);
    setReviewServiceForm({
      id: null,
      name: selectedRepairDocumentOcrServiceName,
      city: "",
      contact: "",
      comment: "",
      status: user?.role === "admin" ? "confirmed" : "preliminary",
    });
    setShowReviewFieldEditor(false);
    setShowReviewServiceEditor(false);
    setShowRepairOverviewDetails(false);
  }, [selectedRepair?.id, selectedRepair?.service?.name, selectedRepairDocumentExtractedFields?.plate_number, selectedRepairDocumentExtractedFields?.vin, selectedRepairDocumentOcrServiceName, user?.role]);

  useEffect(() => {
    if (!token || !selectedRepairDocument || !reviewDocumentPreviewKind) {
      setReviewDocumentPreviewUrl("");
      setReviewDocumentPreviewLoading(false);
      return;
    }

    let isMounted = true;
    let objectUrl = "";

    setReviewDocumentPreviewLoading(true);
    setReviewDocumentPreviewUrl("");
    void downloadDocumentFile(selectedRepairDocument.id, token)
      .then((url) => {
        if (!isMounted) {
          URL.revokeObjectURL(url);
          return;
        }
        objectUrl = url;
        setReviewDocumentPreviewUrl(url);
      })
      .catch((error) => {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить превью документа");
        }
      })
      .finally(() => {
        if (isMounted) {
          setReviewDocumentPreviewLoading(false);
        }
      });

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [reviewDocumentPreviewKind, selectedRepairDocument, token]);

  useEffect(() => {
    setAdminResetPasswordValue("");
  }, [selectedManagedUserId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get("reset_token") || "";
    setRecoveryTokenValue(resetToken);
    if (resetToken) {
      setShowPasswordRecoveryRequest(true);
    }
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload = await loginRequest<LoginResponse>(loginValue, passwordValue);
      localStorage.setItem(TOKEN_STORAGE_KEY, payload.access_token);
      setToken(payload.access_token);
      setPasswordValue("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось выполнить вход");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleChangePassword() {
    if (!token) {
      return;
    }
    if (!currentPasswordValue.trim() || !newPasswordValue.trim()) {
      setErrorMessage("Укажите текущий и новый пароль");
      return;
    }

    setPasswordChangeLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<ChangePasswordResponse>(
        "/auth/change-password",
        {
          method: "POST",
          body: JSON.stringify({
            current_password: currentPasswordValue,
            new_password: newPasswordValue,
          }),
        },
        token,
      );
      setSuccessMessage(result.message);
      setCurrentPasswordValue("");
      setNewPasswordValue("");
      setShowPasswordChange(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сменить пароль");
    } finally {
      setPasswordChangeLoading(false);
    }
  }

  async function handleRequestPasswordRecovery() {
    if (!recoveryEmailValue.trim()) {
      setErrorMessage("Укажите почту для восстановления");
      return;
    }
    setPasswordRecoveryLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<PasswordResetRequestResponse>(
        "/auth/password-reset/request",
        {
          method: "POST",
          body: JSON.stringify({ email: recoveryEmailValue.trim() }),
        },
      );
      setSuccessMessage(result.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось запросить восстановление пароля");
    } finally {
      setPasswordRecoveryLoading(false);
    }
  }

  async function handleConfirmPasswordRecovery() {
    if (!recoveryTokenValue.trim() || !recoveryNewPasswordValue.trim()) {
      setErrorMessage("Укажите токен восстановления и новый пароль");
      return;
    }
    setPasswordRecoveryLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<PasswordResetConfirmResponse>(
        "/auth/password-reset/confirm",
        {
          method: "POST",
          body: JSON.stringify({
            token: recoveryTokenValue.trim(),
            new_password: recoveryNewPasswordValue,
          }),
        },
      );
      setSuccessMessage(result.message);
      setRecoveryNewPasswordValue("");
      setRecoveryTokenValue("");
      const url = new URL(window.location.href);
      url.searchParams.delete("reset_token");
      window.history.replaceState({}, "", url.toString());
      setShowPasswordRecoveryRequest(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось восстановить пароль");
    } finally {
      setPasswordRecoveryLoading(false);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedFile) {
      setErrorMessage("Сначала выберите файл");
      return;
    }

    setUploadLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const body = new FormData();
      body.append("kind", uploadForm.documentKind);
      if (uploadForm.vehicleId) {
        body.append("vehicle_id", uploadForm.vehicleId);
      }
      if (uploadForm.repairDate) {
        body.append("repair_date", uploadForm.repairDate);
      }
      if (uploadForm.mileage.trim()) {
        body.append("mileage", uploadForm.mileage);
      }
      if (uploadForm.orderNumber.trim()) {
        body.append("order_number", uploadForm.orderNumber);
      }
      if (uploadForm.reason.trim()) {
        body.append("reason", uploadForm.reason);
      }
      if (uploadForm.employeeComment.trim()) {
        body.append("employee_comment", uploadForm.employeeComment);
      }
      if (uploadForm.notes.trim()) {
        body.append("notes", uploadForm.notes);
      }
      body.append("file", selectedFile);

      const result = await apiRequest<DocumentUploadResponse>(
        "/documents/upload",
        {
          method: "POST",
          body,
        },
        token,
      );

      setSuccessMessage(result.message);
      setLastUploadedDocument(result.document);
      setUploadForm(emptyUploadForm());
      setSelectedFile(null);
      await loadWorkspace(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить документ");
    } finally {
      setUploadLoading(false);
    }
  }

  function handleUploadFieldChange(field: keyof UploadFormState, value: string) {
    setUploadForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleUploadFileSelect(nextFile: File | null) {
    setLastUploadedDocument(null);
    setSelectedFile(nextFile);
    if (!nextFile) {
      return;
    }

    const parsedRepairDate = parseRepairDateFromFilename(nextFile.name);
    const parsedOrderNumber = parseOrderNumberFromFilename(nextFile.name);
    setUploadForm((current) => ({
      ...current,
      repairDate: parsedRepairDate || current.repairDate,
      orderNumber: current.orderNumber.trim() || !parsedOrderNumber ? current.orderNumber : parsedOrderNumber,
    }));
  }

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

  function openFleetVehicleById(vehicleId: number) {
    setActiveWorkspaceTab("fleet");
    setSelectedFleetVehicleId(vehicleId);
    setFleetViewMode("detail");
    updateBrowserRoute({ workspace: "fleet", vehicleId }, "push");
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
      await loadServices(token, name, "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось открыть список сервисов");
    }
  }

  async function handleGlobalSearchSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!token) {
      return;
    }
    setErrorMessage("");
    try {
      await runGlobalSearch(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось выполнить поиск");
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

  async function handleExportVehicle() {
    if (!token || !selectedFleetVehicle) {
      return;
    }
    setVehicleExportLoading(true);
    setErrorMessage("");
    try {
      await downloadApiFile(`/vehicles/${selectedFleetVehicle.id}/export`, token, `vehicle_${selectedFleetVehicle.id}.xlsx`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось выгрузить карточку техники");
    } finally {
      setVehicleExportLoading(false);
    }
  }

  async function handleOpenRepair(document: DocumentItem) {
    await openRepairByIds(document.id, document.repair.id);
  }

  async function handleOpenReviewQueueItem(item: ReviewQueueItem) {
    await openRepairByIds(item.document.id, item.repair.id);
  }

  async function handleReprocessDocumentById(documentId: number, repairId: number) {
    if (!token) {
      return;
    }
    setReprocessLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<{ message: string }>(
        `/documents/${documentId}/process`,
        { method: "POST" },
        token,
      );
      setSuccessMessage(result.message);
      await loadWorkspace(token);
      await openRepairByIds(documentId, repairId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось повторно распознать документ");
    } finally {
      setReprocessLoading(false);
    }
  }

  async function handleReprocessDocument(document: DocumentItem) {
    await handleReprocessDocumentById(document.id, document.repair.id);
  }

  async function handleBatchReprocessDocuments() {
    if (!token || user?.role !== "admin") {
      return;
    }

    setBatchReprocessLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const normalizedLimit = String(Math.min(500, Math.max(1, Number(batchReprocessLimit || "50") || 50)));
      const params = new URLSearchParams();
      params.set("limit", normalizedLimit);
      if (batchReprocessStatusFilter) {
        params.set("status", batchReprocessStatusFilter);
      }
      if (batchReprocessPrimaryOnly === "true") {
        params.set("only_primary", "true");
      }

      const result = await apiRequest<DocumentBatchProcessResponse>(
        `/documents/reprocess-existing?${params.toString()}`,
        { method: "POST" },
        token,
      );

      const statusSummary = Object.entries(result.status_counts)
        .map(([status, count]) => `${formatDocumentStatusLabel(status)}: ${count}`)
        .join(", ");

      setSuccessMessage(
        statusSummary
          ? `Переобработано ${result.processed_count} документов. ${statusSummary}`
          : `Переобработано ${result.processed_count} документов.`,
      );
      await loadWorkspace(token);
      if (selectedDocumentId !== null && selectedRepair) {
        await openRepairByIds(selectedDocumentId, selectedRepair.id);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось запустить массовую переобработку");
    } finally {
      setBatchReprocessLoading(false);
    }
  }

  async function handleOpenDocumentFile(documentId: number) {
    if (!token) {
      return;
    }

    setDocumentOpenLoadingId(documentId);
    setErrorMessage("");
    try {
      const objectUrl = await downloadDocumentFile(documentId, token);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось открыть документ");
    } finally {
      setDocumentOpenLoadingId(null);
    }
  }

  async function handleAttachDocumentToRepair() {
    if (!token || !selectedRepair || !attachedDocumentFile) {
      setErrorMessage("Сначала выберите файл");
      return;
    }

    setAttachDocumentLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const body = new FormData();
      body.append("repair_id", String(selectedRepair.id));
      body.append("kind", attachedDocumentKind);
      body.append("notes", attachedDocumentNotes);
      body.append("file", attachedDocumentFile);

      const result = await apiRequest<{ document: { id: number }; message: string }>(
        "/documents/upload-to-repair",
        {
          method: "POST",
          body,
        },
        token,
      );

      setSuccessMessage(result.message);
      setAttachedDocumentNotes("");
      setAttachedDocumentFile(null);
      await loadWorkspace(token);
      await openRepairByIds(result.document.id, selectedRepair.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось прикрепить документ к ремонту");
    } finally {
      setAttachDocumentLoading(false);
    }
  }

  async function handleSetPrimaryDocument(documentId: number) {
    if (!token || !selectedRepair) {
      return;
    }

    setPrimaryDocumentLoadingId(documentId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<{ id: number }>(
        `/documents/${documentId}/set-primary`,
        {
          method: "POST",
        },
        token,
      );
      setSuccessMessage("Основной документ обновлён");
      await loadWorkspace(token);
      await openRepairByIds(result.id, selectedRepair.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось назначить основной документ");
    } finally {
      setPrimaryDocumentLoadingId(null);
    }
  }

  async function handleCompareWithPrimary(documentId: number) {
    if (!token || !selectedRepair) {
      return;
    }

    const primaryDocument = selectedRepair.documents.find((item) => item.is_primary);
    if (!primaryDocument || primaryDocument.id === documentId) {
      return;
    }

    setDocumentComparisonLoadingId(documentId);
    setErrorMessage("");
    try {
      const result = await apiRequest<DocumentComparisonResponse>(
        `/documents/${documentId}/compare?with_document_id=${primaryDocument.id}`,
        {
          method: "GET",
        },
        token,
      );
      setDocumentComparison(result);
      setDocumentComparisonComment("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сравнить документы");
    } finally {
      setDocumentComparisonLoadingId(null);
    }
  }

  async function handleReviewDocumentComparison(
    action: "keep_current_primary" | "make_document_primary" | "mark_reviewed",
  ) {
    if (!token || !selectedRepair || !documentComparison) {
      return;
    }

    setDocumentComparisonReviewLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<DocumentComparisonReviewResponse>(
        `/documents/${documentComparison.left_document.id}/compare/review`,
        {
          method: "POST",
          body: JSON.stringify({
            with_document_id: documentComparison.right_document.id,
            action,
            comment: documentComparisonComment.trim() || null,
          }),
        },
        token,
      );
      setSuccessMessage(result.message);
      setDocumentComparison(null);
      setDocumentComparisonComment("");
      await loadWorkspace(token);
      await openRepairByIds(result.document_id, result.repair_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить решение по сверке документов");
    } finally {
      setDocumentComparisonReviewLoading(false);
    }
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

  async function handleReviewAction(action: "employee_confirm" | "confirm" | "send_to_review") {
    if (!token || !selectedReviewItem) {
      return;
    }

    setReviewActionLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<ReviewActionResponse>(
        `/review/queue/${selectedReviewItem.document.id}/action`,
        {
          method: "POST",
          body: JSON.stringify({
            action,
            comment: reviewActionComment.trim() || null,
          }),
        },
        token,
      );
      setSuccessMessage(result.message);
      setReviewActionComment("");
      await loadWorkspace(token);
      await openRepairByIds(result.document_id, result.repair_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось применить действие по проверке");
    } finally {
      setReviewActionLoading(false);
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

  function resetUserEditor() {
    setUserForm(createEmptyUserForm());
    setUserAssignmentForm(createEmptyUserAssignmentForm());
    setUserVehicleSearch("");
    setUserVehicleSearchResults([]);
  }

  function handleEditUser(item: UserItem) {
    setUserForm(createUserFormFromItem(item));
    setSelectedManagedUserId(item.id);
    setShowUserEditor(true);
  }

  async function handleUserSearch() {
    if (!token || user?.role !== "admin") {
      return;
    }
    setErrorMessage("");
    try {
      await loadUsers(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить список сотрудников");
    }
  }

  async function handleSaveUser() {
    if (!token || user?.role !== "admin") {
      return;
    }
    if (!userForm.full_name.trim() || !userForm.login.trim() || !userForm.email.trim()) {
      setErrorMessage("Имя, логин и почта обязательны");
      return;
    }
    if (!userForm.id && !userForm.password.trim()) {
      setErrorMessage("Для нового пользователя нужно задать пароль");
      return;
    }

    setUserSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const body = {
        full_name: userForm.full_name.trim(),
        login: userForm.login.trim(),
        email: userForm.email.trim(),
        role: userForm.role,
        is_active: userForm.is_active === "true",
        ...(userForm.password.trim() ? { password: userForm.password.trim() } : {}),
      };

      if (userForm.id) {
        await apiRequest<UserItem>(
          `/users/${userForm.id}`,
          { method: "PATCH", body: JSON.stringify(body) },
          token,
        );
        setSuccessMessage("Пользователь обновлён");
      } else {
        await apiRequest<UserItem>("/users", { method: "POST", body: JSON.stringify(body) }, token);
        setSuccessMessage("Пользователь создан");
      }
      await loadUsers(token);
      resetUserEditor();
      setShowUserEditor(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить пользователя");
    } finally {
      setUserSaving(false);
    }
  }

  async function handleSearchVehiclesForAssignment() {
    if (!token || user?.role !== "admin") {
      return;
    }
    setErrorMessage("");
    try {
      await searchVehiclesForUserAssignment(token, userVehicleSearch);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось найти технику");
    }
  }

  async function handleCreateUserAssignment(vehicleId: number) {
    if (!token || user?.role !== "admin" || selectedManagedUserId === null) {
      return;
    }
    setUserAssignmentSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiRequest<UserItem>(
        `/users/${selectedManagedUserId}/vehicle-assignments`,
        {
          method: "POST",
          body: JSON.stringify({
            vehicle_id: vehicleId,
            starts_at: userAssignmentForm.starts_at,
            ends_at: userAssignmentForm.ends_at || null,
            comment: userAssignmentForm.comment.trim() || null,
          }),
        },
        token,
      );
      setSuccessMessage("Техника закреплена за сотрудником");
      setUserAssignmentForm(createEmptyUserAssignmentForm());
      setUserVehicleSearch("");
      setUserVehicleSearchResults([]);
      await loadUsers(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось закрепить технику");
    } finally {
      setUserAssignmentSaving(false);
    }
  }

  async function handleAdminResetUserPassword() {
    if (!token || user?.role !== "admin" || selectedManagedUserId === null) {
      return;
    }
    if (!adminResetPasswordValue.trim()) {
      setErrorMessage("Укажите новый пароль для сотрудника");
      return;
    }

    setUserSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiRequest<UserItem>(
        `/users/${selectedManagedUserId}/reset-password`,
        {
          method: "POST",
          body: JSON.stringify({ new_password: adminResetPasswordValue.trim() }),
        },
        token,
      );
      setSuccessMessage("Пароль сотрудника обновлён");
      setAdminResetPasswordValue("");
      await loadUsers(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сбросить пароль сотрудника");
    } finally {
      setUserSaving(false);
    }
  }

  async function handleCloseUserAssignment(assignment: UserAssignment) {
    if (!token || user?.role !== "admin" || selectedManagedUserId === null) {
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const closeDate = assignment.starts_at > today ? assignment.starts_at : today;
    setUserAssignmentSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiRequest<UserItem>(
        `/users/${selectedManagedUserId}/vehicle-assignments/${assignment.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ends_at: closeDate,
            comment: assignment.comment,
          }),
        },
        token,
      );
      setSuccessMessage("Назначение техники закрыто");
      await loadUsers(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось закрыть назначение техники");
    } finally {
      setUserAssignmentSaving(false);
    }
  }

  async function handleLaborNormSearch() {
    if (!token || user?.role !== "admin") {
      return;
    }
    setErrorMessage("");
    try {
      await loadLaborNormCatalog(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить справочник нормо-часов");
    }
  }

  async function handleServiceSearch() {
    if (!token || user?.role !== "admin") {
      return;
    }
    setErrorMessage("");
    try {
      await loadServices(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить сервисы");
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

  function handleEditReviewRule(item: ReviewRuleItem) {
    setActiveWorkspaceTab("admin");
    setActiveAdminTab("control");
    updateBrowserRoute({ workspace: "admin", adminTab: "control" }, "push");
    setShowReviewRuleEditor(true);
    setReviewRuleForm(createReviewRuleFormFromItem(item));
  }

  function resetReviewRuleEditor() {
    setReviewRuleForm(createEmptyReviewRuleForm());
  }

  async function handleSaveReviewRule() {
    if (!token || user?.role !== "admin") {
      return;
    }
    if (!reviewRuleForm.rule_type.trim() || !reviewRuleForm.code.trim() || !reviewRuleForm.title.trim()) {
      setErrorMessage("Для правила обязательны тип, код и название");
      return;
    }

    setReviewRuleSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = {
        rule_type: reviewRuleForm.rule_type.trim(),
        code: reviewRuleForm.code.trim(),
        title: reviewRuleForm.title.trim(),
        weight: Number(reviewRuleForm.weight || "0"),
        bucket_override: reviewRuleForm.bucket_override || null,
        is_active: reviewRuleForm.is_active === "true",
        sort_order: Number(reviewRuleForm.sort_order || "100"),
        notes: reviewRuleForm.notes.trim() || null,
      };

      if (reviewRuleForm.id) {
        await apiRequest<ReviewRuleItem>(
          `/review/rules/${reviewRuleForm.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              title: payload.title,
              weight: payload.weight,
              bucket_override: payload.bucket_override,
              is_active: payload.is_active,
              sort_order: payload.sort_order,
              notes: payload.notes,
            }),
          },
          token,
        );
        setSuccessMessage("Правило очереди проверки обновлено");
      } else {
        await apiRequest<ReviewRuleItem>(
          "/review/rules",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("Правило очереди проверки создано");
      }

      await loadReviewRules(token);
      resetReviewRuleEditor();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить правило проверки");
    } finally {
      setReviewRuleSaving(false);
    }
  }

  function handleEditOcrRule(item: OcrRuleItem) {
    openTechAdmin("rules");
    setOcrRuleForm(createOcrRuleFormFromItem(item));
  }

  function resetOcrRuleEditor() {
    setOcrRuleForm(createEmptyOcrRuleForm());
  }

  async function handleSaveOcrRule() {
    if (!token || user?.role !== "admin") {
      return;
    }
    if (!ocrRuleForm.profile_scope.trim() || !ocrRuleForm.target_field.trim() || !ocrRuleForm.pattern.trim()) {
      setErrorMessage("Для OCR-правила обязательны шаблон, поле и выражение поиска");
      return;
    }

    setOcrRuleSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = {
        profile_scope: ocrRuleForm.profile_scope.trim(),
        target_field: ocrRuleForm.target_field.trim(),
        pattern: ocrRuleForm.pattern,
        value_parser: ocrRuleForm.value_parser.trim(),
        confidence: Number(ocrRuleForm.confidence || "0.6"),
        priority: Number(ocrRuleForm.priority || "100"),
        is_active: ocrRuleForm.is_active === "true",
        notes: ocrRuleForm.notes.trim() || null,
      };

      if (ocrRuleForm.id) {
        await apiRequest<OcrRuleItem>(
          `/ocr-rules/${ocrRuleForm.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("OCR-правило обновлено");
      } else {
        await apiRequest<OcrRuleItem>(
          "/ocr-rules",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("OCR-правило создано");
      }

      await loadOcrRules(token, ocrRuleProfileFilter);
      resetOcrRuleEditor();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить OCR-правило");
    } finally {
      setOcrRuleSaving(false);
    }
  }

  function handleEditOcrProfileMatcher(item: OcrProfileMatcherItem) {
    openTechAdmin("matchers");
    setOcrProfileMatcherForm(createOcrProfileMatcherFormFromItem(item));
  }

  function resetOcrProfileMatcherEditor() {
    setOcrProfileMatcherForm(createEmptyOcrProfileMatcherForm());
  }

  async function handleSaveOcrProfileMatcher() {
    if (!token || user?.role !== "admin") {
      return;
    }
    if (!ocrProfileMatcherForm.profile_scope.trim() || !ocrProfileMatcherForm.title.trim()) {
      setErrorMessage("Для правила выбора шаблона обязательны шаблон и название");
      return;
    }

    setOcrProfileMatcherSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = {
        profile_scope: ocrProfileMatcherForm.profile_scope.trim(),
        title: ocrProfileMatcherForm.title.trim(),
        source_type: ocrProfileMatcherForm.source_type || null,
        filename_pattern: ocrProfileMatcherForm.filename_pattern.trim() || null,
        text_pattern: ocrProfileMatcherForm.text_pattern.trim() || null,
        service_name_pattern: ocrProfileMatcherForm.service_name_pattern.trim() || null,
        priority: Number(ocrProfileMatcherForm.priority || "100"),
        is_active: ocrProfileMatcherForm.is_active === "true",
        notes: ocrProfileMatcherForm.notes.trim() || null,
      };

      if (ocrProfileMatcherForm.id) {
        await apiRequest<OcrProfileMatcherItem>(
          `/ocr-profile-matchers/${ocrProfileMatcherForm.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("Правило выбора шаблона обновлено");
      } else {
        await apiRequest<OcrProfileMatcherItem>(
          "/ocr-profile-matchers",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("Правило выбора шаблона создано");
      }

      await loadOcrProfileMatchers(token, ocrProfileMatcherProfileFilter);
      resetOcrProfileMatcherEditor();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить правило выбора шаблона");
    } finally {
      setOcrProfileMatcherSaving(false);
    }
  }

  async function handleUpdateOcrLearningSignal(signalId: number, nextStatus: string) {
    if (!token || user?.role !== "admin") {
      return;
    }
    setOcrLearningUpdateId(signalId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiRequest<OcrLearningSignalItem>(
        `/ocr-learning/signals/${signalId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: nextStatus }),
        },
        token,
      );
      setSuccessMessage("OCR-сигнал обновлён");
      await loadOcrLearningSignals(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось обновить OCR-сигнал");
    } finally {
      setOcrLearningUpdateId(null);
    }
  }

  async function handleLoadOcrLearningDraft(
    signalId: number,
    target: "ocr_rule" | "matcher",
  ) {
    if (!token || user?.role !== "admin") {
      return;
    }
    setOcrLearningDraftId(signalId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = await apiRequest<OcrLearningDraftsResponse>(
        `/ocr-learning/signals/${signalId}/drafts`,
        { method: "GET" },
        token,
      );

      if (target === "ocr_rule") {
        openTechAdmin("rules");
        setOcrRuleForm({
          id: null,
          profile_scope: payload.ocr_rule_draft.profile_scope,
          target_field: payload.ocr_rule_draft.target_field,
          pattern: payload.ocr_rule_draft.pattern,
          value_parser: payload.ocr_rule_draft.value_parser,
          confidence: String(payload.ocr_rule_draft.confidence),
          priority: String(payload.ocr_rule_draft.priority),
          is_active: "true",
          notes: payload.ocr_rule_draft.notes || "",
        });
        setOcrRuleProfileFilter(payload.ocr_rule_draft.profile_scope);
        setSuccessMessage("Черновик OCR-правила перенесён в форму редактирования");
      } else {
        openTechAdmin("matchers");
        setOcrProfileMatcherForm({
          id: null,
          profile_scope: payload.matcher_draft.profile_scope,
          title: payload.matcher_draft.title,
          source_type: payload.matcher_draft.source_type || "",
          filename_pattern: payload.matcher_draft.filename_pattern || "",
          text_pattern: payload.matcher_draft.text_pattern || "",
          service_name_pattern: payload.matcher_draft.service_name_pattern || "",
          priority: String(payload.matcher_draft.priority),
          is_active: "true",
          notes: payload.matcher_draft.notes || "",
        });
        setOcrProfileMatcherProfileFilter(payload.matcher_draft.profile_scope);
        setSuccessMessage("Черновик правила выбора перенесён в форму редактирования");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить черновик из OCR-обучения");
    } finally {
      setOcrLearningDraftId(null);
    }
  }

  function handleEditService(item: ServiceItem) {
    setActiveWorkspaceTab("admin");
    setActiveAdminTab("services");
    updateBrowserRoute({ workspace: "admin", adminTab: "services" }, "push");
    setShowServiceEditor(true);
    setServiceForm(createServiceFormFromItem(item));
  }

  function resetServiceEditor() {
    setServiceForm(createEmptyServiceForm());
  }

  async function handleSaveService() {
    if (!token || user?.role !== "admin") {
      return;
    }
    if (!serviceForm.name.trim()) {
      setErrorMessage("Название сервиса обязательно");
      return;
    }

    setServiceSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = {
        name: serviceForm.name.trim(),
        city: serviceForm.city.trim() || null,
        contact: serviceForm.contact.trim() || null,
        comment: serviceForm.comment.trim() || null,
        status: serviceForm.status,
      };

      if (serviceForm.id) {
        await apiRequest<ServiceItem>(
          `/services/${serviceForm.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("Сервис обновлён");
      } else {
        await apiRequest<ServiceItem>(
          "/services",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("Сервис создан");
      }

      await loadServices(token);
      resetServiceEditor();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить сервис");
    } finally {
      setServiceSaving(false);
    }
  }

  async function assignReviewService(serviceName: string) {
    if (!token || !selectedRepair) {
      return;
    }

    setReviewServiceAssigning(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const savedRepair = await apiRequest<RepairDetail>(
        `/repairs/${selectedRepair.id}/service`,
        {
          method: "PATCH",
          body: JSON.stringify({
            service_name: serviceName.trim() || null,
          }),
        },
        token,
      );
      setSelectedRepair(savedRepair);
      if (!isEditingRepair) {
        setRepairDraft(createRepairDraft(savedRepair));
      }
      setReviewServiceName(savedRepair.service?.name || "");
      setSuccessMessage(savedRepair.service ? "Сервис назначен ремонту" : "Сервис у ремонта очищен");
      await loadWorkspace(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось назначить сервис");
    } finally {
      setReviewServiceAssigning(false);
    }
  }

  async function handleAssignReviewService() {
    await assignReviewService(reviewServiceName);
  }

  async function handleCreateReviewService() {
    if (!token || !selectedRepair) {
      return;
    }
    if (!reviewServiceForm.name.trim()) {
      setErrorMessage("Название сервиса обязательно");
      return;
    }

    setReviewServiceSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const createdService = await apiRequest<ServiceItem>(
        "/services",
        {
          method: "POST",
          body: JSON.stringify({
            name: reviewServiceForm.name.trim(),
            city: reviewServiceForm.city.trim() || null,
            contact: reviewServiceForm.contact.trim() || null,
            comment: reviewServiceForm.comment.trim() || null,
            status: user?.role === "admin" ? reviewServiceForm.status : "preliminary",
          }),
        },
        token,
      );
      await loadServices(token);
      setReviewServiceForm({
        id: null,
        name: "",
        city: "",
        contact: "",
        comment: "",
        status: user?.role === "admin" ? "confirmed" : "preliminary",
      });
      setShowReviewServiceEditor(false);
      await assignReviewService(createdService.name);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось создать сервис");
    } finally {
      setReviewServiceSaving(false);
    }
  }

  async function searchReviewVehicles(activeToken: string, search: string) {
    if (!search.trim()) {
      setReviewVehicleSearchResults([]);
      return;
    }

    setReviewVehicleSearchLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "20");
      params.set("search", search.trim());
      const payload = await apiRequest<VehiclesResponse>(`/vehicles?${params.toString()}`, { method: "GET" }, activeToken);
      setReviewVehicleSearchResults(
        payload.items.filter((item) => !isPlaceholderVehicle(item.external_id)),
      );
    } finally {
      setReviewVehicleSearchLoading(false);
    }
  }

  async function handleSearchReviewVehicles() {
    if (!token) {
      return;
    }
    setErrorMessage("");
    try {
      await searchReviewVehicles(token, reviewVehicleSearch);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось найти технику");
    }
  }

  async function handleLinkReviewVehicle(vehicleId: number) {
    if (!token || !selectedDocumentId || !selectedRepair) {
      return;
    }

    setReviewVehicleLinkingId(vehicleId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<DocumentCreateVehicleResponse>(
        `/documents/${selectedDocumentId}/link-vehicle`,
        {
          method: "POST",
          body: JSON.stringify({ vehicle_id: vehicleId }),
        },
        token,
      );
      setSuccessMessage(result.message);
      setReviewVehicleSearchResults([]);
      await loadWorkspace(token);
      await openRepairByIds(result.document.id, result.repair_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось привязать технику");
    } finally {
      setReviewVehicleLinkingId(null);
    }
  }

  function updateReviewFieldDraft<K extends keyof ReviewRepairFieldsDraft>(field: K, value: ReviewRepairFieldsDraft[K]) {
    setReviewFieldDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function fillReviewFieldDraftFromOcr() {
    setReviewFieldDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        order_number:
          typeof selectedRepairDocumentExtractedFields?.order_number === "string"
            ? selectedRepairDocumentExtractedFields.order_number
            : current.order_number,
        repair_date:
          typeof selectedRepairDocumentExtractedFields?.repair_date === "string"
            ? selectedRepairDocumentExtractedFields.repair_date
            : current.repair_date,
        mileage:
          selectedRepairDocumentExtractedFields?.mileage !== null &&
          selectedRepairDocumentExtractedFields?.mileage !== undefined
            ? String(selectedRepairDocumentExtractedFields.mileage)
            : current.mileage,
        work_total:
          selectedRepairDocumentExtractedFields?.work_total !== null &&
          selectedRepairDocumentExtractedFields?.work_total !== undefined
            ? String(selectedRepairDocumentExtractedFields.work_total)
            : current.work_total,
        parts_total:
          selectedRepairDocumentExtractedFields?.parts_total !== null &&
          selectedRepairDocumentExtractedFields?.parts_total !== undefined
            ? String(selectedRepairDocumentExtractedFields.parts_total)
            : current.parts_total,
        vat_total:
          selectedRepairDocumentExtractedFields?.vat_total !== null &&
          selectedRepairDocumentExtractedFields?.vat_total !== undefined
            ? String(selectedRepairDocumentExtractedFields.vat_total)
            : current.vat_total,
        grand_total:
          selectedRepairDocumentExtractedFields?.grand_total !== null &&
          selectedRepairDocumentExtractedFields?.grand_total !== undefined
            ? String(selectedRepairDocumentExtractedFields.grand_total)
            : current.grand_total,
      };
    });
  }

  async function handleSaveReviewFields() {
    if (!token || !selectedRepair || !reviewFieldDraft) {
      return;
    }

    const parseOptionalNumber = (value: string, label: string) => {
      const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
      if (!normalized) {
        return null;
      }
      const parsed = Number(normalized);
      if (!Number.isFinite(parsed)) {
        throw new Error(`Поле \`${label}\` заполнено некорректно`);
      }
      return parsed;
    };

    setReviewFieldSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = {
        order_number: reviewFieldDraft.order_number.trim() || null,
        repair_date: reviewFieldDraft.repair_date || null,
        mileage: parseOptionalNumber(reviewFieldDraft.mileage, "Пробег"),
        work_total: parseOptionalNumber(reviewFieldDraft.work_total, "Работы"),
        parts_total: parseOptionalNumber(reviewFieldDraft.parts_total, "Запчасти"),
        vat_total: parseOptionalNumber(reviewFieldDraft.vat_total, "НДС"),
        grand_total: parseOptionalNumber(reviewFieldDraft.grand_total, "Итоговая сумма"),
        reason: reviewFieldDraft.reason.trim() || null,
        employee_comment: reviewFieldDraft.employee_comment.trim() || null,
      };

      const savedRepair = await apiRequest<RepairDetail>(
        `/repairs/${selectedRepair.id}/review-fields`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        token,
      );
      setSelectedRepair(savedRepair);
      setRepairDraft(createRepairDraft(savedRepair));
      setReviewFieldDraft(createReviewRepairFieldsDraft(savedRepair));
      setSuccessMessage("Поля проверки сохранены");
      await loadWorkspace(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить поля проверки");
    } finally {
      setReviewFieldSaving(false);
    }
  }

  async function handleLaborNormImport() {
    if (!token || user?.role !== "admin" || !laborNormFile) {
      setErrorMessage("Выберите .xlsx файл справочника");
      return;
    }

    setLaborNormImportLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const body = new FormData();
      body.append("file", laborNormFile);
      body.append("scope", laborNormImportScope);
      body.append("brand_family", laborNormImportBrandFamily);
      body.append("catalog_name", laborNormImportCatalogName);

      const result = await apiRequest<LaborNormImportResponse>(
        "/labor-norms/import",
        {
          method: "POST",
          body,
        },
        token,
      );

      setSuccessMessage(
        `${result.message}. Создано ${result.created}, обновлено ${result.updated}, пропущено ${result.skipped}.`,
      );
      setLaborNormFile(null);
      setLaborNormScope(laborNormImportScope);
      await loadLaborNormCatalogConfigs(token);
      await loadLaborNormCatalog(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось импортировать справочник нормо-часов");
    } finally {
      setLaborNormImportLoading(false);
    }
  }

  async function handleHistoricalRepairImport() {
    if (!token || user?.role !== "admin" || !historicalImportFile) {
      setErrorMessage("Выберите .xlsx файл истории ремонтов");
      return;
    }

    setHistoricalImportLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const body = new FormData();
      body.append("file", historicalImportFile);
      const normalizedLimit = historicalImportLimit.trim();
      if (normalizedLimit) {
        body.append("repair_limit", normalizedLimit);
      }

      const result = await apiRequest<HistoricalRepairImportResponse>(
        "/imports/historical-repairs",
        {
          method: "POST",
          body,
        },
        token,
      );

      setHistoricalImportResult(result);
      setSuccessMessage(
        `${result.message}. Создано ремонтов ${result.created_repairs}, конфликтов ${result.conflicts_created}, дублей ${result.duplicate_repairs}.`,
      );
      setHistoricalImportFile(null);
      await Promise.all([loadHistoricalImportJobs(token), loadHistoricalWorkReference(token), loadImportConflicts(token)]);
      await loadWorkspace(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось импортировать историю ремонтов");
    } finally {
      setHistoricalImportLoading(false);
    }
  }

  async function handleResolveImportConflict(nextStatus: "resolved" | "ignored") {
    if (!token || user?.role !== "admin" || !selectedImportConflict) {
      return;
    }

    setImportConflictSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = await apiRequest<ImportConflictResolveResponse>(
        `/imports/conflicts/${selectedImportConflict.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: nextStatus,
            comment: importConflictComment.trim() || null,
          }),
        },
        token,
      );
      setSelectedImportConflict(payload.conflict);
      setSuccessMessage(payload.message);
      setShowImportConflictDialog(false);
      setImportConflictComment("");
      await Promise.all([
        loadImportConflicts(token),
        loadWorkspace(token),
      ]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось обновить конфликт импорта");
    } finally {
      setImportConflictSaving(false);
    }
  }

  function handleEditLaborNormCatalog(item: LaborNormCatalogConfigItem) {
    setActiveWorkspaceTab("admin");
    setActiveAdminTab("labor_norms");
    updateBrowserRoute({ workspace: "admin", adminTab: "labor_norms" }, "push");
    setShowLaborNormCatalogEditor(true);
    setEditingLaborNormCatalogId(item.id);
    setLaborNormCatalogForm(createCatalogFormFromItem(item));
  }

  function resetLaborNormCatalogEditor() {
    setEditingLaborNormCatalogId(null);
    setLaborNormCatalogForm(createEmptyCatalogForm());
  }

  function handleCatalogScopeSelected(scope: string) {
    setActiveWorkspaceTab("admin");
    setActiveAdminTab("labor_norms");
    updateBrowserRoute({ workspace: "admin", adminTab: "labor_norms" }, "push");
    setShowLaborNormImport(true);
    setLaborNormImportScope(scope);
    const selectedCatalog = laborNormCatalogs.find((item) => item.scope === scope);
    if (selectedCatalog) {
      setLaborNormImportBrandFamily(selectedCatalog.brand_family || "");
      setLaborNormImportCatalogName(selectedCatalog.catalog_name);
      if (!laborNormEntryForm.scope) {
        setLaborNormEntryForm((current) => ({ ...current, scope }));
      }
    }
  }

  async function handleSaveLaborNormCatalog() {
    if (!token || user?.role !== "admin") {
      return;
    }

    if (!laborNormCatalogForm.scope.trim() || !laborNormCatalogForm.catalog_name.trim()) {
      setErrorMessage("Для каталога обязательны код и название");
      return;
    }

    setLaborNormCatalogSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = {
        catalog_name: laborNormCatalogForm.catalog_name.trim(),
        brand_family: laborNormCatalogForm.brand_family.trim() || null,
        vehicle_type: laborNormCatalogForm.vehicle_type || null,
        year_from: laborNormCatalogForm.year_from.trim() ? Number(laborNormCatalogForm.year_from) : null,
        year_to: laborNormCatalogForm.year_to.trim() ? Number(laborNormCatalogForm.year_to) : null,
        brand_keywords: splitEditorLines(laborNormCatalogForm.brand_keywords),
        model_keywords: splitEditorLines(laborNormCatalogForm.model_keywords),
        vin_prefixes: splitEditorLines(laborNormCatalogForm.vin_prefixes),
        priority: Number(laborNormCatalogForm.priority || "100"),
        auto_match_enabled: laborNormCatalogForm.auto_match_enabled === "true",
        status: laborNormCatalogForm.status,
        notes: laborNormCatalogForm.notes.trim() || null,
      };

      if (editingLaborNormCatalogId) {
        await apiRequest<LaborNormCatalogConfigItem>(
          `/labor-norms/catalogs/${editingLaborNormCatalogId}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("Каталог нормо-часов обновлён");
      } else {
        await apiRequest<LaborNormCatalogConfigItem>(
          "/labor-norms/catalogs",
          {
            method: "POST",
            body: JSON.stringify({
              scope: laborNormCatalogForm.scope.trim(),
              ...payload,
            }),
          },
          token,
        );
        setSuccessMessage("Каталог нормо-часов создан");
      }

      await loadLaborNormCatalogConfigs(token);
      handleCatalogScopeSelected(laborNormCatalogForm.scope.trim());
      if (laborNormScope === laborNormCatalogForm.scope.trim()) {
        await loadLaborNormCatalog(token);
      }
      resetLaborNormCatalogEditor();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить каталог нормо-часов");
    } finally {
      setLaborNormCatalogSaving(false);
    }
  }

  function handleEditLaborNormItem(item: LaborNormCatalogItem) {
    setActiveWorkspaceTab("admin");
    setActiveAdminTab("labor_norms");
    updateBrowserRoute({ workspace: "admin", adminTab: "labor_norms" }, "push");
    setShowLaborNormEntryEditor(true);
    setLaborNormEntryForm(createLaborNormEntryFormFromItem(item));
  }

  function resetLaborNormEntryEditor(scope = laborNormScope || laborNormImportScope || laborNormCatalogs[0]?.scope || "") {
    setLaborNormEntryForm(createEmptyLaborNormEntryForm(scope));
  }

  async function handleSaveLaborNormEntry() {
    if (!token || user?.role !== "admin") {
      return;
    }
    if (!laborNormEntryForm.scope.trim() || !laborNormEntryForm.code.trim() || !laborNormEntryForm.name_ru.trim()) {
      setErrorMessage("Для записи обязательны каталог, код и русское название");
      return;
    }
    if (!laborNormEntryForm.standard_hours.trim()) {
      setErrorMessage("Укажите норматив в часах");
      return;
    }

    setLaborNormEntrySaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = {
        scope: laborNormEntryForm.scope.trim(),
        code: laborNormEntryForm.code.trim(),
        category: laborNormEntryForm.category.trim() || null,
        name_ru: laborNormEntryForm.name_ru.trim(),
        name_ru_alt: laborNormEntryForm.name_ru_alt.trim() || null,
        name_cn: laborNormEntryForm.name_cn.trim() || null,
        name_en: laborNormEntryForm.name_en.trim() || null,
        standard_hours: Number(laborNormEntryForm.standard_hours.replace(",", ".")),
        source_sheet: laborNormEntryForm.source_sheet.trim() || null,
        source_file: laborNormEntryForm.source_file.trim() || null,
        status: laborNormEntryForm.status,
      };

      if (laborNormEntryForm.id) {
        await apiRequest<LaborNormCatalogItem>(
          `/labor-norms/${laborNormEntryForm.id}`,
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("Запись нормо-часов обновлена");
      } else {
        await apiRequest<LaborNormCatalogItem>(
          "/labor-norms",
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
          token,
        );
        setSuccessMessage("Запись нормо-часов создана");
      }

      setLaborNormScope(laborNormEntryForm.scope.trim());
      await loadLaborNormCatalogConfigs(token);
      await loadLaborNormCatalog(token, laborNormQuery, laborNormEntryForm.scope.trim(), laborNormCategory);
      resetLaborNormEntryEditor(laborNormEntryForm.scope.trim());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить запись нормо-часов");
    } finally {
      setLaborNormEntrySaving(false);
    }
  }

  async function handleArchiveLaborNormItem(item: LaborNormCatalogItem) {
    if (!token || user?.role !== "admin") {
      return;
    }
    setLaborNormEntrySaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      await apiRequest<LaborNormCatalogItem>(
        `/labor-norms/${item.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "archived" }),
        },
        token,
      );
      setSuccessMessage(`Запись ${item.code} отправлена в архив`);
      await loadLaborNormCatalog(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось отправить запись в архив");
    } finally {
      setLaborNormEntrySaving(false);
    }
  }

  function handleStartRepairEdit() {
    if (!selectedRepair) {
      return;
    }
    setActiveRepairTab("overview");
    setRepairDraft(createRepairDraft(selectedRepair));
    setIsEditingRepair(true);
  }

  function handleCancelRepairEdit() {
    if (selectedRepair) {
      setRepairDraft(createRepairDraft(selectedRepair));
    } else {
      setRepairDraft(null);
    }
    setIsEditingRepair(false);
  }

  function updateRepairDraftField<K extends keyof EditableRepairDraft>(field: K, value: EditableRepairDraft[K]) {
    setRepairDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateWorkDraft(index: number, field: keyof EditableWorkDraft, value: EditableWorkDraft[keyof EditableWorkDraft]) {
    setRepairDraft((current) => {
      if (!current) {
        return current;
      }
      const works = [...current.works];
      works[index] = { ...works[index], [field]: value };
      return { ...current, works };
    });
  }

  function updatePartDraft(index: number, field: keyof EditablePartDraft, value: EditablePartDraft[keyof EditablePartDraft]) {
    setRepairDraft((current) => {
      if (!current) {
        return current;
      }
      const parts = [...current.parts];
      parts[index] = { ...parts[index], [field]: value };
      return { ...current, parts };
    });
  }

  function addWorkDraft() {
    setRepairDraft((current) =>
      current
        ? {
            ...current,
            works: [
              ...current.works,
              {
                work_code: "",
                work_name: "",
                quantity: 1,
                standard_hours: "",
                actual_hours: "",
                price: 0,
                line_total: 0,
                status: "preliminary",
              },
            ],
          }
        : current,
    );
  }

  function addPartDraft() {
    setRepairDraft((current) =>
      current
        ? {
            ...current,
            parts: [
              ...current.parts,
              {
                article: "",
                part_name: "",
                quantity: 1,
                unit_name: "шт",
                price: 0,
                line_total: 0,
                status: "preliminary",
              },
            ],
          }
        : current,
    );
  }

  function removeWorkDraft(index: number) {
    setRepairDraft((current) =>
      current
        ? { ...current, works: current.works.filter((_, itemIndex) => itemIndex !== index) }
        : current,
    );
  }

  function removePartDraft(index: number) {
    setRepairDraft((current) =>
      current
        ? { ...current, parts: current.parts.filter((_, itemIndex) => itemIndex !== index) }
        : current,
    );
  }

  async function handleSaveRepair() {
    if (!token || !selectedRepair || !repairDraft) {
      return;
    }

    setSaveRepairLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload = {
        order_number: repairDraft.order_number || null,
        repair_date: repairDraft.repair_date,
        mileage: Number(repairDraft.mileage),
        reason: repairDraft.reason || null,
        employee_comment: repairDraft.employee_comment || null,
        service_name: repairDraft.service_name || null,
        work_total: Number(repairDraft.work_total),
        parts_total: Number(repairDraft.parts_total),
        vat_total: Number(repairDraft.vat_total),
        grand_total: Number(repairDraft.grand_total),
        status: repairDraft.status,
        is_preliminary: repairDraft.is_preliminary,
        works: repairDraft.works.map((item) => ({
          work_code: item.work_code || null,
          work_name: item.work_name,
          quantity: Number(item.quantity),
          standard_hours: item.standard_hours === "" ? null : Number(item.standard_hours),
          actual_hours: item.actual_hours === "" ? null : Number(item.actual_hours),
          price: Number(item.price),
          line_total: Number(item.line_total),
          status: item.status,
          reference_payload: { source: "manual_edit" },
        })),
        parts: repairDraft.parts.map((item) => ({
          article: item.article || null,
          part_name: item.part_name,
          quantity: Number(item.quantity),
          unit_name: item.unit_name || null,
          price: Number(item.price),
          line_total: Number(item.line_total),
          status: item.status,
        })),
      };

      const savedRepair = await apiRequest<RepairDetail>(
        `/repairs/${selectedRepair.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        token,
      );

      setSelectedRepair(savedRepair);
      setRepairDraft(createRepairDraft(savedRepair));
      setIsEditingRepair(false);
      setSuccessMessage("Карточка ремонта обновлена");
      await loadWorkspace(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить ремонт");
    } finally {
      setSaveRepairLoading(false);
    }
  }

  async function handleArchiveRepair() {
    if (!token || !selectedRepair || user?.role !== "admin") {
      return;
    }

    setRepairArchiveLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const savedRepair = await apiRequest<RepairDetail>(
        `/repairs/${selectedRepair.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "archived" }),
        },
        token,
      );
      setSelectedRepair(savedRepair);
      setRepairDraft(createRepairDraft(savedRepair));
      setIsEditingRepair(false);
      setSelectedDocumentId((current) => resolveRepairDocumentId(savedRepair, current));
      setSuccessMessage(`Ремонт #${savedRepair.id} отправлен в архив`);
      await loadWorkspace(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось отправить ремонт в архив");
    } finally {
      setRepairArchiveLoading(false);
    }
  }

  async function handleDeleteRepair(repairId: number) {
    if (!token || user?.role !== "admin") {
      return;
    }
    const confirmed = window.confirm(
      "Удалить ошибочно введенный заказ-наряд вместе со связанными документами и OCR-данными?",
    );
    if (!confirmed) {
      return;
    }

    setRepairDeleteLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload = await apiRequest<RepairDeleteResponse>(
        `/repairs/${repairId}`,
        { method: "DELETE" },
        token,
      );
      if (selectedRepair?.id === repairId) {
        setSelectedRepair(null);
        setSelectedDocumentId(null);
        setActiveWorkspaceTab("documents");
      }
      setSuccessMessage(payload.message);
      await loadWorkspace(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось удалить заказ-наряд");
    } finally {
      setRepairDeleteLoading(false);
    }
  }

  async function handleArchiveDocument(documentId: number, repairId: number) {
    if (!token || user?.role !== "admin") {
      return;
    }

    setDocumentArchiveLoadingId(documentId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const updatedDocument = await apiRequest<DocumentItem>(
        `/documents/${documentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "archived" }),
        },
        token,
      );
      setSuccessMessage(`Документ ${updatedDocument.original_filename} отправлен в архив`);
      await loadWorkspace(token);
      if (selectedRepair?.id === repairId) {
        await openRepairByIds(updatedDocument.id, repairId);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось отправить документ в архив");
    } finally {
      setDocumentArchiveLoadingId(null);
    }
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken("");
    setActiveWorkspaceTab("documents");
    setActiveAdminTab("services");
    setActiveTechAdminTab("learning");
    setActiveRepairTab("overview");
    setShowTechAdminTab(false);
    setShowPasswordChange(false);
    setShowPasswordRecoveryRequest(false);
    setShowServiceEditor(false);
    setShowReviewRuleEditor(false);
    setShowLaborNormCatalogEditor(false);
    setShowLaborNormImport(false);
    setShowLaborNormEntryEditor(false);
    setLastUploadedDocument(null);
    setCurrentPasswordValue("");
    setNewPasswordValue("");
    setRecoveryEmailValue("");
    setRecoveryTokenValue("");
    setRecoveryNewPasswordValue("");
    setAdminResetPasswordValue("");
    setSuccessMessage("");
    setErrorMessage("");
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
        onOpenPasswordRecovery={() => {
          setShowPasswordRecoveryRequest(true);
          setErrorMessage("");
          setSuccessMessage("");
        }}
        onRecoveryEmailValueChange={setRecoveryEmailValue}
        onRequestPasswordRecovery={() => {
          void handleRequestPasswordRecovery();
        }}
        onRecoveryTokenValueChange={setRecoveryTokenValue}
        onRecoveryNewPasswordValueChange={setRecoveryNewPasswordValue}
        onConfirmPasswordRecovery={() => {
          void handleConfirmPasswordRecovery();
        }}
        onBackToLogin={() => {
          setShowPasswordRecoveryRequest(false);
          setErrorMessage("");
          setSuccessMessage("");
          setRecoveryNewPasswordValue("");
          if (!window.location.search.includes("reset_token=")) {
            setRecoveryTokenValue("");
          }
        }}
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
        onCancelPasswordChange: () => {
          setShowPasswordChange(false);
          setCurrentPasswordValue("");
          setNewPasswordValue("");
        },
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
                onUploadFieldChange: handleUploadFieldChange,
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
                  setUserSearch("");
                  if (token) {
                    void loadUsers(token, "");
                  }
                },
                onToggleUserEditor: () => {
                  setShowUserEditor((current) => !current);
                },
                onUserFormChange: (field, value) => {
                  setUserForm((current) => ({
                    ...current,
                    [field]: value,
                  }));
                },
                onSaveUser: () => {
                  void handleSaveUser();
                },
                onResetUserForm: () => {
                  resetUserEditor();
                  setShowUserEditor(false);
                },
                onSelectUser: setSelectedManagedUserId,
                onEditUser: handleEditUser,
                onAdminResetPasswordValueChange: setAdminResetPasswordValue,
                onAdminResetUserPassword: () => {
                  void handleAdminResetUserPassword();
                },
                onUserVehicleSearchChange: setUserVehicleSearch,
                onUserAssignmentFormChange: (field, value) => {
                  setUserAssignmentForm((current) => ({
                    ...current,
                    [field]: value,
                  }));
                },
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
                  setServiceQuery("");
                  setServiceCityFilter("");
                  if (token) {
                    void loadServices(token, "", "");
                  }
                },
                onToggleEditor: () => {
                  setShowServiceEditor((current) => !current);
                },
                onServiceFormChange: (field, value) => {
                  setServiceForm((current) => ({
                    ...current,
                    [field]: value,
                  }));
                },
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
                  if (token) {
                    void loadBackups(token);
                  }
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
                  setShowReviewRuleEditor((current) => !current);
                },
                onReviewRuleFormChange: (field, value) => {
                  setReviewRuleForm((current) => ({
                    ...current,
                    [field]: value,
                  }));
                },
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
                onEditReviewRule: handleEditReviewRule,
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
                    void loadOcrLearningSignals(token);
                  }
                },
                onReset: () => {
                  setOcrLearningStatusFilter("");
                  setOcrLearningTargetFieldFilter("");
                  setOcrLearningProfileScopeFilter("");
                  if (token) {
                    void loadOcrLearningSignals(token, "", "", "");
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
                    void loadOcrProfileMatchers(token, ocrProfileMatcherProfileFilter);
                  }
                },
                onResetFilter: () => {
                  setOcrProfileMatcherProfileFilter("");
                  if (token) {
                    void loadOcrProfileMatchers(token, "");
                  }
                },
                onFormChange: (field, value) => {
                  setOcrProfileMatcherForm((current) => ({
                    ...current,
                    [field]: value,
                  }));
                },
                onSave: () => {
                  void handleSaveOcrProfileMatcher();
                },
                onResetForm: resetOcrProfileMatcherEditor,
                onEdit: handleEditOcrProfileMatcher,
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
                    void loadOcrRules(token, ocrRuleProfileFilter);
                  }
                },
                onResetFilter: () => {
                  setOcrRuleProfileFilter("");
                  if (token) {
                    void loadOcrRules(token, "");
                  }
                },
                onFormChange: (field, value) => {
                  setOcrRuleForm((current) => ({
                    ...current,
                    [field]: value,
                  }));
                },
                onSave: () => {
                  void handleSaveOcrRule();
                },
                onResetForm: resetOcrRuleEditor,
                onEdit: handleEditOcrRule,
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
                  if (token) {
                    void Promise.all([
                      loadHistoricalImportJobs(token),
                      loadHistoricalWorkReference(token),
                      loadImportConflicts(token),
                    ]);
                  }
                },
                onOpenImportedRepair: (repairId) => {
                  void openRepairByIds(null, repairId);
                },
                onHistoricalWorkReferenceQueryChange: setHistoricalWorkReferenceQuery,
                onHistoricalWorkReferenceMinSamplesChange: setHistoricalWorkReferenceMinSamples,
                onRefreshHistoricalWorkReference: () => {
                  if (token) {
                    void loadHistoricalWorkReference(token);
                  }
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
                onToggleCatalogEditor: () => setShowLaborNormCatalogEditor((current) => !current),
                onToggleImport: () => setShowLaborNormImport((current) => !current),
                onToggleEntryEditor: () => setShowLaborNormEntryEditor((current) => !current),
                onCatalogFormChange: (field, value) =>
                  setLaborNormCatalogForm((current) => ({
                    ...current,
                    [field]: value,
                  })),
                onSaveCatalog: () => {
                  void handleSaveLaborNormCatalog();
                },
                onResetCatalogForm: () => {
                  resetLaborNormCatalogEditor();
                  setShowLaborNormCatalogEditor(false);
                },
                onEditCatalog: handleEditLaborNormCatalog,
                onSelectCatalogScope: handleCatalogScopeSelected,
                onQueryChange: setLaborNormQuery,
                onScopeChange: setLaborNormScope,
                onCategoryChange: setLaborNormCategory,
                onSearch: () => {
                  void handleLaborNormSearch();
                },
                onResetFilters: () => {
                  setLaborNormQuery("");
                  setLaborNormScope("");
                  setLaborNormCategory("");
                  if (token) {
                    void loadLaborNormCatalog(token, "", "", "");
                  }
                },
                onImportBrandFamilyChange: setLaborNormImportBrandFamily,
                onImportCatalogNameChange: setLaborNormImportCatalogName,
                onImportFileChange: setLaborNormFile,
                onImport: () => {
                  void handleLaborNormImport();
                },
                onEntryFormChange: (field, value) =>
                  setLaborNormEntryForm((current) => ({
                    ...current,
                    [field]: value,
                  })),
                onSaveEntry: () => {
                  void handleSaveLaborNormEntry();
                },
                onResetEntryForm: () => {
                  resetLaborNormEntryEditor();
                  setShowLaborNormEntryEditor(false);
                },
                onOpenListDialog: () => setShowLaborNormListDialog(true),
                onCloseListDialog: () => setShowLaborNormListDialog(false),
                onEditItem: handleEditLaborNormItem,
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
                onReset: () => {
                  setGlobalSearchQuery("");
                  setGlobalSearchResult(null);
                },
                onOpenRepair: (documentId, repairId) => {
                  void openRepairByIds(documentId, repairId);
                },
                onOpenVehicle: openFleetVehicleById,
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
                  if (token) {
                    void loadAuditLog(token);
                  }
                },
                onReset: () => {
                  setAuditSearchQuery("");
                  setAuditEntityTypeFilter("");
                  setAuditActionTypeFilter("");
                  setAuditUserIdFilter("");
                  setAuditDateFrom("");
                  setAuditDateTo("");
                },
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
                  if (token) {
                    void loadFleetVehicles(token);
                  }
                },
                onReset: () => {
                  setFleetQuery("");
                  setFleetVehicleTypeFilter("");
                  setFleetStatusFilter("");
                  if (token) {
                    void loadFleetVehicles(token, "", "", "");
                  }
                },
                onReturnToList: returnToFleetList,
                onOpenVehicleCard: openFleetVehicleCard,
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
