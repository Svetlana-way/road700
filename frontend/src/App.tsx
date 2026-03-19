import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { AdminWorkspacePanel } from "./components/AdminWorkspacePanel";
import { AuditLogPanel } from "./components/AuditLogPanel";
import { BackupsAdminPanel } from "./components/BackupsAdminPanel";
import { DataQualityOverviewPanel } from "./components/DataQualityOverviewPanel";
import { DocumentsListPanel } from "./components/DocumentsListPanel";
import { DocumentsUploadPanel } from "./components/DocumentsUploadPanel";
import { EmployeesAdminPanel } from "./components/EmployeesAdminPanel";
import { FleetPanel } from "./components/FleetPanel";
import { FleetVehicleDetailPanel } from "./components/FleetVehicleDetailPanel";
import { GlobalSearchPanel } from "./components/GlobalSearchPanel";
import { HistoricalImportsAdminPanel } from "./components/HistoricalImportsAdminPanel";
import { LaborNormsAdminPanel } from "./components/LaborNormsAdminPanel";
import { OcrLearningAdminPanel } from "./components/OcrLearningAdminPanel";
import { OcrMatchersAdminPanel } from "./components/OcrMatchersAdminPanel";
import { OcrRulesAdminPanel } from "./components/OcrRulesAdminPanel";
import { RepairPanel } from "./components/RepairPanel";
import { RepairEditSections } from "./components/RepairEditSections";
import { RepairDocumentsSection } from "./components/RepairDocumentsSection";
import { RepairOverviewReportPanel } from "./components/RepairOverviewReportPanel";
import { RepairReadOnlySections } from "./components/RepairReadOnlySections";
import { ReviewExtractedDataPanel } from "./components/ReviewExtractedDataPanel";
import { ReviewDocumentPreviewPanel } from "./components/ReviewDocumentPreviewPanel";
import { ReviewRequiredFieldsPanel } from "./components/ReviewRequiredFieldsPanel";
import { ReviewServicePanel } from "./components/ReviewServicePanel";
import { ReviewVehicleLinkPanel } from "./components/ReviewVehicleLinkPanel";
import { ReviewRulesAdminPanel } from "./components/ReviewRulesAdminPanel";
import { ReviewQueuePanel } from "./components/ReviewQueuePanel";
import { ServicesAdminPanel } from "./components/ServicesAdminPanel";
import { TechAdminWorkspacePanel } from "./components/TechAdminWorkspacePanel";
import { WorkspaceChromePanels } from "./components/WorkspaceChromePanels";
import { TOKEN_STORAGE_KEY, apiRequest, downloadApiFile, downloadDocumentFile, loginRequest } from "./shared/api";

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

type DashboardVisualTone = "blue" | "amber" | "red" | "green";

type DashboardVisualBar = {
  label: string;
  value: number;
  hint?: string;
  tone: DashboardVisualTone;
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
type WorkspaceTab = "documents" | "repair" | "admin" | "tech_admin" | "fleet" | "search" | "audit";
type AdminTab = "services" | "control" | "labor_norms" | "imports" | "employees" | "backups";
type TechAdminTab = "learning" | "matchers" | "rules";
type RepairTab = "overview" | "works" | "parts" | "documents" | "checks" | "history";
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

type RepairReportSectionKey = "catalogs" | "labor_norms" | "amounts" | "history" | "ocr";
type RepairReportSection = {
  key: RepairReportSectionKey;
  title: string;
  checks: RepairDetail["checks"];
};

type RepairHistoryEntry = RepairDetail["history"][number];
type RepairDocumentHistoryEntry = RepairDetail["document_history"][number];

type CheckResolutionMeta = {
  is_resolved?: boolean;
  comment?: string | null;
  user_id?: number;
  user_name?: string | null;
  resolved_at?: string | null;
};

type WorkLaborNormMeta = {
  applicable: boolean | null;
  applicabilityReason: string | null;
  scope: string | null;
  catalogName: string | null;
  code: string | null;
  name: string | null;
  category: string | null;
  matchedBy: string | null;
  matchScore: number | null;
  standardHours: number | null;
};

type OcrProfileMeta = {
  scope: string | null;
  source: string | null;
  reason: string | null;
};

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

type ReviewComparisonStatus = "match" | "missing" | "mismatch" | "ocr_missing" | "empty";

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

const PLACEHOLDER_EXTERNAL_ID = "__batch_import_placeholder__";

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

function parseRepairDateFromFilename(filename: string): string | null {
  const normalized = filename.trim();
  const dayFirstMatch = normalized.match(/(\d{2})[.\-_](\d{2})[.\-_](\d{4})/);
  if (dayFirstMatch) {
    return `${dayFirstMatch[3]}-${dayFirstMatch[2]}-${dayFirstMatch[1]}`;
  }
  const isoMatch = normalized.match(/(\d{4})[.\-_](\d{2})[.\-_](\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }
  return null;
}

function parseOrderNumberFromFilename(filename: string): string | null {
  const directNumberMatch = filename.match(/№\s*([A-Za-zА-Яа-я0-9\-\/]+)/u);
  if (directNumberMatch?.[1]) {
    return directNumberMatch[1].trim();
  }
  const orderMatch = filename.match(/(?:заказ[\s_-]*наряд|зн)[^\w]{0,3}([A-Za-zА-Яа-я0-9\-\/]+)/iu);
  if (orderMatch?.[1]) {
    return orderMatch[1].trim();
  }
  return null;
}

const summaryCards: Array<{ key: keyof DashboardSummary; label: string }> = [
  { key: "vehicles_total", label: "Техника в доступе" },
  { key: "repairs_total", label: "Ремонтов в базе" },
  { key: "documents_total", label: "Документов загружено" },
  { key: "documents_review_queue", label: "Очередь проверки" },
];

const qualityCards: Array<{ key: keyof DashboardDataQuality; label: string }> = [
  { key: "documents_needs_review", label: "Документы на проверке" },
  { key: "documents_ocr_error", label: "Ошибки OCR" },
  { key: "documents_low_confidence", label: "Низкая уверенность OCR" },
  { key: "repairs_suspicious", label: "Подозрительные ремонты" },
  { key: "services_preliminary", label: "Неподтверждённые сервисы" },
  { key: "works_preliminary", label: "Неподтверждённые работы" },
  { key: "parts_preliminary", label: "Неподтверждённые материалы" },
  { key: "import_conflicts_pending", label: "Конфликты импорта" },
];

function buildDashboardVisualBarWidth(value: number, maxValue: number) {
  if (value <= 0 || maxValue <= 0) {
    return "0%";
  }
  const ratio = (value / maxValue) * 100;
  return `${Math.max(8, Math.min(100, ratio))}%`;
}

function buildRepairVisualBars(
  summary: DashboardSummary | null,
  dataQuality: DashboardDataQuality | null,
): DashboardVisualBar[] {
  if (!summary) {
    return [];
  }

  const confirmedRepairs = Math.max(
    0,
    summary.repairs_total - summary.repairs_draft - (dataQuality?.repairs_suspicious || 0),
  );

  const items: DashboardVisualBar[] = [
    {
      label: "Подтверждено",
      value: confirmedRepairs,
      hint: "Ремонты без открытой подозрительности",
      tone: "green",
    },
    {
      label: "Черновики",
      value: summary.repairs_draft,
      hint: "Ещё не подтверждены",
      tone: "amber",
    },
    {
      label: "Подозрительные",
      value: dataQuality?.repairs_suspicious || 0,
      hint: "Требуют проверки",
      tone: "red",
    },
    {
      label: "Документы в очереди",
      value: summary.documents_review_queue,
      hint: "Ожидают OCR или ручной разбор",
      tone: "blue",
    },
  ];

  return items.filter((item) => item.value > 0);
}

function buildQualityVisualBars(dataQuality: DashboardDataQuality | null): DashboardVisualBar[] {
  if (!dataQuality) {
    return [];
  }

  const items: DashboardVisualBar[] = [
    {
      label: "Низкая уверенность OCR",
      value: dataQuality.documents_low_confidence,
      hint: "Ниже рабочего порога",
      tone: "amber",
    },
    {
      label: "Документы на проверке",
      value: dataQuality.documents_needs_review,
      hint: "Нужен ручной разбор",
      tone: "blue",
    },
    {
      label: "Ошибки OCR",
      value: dataQuality.documents_ocr_error,
      hint: "Распознавание не удалось",
      tone: "red",
    },
    {
      label: "Конфликты импорта",
      value: dataQuality.import_conflicts_pending,
      hint: "История ждёт сверки",
      tone: "amber",
    },
  ];

  return items.filter((item) => item.value > 0);
}

function buildAttentionVisualBars(details: DashboardDataQualityDetails | null): DashboardVisualBar[] {
  if (!details) {
    return [];
  }

  const items: DashboardVisualBar[] = [
    {
      label: "Документы",
      value: details.counts.documents,
      hint: "Проблемные файлы",
      tone: "blue",
    },
    {
      label: "Сервисы",
      value: details.counts.services,
      hint: "Неподтверждённые контрагенты",
      tone: "amber",
    },
    {
      label: "Работы",
      value: details.counts.works,
      hint: "Строки без нормализации",
      tone: "amber",
    },
    {
      label: "Материалы",
      value: details.counts.parts,
      hint: "Строки без подтверждения",
      tone: "amber",
    },
    {
      label: "Конфликты",
      value: details.counts.conflicts,
      hint: "Не разобран импорт",
      tone: "red",
    },
  ];

  return items.filter((item) => item.value > 0);
}

const workspaceTabDescriptions: Record<WorkspaceTab, string> = {
  documents: "Загрузка заказ-наряда, автоматическая проверка и короткий итог по результату.",
  repair: "Короткий итог по заказ-наряду, полная расшифровка проверки и история ремонта.",
  admin: "Справочники и правила системы, доступные администратору.",
  tech_admin: "Отдельный экран для OCR-обучения и тонкой технической настройки.",
  fleet: "Быстрый обзор техники, доступной текущему пользователю.",
  search: "Глобальный поиск по заказ-нарядам, ремонтам и карточкам техники.",
  audit: "Журнал действий по ремонтам, документам, технике и пользовательским операциям.",
};
const workspaceTabReturnLabels: Record<WorkspaceTab, string> = {
  documents: "Назад к документам",
  repair: "Назад к ремонту",
  admin: "Назад в админку",
  tech_admin: "Назад в тех. админку",
  fleet: "Назад к технике",
  search: "Назад к поиску",
  audit: "Назад к журналу",
};

const adminTabDescriptions: Record<AdminTab, string> = {
  services: "Справочник сервисов для нормализации названий и ручной правки ремонтов.",
  control: "Причины ручной проверки и приоритеты очереди для заказ-нарядов.",
  labor_norms: "Каталоги нормо-часов, импорт справочников и ручная правка записей.",
  imports: "Пакетный импорт исторических ремонтов из Excel с фиксацией конфликтов и созданием архивной базы.",
  employees: "Пользователи системы, доступ сотрудников и закрепление техники по зонам ответственности.",
  backups: "Полные резервные копии базы и файлов, ручной запуск backup и защищённое восстановление.",
};

const techAdminTabDescriptions: Record<TechAdminTab, string> = {
  learning: "Сигналы из ручных исправлений, которые помогают улучшать OCR на реальных документах.",
  matchers: "Правила выбора шаблона OCR по файлу, сервису и текстовым признакам документа.",
  rules: "Правила извлечения полей из PDF, фото и сканов заказ-нарядов.",
};

const repairTabDescriptions: Record<RepairTab, string> = {
  overview: "Короткий итог для руководителя и полная расшифровка проверки по кнопке.",
  works: "Список работ, нормо-часы и ручное редактирование работ.",
  parts: "Список запчастей и ручное редактирование материалов.",
  documents: "Документы ремонта, версии OCR и сравнение файлов.",
  checks: "Подозрительные проверки и их ручное закрытие.",
  history: "История изменений ремонта и документов.",
};

type AppRoute =
  | { workspace: "documents" }
  | { workspace: "search" }
  | { workspace: "audit" }
  | { workspace: "admin"; adminTab: AdminTab }
  | { workspace: "tech_admin"; techAdminTab: TechAdminTab }
  | { workspace: "fleet"; vehicleId: number | null }
  | { workspace: "repair"; repairId: number | null; repairTab: RepairTab; documentId: number | null };

function normalizeAdminTab(value: string | null): AdminTab {
  if (value === "employees" || value === "control" || value === "labor_norms" || value === "imports" || value === "backups") {
    return value;
  }
  return "services";
}

function normalizeTechAdminTab(value: string | null): TechAdminTab {
  if (value === "matchers" || value === "rules") {
    return value;
  }
  return "learning";
}

function normalizeRepairTab(value: string | null): RepairTab {
  if (value === "works" || value === "parts" || value === "documents" || value === "checks" || value === "history") {
    return value;
  }
  return "overview";
}

function parsePositiveId(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readAppRoute(location: Location): AppRoute {
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const searchParams = new URLSearchParams(location.search);

  if (pathSegments[0] === "search") {
    return { workspace: "search" };
  }
  if (pathSegments[0] === "audit") {
    return { workspace: "audit" };
  }
  if (pathSegments[0] === "admin") {
    return { workspace: "admin", adminTab: normalizeAdminTab(pathSegments[1] ?? null) };
  }
  if (pathSegments[0] === "tech-admin") {
    return { workspace: "tech_admin", techAdminTab: normalizeTechAdminTab(pathSegments[1] ?? null) };
  }
  if (pathSegments[0] === "fleet") {
    return { workspace: "fleet", vehicleId: parsePositiveId(pathSegments[1]) };
  }
  if (pathSegments[0] === "repair") {
    return {
      workspace: "repair",
      repairId: null,
      repairTab: normalizeRepairTab(searchParams.get("tab")),
      documentId: parsePositiveId(searchParams.get("document")),
    };
  }
  if (pathSegments[0] === "repairs") {
    return {
      workspace: "repair",
      repairId: parsePositiveId(pathSegments[1]),
      repairTab: normalizeRepairTab(searchParams.get("tab")),
      documentId: parsePositiveId(searchParams.get("document")),
    };
  }
  if (pathSegments[0] === "documents") {
    return { workspace: "documents" };
  }

  return { workspace: "documents" };
}

function buildAppRouteUrl(route: AppRoute): string {
  if (route.workspace === "documents") {
    return "/documents";
  }
  if (route.workspace === "search") {
    return "/search";
  }
  if (route.workspace === "audit") {
    return "/audit";
  }
  if (route.workspace === "admin") {
    return `/admin/${route.adminTab}`;
  }
  if (route.workspace === "tech_admin") {
    return `/tech-admin/${route.techAdminTab}`;
  }
  if (route.workspace === "fleet") {
    return route.vehicleId ? `/fleet/${route.vehicleId}` : "/fleet";
  }

  const params = new URLSearchParams();
  if (route.repairTab !== "overview") {
    params.set("tab", route.repairTab);
  }
  if (route.documentId !== null) {
    params.set("document", String(route.documentId));
  }
  const query = params.toString();
  const path = route.repairId ? `/repairs/${route.repairId}` : "/repair";
  return query ? `${path}?${query}` : path;
}

function areAppRoutesEqual(left: AppRoute, right: AppRoute) {
  if (left.workspace !== right.workspace) {
    return false;
  }
  if (left.workspace === "admin" && right.workspace === "admin") {
    return left.adminTab === right.adminTab;
  }
  if (left.workspace === "tech_admin" && right.workspace === "tech_admin") {
    return left.techAdminTab === right.techAdminTab;
  }
  if (left.workspace === "fleet" && right.workspace === "fleet") {
    return left.vehicleId === right.vehicleId;
  }
  if (left.workspace === "repair" && right.workspace === "repair") {
    return left.repairId === right.repairId && left.repairTab === right.repairTab && left.documentId === right.documentId;
  }
  return true;
}

const reviewQueueFilters: Array<{ key: ReviewQueueCategory; label: string }> = [
  { key: "all", label: "Все" },
  { key: "suspicious", label: "Подозрительные" },
  { key: "ocr_error", label: "OCR ошибки" },
  { key: "partial_recognition", label: "Частично распознано" },
  { key: "employee_confirmation", label: "Ждут подтверждения" },
  { key: "manual_review", label: "Ручная проверка" },
];

const historyFilters: Array<{ key: HistoryFilter; label: string }> = [
  { key: "all", label: "Все события" },
  { key: "repair", label: "Ремонт" },
  { key: "documents", label: "Документы" },
  { key: "uploads", label: "Загрузки" },
  { key: "primary", label: "Основной документ" },
  { key: "comparison", label: "Сверки" },
];

const documentKindOptions: Array<{ value: DocumentKind; label: string }> = [
  { value: "order", label: "Основной заказ-наряд" },
  { value: "repeat_scan", label: "Повторный скан" },
  { value: "attachment", label: "Приложение" },
  { value: "confirmation", label: "Подтверждающий файл" },
];

const rootDocumentKindOptions = documentKindOptions.filter(
  (option) => option.value === "order" || option.value === "repeat_scan",
);
const VEHICLES_FULL_LIST_LIMIT = 2000;
const HISTORY_DETAIL_PREVIEW_LIMIT = 220;
const HISTORY_DETAIL_PREVIEW_LINES = 3;
const historyActionLabels: Record<string, string> = {
  manual_update: "Ручное редактирование ремонта",
  repair_archived: "Ремонт отправлен в архив",
  repair_deleted: "Заказ-наряд удалён",
  service_assignment: "Назначение сервиса",
  review_field_update: "Обновление полей проверки",
  check_resolution_update: "Изменение статуса проверки",
  review_employee_confirm: "Подтверждение сотрудником",
  review_confirm: "Подтверждение администратором",
  review_send_to_review: "Возврат в ручную проверку",
  primary_document_changed: "Смена основного документа",
  set_primary: "Документ назначен основным",
  document_uploaded: "Загрузка нового документа",
  document_attached: "Прикрепление документа к ремонту",
  document_archived: "Документ отправлен в архив",
  document_status_updated: "Изменение статуса документа",
  document_comparison_reviewed: "Результат сверки документов",
  repair_vehicle_relinked: "Перепривязка ремонта к технике",
  document_vehicle_linked: "Привязка документа к технике",
  vehicle_created_from_document: "Карточка техники создана из документа",
  comparison_keep_current_primary: "Сверка: оставлен текущий основной документ",
  comparison_make_document_primary: "Сверка: выбран новый основной документ",
  comparison_mark_reviewed: "Сверка отмечена как проверенная",
  historical_import_created: "Исторический ремонт загружен",
  user_created: "Пользователь создан",
  user_updated: "Пользователь обновлён",
  user_password_reset: "Пароль пользователя сброшен администратором",
  user_password_changed: "Пользователь сменил пароль",
  user_password_recovery_requested: "Запрошено восстановление пароля",
  user_password_recovered: "Пароль восстановлен",
  user_assignment_created: "Назначение техники пользователю",
  user_assignment_updated: "Изменение назначения техники пользователю",
  vehicle_updated: "Карточка техники обновлена",
  backup_created: "Резервная копия создана",
  backup_restored: "Резервная копия восстановлена",
  import_conflict_resolved: "Конфликт импорта обработан",
};
const auditEntityLabels: Record<string, string> = {
  repair: "Ремонт",
  document: "Документ",
  vehicle: "Техника",
  user: "Пользователь",
  system: "Система",
  import_conflict: "Конфликт импорта",
};
const repairStatusLabels: Record<string, string> = {
  draft: "Черновик",
  in_review: "На проверке",
  employee_confirmed: "Подтверждено сотрудником",
  suspicious: "Подозрительный ремонт",
  ocr_error: "Ошибка OCR",
  confirmed: "Подтверждено",
  archived: "Архив",
};
const documentStatusLabels: Record<string, string> = {
  uploaded: "В очереди OCR",
  recognized: "Распознан",
  partially_recognized: "Распознан частично",
  needs_review: "Требует ручной проверки",
  confirmed: "Подтвержден",
  ocr_error: "Ошибка OCR",
  archived: "Архив",
};
const genericStatusLabels: Record<string, string> = {
  queued: "В очереди",
  retry: "Повторная очередь",
  processing: "Обрабатывается",
  preliminary: "Предварительный",
  confirmed: "Подтверждено",
  archived: "Архив",
  merged: "Объединён",
  uploaded: "В очереди OCR",
  recognized: "Распознан",
  partially_recognized: "Распознан частично",
  needs_review: "Требует ручной проверки",
  ocr_error: "Ошибка OCR",
  draft: "Черновик",
  in_review: "На проверке",
  employee_confirmed: "Подтверждено сотрудником",
  suspicious: "Подозрительный",
  review: "Обычный",
  critical: "Критичный",
  normal: "Норма",
  warning: "Предупреждение",
  error: "Ошибка",
  ready: "Готова",
  missing: "Файл отсутствует",
  manual: "Вручную",
  full: "Полная",
};
const manualReviewReasonLabels: Record<string, string> = {
  mileage_missing: "не удалось определить пробег",
  order_number_missing: "не удалось определить номер заказ-наряда",
  repair_date_invalid: "дата ремонта распознана с ошибкой",
  repair_date_missing: "не удалось определить дату ремонта",
  service_name_missing: "не удалось определить сервис",
  service_name_suspicious: "название сервиса выглядит сомнительно",
  service_not_found: "сервис не найден в справочнике",
  text_not_found: "не удалось извлечь текст из документа",
  vehicle_missing: "не удалось определить технику",
  vehicle_not_found: "техника не найдена в базе",
};

function formatStatus(status: string) {
  return genericStatusLabels[status] || status.split("_").join(" ");
}

function formatAuditEntityLabel(entityType: string | null | undefined) {
  if (!entityType) {
    return "Сущность";
  }
  return auditEntityLabels[entityType] || formatStatus(entityType);
}

function formatJsonPretty(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildAuditEntryDetails(entry: AuditLogItem) {
  const documentFields = [
    "document_id",
    "repair_id",
    "original_filename",
    "kind",
    "status",
    "is_primary",
    "notes",
    "review_queue_priority",
    "document_status",
    "repair_status",
    "source_document_id",
  ];
  const repairFields = [
    "order_number",
    "repair_date",
    "mileage",
    "reason",
    "employee_comment",
    "service_name",
    "work_total",
    "parts_total",
    "vat_total",
    "grand_total",
    "status",
    "repair_status",
    "document_status",
    "review_queue_priority",
    "is_preliminary",
    "is_partially_recognized",
    "source_document_id",
  ];
  const vehicleFields = ["plate_number", "vin", "brand", "model", "status", "comment"];
  const userFields = ["full_name", "login", "email", "role", "is_active", "vehicle_id", "starts_at", "ends_at", "comment"];
  const genericFields = [
    "document_id",
    "repair_id",
    "original_filename",
    "source_filename",
    "status",
    "comment",
    "notes",
  ];

  let context: "repair" | "document" | "generic" = "generic";
  let fields = genericFields;
  if (entry.entity_type === "repair") {
    context = "repair";
    fields = repairFields;
  } else if (entry.entity_type === "document") {
    context = "document";
    fields = documentFields;
  } else if (entry.entity_type === "vehicle") {
    fields = vehicleFields;
  } else if (entry.entity_type === "user") {
    fields = userFields;
  }

  const lines = collectChangedFieldLines(entry.old_value, entry.new_value, fields, context);
  if (lines.length > 0) {
    return lines;
  }

  const snapshotLines: string[] = [];
  const appendSnapshot = (title: string, value: Record<string, unknown> | null) => {
    if (!value || Object.keys(value).length === 0) {
      return;
    }
    const pieces = fields
      .filter((fieldName) => value[fieldName] !== undefined && value[fieldName] !== null && value[fieldName] !== "")
      .map((fieldName) => {
        const scalar = formatHistoryScalar(fieldName, value[fieldName], context);
        return `${formatHistoryFieldLabel(fieldName, context)}: ${scalar}`;
      });
    if (pieces.length > 0) {
      snapshotLines.push(`${title}: ${pieces.join(" · ")}`);
      return;
    }
    snapshotLines.push(`${title}: ${formatJsonPretty(value)}`);
  };

  appendSnapshot("Было", entry.old_value);
  appendSnapshot("Стало", entry.new_value);
  if (snapshotLines.length > 0) {
    return snapshotLines;
  }
  return ["Подробные изменения не записаны."];
}

function formatMoney(value?: number | null) {
  if (typeof value !== "number") {
    return null;
  }
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatFileSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 Б";
  }
  const units = ["Б", "КБ", "МБ", "ГБ"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
}

function getLaborNormApplicability(
  payload: Record<string, unknown> | null | undefined,
):
  | {
      eligible: boolean;
      reason: string | null;
      matchedCount: number;
      unmatchedCount: number;
    }
  | null {
  const rawValue = payload?.labor_norm_applicability;
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return null;
  }

  const rawApplicability = rawValue as Record<string, unknown>;
  return {
    eligible: rawApplicability.eligible === true,
    reason: typeof rawApplicability.reason === "string" ? rawApplicability.reason : null,
    matchedCount:
      typeof rawApplicability.matched_count === "number" ? rawApplicability.matched_count : 0,
    unmatchedCount:
      typeof rawApplicability.unmatched_count === "number" ? rawApplicability.unmatched_count : 0,
  };
}

function formatLaborNormApplicability(payload: Record<string, unknown> | null | undefined) {
  const applicability = getLaborNormApplicability(payload);
  if (!applicability) {
    return null;
  }

  if (!applicability.eligible) {
    return `Нормо-часы: ${applicability.reason || "справочник не применяется к этой технике"}`;
  }

  if (applicability.matchedCount > 0) {
    if (applicability.unmatchedCount > 0) {
      return `Нормо-часы: найдено совпадений ${applicability.matchedCount}, без совпадения ${applicability.unmatchedCount}`;
    }
    return `Нормо-часы: найдено совпадений ${applicability.matchedCount}`;
  }

  if (applicability.unmatchedCount > 0) {
    return "Нормо-часы: справочник применим, но совпадения не найдены";
  }

  return "Нормо-часы: применимость проверена";
}

function readOcrProfileMeta(payload: Record<string, unknown> | null | undefined): OcrProfileMeta | null {
  if (!payload) {
    return null;
  }
  return {
    scope: typeof payload.ocr_profile_scope === "string" ? payload.ocr_profile_scope : null,
    source: typeof payload.ocr_profile_source === "string" ? payload.ocr_profile_source : null,
    reason: typeof payload.ocr_profile_reason === "string" ? payload.ocr_profile_reason : null,
  };
}

function formatOcrProfileMeta(payload: Record<string, unknown> | null | undefined) {
  const meta = readOcrProfileMeta(payload);
  if (!meta?.scope) {
    return null;
  }
  const sourceSuffix = meta.source ? ` · ${meta.source}` : "";
  const reasonSuffix = meta.reason ? ` · ${meta.reason}` : "";
  return `Шаблон OCR: ${formatOcrProfileName(meta.scope)}${sourceSuffix}${reasonSuffix}`;
}

function formatOcrProfileName(value: string | null | undefined) {
  if (!value) {
    return "Не указан";
  }
  if (value === "default") {
    return "Базовый";
  }
  return value;
}

function formatValueParserLabel(value: string) {
  const labels: Record<string, string> = {
    raw: "Без обработки",
    date: "Дата",
    amount: "Сумма",
    digits_int: "Целое число",
  };
  return labels[value] || value;
}

function formatReviewBucketLabel(value: string | null | undefined) {
  if (!value) {
    return "Без переопределения";
  }
  const labels: Record<string, string> = {
    review: "Обычный",
    critical: "Критичный",
    suspicious: "Подозрительный",
  };
  return labels[value] || value;
}

function formatReviewRuleTypeLabel(value: string) {
  const labels: Record<string, string> = {
    manual_review_reason: "Причина ручной проверки",
    document_status: "Статус документа",
    repair_status: "Статус ремонта",
    check_severity: "Уровень проверки",
    signal: "Сигнал системы",
  };
  return labels[value] || value;
}

function formatOcrFieldLabel(value: string) {
  const labels: Record<string, string> = {
    order_number: "Номер заказ-наряда",
    repair_date: "Дата ремонта",
    mileage: "Пробег",
    plate_number: "Госномер",
    vin: "VIN",
    service_name: "Сервис",
    work_total: "Сумма работ",
    parts_total: "Сумма запчастей",
    vat_total: "НДС",
    grand_total: "Итоговая сумма",
  };
  return labels[value] || value;
}

function formatOcrLearningStatusLabel(value: string) {
  const labels: Record<string, string> = {
    new: "Новый",
    reviewed: "Просмотрен",
    applied: "Применён",
    rejected: "Отклонён",
  };
  return labels[value] || value;
}

function formatOcrSignalTypeLabel(value: string) {
  const labels: Record<string, string> = {
    corrected_value: "Исправленное значение",
    missing_value: "Не извлечено",
    mismatched_value: "Извлечено неверно",
  };
  return labels[value] || value;
}

function formatSourceTypeLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    pdf: "PDF",
    image: "Изображение",
  };
  if (!value) {
    return "Любой";
  }
  return labels[value] || value.toUpperCase();
}

function formatCatalogCodeLabel(value: string | null | undefined) {
  if (!value) {
    return "Не указан";
  }
  return value;
}

function formatHours(value: number | null | undefined) {
  if (typeof value !== "number") {
    return null;
  }
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ч`;
}

function formatCompactNumber(value: number | null | undefined) {
  if (typeof value !== "number") {
    return null;
  }
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

function readStringValue(item: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function readNumberValue(item: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

function formatOcrLineUnit(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const normalizedValue = value.trim();
  return normalizedValue || null;
}

function splitEditorLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinEditorLines(values: string[] | null | undefined) {
  return (values || []).join("\n");
}

function createEmptyCatalogForm(): LaborNormCatalogFormState {
  return {
    scope: "",
    catalog_name: "",
    brand_family: "",
    vehicle_type: "",
    year_from: "",
    year_to: "",
    brand_keywords: "",
    model_keywords: "",
    vin_prefixes: "",
    priority: "100",
    auto_match_enabled: "true",
    status: "confirmed",
    notes: "",
  };
}

function createCatalogFormFromItem(item: LaborNormCatalogConfigItem): LaborNormCatalogFormState {
  return {
    scope: item.scope,
    catalog_name: item.catalog_name,
    brand_family: item.brand_family || "",
    vehicle_type: item.vehicle_type || "",
    year_from: item.year_from !== null ? String(item.year_from) : "",
    year_to: item.year_to !== null ? String(item.year_to) : "",
    brand_keywords: joinEditorLines(item.brand_keywords),
    model_keywords: joinEditorLines(item.model_keywords),
    vin_prefixes: joinEditorLines(item.vin_prefixes),
    priority: String(item.priority),
    auto_match_enabled: item.auto_match_enabled ? "true" : "false",
    status: item.status,
    notes: item.notes || "",
  };
}

function createEmptyLaborNormEntryForm(scope = ""): LaborNormEntryFormState {
  return {
    id: null,
    scope,
    code: "",
    category: "",
    name_ru: "",
    name_ru_alt: "",
    name_cn: "",
    name_en: "",
    standard_hours: "",
    source_sheet: "",
    source_file: "",
    status: "confirmed",
  };
}

function createEmptyServiceForm(): ServiceFormState {
  return {
    id: null,
    name: "",
    city: "",
    contact: "",
    comment: "",
    status: "confirmed",
  };
}

function createEmptyUserForm(): UserFormState {
  return {
    id: null,
    full_name: "",
    login: "",
    email: "",
    role: "employee",
    is_active: "true",
    password: "",
  };
}

function createUserFormFromItem(item: UserItem): UserFormState {
  return {
    id: item.id,
    full_name: item.full_name,
    login: item.login,
    email: item.email,
    role: item.role,
    is_active: item.is_active ? "true" : "false",
    password: "",
  };
}

function createEmptyUserAssignmentForm(): UserAssignmentFormState {
  return {
    starts_at: new Date().toISOString().slice(0, 10),
    ends_at: "",
    comment: "",
  };
}

function createEmptyDocumentVehicleForm(): DocumentVehicleFormState {
  return {
    vehicle_type: "truck",
    plate_number: "",
    vin: "",
    brand: "",
    model: "",
    year: "",
    comment: "",
  };
}

function createServiceFormFromItem(item: ServiceItem): ServiceFormState {
  return {
    id: item.id,
    name: item.name,
    city: item.city || "",
    contact: item.contact || "",
    comment: item.comment || "",
    status: item.status,
  };
}

function createEmptyReviewRuleForm(): ReviewRuleFormState {
  return {
    id: null,
    rule_type: "manual_review_reason",
    code: "",
    title: "",
    weight: "0",
    bucket_override: "",
    is_active: "true",
    sort_order: "100",
    notes: "",
  };
}

function createReviewRuleFormFromItem(item: ReviewRuleItem): ReviewRuleFormState {
  return {
    id: item.id,
    rule_type: item.rule_type,
    code: item.code,
    title: item.title,
    weight: String(item.weight),
    bucket_override: item.bucket_override || "",
    is_active: item.is_active ? "true" : "false",
    sort_order: String(item.sort_order),
    notes: item.notes || "",
  };
}

function createEmptyOcrRuleForm(): OcrRuleFormState {
  return {
    id: null,
    profile_scope: "default",
    target_field: "order_number",
    pattern: "",
    value_parser: "raw",
    confidence: "0.6",
    priority: "100",
    is_active: "true",
    notes: "",
  };
}

function createOcrRuleFormFromItem(item: OcrRuleItem): OcrRuleFormState {
  return {
    id: item.id,
    profile_scope: item.profile_scope,
    target_field: item.target_field,
    pattern: item.pattern,
    value_parser: item.value_parser,
    confidence: String(item.confidence),
    priority: String(item.priority),
    is_active: item.is_active ? "true" : "false",
    notes: item.notes || "",
  };
}

function createEmptyOcrProfileMatcherForm(): OcrProfileMatcherFormState {
  return {
    id: null,
    profile_scope: "default",
    title: "",
    source_type: "",
    filename_pattern: "",
    text_pattern: "",
    service_name_pattern: "",
    priority: "100",
    is_active: "true",
    notes: "",
  };
}

function createOcrProfileMatcherFormFromItem(item: OcrProfileMatcherItem): OcrProfileMatcherFormState {
  return {
    id: item.id,
    profile_scope: item.profile_scope,
    title: item.title,
    source_type: item.source_type || "",
    filename_pattern: item.filename_pattern || "",
    text_pattern: item.text_pattern || "",
    service_name_pattern: item.service_name_pattern || "",
    priority: String(item.priority),
    is_active: item.is_active ? "true" : "false",
    notes: item.notes || "",
  };
}

function createLaborNormEntryFormFromItem(item: LaborNormCatalogItem): LaborNormEntryFormState {
  return {
    id: item.id,
    scope: item.scope,
    code: item.code,
    category: item.category || "",
    name_ru: item.name_ru,
    name_ru_alt: item.name_ru_alt || "",
    name_cn: item.name_cn || "",
    name_en: item.name_en || "",
    standard_hours: String(item.standard_hours),
    source_sheet: item.source_sheet || "",
    source_file: item.source_file || "",
    status: item.status,
  };
}

function formatMatchMethod(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const labels: Record<string, string> = {
    code: "по коду",
    normalized_name: "по нормализованному названию",
    name_contains: "по частичному совпадению",
    name_tokens: "по токенам названия",
  };
  return labels[value] || value;
}

function readWorkLaborNormMeta(referencePayload: Record<string, unknown> | null | undefined): WorkLaborNormMeta | null {
  if (!referencePayload) {
    return null;
  }
  return {
    applicable:
      typeof referencePayload.labor_norm_applicable === "boolean"
        ? referencePayload.labor_norm_applicable
        : null,
    applicabilityReason:
      typeof referencePayload.labor_norm_applicability_reason === "string"
        ? referencePayload.labor_norm_applicability_reason
        : null,
    scope:
      typeof referencePayload.labor_norm_scope === "string" ? referencePayload.labor_norm_scope : null,
    catalogName:
      typeof referencePayload.labor_norm_catalog_name === "string"
        ? referencePayload.labor_norm_catalog_name
        : null,
    code:
      typeof referencePayload.labor_norm_code === "string" ? referencePayload.labor_norm_code : null,
    name:
      typeof referencePayload.labor_norm_name === "string" ? referencePayload.labor_norm_name : null,
    category:
      typeof referencePayload.labor_norm_category === "string"
        ? referencePayload.labor_norm_category
        : null,
    matchedBy:
      typeof referencePayload.labor_norm_matched_by === "string"
        ? referencePayload.labor_norm_matched_by
        : null,
    matchScore:
      typeof referencePayload.labor_norm_match_score === "number"
        ? referencePayload.labor_norm_match_score
        : null,
    standardHours:
      typeof referencePayload.labor_norm_standard_hours === "number"
        ? referencePayload.labor_norm_standard_hours
        : null,
  };
}

function formatWorkLaborNormMeta(item: RepairDetail["works"][number]) {
  const meta = readWorkLaborNormMeta(item.reference_payload);
  if (!meta) {
    return null;
  }

  if (meta.code && meta.name) {
    const scoreSuffix =
      typeof meta.matchScore === "number" ? ` · уверенность ${Math.round(meta.matchScore * 100)}%` : "";
    const methodSuffix = formatMatchMethod(meta.matchedBy) ? ` · ${formatMatchMethod(meta.matchedBy)}` : "";
    const hoursSuffix = formatHours(meta.standardHours) ? ` · справочник ${formatHours(meta.standardHours)}` : "";
    const categorySuffix = meta.category ? ` · ${meta.category}` : "";
    const catalogSuffix = meta.catalogName ? ` · ${meta.catalogName}` : meta.scope ? ` · ${meta.scope}` : "";
    return `Матчинг: ${meta.code} · ${meta.name}${categorySuffix}${catalogSuffix}${hoursSuffix}${methodSuffix}${scoreSuffix}`;
  }

  if (meta.applicable === false) {
    const scopeSuffix = meta.catalogName ? ` · ${meta.catalogName}` : meta.scope ? ` · ${meta.scope}` : "";
    return `Матчинг: справочник не применён${scopeSuffix}${meta.applicabilityReason ? ` · ${meta.applicabilityReason}` : ""}`;
  }

  if (meta.applicable === true) {
    return "Матчинг: справочник применим, но совпадение не найдено";
  }

  return null;
}

function formatVehicle(vehicle: VehiclePreview) {
  const parts = [vehicle.plate_number, vehicle.brand, vehicle.model].filter(Boolean);
  return parts.join(" • ") || `#${vehicle.id}`;
}

function formatQualityVehicle(vehicle: { plate_number: string | null; brand: string | null; model: string | null }) {
  const parts = [vehicle.plate_number, vehicle.brand, vehicle.model].filter(Boolean);
  return parts.join(" • ") || "Техника не определена";
}

function normalizeIdentifier(value: string | null | undefined) {
  if (!value) {
    return "";
  }
  return value
    .replace(/[Оо]/g, "O")
    .replace(/[Аа]/g, "A")
    .replace(/[Вв]/g, "B")
    .replace(/[Ее]/g, "E")
    .replace(/[Кк]/g, "K")
    .replace(/[Мм]/g, "M")
    .replace(/[Нн]/g, "H")
    .replace(/[Рр]/g, "P")
    .replace(/[Сс]/g, "C")
    .replace(/[Тт]/g, "T")
    .replace(/[Уу]/g, "Y")
    .replace(/[Хх]/g, "X")
    .toUpperCase()
    .replace(/[^A-Z0-9А-Я]/g, "");
}

function inferVehicleTypeFromIdentifiers(plateNumber: string | null | undefined): VehicleType {
  const normalizedPlate = normalizeIdentifier(plateNumber);
  if (/^[A-ZА-Я]{2}\d{4}\d{2,3}$/.test(normalizedPlate)) {
    return "trailer";
  }
  return "truck";
}

function isPlaceholderVehicle(externalId: string | null | undefined) {
  return externalId === PLACEHOLDER_EXTERNAL_ID;
}

function getLatestRepairDocumentPayload(
  repair: RepairDetail | null,
  documentId: number | null,
): Record<string, unknown> | null {
  if (!repair || documentId === null) {
    return null;
  }
  const selectedDocument = repair.documents.find((item) => item.id === documentId);
  const latestVersion = selectedDocument?.versions?.[0];
  if (!latestVersion?.parsed_payload || typeof latestVersion.parsed_payload !== "object") {
    return null;
  }
  return latestVersion.parsed_payload;
}

function getLatestRepairDocumentConfidenceMap(
  repair: RepairDetail | null,
  documentId: number | null,
): Record<string, unknown> | null {
  if (!repair || documentId === null) {
    return null;
  }
  const selectedDocument = repair.documents.find((item) => item.id === documentId);
  const latestVersion = selectedDocument?.versions?.[0];
  if (!latestVersion?.field_confidence_map || typeof latestVersion.field_confidence_map !== "object") {
    return null;
  }
  return latestVersion.field_confidence_map;
}

function getPayloadExtractedFields(payload: Record<string, unknown> | null | undefined) {
  const rawValue = payload?.extracted_fields;
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return null;
  }
  return rawValue as Record<string, unknown>;
}

function getPayloadExtractedItems(payload: Record<string, unknown> | null | undefined) {
  const rawValue = payload?.extracted_items;
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return null;
  }
  return rawValue as {
    works?: Array<Record<string, unknown>>;
    parts?: Array<Record<string, unknown>>;
  };
}

function createVehicleFormFromPayload(payload: Record<string, unknown> | null | undefined): DocumentVehicleFormState {
  const extractedFields = getPayloadExtractedFields(payload);
  const plateNumber =
    typeof extractedFields?.plate_number === "string" ? extractedFields.plate_number.trim() : "";
  const vin = typeof extractedFields?.vin === "string" ? extractedFields.vin.trim() : "";
  return {
    vehicle_type: inferVehicleTypeFromIdentifiers(plateNumber),
    plate_number: plateNumber,
    vin,
    brand: "",
    model: "",
    year: "",
    comment: "",
  };
}

function formatVehicleTypeLabel(value: VehicleType | "" | null | undefined) {
  if (value === "truck") {
    return "Грузовик";
  }
  if (value === "trailer") {
    return "Прицеп";
  }
  return "Любой";
}

function formatUserRoleLabel(value: UserRole) {
  if (value === "admin") {
    return "Администратор";
  }
  return "Сотрудник";
}

function isAssignmentActive(assignment: UserAssignment) {
  const today = new Date().toISOString().slice(0, 10);
  return assignment.starts_at <= today && (!assignment.ends_at || assignment.ends_at >= today);
}

function formatVehicleStatusLabel(value: string | null | undefined) {
  if (!value) {
    return "Не указан";
  }
  const labels: Record<string, string> = {
    active: "В работе",
    in_repair: "В ремонте",
    waiting_repair: "Ожидает ремонта",
    inactive: "Не используется",
    decommissioned: "Списан",
    archived: "Архив",
  };
  return labels[value] || formatStatus(value);
}

function vehicleStatusColor(status: VehicleStatus | string): "default" | "success" | "warning" | "error" {
  if (status === "active") {
    return "success";
  }
  if (status === "in_repair" || status === "waiting_repair") {
    return "warning";
  }
  if (status === "decommissioned") {
    return "error";
  }
  return "default";
}

function statusColor(status: DocumentStatus): "default" | "success" | "error" | "warning" {
  if (status === "confirmed" || status === "recognized") {
    return "success";
  }
  if (status === "ocr_error") {
    return "error";
  }
  if (status === "needs_review" || status === "partially_recognized") {
    return "warning";
  }
  return "default";
}

function checkSeverityColor(severity: CheckSeverity): "default" | "success" | "error" | "warning" {
  if (severity === "error") {
    return "error";
  }
  if (severity === "warning" || severity === "suspicious") {
    return "warning";
  }
  if (severity === "normal") {
    return "success";
  }
  return "default";
}

function executiveRiskColor(level: "low" | "medium" | "high"): "success" | "warning" | "error" {
  if (level === "high") {
    return "error";
  }
  if (level === "medium") {
    return "warning";
  }
  return "success";
}

function formatExecutiveRiskLabel(level: "low" | "medium" | "high") {
  if (level === "high") {
    return "Высокий риск";
  }
  if (level === "medium") {
    return "Средний риск";
  }
  return "Низкий риск";
}

function reviewPriorityColor(bucket: ReviewPriorityBucket): "default" | "error" | "warning" {
  if (bucket === "suspicious") {
    return "error";
  }
  if (bucket === "critical") {
    return "warning";
  }
  return "default";
}

function formatReviewPriority(bucket: ReviewPriorityBucket) {
  if (bucket === "suspicious") {
    return "Подозрительно";
  }
  if (bucket === "critical") {
    return "Критично";
  }
  return "Проверить";
}

function formatDocumentKind(kind: DocumentKind) {
  if (kind === "order") {
    return "Заказ-наряд";
  }
  if (kind === "repeat_scan") {
    return "Повторный скан";
  }
  if (kind === "attachment") {
    return "Приложение";
  }
  return "Подтверждение";
}

function formatRepairStatus(status: string | null | undefined) {
  if (!status) {
    return "—";
  }
  return repairStatusLabels[status] || formatStatus(status);
}

function formatDocumentStatusLabel(status: string | null | undefined) {
  if (!status) {
    return "—";
  }
  return documentStatusLabels[status] || formatStatus(status);
}

function formatManualReviewReason(reason: string) {
  return manualReviewReasonLabels[reason] || formatStatus(reason);
}

function formatManualReviewReasons(reasons: string[]) {
  return reasons.map((reason) => formatManualReviewReason(reason)).join(", ");
}

function formatHistoryActionLabel(actionType: string) {
  return historyActionLabels[actionType] || formatStatus(actionType);
}

function formatComparisonActionLabel(action: string | null | undefined) {
  if (!action) {
    return "Результат не указан";
  }
  const labels: Record<string, string> = {
    keep_current_primary: "Оставлен текущий основной документ",
    make_document_primary: "Сравниваемый документ назначен основным",
    mark_reviewed: "Сверка отмечена как проверенная",
  };
  return labels[action] || formatStatus(action);
}

function formatDateValue(value: string) {
  const normalizedValue = value.length === 10 ? `${value}T00:00:00` : value;
  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(
    "ru-RU",
    value.length === 10 ? { dateStyle: "short" } : { dateStyle: "short", timeStyle: "short" },
  ).format(parsed);
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function areHistoryValuesEqual(left: unknown, right: unknown) {
  if (left === right) {
    return true;
  }
  return safeJsonStringify(left) === safeJsonStringify(right);
}

function formatHistoryFieldLabel(fieldName: string, context: "repair" | "document" | "generic" = "generic") {
  if (fieldName === "status") {
    if (context === "document") {
      return "Статус документа";
    }
    if (context === "repair") {
      return "Статус ремонта";
    }
    return "Статус";
  }

  const labels: Record<string, string> = {
    document_id: "Документ",
    repair_id: "Ремонт",
    vehicle_id: "Техника",
    order_number: "Номер заказ-наряда",
    repair_date: "Дата ремонта",
    mileage: "Пробег",
    reason: "Причина обращения",
    employee_comment: "Комментарий сотрудника",
    service_name: "Сервис",
    work_total: "Сумма работ",
    parts_total: "Сумма запчастей",
    vat_total: "НДС",
    grand_total: "Итоговая сумма",
    repair_status: "Статус ремонта",
    document_status: "Статус документа",
    review_queue_priority: "Приоритет очереди",
    source_document_id: "Основной документ",
    is_preliminary: "Черновик",
    is_partially_recognized: "Частичное распознавание",
    is_primary: "Основной документ",
    kind: "Тип документа",
    document_kind: "Тип документа",
    original_filename: "Файл",
    source_filename: "Файл-источник",
    full_name: "ФИО",
    login: "Логин",
    email: "E-mail",
    role: "Роль",
    is_active: "Активен",
    starts_at: "Дата начала",
    ends_at: "Дата окончания",
    comment: "Комментарий",
    plate_number: "Госномер",
    brand: "Марка",
    model: "Модель",
    notes: "Комментарий",
  };

  return labels[fieldName] || formatStatus(fieldName);
}

function formatHistoryScalar(
  fieldName: string,
  value: unknown,
  context: "repair" | "document" | "generic" = "generic",
) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Да" : "Нет";
  }
  if (typeof value === "number") {
    if (
      fieldName === "work_total" ||
      fieldName === "parts_total" ||
      fieldName === "vat_total" ||
      fieldName === "grand_total"
    ) {
      return formatMoney(value) || "—";
    }
    return new Intl.NumberFormat("ru-RU").format(value);
  }
  if (typeof value === "string") {
    if (fieldName === "repair_date") {
      return formatDateValue(value);
    }
    if (fieldName === "role") {
      return value === "admin" ? "Администратор" : value === "employee" ? "Сотрудник" : value;
    }
    if (fieldName === "status" && context === "generic") {
      return formatStatus(value);
    }
    if (fieldName === "status" || fieldName === "repair_status") {
      return formatRepairStatus(value);
    }
    if (fieldName === "document_status") {
      return formatDocumentStatusLabel(value);
    }
    if (fieldName === "kind" || fieldName === "document_kind") {
      return formatDocumentKind(value as DocumentKind);
    }
    if (fieldName.endsWith("_at")) {
      return formatDateValue(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return `${value.length}`;
  }
  if (typeof value === "object") {
    if (fieldName === "status" && context === "document") {
      return formatDocumentStatusLabel(String((value as Record<string, unknown>).status || ""));
    }
    return safeJsonStringify(value);
  }
  return String(value);
}

function collectChangedFieldLines(
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  fieldNames: string[],
  context: "repair" | "document" | "generic" = "generic",
) {
  const lines: string[] = [];
  fieldNames.forEach((fieldName) => {
    const previous = oldValue?.[fieldName];
    const next = newValue?.[fieldName];
    if (areHistoryValuesEqual(previous, next)) {
      return;
    }
    lines.push(
      `${formatHistoryFieldLabel(fieldName, context)}: ${formatHistoryScalar(fieldName, previous, context)} -> ${formatHistoryScalar(fieldName, next, context)}`,
    );
  });
  return lines;
}

function summarizeChecks(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }
  const unresolved = value.filter((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }
    return !Boolean((item as Record<string, unknown>).is_resolved);
  }).length;
  return `${unresolved} открыто из ${value.length}`;
}

function buildCollectionCountLine(label: string, previous: unknown, next: unknown) {
  if (!Array.isArray(previous) || !Array.isArray(next)) {
    return null;
  }
  if (previous.length === next.length) {
    return null;
  }
  return `${label}: ${previous.length} -> ${next.length}`;
}

function buildCheckSummaryLine(previous: unknown, next: unknown) {
  const previousSummary = summarizeChecks(previous);
  const nextSummary = summarizeChecks(next);
  if (!previousSummary || !nextSummary || previousSummary === nextSummary) {
    return null;
  }
  return `Открытые проверки: ${previousSummary} -> ${nextSummary}`;
}

function buildHistoryFallbackLine(
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
) {
  if (!oldValue && !newValue) {
    return "Изменение зафиксировано без дополнительных данных.";
  }
  return `Снимок изменения: ${safeJsonStringify({ before: oldValue, after: newValue })}`;
}

function buildRepairHistoryDetails(entry: RepairHistoryEntry) {
  const lines = [
    ...collectChangedFieldLines(
      entry.old_value,
      entry.new_value,
      [
        "order_number",
        "repair_date",
        "mileage",
        "service_name",
        "grand_total",
        "status",
        "repair_status",
        "document_status",
        "review_queue_priority",
        "is_preliminary",
        "is_partially_recognized",
      ],
      "repair",
    ),
  ];

  const worksLine = buildCollectionCountLine("Работы", entry.old_value?.works, entry.new_value?.works);
  if (worksLine) {
    lines.push(worksLine);
  }
  const partsLine = buildCollectionCountLine("Запчасти", entry.old_value?.parts, entry.new_value?.parts);
  if (partsLine) {
    lines.push(partsLine);
  }
  const documentsLine = buildCollectionCountLine("Документы", entry.old_value?.documents, entry.new_value?.documents);
  if (documentsLine) {
    lines.push(documentsLine);
  }
  const checksLine =
    buildCheckSummaryLine(entry.old_value?.checks, entry.new_value?.checks) ||
    buildCheckSummaryLine(entry.old_value?.unresolved_checks, entry.new_value?.unresolved_checks);
  if (checksLine) {
    lines.push(checksLine);
  }

  const sourceDocumentChange = collectChangedFieldLines(
    entry.old_value,
    entry.new_value,
    ["source_document_id"],
    "repair",
  );
  if (sourceDocumentChange.length > 0) {
    lines.push(...sourceDocumentChange);
  }

  const reviewMeta = readComparisonReviewMeta(entry.new_value);
  if (reviewMeta) {
    lines.push(`Результат сверки: ${formatComparisonActionLabel(String(reviewMeta.action || ""))}`);
    if (reviewMeta.comment) {
      lines.push(`Комментарий: ${String(reviewMeta.comment)}`);
    }
    if (reviewMeta.compared_document_id || reviewMeta.with_document_id) {
      lines.push(
        `Документы: ${String(reviewMeta.compared_document_id || "—")} и ${String(reviewMeta.with_document_id || "—")}`,
      );
    }
  }

  if (lines.length === 0) {
    lines.push(buildHistoryFallbackLine(entry.old_value, entry.new_value));
  }
  return lines;
}

function buildDocumentHistoryDetails(entry: RepairDocumentHistoryEntry) {
  const lines = [
    ...collectChangedFieldLines(
      entry.old_value,
      entry.new_value,
      ["status", "document_status", "repair_status", "review_queue_priority", "is_primary", "kind", "notes"],
      "document",
    ),
    ...collectChangedFieldLines(entry.old_value, entry.new_value, ["source_document_id"], "document"),
  ];

  const reviewMeta = readComparisonReviewMeta(entry.new_value);
  if (reviewMeta) {
    lines.push(`Результат сверки: ${formatComparisonActionLabel(String(reviewMeta.action || ""))}`);
    if (reviewMeta.comment) {
      lines.push(`Комментарий: ${String(reviewMeta.comment)}`);
    }
    if (reviewMeta.compared_document_id || reviewMeta.with_document_id) {
      lines.push(
        `Документы: ${String(reviewMeta.compared_document_id || "—")} и ${String(reviewMeta.with_document_id || "—")}`,
      );
    }
  }

  if (lines.length === 0 && entry.new_value) {
    lines.push(buildHistoryFallbackLine(entry.old_value, entry.new_value));
  }
  if (lines.length === 0) {
    lines.push("Событие зафиксировано без дополнительных деталей.");
  }
  return lines;
}

function matchesTextSearch(parts: Array<string | null | undefined>, search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }
  return parts.some((part) => part?.toLowerCase().includes(normalizedSearch));
}

function createRepairDraft(repair: RepairDetail): EditableRepairDraft {
  return {
    order_number: repair.order_number || "",
    repair_date: repair.repair_date,
    mileage: repair.mileage,
    reason: repair.reason || "",
    employee_comment: repair.employee_comment || "",
    service_name: repair.service?.name || "",
    work_total: repair.work_total,
    parts_total: repair.parts_total,
    vat_total: repair.vat_total,
    grand_total: repair.grand_total,
    status: repair.status,
    is_preliminary: repair.is_preliminary,
    works: repair.works.map((item) => ({
      work_code: item.work_code || "",
      work_name: item.work_name,
      quantity: item.quantity,
      standard_hours: item.standard_hours ?? "",
      actual_hours: item.actual_hours ?? "",
      price: item.price,
      line_total: item.line_total,
      status: item.status,
    })),
    parts: repair.parts.map((item) => ({
      article: item.article || "",
      part_name: item.part_name,
      quantity: item.quantity,
      unit_name: item.unit_name || "",
      price: item.price,
      line_total: item.line_total,
      status: item.status,
    })),
  };
}

function createReviewRepairFieldsDraft(repair: RepairDetail): ReviewRepairFieldsDraft {
  return {
    order_number: repair.order_number || "",
    repair_date: repair.repair_date || "",
    mileage: repair.mileage > 0 ? String(repair.mileage) : "",
    work_total: String(repair.work_total ?? ""),
    parts_total: String(repair.parts_total ?? ""),
    vat_total: String(repair.vat_total ?? ""),
    grand_total: String(repair.grand_total ?? ""),
    reason: repair.reason || "",
    employee_comment: repair.employee_comment || "",
  };
}

function normalizeComparableText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim().toLowerCase();
}

function normalizeComparableNumber(value: unknown, digits = 2): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(digits));
  }
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, "").replace(",", ".").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return Number(parsed.toFixed(digits));
    }
  }
  return null;
}

function getReviewComparisonStatus(
  currentValue: unknown,
  ocrValue: unknown,
  mode: "text" | "int" | "money" = "text",
): ReviewComparisonStatus {
  if (mode === "text") {
    const current = normalizeComparableText(currentValue);
    const ocr = normalizeComparableText(ocrValue);
    if (!current && !ocr) {
      return "empty";
    }
    if (!current && ocr) {
      return "missing";
    }
    if (current && !ocr) {
      return "ocr_missing";
    }
    return current === ocr ? "match" : "mismatch";
  }

  const digits = mode === "int" ? 0 : 2;
  const current = normalizeComparableNumber(currentValue, digits);
  const ocr = normalizeComparableNumber(ocrValue, digits);
  if (current === null && ocr === null) {
    return "empty";
  }
  if (current === null && ocr !== null) {
    return "missing";
  }
  if (current !== null && ocr === null) {
    return "ocr_missing";
  }
  return current === ocr ? "match" : "mismatch";
}

function getReviewComparisonLabel(status: ReviewComparisonStatus) {
  switch (status) {
    case "match":
      return "Совпадает";
    case "missing":
      return "Нужно заполнить";
    case "mismatch":
      return "Расхождение";
    case "ocr_missing":
      return "Нет в OCR";
    default:
      return "Нет данных";
  }
}

function getReviewComparisonColor(
  status: ReviewComparisonStatus,
): "default" | "success" | "warning" | "error" {
  switch (status) {
    case "match":
      return "success";
    case "missing":
      return "warning";
    case "mismatch":
      return "error";
    default:
      return "default";
  }
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatConfidence(value: number | null) {
  if (typeof value !== "number") {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
}

function readConfidenceValue(
  confidenceMap: Record<string, unknown> | null | undefined,
  ...keys: string[]
) {
  for (const key of keys) {
    const rawValue = confidenceMap?.[key];
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      return rawValue;
    }
  }
  return null;
}

function getConfidenceColor(value: number | null): "default" | "success" | "warning" | "error" {
  if (value === null) {
    return "default";
  }
  if (value >= 0.9) {
    return "success";
  }
  if (value >= 0.7) {
    return "warning";
  }
  return "error";
}

function formatConfidenceLabel(value: number | null) {
  return value === null ? "OCR без оценки" : `OCR ${formatConfidence(value)}`;
}

function resolveRepairDocumentId(repair: RepairDetail, preferredDocumentId: number | null) {
  if (preferredDocumentId !== null && repair.documents.some((document) => document.id === preferredDocumentId)) {
    return preferredDocumentId;
  }
  return repair.documents.find((document) => document.is_primary)?.id ?? repair.documents[0]?.id ?? null;
}

function isDocumentAwaitingOcr(status: string | null | undefined) {
  return status === "uploaded";
}

function isImportJobActive(status: string | null | undefined) {
  return status === "queued" || status === "retry" || status === "processing";
}

function documentHasActiveImportJob(
  document: { latest_import_job?: { status?: string | null } | null } | null | undefined,
) {
  return isImportJobActive(document?.latest_import_job?.status);
}

function importJobStatusColor(status: string | null | undefined): "default" | "success" | "error" | "warning" {
  if (status === "completed") {
    return "success";
  }
  if (status === "failed") {
    return "error";
  }
  if (status === "queued" || status === "retry" || status === "processing" || status === "completed_with_conflicts") {
    return "warning";
  }
  return "default";
}

function repairHasDocumentsAwaitingOcr(repair: RepairDetail | null) {
  return (
    repair?.documents.some((document) => isDocumentAwaitingOcr(document.status) || documentHasActiveImportJob(document)) ??
    false
  );
}

function readCheckResolutionMeta(check: RepairDetail["checks"][number]): CheckResolutionMeta | null {
  const resolution = check.calculation_payload?.resolution;
  if (!resolution || typeof resolution !== "object") {
    return null;
  }
  return resolution as CheckResolutionMeta;
}

function getRepairCheckReportSectionKey(checkType: string): RepairReportSectionKey {
  if (checkType.includes("vehicle") || checkType.includes("service")) {
    return "catalogs";
  }
  if (checkType.includes("standard_hours")) {
    return "labor_norms";
  }
  if (checkType.includes("work_reference")) {
    return "history";
  }
  if (
    checkType.includes("total")
    || checkType.includes("duplicate")
    || checkType.includes("expected_total")
  ) {
    return "amounts";
  }
  if (checkType.includes("repeat_repair")) {
    return "history";
  }
  return "ocr";
}

function groupRepairChecksForReport(checks: RepairDetail["checks"]): RepairReportSection[] {
  const sectionTitles: Record<RepairReportSectionKey, string> = {
    catalogs: "Справочники",
    labor_norms: "Нормо-часы",
    amounts: "Суммы и структура",
    history: "История и аномалии",
    ocr: "OCR и ручная проверка",
  };
  const sectionOrder: RepairReportSectionKey[] = ["catalogs", "labor_norms", "amounts", "history", "ocr"];
  const grouped = new Map<RepairReportSectionKey, RepairDetail["checks"]>();

  for (const check of checks) {
    const key = getRepairCheckReportSectionKey(check.check_type);
    const existing = grouped.get(key) ?? [];
    grouped.set(key, [...existing, check]);
  }

  return sectionOrder
    .filter((key) => (grouped.get(key)?.length ?? 0) > 0)
    .map((key) => ({
      key,
      title: sectionTitles[key],
      checks: grouped.get(key) ?? [],
    }));
}

function buildCheckPayloadDetails(check: RepairDetail["checks"][number]) {
  const payload = check.calculation_payload;
  if (!payload) {
    return [];
  }

  const lines: string[] = [];
  const workName = readStringValue(payload, "work_name");
  const partName = readStringValue(payload, "part_name");

  if (check.check_type === "ocr_expected_total_exceeded") {
    const actualTotal = readNumberValue(payload, "actual_total");
    const expectedTotal = readNumberValue(payload, "expected_total");
    const actualWorkTotal = readNumberValue(payload, "actual_work_total");
    const expectedWorkTotal = readNumberValue(payload, "expected_work_total");
    const lineBreakdown = Array.isArray(payload.line_breakdown) ? payload.line_breakdown.length : 0;
    if (actualTotal !== null || expectedTotal !== null) {
      lines.push(`Факт: ${formatMoney(actualTotal) || "—"} · ожидалось: ${formatMoney(expectedTotal) || "—"}`);
    }
    if (actualWorkTotal !== null || expectedWorkTotal !== null) {
      lines.push(`Работы: ${formatMoney(actualWorkTotal) || "—"} · по модели: ${formatMoney(expectedWorkTotal) || "—"}`);
    }
    if (lineBreakdown > 0) {
      lines.push(`В расчёте учтено строк работ: ${lineBreakdown}`);
    }
  }

  if (check.check_type === "ocr_repeat_repair_detected") {
    const previousRepairId = readNumberValue(payload, "previous_repair_id");
    const previousRepairDate = readStringValue(payload, "previous_repair_date");
    const previousOrderNumber = readStringValue(payload, "previous_order_number");
    const daysSincePrevious = readNumberValue(payload, "days_since_previous");
    if (workName) {
      lines.push(`Работа: ${workName}`);
    }
    lines.push(
      `Предыдущий ремонт: #${previousRepairId !== null ? String(previousRepairId) : "—"}`
      + `${previousOrderNumber ? ` · заказ-наряд ${previousOrderNumber}` : ""}`
      + `${previousRepairDate ? ` · ${previousRepairDate}` : ""}`
      + `${daysSincePrevious !== null ? ` · ${formatCompactNumber(daysSincePrevious)} дн. назад` : ""}`,
    );
  }

  if (check.check_type === "ocr_duplicate_work_lines" || check.check_type === "ocr_duplicate_part_lines") {
    const duplicateCount = readNumberValue(payload, "duplicate_count");
    const quantity = readNumberValue(payload, "quantity");
    const price = readNumberValue(payload, "price");
    const lineTotal = readNumberValue(payload, "line_total");
    if (workName || partName) {
      lines.push(`${workName || partName}`);
    }
    lines.push(
      `Совпадающих строк: ${duplicateCount !== null ? formatCompactNumber(duplicateCount) : "—"}`
      + `${quantity !== null ? ` · кол-во ${formatCompactNumber(quantity)}` : ""}`
      + `${price !== null ? ` · цена ${formatMoney(price)}` : ""}`
      + `${lineTotal !== null ? ` · сумма ${formatMoney(lineTotal)}` : ""}`,
    );
  }

  if (check.check_type === "ocr_document_standard_hours_exceeded") {
    const documentHours = readNumberValue(payload, "document_standard_hours");
    const catalogHours = readNumberValue(payload, "catalog_standard_hours");
    if (workName) {
      lines.push(`Работа: ${workName}`);
    }
    lines.push(`Норма в документе: ${formatHours(documentHours) || "—"} · справочник: ${formatHours(catalogHours) || "—"}`);
  }

  if (check.check_type === "ocr_standard_hours_exceeded") {
    const actualHours = readNumberValue(payload, "actual_hours");
    const standardHours = readNumberValue(payload, "standard_hours");
    if (workName) {
      lines.push(`Работа: ${workName}`);
    }
    lines.push(`Факт: ${formatHours(actualHours) || "—"} · норма: ${formatHours(standardHours) || "—"}`);
  }

  if (check.check_type === "ocr_work_lines_total_mismatch" || check.check_type === "ocr_part_lines_total_mismatch") {
    const linesTotal = readNumberValue(payload, "lines_total");
    const headerTotal = readNumberValue(payload, "header_total");
    lines.push(`По строкам: ${formatMoney(linesTotal) || "—"} · в шапке: ${formatMoney(headerTotal) || "—"}`);
  }

  if (check.check_type === "ocr_total_mismatch") {
    const calculatedTotal = readNumberValue(payload, "calculated_total");
    const grandTotal = readNumberValue(payload, "grand_total");
    const workTotal = readNumberValue(payload, "work_total");
    const partsTotal = readNumberValue(payload, "parts_total");
    const vatTotal = readNumberValue(payload, "vat_total");
    lines.push(`Сумма строк: ${formatMoney(calculatedTotal) || "—"} · итог документа: ${formatMoney(grandTotal) || "—"}`);
    lines.push(
      `Работы ${formatMoney(workTotal) || "—"} · запчасти ${formatMoney(partsTotal) || "—"} · НДС ${formatMoney(vatTotal) || "—"}`,
    );
  }

  if (check.check_type === "ocr_work_reference_missing") {
    const comparisonSourceLabel = readStringValue(payload, "comparison_source_label");
    const repairMileage = readNumberValue(payload, "repair_mileage");
    if (workName) {
      lines.push(`Работа: ${workName}`);
    }
    lines.push(
      `${comparisonSourceLabel || "История"}: недостаточно данных`
      + `${repairMileage !== null ? ` · текущий пробег ${formatCompactNumber(repairMileage)} км` : ""}`,
    );
  }

  if (check.check_type === "ocr_work_reference_price_deviation") {
    const currentPrice = readNumberValue(payload, "current_price");
    const medianPrice = readNumberValue(payload, "median_price");
    const sampleLines = readNumberValue(payload, "sample_lines");
    const allSampleLines = readNumberValue(payload, "all_sample_lines");
    const historicalSampleLines = readNumberValue(payload, "historical_sample_lines");
    const operationalSampleLines = readNumberValue(payload, "operational_sample_lines");
    const comparisonSourceLabel = readStringValue(payload, "comparison_source_label");
    if (workName) {
      lines.push(`Работа: ${workName}`);
    }
    lines.push(
      `Цена: ${formatMoney(currentPrice) || "—"} · медиана: ${formatMoney(medianPrice) || "—"}`
      + `${comparisonSourceLabel ? ` · ${comparisonSourceLabel}` : ""}`,
    );
    lines.push(
      `Выборка: ${sampleLines !== null ? formatCompactNumber(sampleLines) : "—"} строк`
      + `${allSampleLines !== null ? ` из ${formatCompactNumber(allSampleLines)}` : ""}`
      + `${historicalSampleLines !== null ? ` · архив ${formatCompactNumber(historicalSampleLines)}` : ""}`
      + `${operationalSampleLines !== null ? ` · новые ${formatCompactNumber(operationalSampleLines)}` : ""}`,
    );
  }

  if (check.check_type === "ocr_work_reference_mileage_outlier") {
    const repairMileage = readNumberValue(payload, "repair_mileage");
    const medianMileage = readNumberValue(payload, "median_mileage");
    const minMileage = readNumberValue(payload, "min_mileage");
    const maxMileage = readNumberValue(payload, "max_mileage");
    const sampleLines = readNumberValue(payload, "sample_lines");
    const comparisonSourceLabel = readStringValue(payload, "comparison_source_label");
    if (workName) {
      lines.push(`Работа: ${workName}`);
    }
    lines.push(
      `Пробег сейчас: ${repairMileage !== null ? `${formatCompactNumber(repairMileage)} км` : "—"}`
      + `${medianMileage !== null ? ` · медиана ${formatCompactNumber(medianMileage)} км` : ""}`,
    );
    lines.push(
      `Диапазон: ${minMileage !== null ? formatCompactNumber(minMileage) : "—"}-${maxMileage !== null ? formatCompactNumber(maxMileage) : "—"} км`
      + `${comparisonSourceLabel ? ` · ${comparisonSourceLabel}` : ""}`
      + `${sampleLines !== null ? ` · выборка ${formatCompactNumber(sampleLines)}` : ""}`,
    );
  }

  return lines;
}

function getCheckLinkedRepairId(check: RepairDetail["checks"][number]) {
  if (check.check_type !== "ocr_repeat_repair_detected") {
    return null;
  }
  return readNumberValue(check.calculation_payload || {}, "previous_repair_id");
}

function readComparisonReviewMeta(value: Record<string, unknown> | null): Record<string, unknown> | null {
  const review = value?.comparison_review;
  if (!review || typeof review !== "object") {
    return null;
  }
  return review as Record<string, unknown>;
}

function getDocumentPreviewKind(mimeType: string | null | undefined): "pdf" | "image" | null {
  if (!mimeType) {
    return null;
  }
  if (mimeType === "application/pdf") {
    return "pdf";
  }
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  return null;
}

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
  const [expandedHistoryEntries, setExpandedHistoryEntries] = useState<Record<string, boolean>>({});
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
    if (targetWorkspaceTab === "admin") {
      return { workspace: "admin", adminTab: activeAdminTab };
    }
    if (targetWorkspaceTab === "tech_admin") {
      return { workspace: "tech_admin", techAdminTab: activeTechAdminTab };
    }
    if (targetWorkspaceTab === "fleet") {
      return { workspace: "fleet", vehicleId: fleetViewMode === "detail" ? selectedFleetVehicleId : null };
    }
    if (targetWorkspaceTab === "repair") {
      return {
        workspace: "repair",
        repairId: selectedRepair?.id ?? null,
        repairTab: activeRepairTab,
        documentId: selectedDocumentId,
      };
    }
    if (targetWorkspaceTab === "search") {
      return { workspace: "search" };
    }
    if (targetWorkspaceTab === "audit") {
      return { workspace: "audit" };
    }
    return { workspace: "documents" };
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

  function buildLaborNormQueryString(
    query: string = laborNormQuery,
    scope: string = laborNormScope,
    category: string = laborNormCategory,
  ) {
    const params = new URLSearchParams();
    params.set("limit", "12");
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (scope) {
      params.set("scope", scope);
    }
    if (category) {
      params.set("category", category);
    }
    return params.toString();
  }

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
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (query.trim()) {
        params.set("q", query.trim());
      }
      if (city) {
        params.set("city", city);
      }
      const payload = await apiRequest<ServicesResponse>(
        `/services?${params.toString()}`,
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
      const params = new URLSearchParams();
      params.set("limit", "20");
      const normalizedQuery = query.trim();
      if (normalizedQuery) {
        params.set("q", normalizedQuery);
      }
      const normalizedMinSamples = Number(minSamplesValue.trim());
      if (Number.isFinite(normalizedMinSamples) && normalizedMinSamples > 0) {
        params.set("min_samples", String(Math.round(normalizedMinSamples)));
      }
      const payload = await apiRequest<HistoricalWorkReferenceResponse>(
        `/imports/historical-work-reference?${params.toString()}`,
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
        `/imports/conflicts?status=${encodeURIComponent(status)}&limit=20`,
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
    const params = new URLSearchParams();
    if (profileScope) {
      params.set("profile_scope", profileScope);
    }
    const payload = await apiRequest<OcrRuleResponse>(
      `/ocr-rules${params.toString() ? `?${params.toString()}` : ""}`,
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
    const params = new URLSearchParams();
    if (profileScope) {
      params.set("profile_scope", profileScope);
    }
    const payload = await apiRequest<OcrProfileMatcherResponse>(
      `/ocr-profile-matchers${params.toString() ? `?${params.toString()}` : ""}`,
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
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (statusFilter) {
        params.set("status", statusFilter);
      }
      if (targetFieldFilter) {
        params.set("target_field", targetFieldFilter);
      }
      if (profileScopeFilter) {
        params.set("profile_scope", profileScopeFilter);
      }
      const payload = await apiRequest<OcrLearningResponse>(
        `/ocr-learning/signals?${params.toString()}`,
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
      const params = new URLSearchParams();
      params.set("limit", String(VEHICLES_FULL_LIST_LIMIT));
      if (query.trim()) {
        params.set("search", query.trim());
      }
      if (vehicleType) {
        params.set("vehicle_type", vehicleType);
      }
      if (statusFilter) {
        params.set("status", statusFilter);
      }
      const payload = await apiRequest<VehiclesResponse>(`/vehicles?${params.toString()}`, { method: "GET" }, activeToken);
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
      const params = new URLSearchParams();
      params.set("q", normalizedQuery);
      params.set("limit_per_section", "8");
      const payload = await apiRequest<GlobalSearchResponse>(`/search/global?${params.toString()}`, { method: "GET" }, activeToken);
      setGlobalSearchResult(payload);
    } finally {
      setGlobalSearchLoading(false);
    }
  }

  async function loadAuditLog(activeToken: string) {
    setAuditLogLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "80");
      if (auditSearchQuery.trim()) {
        params.set("search", auditSearchQuery.trim());
      }
      if (auditEntityTypeFilter) {
        params.set("entity_type", auditEntityTypeFilter);
      }
      if (auditActionTypeFilter) {
        params.set("action_type", auditActionTypeFilter);
      }
      if (auditUserIdFilter) {
        params.set("user_id", auditUserIdFilter);
      }
      if (auditDateFrom) {
        params.set("date_from", `${auditDateFrom}T00:00:00`);
      }
      if (auditDateTo) {
        params.set("date_to", `${auditDateTo}T00:00:00`);
      }
      const payload = await apiRequest<AuditLogResponse>(`/audit?${params.toString()}`, { method: "GET" }, activeToken);
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
      const params = new URLSearchParams();
      params.set("include_inactive", "true");
      if (search.trim()) {
        params.set("search", search.trim());
      }
      const payload = await apiRequest<UsersResponse>(`/users?${params.toString()}`, { method: "GET" }, activeToken);
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
              `/labor-norms?${buildLaborNormQueryString()}`,
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
        setExpandedHistoryEntries({});
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

  function toggleHistoryEntry(entryKey: string) {
    setExpandedHistoryEntries((current) => ({
      ...current,
      [entryKey]: !current[entryKey],
    }));
  }

  function renderHistoryDetails(entryKey: string, lines: string[]) {
    const text = lines.join("\n");
    const previewLines = lines.slice(-HISTORY_DETAIL_PREVIEW_LINES);
    const previewText = previewLines.join("\n");
    const isExpandable = text.length > HISTORY_DETAIL_PREVIEW_LIMIT || lines.length > HISTORY_DETAIL_PREVIEW_LINES;
    const isExpanded = Boolean(expandedHistoryEntries[entryKey]);
    const visibleText =
      !isExpandable || isExpanded
        ? text
        : previewText.length > HISTORY_DETAIL_PREVIEW_LIMIT
          ? `${previewText.slice(0, HISTORY_DETAIL_PREVIEW_LIMIT).trimEnd()}...`
          : previewText;

    return (
      <Stack spacing={0.5}>
        <Typography className="muted-copy" sx={{ whiteSpace: "pre-line" }}>
          {visibleText}
        </Typography>
        {isExpandable ? (
          <Box>
            <Button
              size="small"
              onClick={() => {
                toggleHistoryEntry(entryKey);
              }}
            >
              {isExpanded ? "Скрыть" : "Подробнее"}
            </Button>
          </Box>
        ) : null}
      </Stack>
    );
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
      <Box className="app-shell">
        <Container maxWidth="md">
          <Paper className="hero-panel" elevation={0}>
            <Stack spacing={3}>
              <Box>
                <Chip label="Road700" color="primary" />
                <Typography variant="h2" component="h1" className="hero-title">
                  Контроль заказ-нарядов и ремонтов техники
                </Typography>
                <Typography className="hero-copy">
                  Вход в MVP-панель: загрузка PDF и фото, создание черновика ремонта,
                  контроль очереди проверки и история по технике.
                </Typography>
              </Box>

              {!showPasswordRecoveryRequest ? (
                <Box component="form" onSubmit={handleLogin} className="login-form">
                  <Stack spacing={2}>
                    <TextField
                      label="Логин"
                      value={loginValue}
                      onChange={(event) => setLoginValue(event.target.value)}
                      required
                      fullWidth
                    />
                    <TextField
                      label="Пароль"
                      type="password"
                      value={passwordValue}
                      onChange={(event) => setPasswordValue(event.target.value)}
                      required
                      fullWidth
                    />
                    {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
                    {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button type="submit" variant="contained" size="large" disabled={loginLoading}>
                        {loginLoading ? "Вход..." : "Войти в систему"}
                      </Button>
                      <Button
                        type="button"
                        variant="text"
                        onClick={() => {
                          setShowPasswordRecoveryRequest(true);
                          setErrorMessage("");
                          setSuccessMessage("");
                        }}
                      >
                        Забыли пароль?
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              ) : (
                <Paper className="repair-line" elevation={0}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h6">Восстановление пароля</Typography>
                      <Typography className="muted-copy">
                        Сначала запросите ссылку по почте, затем установите новый пароль по токену из письма.
                      </Typography>
                    </Box>
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Почта пользователя"
                          value={recoveryEmailValue}
                          onChange={(event) => setRecoveryEmailValue(event.target.value)}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Button
                          variant="outlined"
                          disabled={passwordRecoveryLoading}
                          onClick={() => {
                            void handleRequestPasswordRecovery();
                          }}
                        >
                          {passwordRecoveryLoading ? "Отправка..." : "Запросить восстановление"}
                        </Button>
                      </Grid>
                      <Grid item xs={12}>
                        <Divider />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Токен восстановления"
                          value={recoveryTokenValue}
                          onChange={(event) => setRecoveryTokenValue(event.target.value)}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Новый пароль"
                          type="password"
                          value={recoveryNewPasswordValue}
                          onChange={(event) => setRecoveryNewPasswordValue(event.target.value)}
                          fullWidth
                        />
                      </Grid>
                    </Grid>
                    {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
                    {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button
                        variant="contained"
                        disabled={passwordRecoveryLoading}
                        onClick={() => {
                          void handleConfirmPasswordRecovery();
                        }}
                      >
                        {passwordRecoveryLoading ? "Сохранение..." : "Установить новый пароль"}
                      </Button>
                      <Button
                        variant="text"
                        disabled={passwordRecoveryLoading}
                        onClick={() => {
                          setShowPasswordRecoveryRequest(false);
                          setErrorMessage("");
                          setSuccessMessage("");
                          setRecoveryNewPasswordValue("");
                          if (!window.location.search.includes("reset_token=")) {
                            setRecoveryTokenValue("");
                          }
                        }}
                      >
                        Вернуться ко входу
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              )}

              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Card className="feature-card" elevation={0}>
                    <CardContent>
                      <Typography variant="h6">Документы</Typography>
                      <Typography className="muted-copy">
                        Приём PDF, сканов и фото с привязкой к ремонту и технике.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card className="feature-card" elevation={0}>
                    <CardContent>
                      <Typography variant="h6">Контроль</Typography>
                      <Typography className="muted-copy">
                        Очередь проверки, статусы, черновики ремонта и ручная верификация.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card className="feature-card" elevation={0}>
                    <CardContent>
                      <Typography variant="h6">История</Typography>
                      <Typography className="muted-copy">
                        Вся техника, связи грузовик-прицеп и история документов в одном месте.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box className="app-shell">
      <Container maxWidth="xl">
        <Stack spacing={3}>
          <WorkspaceChromePanels
            user={user ? { full_name: user.full_name, email: user.email, role: user.role } : null}
            showPasswordChange={showPasswordChange}
            currentPasswordValue={currentPasswordValue}
            newPasswordValue={newPasswordValue}
            passwordChangeLoading={passwordChangeLoading}
            errorMessage={errorMessage}
            successMessage={successMessage}
            bootLoading={bootLoading}
            activeWorkspaceTab={activeWorkspaceTab}
            documentsCount={documents.length}
            selectedRepairId={selectedRepair?.id ?? null}
            showTechAdminTab={showTechAdminTab}
            vehiclesCount={vehicles.length}
            workspaceDescription={workspaceTabDescriptions[activeWorkspaceTab]}
            summary={summary}
            summaryCards={summaryCards}
            onTogglePasswordChange={() => setShowPasswordChange((current) => !current)}
            onCurrentPasswordValueChange={setCurrentPasswordValue}
            onNewPasswordValueChange={setNewPasswordValue}
            onChangePassword={() => {
              void handleChangePassword();
            }}
            onCancelPasswordChange={() => {
              setShowPasswordChange(false);
              setCurrentPasswordValue("");
              setNewPasswordValue("");
            }}
            onLogout={handleLogout}
            onWorkspaceTabChange={handleWorkspaceTabChange}
          />

          <DataQualityOverviewPanel
            dataQuality={dataQuality}
            qualityCards={qualityCards}
            repairVisualBars={repairVisualBars}
            repairVisualMax={repairVisualMax}
            qualityVisualBars={qualityVisualBars}
            qualityVisualMax={qualityVisualMax}
            attentionVisualBars={attentionVisualBars}
            attentionVisualMax={attentionVisualMax}
            topAttentionServices={topAttentionServices}
            dataQualityDetails={dataQualityDetails}
            showQualityDialog={showQualityDialog}
            activeQualityTab={activeQualityTab}
            userRole={user?.role}
            onOpenQualityDialog={() => setShowQualityDialog(true)}
            onCloseQualityDialog={() => setShowQualityDialog(false)}
            onQualityTabChange={setActiveQualityTab}
            onOpenQualityRepair={(documentId, repairId) => {
              setShowQualityDialog(false);
              void openQualityRepair(documentId, repairId);
            }}
            onOpenQualityService={(name) => {
              setShowQualityDialog(false);
              void openQualityService(name);
            }}
            onOpenImportConflict={(conflictId) => {
              void openImportConflict(conflictId);
            }}
            buildDashboardVisualBarWidth={buildDashboardVisualBarWidth}
            formatConfidence={formatConfidence}
            formatMoney={formatMoney}
            formatQualityVehicle={formatQualityVehicle}
            statusColor={statusColor}
            formatDocumentStatusLabel={formatDocumentStatusLabel}
            formatRepairStatus={formatRepairStatus}
            formatDateTime={formatDateTime}
          />
          <Dialog
            open={showImportConflictDialog}
            onClose={() => {
              if (!importConflictSaving) {
                setShowImportConflictDialog(false);
              }
            }}
            fullWidth
            maxWidth="md"
          >
            <DialogTitle>Разбор конфликта импорта</DialogTitle>
            <DialogContent dividers>
              {importConflictLoading ? (
                <Stack spacing={2} alignItems="center">
                  <CircularProgress size={24} />
                  <Typography className="muted-copy">Загрузка конфликта...</Typography>
                </Stack>
              ) : selectedImportConflict ? (
                <Stack spacing={2}>
                  <Typography>
                    {selectedImportConflict.entity_type} · {formatStatus(selectedImportConflict.status)}
                  </Typography>
                  <Typography className="muted-copy">
                    {[selectedImportConflict.conflict_key, selectedImportConflict.source_filename, formatDateTime(selectedImportConflict.created_at)]
                      .filter(Boolean)
                      .join(" · ")}
                  </Typography>
                  <TextField
                    label="Входящие данные"
                    value={formatJsonPretty(selectedImportConflict.incoming_payload)}
                    multiline
                    minRows={6}
                    fullWidth
                    InputProps={{ readOnly: true }}
                  />
                  <TextField
                    label="Существующие данные"
                    value={formatJsonPretty(selectedImportConflict.existing_payload)}
                    multiline
                    minRows={6}
                    fullWidth
                    InputProps={{ readOnly: true }}
                  />
                  {selectedImportConflict.resolution_payload ? (
                    <TextField
                      label="Текущее решение"
                      value={formatJsonPretty(selectedImportConflict.resolution_payload)}
                      multiline
                      minRows={4}
                      fullWidth
                      InputProps={{ readOnly: true }}
                    />
                  ) : null}
                  <TextField
                    label="Комментарий администратора"
                    value={importConflictComment}
                    onChange={(event) => setImportConflictComment(event.target.value)}
                    fullWidth
                    multiline
                    minRows={3}
                  />
                </Stack>
              ) : (
                <Typography className="muted-copy">Конфликт не выбран.</Typography>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowImportConflictDialog(false)} disabled={importConflictSaving}>
                Закрыть
              </Button>
              <Button
                variant="outlined"
                disabled={importConflictSaving || !selectedImportConflict}
                onClick={() => {
                  void handleResolveImportConflict("ignored");
                }}
              >
                {importConflictSaving ? "Сохранение..." : "Игнорировать"}
              </Button>
              <Button
                variant="contained"
                disabled={importConflictSaving || !selectedImportConflict}
                onClick={() => {
                  void handleResolveImportConflict("resolved");
                }}
              >
                {importConflictSaving ? "Сохранение..." : "Отметить решённым"}
              </Button>
            </DialogActions>
          </Dialog>

          <Grid container spacing={3}>
            {activeWorkspaceTab === "documents" ? (
              <DocumentsUploadPanel
                uploadForm={uploadForm}
                vehicles={vehicles}
                rootDocumentKindOptions={rootDocumentKindOptions}
                selectedFile={selectedFile}
                uploadMissingRequirements={uploadMissingRequirements}
                uploadLoading={uploadLoading}
                lastUploadedDocument={lastUploadedDocument}
                uploadFileInputRef={uploadFileInputRef}
                onSubmit={handleUpload}
                onUploadFieldChange={handleUploadFieldChange}
                onFileSelect={handleUploadFileSelect}
                onOpenFilePicker={() => uploadFileInputRef.current?.click()}
                onOpenUploadedRepair={(documentId, repairId) => {
                  void openRepairByIds(documentId, repairId);
                }}
                onHideUploadedResult={() => {
                  setLastUploadedDocument(null);
                }}
                formatVehicle={formatVehicle}
                formatDocumentKind={formatDocumentKind}
                importJobStatusColor={importJobStatusColor}
                formatStatus={formatStatus}
                statusColor={statusColor}
                formatDocumentStatusLabel={formatDocumentStatusLabel}
                isDocumentAwaitingOcr={isDocumentAwaitingOcr}
                documentHasActiveImportJob={documentHasActiveImportJob}
                isPlaceholderVehicle={isPlaceholderVehicle}
                formatConfidence={formatConfidence}
              />
            ) : null}

            <Grid item xs={12} md={activeWorkspaceTab === "documents" ? 5 : 12}>
              <Stack spacing={3}>
                {activeWorkspaceTab === "admin" && user?.role === "admin" ? (
                  <AdminWorkspacePanel
                    activeAdminTab={activeAdminTab}
                    description={adminTabDescriptions[activeAdminTab]}
                    onAdminTabChange={handleAdminTabChange}
                    onOpenTechAdmin={openTechAdmin}
                  />
                ) : null}
                {activeWorkspaceTab === "tech_admin" && user?.role === "admin" ? (
                  <TechAdminWorkspacePanel
                    activeTechAdminTab={activeTechAdminTab}
                    description={techAdminTabDescriptions[activeTechAdminTab]}
                    isPasswordRecoveryEmailConfigured={Boolean(systemStatus?.password_recovery_email_configured)}
                    onTechAdminTabChange={handleTechAdminTabChange}
                    onCloseTechAdmin={closeTechAdmin}
                  />
                ) : null}
                {activeWorkspaceTab === "documents" ? (
                  <ReviewQueuePanel
                    reviewQueueFilters={reviewQueueFilters}
                    reviewQueueCounts={reviewQueueCounts}
                    selectedReviewCategory={selectedReviewCategory}
                    reviewQueue={reviewQueue}
                    userRole={user?.role}
                    reprocessLoading={reprocessLoading}
                    selectedDocumentId={selectedDocumentId}
                    onSelectCategory={setSelectedReviewCategory}
                    onOpenReviewQueueItem={(item) => {
                      void handleOpenReviewQueueItem(item);
                    }}
                    onReprocessDocumentById={(documentId, repairId) => {
                      void handleReprocessDocumentById(documentId, repairId);
                    }}
                    formatDocumentKind={formatDocumentKind}
                    reviewPriorityColor={reviewPriorityColor}
                    formatReviewPriority={formatReviewPriority}
                    statusColor={statusColor}
                    formatDocumentStatusLabel={formatDocumentStatusLabel}
                    formatVehicle={formatVehicle}
                    formatConfidence={formatConfidence}
                    formatMoney={formatMoney}
                  />
                ) : null}

                {activeWorkspaceTab === "documents" ? (
                  <DocumentsListPanel
                    userRole={user?.role}
                    documents={documents}
                    selectedDocumentId={selectedDocumentId}
                    batchReprocessLimit={batchReprocessLimit}
                    batchReprocessStatusFilter={batchReprocessStatusFilter}
                    batchReprocessPrimaryOnly={batchReprocessPrimaryOnly}
                    batchReprocessLoading={batchReprocessLoading}
                    reprocessLoading={reprocessLoading}
                    repairDeleteLoading={repairDeleteLoading}
                    documentArchiveLoadingId={documentArchiveLoadingId}
                    onBatchReprocessLimitChange={setBatchReprocessLimit}
                    onBatchReprocessStatusFilterChange={setBatchReprocessStatusFilter}
                    onBatchReprocessPrimaryOnlyChange={setBatchReprocessPrimaryOnly}
                    onBatchReprocess={() => {
                      void handleBatchReprocessDocuments();
                    }}
                    onOpenRepair={(document) => {
                      void handleOpenRepair(document);
                    }}
                    onReprocessDocument={(document) => {
                      void handleReprocessDocument(document);
                    }}
                    onDeleteRepair={(repairId) => {
                      void handleDeleteRepair(repairId);
                    }}
                    onArchiveDocument={(documentId, repairId) => {
                      void handleArchiveDocument(documentId, repairId);
                    }}
                    formatDocumentKind={formatDocumentKind}
                    importJobStatusColor={importJobStatusColor}
                    formatStatus={formatStatus}
                    statusColor={statusColor}
                    formatDocumentStatusLabel={formatDocumentStatusLabel}
                    formatVehicle={formatVehicle}
                    formatMoney={formatMoney}
                    formatManualReviewReasons={formatManualReviewReasons}
                    formatOcrProfileMeta={formatOcrProfileMeta}
                    formatLaborNormApplicability={formatLaborNormApplicability}
                  />
                ) : null}

                {activeWorkspaceTab === "admin" && activeAdminTab === "employees" && user?.role === "admin" ? (
                  <EmployeesAdminPanel
                    userSearch={userSearch}
                    userLoading={userLoading}
                    showUserEditor={showUserEditor}
                    userForm={userForm}
                    userSaving={userSaving}
                    usersTotal={usersTotal}
                    usersList={usersList}
                    selectedManagedUserId={selectedManagedUserId}
                    selectedManagedUser={selectedManagedUser}
                    adminResetPasswordValue={adminResetPasswordValue}
                    userVehicleSearch={userVehicleSearch}
                    userVehicleSearchLoading={userVehicleSearchLoading}
                    userVehicleSearchResults={userVehicleSearchResults}
                    userAssignmentForm={userAssignmentForm}
                    userAssignmentSaving={userAssignmentSaving}
                    onUserSearchChange={setUserSearch}
                    onRefreshUsers={() => {
                      void handleUserSearch();
                    }}
                    onResetUsersSearch={() => {
                      setUserSearch("");
                      if (token) {
                        void loadUsers(token, "");
                      }
                    }}
                    onToggleUserEditor={() => {
                      setShowUserEditor((current) => !current);
                    }}
                    onUserFormChange={(field, value) => {
                      setUserForm((current) => ({
                        ...current,
                        [field]: value,
                      }));
                    }}
                    onSaveUser={() => {
                      void handleSaveUser();
                    }}
                    onResetUserForm={() => {
                      resetUserEditor();
                      setShowUserEditor(false);
                    }}
                    onSelectUser={setSelectedManagedUserId}
                    onEditUser={handleEditUser}
                    onAdminResetPasswordValueChange={setAdminResetPasswordValue}
                    onAdminResetUserPassword={() => {
                      void handleAdminResetUserPassword();
                    }}
                    onUserVehicleSearchChange={setUserVehicleSearch}
                    onUserAssignmentFormChange={(field, value) => {
                      setUserAssignmentForm((current) => ({
                        ...current,
                        [field]: value,
                      }));
                    }}
                    onSearchVehiclesForAssignment={() => {
                      void handleSearchVehiclesForAssignment();
                    }}
                    onCreateUserAssignment={(vehicleId) => {
                      void handleCreateUserAssignment(vehicleId);
                    }}
                    onCloseUserAssignment={(assignment) => {
                      void handleCloseUserAssignment(assignment);
                    }}
                    formatUserRoleLabel={formatUserRoleLabel}
                    formatVehicle={formatVehicle}
                    formatVehicleTypeLabel={formatVehicleTypeLabel}
                    isAssignmentActive={isAssignmentActive}
                  />
                ) : null}

                {activeWorkspaceTab === "admin" && activeAdminTab === "services" && user?.role === "admin" ? (
                  <ServicesAdminPanel
                    serviceQuery={serviceQuery}
                    serviceCityFilter={serviceCityFilter}
                    serviceCities={serviceCities}
                    serviceLoading={serviceLoading}
                    showServiceEditor={showServiceEditor}
                    serviceForm={serviceForm}
                    serviceSaving={serviceSaving}
                    services={services}
                    showServiceListDialog={showServiceListDialog}
                    onServiceQueryChange={setServiceQuery}
                    onServiceCityFilterChange={setServiceCityFilter}
                    onRefresh={() => {
                      void handleServiceSearch();
                    }}
                    onReset={() => {
                      setServiceQuery("");
                      setServiceCityFilter("");
                      if (token) {
                        void loadServices(token, "", "");
                      }
                    }}
                    onToggleEditor={() => {
                      setShowServiceEditor((current) => !current);
                    }}
                    onServiceFormChange={(field, value) => {
                      setServiceForm((current) => ({
                        ...current,
                        [field]: value,
                      }));
                    }}
                    onSaveService={() => {
                      void handleSaveService();
                    }}
                    onResetEditor={() => {
                      resetServiceEditor();
                      setShowServiceEditor(false);
                    }}
                    onOpenListDialog={() => {
                      setShowServiceListDialog(true);
                    }}
                    onCloseListDialog={() => {
                      setShowServiceListDialog(false);
                    }}
                    onEditService={handleEditService}
                    formatStatus={formatStatus}
                  />
                ) : null}

                {activeWorkspaceTab === "admin" && activeAdminTab === "backups" && user?.role === "admin" ? (
                  <BackupsAdminPanel
                    backupActionLoading={backupActionLoading}
                    backupsLoading={backupsLoading}
                    backups={backups}
                    backupRestoreDialogOpen={backupRestoreDialogOpen}
                    backupRestoreTarget={backupRestoreTarget}
                    backupRestoreConfirmValue={backupRestoreConfirmValue}
                    onCreateBackup={() => {
                      void handleCreateBackup();
                    }}
                    onRefresh={() => {
                      if (token) {
                        void loadBackups(token);
                      }
                    }}
                    onDownloadBackup={(item) => {
                      void handleDownloadBackup(item);
                    }}
                    onOpenRestoreDialog={openBackupRestoreDialog}
                    onCloseRestoreDialog={closeBackupRestoreDialog}
                    onBackupRestoreConfirmValueChange={setBackupRestoreConfirmValue}
                    onRestoreBackup={() => {
                      void handleRestoreBackup();
                    }}
                    formatStatus={formatStatus}
                    formatDateTime={formatDateTime}
                    formatFileSize={formatFileSize}
                  />
                ) : null}

                {activeWorkspaceTab === "admin" && activeAdminTab === "control" && user?.role === "admin" ? (
                  <ReviewRulesAdminPanel
                    showReviewRuleEditor={showReviewRuleEditor}
                    reviewRuleForm={reviewRuleForm}
                    reviewRuleSaving={reviewRuleSaving}
                    reviewRules={reviewRules}
                    reviewRuleTypes={reviewRuleTypes}
                    showReviewRuleListDialog={showReviewRuleListDialog}
                    onToggleEditor={() => {
                      setShowReviewRuleEditor((current) => !current);
                    }}
                    onReviewRuleFormChange={(field, value) => {
                      setReviewRuleForm((current) => ({
                        ...current,
                        [field]: value,
                      }));
                    }}
                    onSaveReviewRule={() => {
                      void handleSaveReviewRule();
                    }}
                    onResetReviewRuleEditor={() => {
                      resetReviewRuleEditor();
                      setShowReviewRuleEditor(false);
                    }}
                    onOpenListDialog={() => {
                      setShowReviewRuleListDialog(true);
                    }}
                    onCloseListDialog={() => {
                      setShowReviewRuleListDialog(false);
                    }}
                    onEditReviewRule={handleEditReviewRule}
                    formatReviewRuleTypeLabel={formatReviewRuleTypeLabel}
                    formatReviewBucketLabel={formatReviewBucketLabel}
                  />
                ) : null}

                {activeWorkspaceTab === "tech_admin" && activeTechAdminTab === "learning" && user?.role === "admin" ? (
                  <OcrLearningAdminPanel
                    ocrLearningStatusFilter={ocrLearningStatusFilter}
                    ocrLearningTargetFieldFilter={ocrLearningTargetFieldFilter}
                    ocrLearningProfileScopeFilter={ocrLearningProfileScopeFilter}
                    ocrLearningStatuses={ocrLearningStatuses}
                    ocrLearningTargetFields={ocrLearningTargetFields}
                    ocrLearningProfileScopes={ocrLearningProfileScopes}
                    ocrLearningLoading={ocrLearningLoading}
                    ocrLearningSummaries={ocrLearningSummaries}
                    ocrLearningSignals={ocrLearningSignals}
                    showOcrLearningListDialog={showOcrLearningListDialog}
                    ocrLearningDraftId={ocrLearningDraftId}
                    ocrLearningUpdateId={ocrLearningUpdateId}
                    onOcrLearningStatusFilterChange={setOcrLearningStatusFilter}
                    onOcrLearningTargetFieldFilterChange={setOcrLearningTargetFieldFilter}
                    onOcrLearningProfileScopeFilterChange={setOcrLearningProfileScopeFilter}
                    onRefresh={() => {
                      if (token) {
                        void loadOcrLearningSignals(token);
                      }
                    }}
                    onReset={() => {
                      setOcrLearningStatusFilter("");
                      setOcrLearningTargetFieldFilter("");
                      setOcrLearningProfileScopeFilter("");
                      if (token) {
                        void loadOcrLearningSignals(token, "", "", "");
                      }
                    }}
                    onOpenListDialog={() => {
                      setShowOcrLearningListDialog(true);
                    }}
                    onCloseListDialog={() => {
                      setShowOcrLearningListDialog(false);
                    }}
                    onLoadDraft={(signalId, draftType) => {
                      void handleLoadOcrLearningDraft(signalId, draftType);
                    }}
                    onUpdateSignalStatus={(signalId, nextStatus) => {
                      void handleUpdateOcrLearningSignal(signalId, nextStatus);
                    }}
                    formatOcrLearningStatusLabel={formatOcrLearningStatusLabel}
                    formatOcrProfileName={formatOcrProfileName}
                    formatOcrFieldLabel={formatOcrFieldLabel}
                    formatOcrSignalTypeLabel={formatOcrSignalTypeLabel}
                  />
                ) : null}

                {activeWorkspaceTab === "tech_admin" &&
                activeTechAdminTab === "matchers" &&
                user?.role === "admin" ? (
                  <OcrMatchersAdminPanel
                    ocrProfileMatcherProfileFilter={ocrProfileMatcherProfileFilter}
                    ocrProfileMatcherProfiles={ocrProfileMatcherProfiles}
                    ocrProfileMatchers={ocrProfileMatchers}
                    ocrProfileMatcherForm={ocrProfileMatcherForm}
                    ocrProfileMatcherSaving={ocrProfileMatcherSaving}
                    onProfileFilterChange={setOcrProfileMatcherProfileFilter}
                    onRefresh={() => {
                      if (token) {
                        void loadOcrProfileMatchers(token, ocrProfileMatcherProfileFilter);
                      }
                    }}
                    onResetFilter={() => {
                      setOcrProfileMatcherProfileFilter("");
                      if (token) {
                        void loadOcrProfileMatchers(token, "");
                      }
                    }}
                    onFormChange={(field, value) => {
                      setOcrProfileMatcherForm((current) => ({
                        ...current,
                        [field]: value,
                      }));
                    }}
                    onSave={() => {
                      void handleSaveOcrProfileMatcher();
                    }}
                    onResetForm={resetOcrProfileMatcherEditor}
                    onEdit={handleEditOcrProfileMatcher}
                    formatOcrProfileName={formatOcrProfileName}
                    formatSourceTypeLabel={formatSourceTypeLabel}
                  />
                ) : null}

                {activeWorkspaceTab === "tech_admin" &&
                activeTechAdminTab === "rules" &&
                user?.role === "admin" ? (
                  <OcrRulesAdminPanel
                    ocrRuleProfileFilter={ocrRuleProfileFilter}
                    ocrRuleProfiles={ocrRuleProfiles}
                    ocrRuleTargetFields={ocrRuleTargetFields}
                    ocrRules={ocrRules}
                    ocrRuleForm={ocrRuleForm}
                    ocrRuleSaving={ocrRuleSaving}
                    onProfileFilterChange={setOcrRuleProfileFilter}
                    onRefresh={() => {
                      if (token) {
                        void loadOcrRules(token, ocrRuleProfileFilter);
                      }
                    }}
                    onResetFilter={() => {
                      setOcrRuleProfileFilter("");
                      if (token) {
                        void loadOcrRules(token, "");
                      }
                    }}
                    onFormChange={(field, value) => {
                      setOcrRuleForm((current) => ({
                        ...current,
                        [field]: value,
                      }));
                    }}
                    onSave={() => {
                      void handleSaveOcrRule();
                    }}
                    onResetForm={resetOcrRuleEditor}
                    onEdit={handleEditOcrRule}
                    formatOcrProfileName={formatOcrProfileName}
                    formatOcrFieldLabel={formatOcrFieldLabel}
                    formatValueParserLabel={formatValueParserLabel}
                  />
                ) : null}

                {activeWorkspaceTab === "admin" && activeAdminTab === "imports" && user?.role === "admin" ? (
                  <HistoricalImportsAdminPanel
                    historicalImportLoading={historicalImportLoading}
                    historicalImportFile={historicalImportFile}
                    historicalImportLimit={historicalImportLimit}
                    historicalImportResult={historicalImportResult}
                    historicalImportJobs={historicalImportJobs}
                    historicalImportJobsLoading={historicalImportJobsLoading}
                    historicalWorkReference={historicalWorkReference}
                    historicalWorkReferenceLoading={historicalWorkReferenceLoading}
                    historicalWorkReferenceTotal={historicalWorkReferenceTotal}
                    historicalWorkReferenceQuery={historicalWorkReferenceQuery}
                    historicalWorkReferenceMinSamples={historicalWorkReferenceMinSamples}
                    importConflicts={importConflicts}
                    importConflictsLoading={importConflictsLoading}
                    canRefreshJournal={!(historicalImportJobsLoading || historicalWorkReferenceLoading || importConflictsLoading) && !!token}
                    onHistoricalImportFileChange={setHistoricalImportFile}
                    onHistoricalImportLimitChange={setHistoricalImportLimit}
                    onStartHistoricalImport={() => {
                      void handleHistoricalRepairImport();
                    }}
                    onRefreshJournal={() => {
                      if (token) {
                        void Promise.all([
                          loadHistoricalImportJobs(token),
                          loadHistoricalWorkReference(token),
                          loadImportConflicts(token),
                        ]);
                      }
                    }}
                    onOpenImportedRepair={(repairId) => {
                      void openRepairByIds(null, repairId);
                    }}
                    onHistoricalWorkReferenceQueryChange={setHistoricalWorkReferenceQuery}
                    onHistoricalWorkReferenceMinSamplesChange={setHistoricalWorkReferenceMinSamples}
                    onRefreshHistoricalWorkReference={() => {
                      if (token) {
                        void loadHistoricalWorkReference(token);
                      }
                    }}
                    onOpenImportConflict={(conflictId) => {
                      void openImportConflict(conflictId);
                    }}
                    formatStatus={formatStatus}
                    formatMoney={formatMoney}
                    formatCompactNumber={formatCompactNumber}
                    formatHours={formatHours}
                    formatDateValue={formatDateValue}
                    formatDateTime={formatDateTime}
                  />
                ) : null}

                {activeWorkspaceTab === "admin" && activeAdminTab === "labor_norms" && user?.role === "admin" ? (
                  <LaborNormsAdminPanel
                    showLaborNormCatalogEditor={showLaborNormCatalogEditor}
                    showLaborNormImport={showLaborNormImport}
                    showLaborNormEntryEditor={showLaborNormEntryEditor}
                    editingLaborNormCatalogId={editingLaborNormCatalogId}
                    laborNormCatalogForm={laborNormCatalogForm}
                    laborNormCatalogSaving={laborNormCatalogSaving}
                    laborNormCatalogs={laborNormCatalogs}
                    laborNormQuery={laborNormQuery}
                    laborNormScope={laborNormScope}
                    laborNormScopes={laborNormScopes}
                    laborNormCategory={laborNormCategory}
                    laborNormCategories={laborNormCategories}
                    laborNormLoading={laborNormLoading}
                    laborNormImportScope={laborNormImportScope}
                    laborNormImportBrandFamily={laborNormImportBrandFamily}
                    laborNormImportCatalogName={laborNormImportCatalogName}
                    laborNormFile={laborNormFile}
                    laborNormImportLoading={laborNormImportLoading}
                    laborNormEntryForm={laborNormEntryForm}
                    laborNormEntrySaving={laborNormEntrySaving}
                    laborNormTotal={laborNormTotal}
                    laborNormSourceFiles={laborNormSourceFiles}
                    showLaborNormListDialog={showLaborNormListDialog}
                    laborNorms={laborNorms}
                    onToggleCatalogEditor={() => setShowLaborNormCatalogEditor((current) => !current)}
                    onToggleImport={() => setShowLaborNormImport((current) => !current)}
                    onToggleEntryEditor={() => setShowLaborNormEntryEditor((current) => !current)}
                    onCatalogFormChange={(field, value) =>
                      setLaborNormCatalogForm((current) => ({
                        ...current,
                        [field]: value,
                      }))
                    }
                    onSaveCatalog={() => {
                      void handleSaveLaborNormCatalog();
                    }}
                    onResetCatalogForm={() => {
                      resetLaborNormCatalogEditor();
                      setShowLaborNormCatalogEditor(false);
                    }}
                    onEditCatalog={handleEditLaborNormCatalog}
                    onSelectCatalogScope={handleCatalogScopeSelected}
                    onQueryChange={setLaborNormQuery}
                    onScopeChange={setLaborNormScope}
                    onCategoryChange={setLaborNormCategory}
                    onSearch={() => {
                      void handleLaborNormSearch();
                    }}
                    onResetFilters={() => {
                      setLaborNormQuery("");
                      setLaborNormScope("");
                      setLaborNormCategory("");
                      if (token) {
                        void loadLaborNormCatalog(token, "", "", "");
                      }
                    }}
                    onImportBrandFamilyChange={setLaborNormImportBrandFamily}
                    onImportCatalogNameChange={setLaborNormImportCatalogName}
                    onImportFileChange={setLaborNormFile}
                    onImport={() => {
                      void handleLaborNormImport();
                    }}
                    onEntryFormChange={(field, value) =>
                      setLaborNormEntryForm((current) => ({
                        ...current,
                        [field]: value,
                      }))
                    }
                    onSaveEntry={() => {
                      void handleSaveLaborNormEntry();
                    }}
                    onResetEntryForm={() => {
                      resetLaborNormEntryEditor();
                      setShowLaborNormEntryEditor(false);
                    }}
                    onOpenListDialog={() => setShowLaborNormListDialog(true)}
                    onCloseListDialog={() => setShowLaborNormListDialog(false)}
                    onEditItem={handleEditLaborNormItem}
                    onArchiveItem={(item) => {
                      void handleArchiveLaborNormItem(item);
                    }}
                    formatCatalogCodeLabel={formatCatalogCodeLabel}
                    formatStatus={formatStatus}
                    formatHours={formatHours}
                  />
                ) : null}

                {activeWorkspaceTab === "repair" ? (
                  <RepairPanel
                    returnLabel={repairHasReturnTarget ? workspaceTabReturnLabels[repairReturnTabRef.current] : null}
                    onReturn={repairHasReturnTarget ? returnFromRepairPage : null}
                  >
                    {repairLoading ? (
                      <Stack spacing={2} alignItems="center" className="repair-placeholder">
                        <CircularProgress size={28} />
                        <Typography className="muted-copy">Загрузка карточки ремонта...</Typography>
                      </Stack>
                    ) : selectedRepair ? (
                      <Stack spacing={2}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Chip size="small" label={formatRepairStatus(selectedRepair.status)} />
                            {selectedReviewItem ? (
                              <Chip
                                size="small"
                                color={reviewPriorityColor(selectedReviewItem.priority_bucket)}
                                label={formatReviewPriority(selectedReviewItem.priority_bucket)}
                              />
                            ) : null}
                          </Stack>
                          {user?.role === "admin" ? (
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                              {isEditingRepair ? (
                                <>
                                  <Button variant="outlined" onClick={handleCancelRepairEdit} disabled={saveRepairLoading}>
                                    Отмена
                                  </Button>
                                  <Button variant="contained" onClick={() => void handleSaveRepair()} disabled={saveRepairLoading || !repairDraft}>
                                    {saveRepairLoading ? "Сохранение..." : "Сохранить"}
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button variant="outlined" onClick={() => void handleExportRepair()} disabled={repairExportLoading}>
                                    {repairExportLoading ? "Экспорт..." : "Экспорт Excel"}
                                  </Button>
                                  {selectedRepair.status !== "archived" ? (
                                    <>
                                      <Button variant="outlined" onClick={handleStartRepairEdit}>
                                        Редактировать
                                      </Button>
                                      <Button
                                        variant="text"
                                        disabled={repairArchiveLoading}
                                        onClick={() => {
                                          void handleArchiveRepair();
                                        }}
                                      >
                                        {repairArchiveLoading ? "Архивация..." : "В архив"}
                                      </Button>
                                    </>
                                  ) : null}
                                  <Button
                                    variant="text"
                                    color="error"
                                    disabled={repairDeleteLoading}
                                    onClick={() => {
                                      void handleDeleteRepair(selectedRepair.id);
                                    }}
                                  >
                                    {repairDeleteLoading ? "Удаление..." : "Удалить"}
                                  </Button>
                                </>
                              )}
                            </Stack>
                          ) : (
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                              <Button variant="outlined" onClick={() => void handleExportRepair()} disabled={repairExportLoading}>
                                {repairExportLoading ? "Экспорт..." : "Экспорт Excel"}
                              </Button>
                            </Stack>
                          )}
                        </Stack>

                        {selectedReviewItem && !isEditingRepair ? (
                          <Paper className="repair-summary" elevation={0}>
                            <Stack spacing={1.5}>
                              <Box>
                                <Typography variant="h6">Решение по проверке</Typography>
                                <Typography className="muted-copy">
                                  {user?.role === "admin"
                                    ? selectedRepair.status === "employee_confirmed"
                                      ? "Сотрудник уже подготовил ремонт. Здесь выполняется финальное подтверждение администратора."
                                      : "Администратор может сразу финально подтвердить ремонт или вернуть его в ручную проверку."
                                    : "Сотрудник подтверждает ремонт по своей технике. После этого запись остаётся предварительной и ждёт финального подтверждения администратора."}
                                </Typography>
                              </Box>
                              <Typography className="muted-copy">
                                Текущие причины: {selectedReviewItem.issue_titles.slice(0, 4).join(", ")}
                                {selectedReviewItem.issue_titles.length > 4
                                  ? ` и ещё ${selectedReviewItem.issue_titles.length - 4}`
                                  : ""}
                              </Typography>
                              {selectedRepairDocument ? (
                                <Grid container spacing={2}>
                                  <Grid item xs={12} lg={6}>
                                    <ReviewDocumentPreviewPanel
                                      document={selectedRepairDocument}
                                      reviewDocumentPreviewLoading={reviewDocumentPreviewLoading}
                                      reviewDocumentPreviewKind={reviewDocumentPreviewKind}
                                      reviewDocumentPreviewUrl={reviewDocumentPreviewUrl}
                                      documentOpenLoadingId={documentOpenLoadingId}
                                      onOpenDocument={(documentId) => {
                                        void handleOpenDocumentFile(documentId);
                                      }}
                                      formatDocumentKind={formatDocumentKind}
                                      statusColor={statusColor}
                                      formatDocumentStatusLabel={formatDocumentStatusLabel}
                                      formatDateTime={formatDateTime}
                                      formatSourceTypeLabel={formatSourceTypeLabel}
                                      formatConfidence={formatConfidence}
                                    />
                                  </Grid>
                                  <Grid item xs={12} lg={6}>
                                    <Stack spacing={1.5}>
                                      {canLinkVehicleFromSelectedDocument ? (
                                        <ReviewVehicleLinkPanel
                                          plateNumber={
                                            selectedRepairDocumentExtractedFields?.plate_number
                                              ? String(selectedRepairDocumentExtractedFields.plate_number)
                                              : null
                                          }
                                          vin={
                                            selectedRepairDocumentExtractedFields?.vin
                                              ? String(selectedRepairDocumentExtractedFields.vin)
                                              : null
                                          }
                                          reviewVehicleSearch={reviewVehicleSearch}
                                          reviewVehicleSearchLoading={reviewVehicleSearchLoading}
                                          reviewVehicleLinkingId={reviewVehicleLinkingId}
                                          reviewVehicleSearchResults={reviewVehicleSearchResults}
                                          userRole={user?.role}
                                          onSearchChange={setReviewVehicleSearch}
                                          onSearch={() => {
                                            void handleSearchReviewVehicles();
                                          }}
                                          onLinkVehicle={(vehicleId) => {
                                            void handleLinkReviewVehicle(vehicleId);
                                          }}
                                          formatVehicle={formatVehicle}
                                          formatVehicleTypeLabel={formatVehicleTypeLabel}
                                        />
                                      ) : null}

                                      <ReviewServicePanel
                                        currentServiceName={selectedRepair.service?.name || null}
                                        ocrServiceName={selectedRepairDocumentOcrServiceName}
                                        reviewServiceName={reviewServiceName}
                                        services={services}
                                        reviewServiceAssigning={reviewServiceAssigning}
                                        reviewServiceSaving={reviewServiceSaving}
                                        reviewFieldSaving={reviewFieldSaving}
                                        reviewVehicleLinking={reviewVehicleLinkingId !== null}
                                        showReviewServiceEditor={showReviewServiceEditor}
                                        reviewServiceForm={reviewServiceForm}
                                        userRole={user?.role}
                                        onServiceNameChange={setReviewServiceName}
                                        onAssign={() => {
                                          void handleAssignReviewService();
                                        }}
                                        onToggleCreate={() => {
                                          setShowReviewServiceEditor((current) => !current);
                                          setReviewServiceForm((current) => ({
                                            ...current,
                                            name: current.name || reviewServiceName || selectedRepairDocumentOcrServiceName,
                                          }));
                                        }}
                                        onClear={() => {
                                          setReviewServiceName("");
                                          void assignReviewService("");
                                        }}
                                        onFormChange={(field, value) => {
                                          setReviewServiceForm((current) => ({
                                            ...current,
                                            [field]: value,
                                          }));
                                        }}
                                        onCreate={() => {
                                          void handleCreateReviewService();
                                        }}
                                      />

                                      <ReviewRequiredFieldsPanel
                                        canConfirmSelectedReview={canConfirmSelectedReview}
                                        reviewReadyFieldsCount={reviewReadyFieldsCount}
                                        reviewRequiredFieldComparisons={reviewRequiredFieldComparisons}
                                        reviewFieldSaving={reviewFieldSaving}
                                        showReviewFieldEditor={showReviewFieldEditor}
                                        reviewFieldDraft={reviewFieldDraft}
                                        reviewMissingRequiredFields={reviewMissingRequiredFields}
                                        onToggleEditor={() => {
                                          setShowReviewFieldEditor((current) => !current);
                                        }}
                                        onFillFromOcr={fillReviewFieldDraftFromOcr}
                                        onDraftChange={updateReviewFieldDraft}
                                        onSave={() => {
                                          void handleSaveReviewFields();
                                        }}
                                        getReviewComparisonColor={getReviewComparisonColor}
                                        getReviewComparisonLabel={getReviewComparisonLabel}
                                        getConfidenceColor={getConfidenceColor}
                                        formatConfidenceLabel={formatConfidenceLabel}
                                      />

                                      <ReviewExtractedDataPanel
                                        selectedRepairDocumentFieldSnapshots={selectedRepairDocumentFieldSnapshots}
                                        selectedRepairDocumentExtractedFields={selectedRepairDocumentExtractedFields}
                                        selectedRepairDocumentOcrServiceName={selectedRepairDocumentOcrServiceName}
                                        selectedRepairDocumentPayload={selectedRepairDocumentPayload}
                                        selectedRepairDocumentWorks={selectedRepairDocumentWorks}
                                        selectedRepairDocumentParts={selectedRepairDocumentParts}
                                        getConfidenceColor={getConfidenceColor}
                                        formatConfidenceLabel={formatConfidenceLabel}
                                        formatMoney={formatMoney}
                                        formatCompactNumber={formatCompactNumber}
                                        formatHours={formatHours}
                                        formatManualReviewReasons={formatManualReviewReasons}
                                        formatOcrProfileMeta={formatOcrProfileMeta}
                                        formatLaborNormApplicability={formatLaborNormApplicability}
                                        readStringValue={readStringValue}
                                        readNumberValue={readNumberValue}
                                        formatOcrLineUnit={formatOcrLineUnit}
                                      />
                                    </Stack>
                                  </Grid>
                                </Grid>
                              ) : null}
                              <TextField
                                label={user?.role === "admin" ? "Комментарий администратора" : "Комментарий сотрудника"}
                                value={reviewActionComment}
                                onChange={(event) => setReviewActionComment(event.target.value)}
                                fullWidth
                                multiline
                                minRows={2}
                              />
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                {user?.role === "admin" ? (
                                  <Button
                                    variant="contained"
                                    disabled={
                                      reviewActionLoading ||
                                      reviewServiceAssigning ||
                                      reviewServiceSaving ||
                                      reviewFieldSaving ||
                                      reviewVehicleLinkingId !== null ||
                                      !canConfirmSelectedReview
                                    }
                                    onClick={() => {
                                      void handleReviewAction("confirm");
                                    }}
                                  >
                                    {reviewActionLoading ? "Сохранение..." : "Подтвердить админом"}
                                  </Button>
                                ) : (
                                  <Button
                                    variant="contained"
                                    disabled={
                                      reviewActionLoading ||
                                      reviewServiceAssigning ||
                                      reviewServiceSaving ||
                                      reviewFieldSaving ||
                                      reviewVehicleLinkingId !== null ||
                                      !canConfirmSelectedReview
                                    }
                                    onClick={() => {
                                      void handleReviewAction("employee_confirm");
                                    }}
                                  >
                                    {reviewActionLoading ? "Сохранение..." : "Подтвердить сотрудником"}
                                  </Button>
                                )}
                                <Button
                                  variant="outlined"
                                  disabled={reviewActionLoading || reviewServiceAssigning || reviewServiceSaving || reviewFieldSaving || reviewVehicleLinkingId !== null}
                                  onClick={() => {
                                    void handleReviewAction("send_to_review");
                                  }}
                                >
                                  Вернуть в ручную проверку
                                </Button>
                              </Stack>
                            </Stack>
                          </Paper>
                        ) : null}

                        {canCreateVehicleFromSelectedDocument && !isEditingRepair ? (
                          <Paper className="repair-summary" elevation={0}>
                            <Stack spacing={1.5}>
                              <Box>
                                <Typography variant="h6">Создать карточку техники</Typography>
                                <Typography className="muted-copy">
                                  Для непривязанного заказ-наряда можно сразу завести технику и перепривязать ремонт.
                                </Typography>
                              </Box>
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap">
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={`Тип: ${formatVehicleTypeLabel(documentVehicleForm.vehicle_type)}`}
                                />
                                {selectedRepairDocumentExtractedFields?.plate_number ? (
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    label={`OCR госномер: ${String(selectedRepairDocumentExtractedFields.plate_number)}`}
                                  />
                                ) : null}
                                {selectedRepairDocumentExtractedFields?.vin ? (
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    label={`OCR VIN: ${String(selectedRepairDocumentExtractedFields.vin)}`}
                                  />
                                ) : null}
                              </Stack>
                              <Grid container spacing={1.5}>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    select
                                    fullWidth
                                    label="Тип техники"
                                    value={documentVehicleForm.vehicle_type}
                                    onChange={(event) =>
                                      setDocumentVehicleForm((current) => ({
                                        ...current,
                                        vehicle_type: event.target.value as VehicleType,
                                      }))
                                    }
                                  >
                                    <MenuItem value="truck">Грузовик</MenuItem>
                                    <MenuItem value="trailer">Прицеп</MenuItem>
                                  </TextField>
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    fullWidth
                                    label="Госномер"
                                    value={documentVehicleForm.plate_number}
                                    onChange={(event) =>
                                      setDocumentVehicleForm((current) => ({
                                        ...current,
                                        plate_number: event.target.value,
                                      }))
                                    }
                                  />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    fullWidth
                                    label="VIN"
                                    value={documentVehicleForm.vin}
                                    onChange={(event) =>
                                      setDocumentVehicleForm((current) => ({
                                        ...current,
                                        vin: event.target.value,
                                      }))
                                    }
                                  />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    fullWidth
                                    label="Марка"
                                    value={documentVehicleForm.brand}
                                    onChange={(event) =>
                                      setDocumentVehicleForm((current) => ({
                                        ...current,
                                        brand: event.target.value,
                                      }))
                                    }
                                  />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    fullWidth
                                    label="Модель"
                                    value={documentVehicleForm.model}
                                    onChange={(event) =>
                                      setDocumentVehicleForm((current) => ({
                                        ...current,
                                        model: event.target.value,
                                      }))
                                    }
                                  />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                  <TextField
                                    fullWidth
                                    label="Год"
                                    value={documentVehicleForm.year}
                                    onChange={(event) =>
                                      setDocumentVehicleForm((current) => ({
                                        ...current,
                                        year: event.target.value.replace(/[^\d]/g, "").slice(0, 4),
                                      }))
                                    }
                                  />
                                </Grid>
                                <Grid item xs={12}>
                                  <TextField
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    label="Комментарий"
                                    value={documentVehicleForm.comment}
                                    onChange={(event) =>
                                      setDocumentVehicleForm((current) => ({
                                        ...current,
                                        comment: event.target.value,
                                      }))
                                    }
                                  />
                                </Grid>
                              </Grid>
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                <Button
                                  variant="contained"
                                  disabled={documentVehicleSaving}
                                  onClick={() => {
                                    void handleCreateVehicleFromDocument();
                                  }}
                                >
                                  {documentVehicleSaving ? "Создание..." : "Создать и привязать"}
                                </Button>
                              </Stack>
                            </Stack>
                          </Paper>
                        ) : null}

                        <Paper className="repair-summary" elevation={0}>
                          <Stack spacing={1.25}>
                            <Tabs
                              value={activeRepairTab}
                              onChange={(_event, value: RepairTab) => handleRepairTabChange(value)}
                              variant="scrollable"
                              scrollButtons="auto"
                              allowScrollButtonsMobile
                            >
                              <Tab label="Итоги" value="overview" />
                              <Tab label={`Работы · ${selectedRepair.works.length}`} value="works" />
                              <Tab label={`Запчасти · ${selectedRepair.parts.length}`} value="parts" />
                              {!isEditingRepair ? (
                                <Tab label={`Документы · ${selectedRepair.documents.length}`} value="documents" />
                              ) : null}
                              {!isEditingRepair ? (
                                <Tab label={`Проверки · ${selectedRepair.checks.length}`} value="checks" />
                              ) : null}
                              {!isEditingRepair ? (
                                <Tab
                                  label={`История · ${filteredDocumentHistory.length + filteredRepairHistory.length}`}
                                  value="history"
                                />
                              ) : null}
                            </Tabs>
                            <Typography className="muted-copy">{repairTabDescriptions[activeRepairTab]}</Typography>
                          </Stack>
                        </Paper>

                        {isEditingRepair && repairDraft ? (
                          <RepairEditSections
                            activeRepairTab={activeRepairTab}
                            repairDraft={repairDraft}
                            services={services}
                            onRepairFieldChange={updateRepairDraftField}
                            onAddWorkDraft={addWorkDraft}
                            onUpdateWorkDraft={updateWorkDraft}
                            onRemoveWorkDraft={removeWorkDraft}
                            onAddPartDraft={addPartDraft}
                            onUpdatePartDraft={updatePartDraft}
                            onRemovePartDraft={removePartDraft}
                          />
                        ) : (
                          <>
                            {activeRepairTab === "overview" ? (
                              <RepairOverviewReportPanel
                                selectedRepair={selectedRepair}
                                selectedRepairDocument={selectedRepairDocument}
                                selectedRepairAwaitingOcr={selectedRepairAwaitingOcr}
                                selectedRepairUnresolvedChecksCount={selectedRepairUnresolvedChecks.length}
                                selectedRepairHasBlockingFindings={selectedRepairHasBlockingFindings}
                                reviewRequiredFieldComparisons={reviewRequiredFieldComparisons}
                                selectedRepairComparisonAttentionCount={selectedRepairComparisonAttentionCount}
                                selectedRepairDocumentWorksCount={selectedRepairDocumentWorks.length}
                                selectedRepairDocumentPartsCount={selectedRepairDocumentParts.length}
                                selectedRepairDocumentManualReviewReasons={selectedRepairDocumentManualReviewReasons}
                                selectedRepairReportSections={selectedRepairReportSections}
                                showRepairOverviewDetails={showRepairOverviewDetails}
                                onToggleShowDetails={() => setShowRepairOverviewDetails((current) => !current)}
                                onOpenLinkedRepair={(repairId) => {
                                  void openRepairByIds(null, repairId);
                                }}
                                isPlaceholderVehicle={isPlaceholderVehicle}
                                formatVehicle={formatVehicle}
                                formatRepairStatus={formatRepairStatus}
                                executiveRiskColor={executiveRiskColor}
                                formatExecutiveRiskLabel={formatExecutiveRiskLabel}
                                statusColor={statusColor}
                                formatDocumentStatusLabel={formatDocumentStatusLabel}
                                formatCompactNumber={formatCompactNumber}
                                formatMoney={formatMoney}
                                formatConfidence={formatConfidence}
                                formatManualReviewReasons={formatManualReviewReasons}
                                buildCheckPayloadDetails={buildCheckPayloadDetails}
                                getCheckLinkedRepairId={getCheckLinkedRepairId}
                                checkSeverityColor={checkSeverityColor}
                                formatStatus={formatStatus}
                              />
                            ) : null}

                            {activeRepairTab === "documents" ? (
                              <RepairDocumentsSection
                                userRole={user?.role}
                                selectedRepair={selectedRepair}
                                documentKindOptions={documentKindOptions}
                                attachedDocumentKind={attachedDocumentKind}
                                attachedDocumentNotes={attachedDocumentNotes}
                                attachedDocumentFile={attachedDocumentFile}
                                attachedFileInputRef={attachedFileInputRef}
                                attachDocumentLoading={attachDocumentLoading}
                                documentOpenLoadingId={documentOpenLoadingId}
                                reprocessLoading={reprocessLoading}
                                selectedDocumentId={selectedDocumentId}
                                documentComparisonLoadingId={documentComparisonLoadingId}
                                primaryDocumentLoadingId={primaryDocumentLoadingId}
                                documentArchiveLoadingId={documentArchiveLoadingId}
                                documentComparison={documentComparison}
                                documentComparisonComment={documentComparisonComment}
                                documentComparisonReviewLoading={documentComparisonReviewLoading}
                                onAttachedDocumentKindChange={setAttachedDocumentKind}
                                onAttachedDocumentNotesChange={setAttachedDocumentNotes}
                                onAttachedDocumentFileChange={setAttachedDocumentFile}
                                onOpenAttachedFilePicker={() => attachedFileInputRef.current?.click()}
                                onAttachDocument={() => {
                                  void handleAttachDocumentToRepair();
                                }}
                                onOpenDocumentFile={(documentId) => {
                                  void handleOpenDocumentFile(documentId);
                                }}
                                onReprocessDocumentById={(documentId, repairId) => {
                                  void handleReprocessDocumentById(documentId, repairId);
                                }}
                                onCompareWithPrimary={(documentId) => {
                                  void handleCompareWithPrimary(documentId);
                                }}
                                onSetPrimaryDocument={(documentId) => {
                                  void handleSetPrimaryDocument(documentId);
                                }}
                                onArchiveDocument={(documentId, repairId) => {
                                  void handleArchiveDocument(documentId, repairId);
                                }}
                                onCloseDocumentComparison={() => {
                                  setDocumentComparison(null);
                                }}
                                onDocumentComparisonCommentChange={setDocumentComparisonComment}
                                onReviewDocumentComparison={(action) => {
                                  void handleReviewDocumentComparison(action);
                                }}
                                formatDocumentKind={formatDocumentKind}
                                importJobStatusColor={importJobStatusColor}
                                formatStatus={formatStatus}
                                statusColor={statusColor}
                                formatDocumentStatusLabel={formatDocumentStatusLabel}
                                formatDateTime={formatDateTime}
                                formatSourceTypeLabel={formatSourceTypeLabel}
                                formatConfidence={formatConfidence}
                                formatManualReviewReasons={formatManualReviewReasons}
                                formatOcrProfileMeta={formatOcrProfileMeta}
                                formatLaborNormApplicability={formatLaborNormApplicability}
                              />
                            ) : null}

                            <RepairReadOnlySections
                              activeRepairTab={activeRepairTab}
                              selectedRepair={selectedRepair}
                              filteredDocumentHistory={filteredDocumentHistory}
                              filteredRepairHistory={filteredRepairHistory}
                              historySearch={historySearch}
                              historyFilter={historyFilter}
                              historyFilters={historyFilters}
                              checkComments={checkComments}
                              checkActionLoadingId={checkActionLoadingId}
                              onHistorySearchChange={setHistorySearch}
                              onHistoryFilterChange={setHistoryFilter}
                              onCheckCommentChange={(checkId, value) =>
                                setCheckComments((current) => ({
                                  ...current,
                                  [checkId]: value,
                                }))
                              }
                              onCheckResolution={(checkId, isResolved) => {
                                void handleCheckResolution(checkId, isResolved);
                              }}
                              onOpenLinkedRepair={(repairId) => {
                                void openRepairByIds(null, repairId);
                              }}
                              formatMoney={formatMoney}
                              formatHours={formatHours}
                              formatStatus={formatStatus}
                              formatWorkLaborNormMeta={formatWorkLaborNormMeta}
                              buildCheckPayloadDetails={buildCheckPayloadDetails}
                              getCheckLinkedRepairId={getCheckLinkedRepairId}
                              checkSeverityColor={checkSeverityColor}
                              readCheckResolutionMeta={readCheckResolutionMeta}
                              formatDateTime={formatDateTime}
                              formatHistoryActionLabel={formatHistoryActionLabel}
                              formatDocumentKind={formatDocumentKind}
                              buildDocumentHistoryDetails={buildDocumentHistoryDetails}
                              buildRepairHistoryDetails={buildRepairHistoryDetails}
                              renderHistoryDetails={renderHistoryDetails}
                            />
                          </>
                        )}
                      </Stack>
                    ) : (
                      <Stack spacing={2} alignItems="center" className="repair-placeholder">
                        <Typography className="muted-copy">
                          Выберите документ, чтобы открыть карточку ремонта.
                        </Typography>
                      </Stack>
                    )}
                  </RepairPanel>
                ) : null}

                {activeWorkspaceTab === "search" ? (
                  <GlobalSearchPanel
                    query={globalSearchQuery}
                    loading={globalSearchLoading}
                    result={globalSearchResult}
                    onQueryChange={setGlobalSearchQuery}
                    onSubmit={(event) => {
                      void handleGlobalSearchSubmit(event);
                    }}
                    onReset={() => {
                      setGlobalSearchQuery("");
                      setGlobalSearchResult(null);
                    }}
                    onOpenRepair={(documentId, repairId) => {
                      void openRepairByIds(documentId, repairId);
                    }}
                    onOpenVehicle={openFleetVehicleById}
                    statusColor={statusColor}
                    vehicleStatusColor={vehicleStatusColor}
                    formatDocumentStatusLabel={formatDocumentStatusLabel}
                    formatRepairStatus={formatRepairStatus}
                    formatVehicleTypeLabel={formatVehicleTypeLabel}
                    formatVehicleStatusLabel={formatVehicleStatusLabel}
                    formatConfidence={formatConfidence}
                    formatDateTime={formatDateTime}
                    formatMoney={formatMoney}
                  />
                ) : null}

                {activeWorkspaceTab === "audit" ? (
                  <AuditLogPanel
                    userRole={user?.role}
                    auditSearchQuery={auditSearchQuery}
                    auditEntityTypeFilter={auditEntityTypeFilter}
                    auditActionTypeFilter={auditActionTypeFilter}
                    auditUserIdFilter={auditUserIdFilter}
                    auditDateFrom={auditDateFrom}
                    auditDateTo={auditDateTo}
                    auditEntityTypes={auditEntityTypes}
                    auditActionTypes={auditActionTypes}
                    users={usersList}
                    auditLogLoading={auditLogLoading}
                    auditLogItems={auditLogItems}
                    auditLogTotal={auditLogTotal}
                    onAuditSearchQueryChange={setAuditSearchQuery}
                    onAuditEntityTypeFilterChange={setAuditEntityTypeFilter}
                    onAuditActionTypeFilterChange={setAuditActionTypeFilter}
                    onAuditUserIdFilterChange={setAuditUserIdFilter}
                    onAuditDateFromChange={setAuditDateFrom}
                    onAuditDateToChange={setAuditDateTo}
                    onRefresh={() => {
                      if (token) {
                        void loadAuditLog(token);
                      }
                    }}
                    onReset={() => {
                      setAuditSearchQuery("");
                      setAuditEntityTypeFilter("");
                      setAuditActionTypeFilter("");
                      setAuditUserIdFilter("");
                      setAuditDateFrom("");
                      setAuditDateTo("");
                    }}
                    formatAuditEntityLabel={formatAuditEntityLabel}
                    formatHistoryActionLabel={formatHistoryActionLabel}
                    formatDateTime={formatDateTime}
                    renderEntryDetails={(entry) => renderHistoryDetails(`audit-${entry.id}`, buildAuditEntryDetails(entry))}
                  />
                ) : null}

                {activeWorkspaceTab === "fleet" ? (
                  <FleetPanel
                    viewMode={fleetViewMode}
                    detailContent={
                      <FleetVehicleDetailPanel
                        selectedFleetVehicleLoading={selectedFleetVehicleLoading}
                        selectedFleetVehicle={selectedFleetVehicle}
                        userRole={user?.role}
                        vehicleSaving={vehicleSaving}
                        vehicleExportLoading={vehicleExportLoading}
                        vehicles={vehicles}
                        fleetVehicles={fleetVehicles}
                        onUpdateVehicleStatus={(status) => {
                          void handleUpdateVehicle({ status });
                        }}
                        onExportVehicle={() => {
                          void handleExportVehicle();
                        }}
                        onOpenRepair={(repairId) => {
                          void openRepairByIds(null, repairId);
                        }}
                        formatVehicle={formatVehicle}
                        formatVehicleTypeLabel={formatVehicleTypeLabel}
                        formatVehicleStatusLabel={formatVehicleStatusLabel}
                        formatDateValue={formatDateValue}
                        formatDateTime={formatDateTime}
                        formatMoney={formatMoney}
                        formatUserRoleLabel={formatUserRoleLabel}
                        formatRepairStatus={formatRepairStatus}
                        vehicleStatusColor={vehicleStatusColor}
                      />
                    }
                    fleetQuery={fleetQuery}
                    fleetVehicleTypeFilter={fleetVehicleTypeFilter}
                    fleetStatusFilter={fleetStatusFilter}
                    fleetVehiclesTotal={fleetVehiclesTotal}
                    selectedFleetVehicleId={selectedFleetVehicleId}
                    fleetVehicles={fleetVehicles}
                    fleetLoading={fleetLoading}
                    onFleetQueryChange={setFleetQuery}
                    onFleetVehicleTypeFilterChange={setFleetVehicleTypeFilter}
                    onFleetStatusFilterChange={setFleetStatusFilter}
                    onRefresh={() => {
                      if (token) {
                        void loadFleetVehicles(token);
                      }
                    }}
                    onReset={() => {
                      setFleetQuery("");
                      setFleetVehicleTypeFilter("");
                      setFleetStatusFilter("");
                      if (token) {
                        void loadFleetVehicles(token, "", "", "");
                      }
                    }}
                    onReturnToList={returnToFleetList}
                    onOpenVehicleCard={openFleetVehicleCard}
                    formatVehicle={formatVehicle}
                    formatVehicleTypeLabel={formatVehicleTypeLabel}
                    formatVehicleStatusLabel={formatVehicleStatusLabel}
                    formatDateValue={formatDateValue}
                    vehicleStatusColor={vehicleStatusColor}
                  />
                ) : null}
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}
