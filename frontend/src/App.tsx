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
import { AuditLogPanel } from "./components/AuditLogPanel";
import { GlobalSearchPanel } from "./components/GlobalSearchPanel";
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

  function renderRepairOverviewReport() {
    if (!selectedRepair) {
      return null;
    }

    const executiveReport = selectedRepair.executive_report;
    const vehicleMatched =
      !isPlaceholderVehicle(selectedRepair.vehicle.external_id) &&
      Boolean(selectedRepair.vehicle.plate_number || selectedRepair.vehicle.model || selectedRepair.vehicle.id);
    const serviceMatched = Boolean(selectedRepair.service?.name);
    const reportAlertSeverity = selectedRepairAwaitingOcr
      ? "info"
      : selectedRepairUnresolvedChecks.length === 0
        ? "success"
        : selectedRepairHasBlockingFindings
          ? "warning"
          : "info";
    const reportAlertText = selectedRepairAwaitingOcr
      ? "Документ ещё находится в очереди OCR или перепроверки. Итоговый отчёт будет обновлён автоматически."
      : selectedRepairUnresolvedChecks.length === 0
        ? "По заказ-наряду открытых несоответствий не найдено."
        : "В отчёте есть несоответствия. Ниже они сгруппированы по типам проверки.";
    const conciseReportTitle = selectedRepairAwaitingOcr
      ? "Документ обрабатывается"
      : executiveReport.headline;
    const overviewAttentionItems = reviewRequiredFieldComparisons.filter(
      (item) => item.status === "missing" || item.status === "mismatch",
    );
    const moneyDelta =
      selectedRepair.expected_total !== null
        ? selectedRepair.grand_total - selectedRepair.expected_total
        : null;
    const moneyDeltaRatio =
      selectedRepair.expected_total !== null && selectedRepair.expected_total > 0
        ? (moneyDelta! / selectedRepair.expected_total) * 100
        : null;
    const conciseExecutiveSummary = selectedRepairAwaitingOcr
      ? `Заказ-наряд ${selectedRepair.order_number || "без номера"} загружен. Документ еще проходит OCR, итог проверки появится автоматически после распознавания.`
      : executiveReport.summary;
    const conciseFacts = executiveReport.highlights.length > 0
      ? executiveReport.highlights
      : [
          `Машина: ${vehicleMatched ? formatVehicle(selectedRepair.vehicle) : "не найдена в базе"}`,
          `Сервис: ${serviceMatched ? selectedRepair.service?.name : "не найден в справочнике"}`,
          `Проверка по базе, справочникам и истории: ${
            selectedRepairAwaitingOcr
              ? "ожидает завершения OCR"
              : selectedRepairUnresolvedChecks.length === 0
                ? "замечаний нет"
                : `найдено ${selectedRepairUnresolvedChecks.length} несоответствий`
          }`,
          `Структура заказ-наряда: работ ${selectedRepair.works.length}, запчастей ${selectedRepair.parts.length}`,
        ];
    const conciseIssues = selectedRepairAwaitingOcr
      ? ["Документ ещё проходит OCR или перепроверку."]
      : executiveReport.findings.slice(0, 4).map((item) => item.title);

    return (
      <Paper className="repair-summary" elevation={0}>
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
          >
            <Box>
              <Typography variant="h6">Итоговый отчёт по заказ-наряду</Typography>
              <Typography className="muted-copy">
                Сначала показываем простой итог. Полная расшифровка открывается по кнопке.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={formatRepairStatus(selectedRepair.status)} />
              <Chip
                size="small"
                color={executiveRiskColor(executiveReport.overall_risk)}
                label={formatExecutiveRiskLabel(executiveReport.overall_risk)}
              />
              {selectedRepairDocument ? (
                <Chip
                  size="small"
                  variant="outlined"
                  color={statusColor(selectedRepairDocument.status as DocumentStatus)}
                  label={`Документ: ${formatDocumentStatusLabel(selectedRepairDocument.status)}`}
                />
              ) : null}
              <Chip
                size="small"
                variant="outlined"
                color={selectedRepairUnresolvedChecks.length > 0 ? "warning" : "success"}
                label={
                  selectedRepairUnresolvedChecks.length > 0
                    ? `Несоответствий: ${selectedRepairUnresolvedChecks.length}`
                    : "Несоответствий нет"
                }
              />
            </Stack>
          </Stack>

          <Paper className="repair-line" elevation={0}>
            <Stack spacing={1.25}>
              <Typography variant="subtitle1">Короткий вывод для руководителя</Typography>
              <Typography>{conciseExecutiveSummary}</Typography>
              <Typography className="muted-copy">{conciseReportTitle}</Typography>
              <Stack spacing={0.5}>
                {conciseFacts.map((line) => (
                  <Typography className="muted-copy" key={line}>
                    {line}
                  </Typography>
                ))}
              </Stack>
              {conciseIssues.length > 0 ? (
                <Stack spacing={0.5}>
                  <Typography className="metric-label">Что требует внимания</Typography>
                  {conciseIssues.map((line, index) => (
                    <Typography className="muted-copy" key={`concise-issue-${index}`}>
                      {line}
                    </Typography>
                  ))}
                </Stack>
              ) : null}
              <Box>
                <Button size="small" onClick={() => setShowRepairOverviewDetails((current) => !current)}>
                  {showRepairOverviewDetails ? "Скрыть подробности" : "Подробнее"}
                </Button>
              </Box>
            </Stack>
          </Paper>

          {showRepairOverviewDetails ? (
            <>
              <Alert severity={reportAlertSeverity}>
                {reportAlertText}
              </Alert>

              <Paper className="repair-line" elevation={0}>
                <Stack spacing={1.25}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Box>
                      <Typography variant="subtitle1">{executiveReport.headline}</Typography>
                      <Typography className="muted-copy">{executiveReport.summary}</Typography>
                    </Box>
                    <Chip
                      size="small"
                      color={executiveRiskColor(executiveReport.overall_risk)}
                      label={formatExecutiveRiskLabel(executiveReport.overall_risk)}
                    />
                  </Stack>
                  {executiveReport.risk_matrix.length > 0 ? (
                    <Stack spacing={1}>
                      <Typography className="metric-label">Сводная оценка рисков</Typography>
                      {executiveReport.risk_matrix.map((item) => (
                        <Paper className="repair-line" elevation={0} key={`executive-risk-${item.zone}`}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={1}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", sm: "center" }}
                          >
                            <Box>
                              <Typography>{item.zone}</Typography>
                              <Typography className="muted-copy">{item.comment}</Typography>
                            </Box>
                            <Chip
                              size="small"
                              color={executiveRiskColor(item.level)}
                              label={formatExecutiveRiskLabel(item.level)}
                            />
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  ) : null}
                  {executiveReport.findings.length > 0 ? (
                    <Stack spacing={1}>
                      <Typography className="metric-label">Подозрительные моменты и риски</Typography>
                      {executiveReport.findings.map((item, index) => (
                        <Paper className="repair-line" elevation={0} key={`executive-finding-${index}`}>
                          <Stack spacing={0.75}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              justifyContent="space-between"
                              alignItems={{ xs: "flex-start", sm: "center" }}
                            >
                              <Typography>{item.title}</Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip size="small" variant="outlined" label={item.category} />
                                <Chip
                                  size="small"
                                  color={executiveRiskColor(item.severity)}
                                  label={formatExecutiveRiskLabel(item.severity)}
                                />
                              </Stack>
                            </Stack>
                            <Typography className="muted-copy">{item.summary}</Typography>
                            {item.rationale ? <Typography className="muted-copy">{item.rationale}</Typography> : null}
                            {item.evidence.length > 0 ? (
                              <Stack spacing={0.5}>
                                {item.evidence.map((line, evidenceIndex) => (
                                  <Typography className="muted-copy" key={`executive-evidence-${index}-${evidenceIndex}`}>
                                    {line}
                                  </Typography>
                                ))}
                              </Stack>
                            ) : null}
                            {item.recommendation ? (
                              <Typography className="muted-copy">Рекомендация: {item.recommendation}</Typography>
                            ) : null}
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  ) : null}
                  {executiveReport.recommendations.length > 0 ? (
                    <Stack spacing={0.5}>
                      <Typography className="metric-label">Что рекомендовано сделать</Typography>
                      {executiveReport.recommendations.map((item, index) => (
                        <Typography className="muted-copy" key={`executive-recommendation-${index}`}>
                          {item}
                        </Typography>
                      ))}
                    </Stack>
                  ) : null}
                </Stack>
              </Paper>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Paper className="repair-line" elevation={0}>
                    <Stack spacing={1}>
                      <Typography className="metric-label">Карточка заказ-наряда</Typography>
                      <Grid container spacing={1.25}>
                        <Grid item xs={12} sm={6}>
                          <Typography className="metric-label">Номер</Typography>
                          <Typography>{selectedRepair.order_number || "Не указан"}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography className="metric-label">Дата ремонта</Typography>
                          <Typography>{selectedRepair.repair_date || "—"}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography className="metric-label">Техника</Typography>
                          <Typography>{formatVehicle(selectedRepair.vehicle)}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography className="metric-label">Сервис</Typography>
                          <Typography>{selectedRepair.service?.name || "Не назначен"}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography className="metric-label">Пробег</Typography>
                          <Typography>{selectedRepair.mileage > 0 ? formatCompactNumber(selectedRepair.mileage) : "—"}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <Typography className="metric-label">OCR</Typography>
                          <Typography>
                            {selectedRepairDocument
                              ? `${formatDocumentStatusLabel(selectedRepairDocument.status)} · ${formatConfidence(selectedRepairDocument.ocr_confidence)}`
                              : "Документ не выбран"}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Stack>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper className="repair-line" elevation={0}>
                    <Stack spacing={1}>
                      <Typography className="metric-label">Суммы</Typography>
                      <Grid container spacing={1.25}>
                        <Grid item xs={6}>
                          <Typography className="metric-label">Работы</Typography>
                          <Typography>{formatMoney(selectedRepair.work_total) || "—"}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography className="metric-label">Запчасти</Typography>
                          <Typography>{formatMoney(selectedRepair.parts_total) || "—"}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography className="metric-label">НДС</Typography>
                          <Typography>{formatMoney(selectedRepair.vat_total) || "—"}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography className="metric-label">Итого</Typography>
                          <Typography>{formatMoney(selectedRepair.grand_total) || "—"}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography className="metric-label">Работ</Typography>
                          <Typography>{formatCompactNumber(selectedRepair.works.length)}</Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography className="metric-label">Запчастей</Typography>
                          <Typography>{formatCompactNumber(selectedRepair.parts.length)}</Typography>
                        </Grid>
                        {selectedRepair.expected_total !== null ? (
                          <>
                            <Grid item xs={6}>
                              <Typography className="metric-label">Ожидаемая сумма</Typography>
                              <Typography>{formatMoney(selectedRepair.expected_total) || "—"}</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography className="metric-label">Отклонение</Typography>
                              <Typography>
                                {moneyDelta !== null ? formatMoney(moneyDelta) : "—"}
                                {moneyDeltaRatio !== null
                                  ? ` · ${moneyDelta! >= 0 ? "+" : ""}${new Intl.NumberFormat("ru-RU", {
                                      maximumFractionDigits: 1,
                                    }).format(moneyDeltaRatio)}%`
                                  : ""}
                              </Typography>
                            </Grid>
                          </>
                        ) : null}
                      </Grid>
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>

              {selectedRepairDocument ? (
                <Paper className="repair-line" elevation={0}>
                  <Stack spacing={1}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", sm: "center" }}
                    >
                      <Typography className="metric-label">Короткая сверка OCR</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`OCR ${formatConfidence(selectedRepairDocument.ocr_confidence)}`}
                        />
                        <Chip
                          size="small"
                          color={selectedRepairComparisonAttentionCount > 0 ? "warning" : "success"}
                          label={
                            selectedRepairComparisonAttentionCount > 0
                              ? `Требует сверки: ${selectedRepairComparisonAttentionCount}`
                              : "Ключевые поля сверены"
                          }
                        />
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`Строк: работ ${selectedRepairDocumentWorks.length}, запчастей ${selectedRepairDocumentParts.length}`}
                        />
                      </Stack>
                    </Stack>
                    {overviewAttentionItems.length > 0 ? (
                      <Stack spacing={0.75}>
                        {overviewAttentionItems.map((item) => (
                          <Typography className="muted-copy" key={`overview-attention-${item.key}`}>
                            {item.label}: в ремонте {item.currentDisplay} · OCR {item.ocrDisplay}
                          </Typography>
                        ))}
                      </Stack>
                    ) : (
                      <Typography className="muted-copy">Ключевые поля OCR совпадают с подтверждёнными данными.</Typography>
                    )}
                    {selectedRepairDocumentManualReviewReasons.length > 0 ? (
                      <Typography className="muted-copy">
                        Ручная проверка OCR: {formatManualReviewReasons(selectedRepairDocumentManualReviewReasons)}.
                      </Typography>
                    ) : null}
                  </Stack>
                </Paper>
              ) : null}

              {selectedRepairReportSections.length > 0 ? (
                <Stack spacing={1.5}>
                  {selectedRepairReportSections.map((section) => (
                    <Stack spacing={1} key={`report-section-${section.key}`}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle1">{section.title}</Typography>
                        <Chip size="small" variant="outlined" label={formatCompactNumber(section.checks.length)} />
                      </Stack>
                      {section.checks.map((check) => {
                        const payloadDetails = buildCheckPayloadDetails(check);
                        const linkedRepairId = getCheckLinkedRepairId(check);
                        return (
                          <Paper className="repair-line" elevation={0} key={`report-check-${check.id}`}>
                            <Stack spacing={0.75}>
                              <Stack
                                direction={{ xs: "column", sm: "row" }}
                                justifyContent="space-between"
                                spacing={1}
                                alignItems={{ xs: "flex-start", sm: "center" }}
                              >
                                <Typography>{check.title}</Typography>
                                <Chip
                                  size="small"
                                  color={checkSeverityColor(check.severity)}
                                  label={formatStatus(check.severity)}
                                />
                              </Stack>
                              {check.details ? <Typography className="muted-copy">{check.details}</Typography> : null}
                              {payloadDetails.length > 0 ? (
                                <Stack spacing={0.5}>
                                  {payloadDetails.slice(0, 3).map((line, index) => (
                                    <Typography className="muted-copy" key={`report-check-payload-${check.id}-${index}`}>
                                      {line}
                                    </Typography>
                                  ))}
                                </Stack>
                              ) : null}
                              {linkedRepairId !== null ? (
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                  <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => {
                                      void openRepairByIds(null, linkedRepairId);
                                    }}
                                  >
                                    Открыть предыдущий ремонт
                                  </Button>
                                </Stack>
                              ) : null}
                            </Stack>
                          </Paper>
                        );
                      })}
                    </Stack>
                  ))}
                </Stack>
              ) : null}
            </>
          ) : null}
        </Stack>
      </Paper>
    );
  }

  function renderSelectedFleetVehicleDetail() {
    if (selectedFleetVehicleLoading) {
      return (
        <Stack spacing={1} alignItems="center" className="repair-placeholder">
          <CircularProgress size={24} />
          <Typography className="muted-copy">Загрузка карточки техники...</Typography>
        </Stack>
      );
    }

    if (!selectedFleetVehicle) {
      return (
        <Stack spacing={1} alignItems="center" className="repair-placeholder">
          <Typography className="muted-copy">
            Выберите технику из списка, чтобы открыть карточку.
          </Typography>
        </Stack>
      );
    }

    return (
      <Stack spacing={1.5}>
        <Paper className="repair-summary" elevation={0}>
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
              <Box>
                <Typography variant="h6">{formatVehicle(selectedFleetVehicle)}</Typography>
                <Typography className="muted-copy">
                  {selectedFleetVehicle.external_id ? `Внешний код: ${selectedFleetVehicle.external_id}` : "Внешний код не указан"}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                {user?.role === "admin" ? (
                  selectedFleetVehicle.status === "archived" ? (
                    <Button
                      variant="outlined"
                      disabled={vehicleSaving}
                      onClick={() => {
                        void handleUpdateVehicle({ status: "active" });
                      }}
                    >
                      {vehicleSaving ? "Сохранение..." : "Вернуть из архива"}
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      color="warning"
                      disabled={vehicleSaving}
                      onClick={() => {
                        void handleUpdateVehicle({ status: "archived" });
                      }}
                    >
                      {vehicleSaving ? "Сохранение..." : "В архив"}
                    </Button>
                  )
                ) : null}
                <Button variant="outlined" onClick={() => void handleExportVehicle()} disabled={vehicleExportLoading}>
                  {vehicleExportLoading ? "Экспорт..." : "Экспорт Excel"}
                </Button>
                <Chip size="small" variant="outlined" label={formatVehicleTypeLabel(selectedFleetVehicle.vehicle_type)} />
                <Chip size="small" color={vehicleStatusColor(selectedFleetVehicle.status)} label={formatVehicleStatusLabel(selectedFleetVehicle.status)} />
              </Stack>
            </Stack>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography className="metric-label">VIN</Typography>
                <Typography>{selectedFleetVehicle.vin || "Не указан"}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography className="metric-label">Год</Typography>
                <Typography>{selectedFleetVehicle.year || "Не указан"}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography className="metric-label">Водитель</Typography>
                <Typography>{selectedFleetVehicle.current_driver_name || "Не указан"}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography className="metric-label">Механик</Typography>
                <Typography>{selectedFleetVehicle.mechanic_name || "Не указан"}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography className="metric-label">Колонна</Typography>
                <Typography>{selectedFleetVehicle.column_name || "Не указана"}</Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography className="metric-label">Обновлено</Typography>
                <Typography>{formatDateTime(selectedFleetVehicle.updated_at)}</Typography>
              </Grid>
            </Grid>
            {selectedFleetVehicle.comment ? (
              <Box>
                <Typography className="metric-label">Комментарий</Typography>
                <Typography>{selectedFleetVehicle.comment}</Typography>
              </Box>
            ) : null}
          </Stack>
        </Paper>
        <Paper className="repair-summary" elevation={0}>
          <Stack spacing={1.5}>
            <Typography variant="h6">История по технике</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Typography className="metric-label">Ремонтов</Typography>
                <Typography>{selectedFleetVehicle.history_summary.repairs_total}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography className="metric-label">Документов</Typography>
                <Typography>{selectedFleetVehicle.history_summary.documents_total}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography className="metric-label">Подтверждено</Typography>
                <Typography>{selectedFleetVehicle.history_summary.confirmed_repairs}</Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography className="metric-label">Подозрительных</Typography>
                <Typography>{selectedFleetVehicle.history_summary.suspicious_repairs}</Typography>
              </Grid>
              <Grid item xs={6} sm={6}>
                <Typography className="metric-label">Последний ремонт</Typography>
                <Typography>
                  {selectedFleetVehicle.history_summary.last_repair_date
                    ? formatDateValue(selectedFleetVehicle.history_summary.last_repair_date)
                    : "Не найден"}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={6}>
                <Typography className="metric-label">Последний пробег</Typography>
                <Typography>
                  {typeof selectedFleetVehicle.history_summary.last_mileage === "number"
                    ? selectedFleetVehicle.history_summary.last_mileage
                    : "Не указан"}
                </Typography>
              </Grid>
            </Grid>
          </Stack>
        </Paper>
        <Paper className="repair-summary" elevation={0}>
          <Stack spacing={1.5}>
            <Typography variant="h6">История из 2025 для ИИ</Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={4}>
                <Typography className="metric-label">Исторических ремонтов</Typography>
                <Typography>{selectedFleetVehicle.historical_history_summary.repairs_total}</Typography>
              </Grid>
              <Grid item xs={6} sm={4}>
                <Typography className="metric-label">Сервисов</Typography>
                <Typography>{selectedFleetVehicle.historical_history_summary.services_total}</Typography>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography className="metric-label">Сумма по истории</Typography>
                <Typography>{formatMoney(selectedFleetVehicle.historical_history_summary.total_spend)}</Typography>
              </Grid>
              <Grid item xs={6} sm={6}>
                <Typography className="metric-label">Первый ремонт в истории</Typography>
                <Typography>
                  {selectedFleetVehicle.historical_history_summary.first_repair_date
                    ? formatDateValue(selectedFleetVehicle.historical_history_summary.first_repair_date)
                    : "Не найден"}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={6}>
                <Typography className="metric-label">Последний ремонт в истории</Typography>
                <Typography>
                  {selectedFleetVehicle.historical_history_summary.last_repair_date
                    ? formatDateValue(selectedFleetVehicle.historical_history_summary.last_repair_date)
                    : "Не найден"}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography className="metric-label">Последний исторический пробег</Typography>
                <Typography>
                  {typeof selectedFleetVehicle.historical_history_summary.last_mileage === "number"
                    ? selectedFleetVehicle.historical_history_summary.last_mileage
                    : "Не указан"}
                </Typography>
              </Grid>
            </Grid>
            {selectedFleetVehicle.historical_repair_history.length > 0 ? (
              selectedFleetVehicle.historical_repair_history.map((repair) => (
                <Paper className="repair-line" key={`vehicle-historical-repair-${repair.repair_id}`} elevation={0}>
                  <Stack spacing={0.75}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      spacing={1}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                    >
                      <Typography>
                        История #{repair.repair_id}
                        {repair.order_number ? ` · ${repair.order_number}` : ""}
                      </Typography>
                      <Chip size="small" variant="outlined" label={formatMoney(repair.grand_total)} />
                    </Stack>
                    <Typography className="muted-copy">
                      {[
                        formatDateValue(repair.repair_date),
                        `пробег ${repair.mileage}`,
                        repair.service_name,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Typography>
                    {repair.employee_comment ? (
                      <Typography className="muted-copy">{repair.employee_comment}</Typography>
                    ) : null}
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          void openRepairByIds(null, repair.repair_id);
                        }}
                      >
                        Открыть исторический ремонт
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))
            ) : (
              <Typography className="muted-copy">
                По этой технике история из `2025 для ИИ` не найдена.
              </Typography>
            )}
          </Stack>
        </Paper>
        <Paper className="repair-summary" elevation={0}>
          <Stack spacing={1.25}>
            <Typography variant="h6">Текущие закрепления</Typography>
            {selectedFleetVehicle.active_assignments.length > 0 ? (
              selectedFleetVehicle.active_assignments.map((assignment) => (
                <Paper className="repair-line" key={`vehicle-assignment-${assignment.id}`} elevation={0}>
                  <Stack spacing={0.5}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      spacing={1}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                    >
                      <Typography>{assignment.user.full_name}</Typography>
                      <Chip size="small" variant="outlined" label={formatUserRoleLabel(assignment.user.role)} />
                    </Stack>
                    <Typography className="muted-copy">{assignment.user.email}</Typography>
                    <Typography className="muted-copy">
                      С {formatDateValue(assignment.starts_at)}
                      {assignment.ends_at ? ` по ${formatDateValue(assignment.ends_at)}` : " по настоящее время"}
                    </Typography>
                    {assignment.comment ? <Typography className="muted-copy">{assignment.comment}</Typography> : null}
                  </Stack>
                </Paper>
              ))
            ) : (
              <Typography className="muted-copy">Сейчас техника ни за кем не закреплена.</Typography>
            )}
          </Stack>
        </Paper>
        <Paper className="repair-summary" elevation={0}>
          <Stack spacing={1.25}>
            <Typography variant="h6">Активные связки</Typography>
            {selectedFleetVehicle.active_links.length > 0 ? (
              selectedFleetVehicle.active_links.map((link) => {
                const linkedVehicleId =
                  link.left_vehicle_id === selectedFleetVehicle.id ? link.right_vehicle_id : link.left_vehicle_id;
                const linkedVehicle =
                  vehicles.find((item) => item.id === linkedVehicleId) ??
                  fleetVehicles.find((item) => item.id === linkedVehicleId) ??
                  null;

                return (
                  <Paper className="repair-line" key={`vehicle-link-${link.id}`} elevation={0}>
                    <Stack spacing={0.5}>
                      <Typography>
                        {linkedVehicle ? formatVehicle(linkedVehicle) : `Техника #${linkedVehicleId}`}
                      </Typography>
                      <Typography className="muted-copy">
                        С {formatDateValue(link.starts_at)}
                        {link.ends_at ? ` по ${formatDateValue(link.ends_at)}` : " по настоящее время"}
                      </Typography>
                      {link.comment ? <Typography className="muted-copy">{link.comment}</Typography> : null}
                    </Stack>
                  </Paper>
                );
              })
            ) : (
              <Typography className="muted-copy">
                Активные связки для этой единицы техники не найдены.
              </Typography>
            )}
          </Stack>
        </Paper>
        <Paper className="repair-summary" elevation={0}>
          <Stack spacing={1.25}>
            <Typography variant="h6">История ремонтов</Typography>
            {selectedFleetVehicle.repair_history.length > 0 ? (
              selectedFleetVehicle.repair_history.map((repair) => (
                <Paper className="repair-line" key={`vehicle-repair-${repair.repair_id}`} elevation={0}>
                  <Stack spacing={0.75}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      spacing={1}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                    >
                      <Typography>
                        Ремонт #{repair.repair_id}
                        {repair.order_number ? ` · ${repair.order_number}` : ""}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Chip size="small" variant="outlined" label={formatRepairStatus(repair.status)} />
                        <Chip size="small" variant="outlined" label={`документов ${repair.documents_total}`} />
                      </Stack>
                    </Stack>
                    <Typography className="muted-copy">
                      {[
                        formatDateValue(repair.repair_date),
                        `пробег ${repair.mileage}`,
                        repair.service_name,
                        formatMoney(repair.grand_total),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Typography>
                    <Typography className="muted-copy">Обновлено {formatDateTime(repair.updated_at)}</Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          void openRepairByIds(null, repair.repair_id);
                        }}
                      >
                        Открыть ремонт
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))
            ) : (
              <Typography className="muted-copy">По этой технике ремонтов пока нет.</Typography>
            )}
          </Stack>
        </Paper>
      </Stack>
    );
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
          <Paper className="topbar" elevation={0}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
              <Box>
                <Typography variant="overline" className="eyebrow">
                  Road700 workspace
                </Typography>
                <Typography variant="h4" component="h1">
                  Операционная панель заказ-нарядов
                </Typography>
                <Typography className="muted-copy">
                  {user ? `${user.full_name} · ${user.role}` : "Загрузка профиля"}
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
                <Chip label={user?.email || "user"} />
                <Button
                  variant={showPasswordChange ? "contained" : "outlined"}
                  onClick={() => setShowPasswordChange((current) => !current)}
                >
                  Сменить пароль
                </Button>
                <Button variant="outlined" onClick={handleLogout}>
                  Выйти
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {showPasswordChange ? (
            <Paper className="workspace-panel" elevation={0}>
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="h6">Смена пароля</Typography>
                  <Typography className="muted-copy">
                    Новый пароль должен быть не короче 8 символов.
                  </Typography>
                </Box>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Текущий пароль"
                      type="password"
                      value={currentPasswordValue}
                      onChange={(event) => setCurrentPasswordValue(event.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Новый пароль"
                      type="password"
                      value={newPasswordValue}
                      onChange={(event) => setNewPasswordValue(event.target.value)}
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button
                        variant="contained"
                        disabled={passwordChangeLoading}
                        onClick={() => {
                          void handleChangePassword();
                        }}
                      >
                        {passwordChangeLoading ? "Сохранение..." : "Обновить пароль"}
                      </Button>
                      <Button
                        variant="text"
                        disabled={passwordChangeLoading}
                        onClick={() => {
                          setShowPasswordChange(false);
                          setCurrentPasswordValue("");
                          setNewPasswordValue("");
                        }}
                      >
                        Отмена
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Stack>
            </Paper>
          ) : null}

          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
          {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}

          {bootLoading ? (
            <Paper className="loading-panel" elevation={0}>
              <Stack spacing={2} alignItems="center">
                <CircularProgress />
                <Typography>Обновление данных...</Typography>
              </Stack>
            </Paper>
          ) : null}

          <Paper className="workspace-panel" elevation={0}>
            <Stack spacing={1.5}>
              <Tabs
                value={activeWorkspaceTab}
                onChange={(_event, value: WorkspaceTab) => handleWorkspaceTabChange(value)}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
              >
                <Tab label={`Документы · ${documents.length}`} value="documents" />
                <Tab label={selectedRepair ? `Ремонт · #${selectedRepair.id}` : "Ремонт"} value="repair" />
                <Tab label="Поиск" value="search" />
                <Tab label="Журнал" value="audit" />
                {user?.role === "admin" ? <Tab label="Админка" value="admin" /> : null}
                {user?.role === "admin" && showTechAdminTab ? <Tab label="Тех. админка" value="tech_admin" /> : null}
                <Tab label={`Техника · ${summary?.vehicles_total ?? vehicles.length}`} value="fleet" />
              </Tabs>
              <Typography className="muted-copy">{workspaceTabDescriptions[activeWorkspaceTab]}</Typography>
            </Stack>
          </Paper>

          <Grid container spacing={2}>
            {summaryCards.map((card) => (
              <Grid item xs={12} sm={6} lg={3} key={card.key}>
                <Paper className="metric-card" elevation={0}>
                  <Typography className="metric-label">{card.label}</Typography>
                  <Typography variant="h3">
                    {summary ? summary[card.key] : "—"}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Paper className="workspace-panel" elevation={0}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h5">Качество данных</Typography>
                <Typography className="muted-copy">
                  Контроль OCR, очереди проверки, предварительных справочников и конфликтов импорта.
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} lg={3}>
                  <Paper className="metric-card" elevation={0}>
                    <Typography className="metric-label">Средняя уверенность OCR</Typography>
                    <Typography variant="h3">
                      {dataQuality ? formatConfidence(dataQuality.average_ocr_confidence) : "—"}
                    </Typography>
                  </Paper>
                </Grid>
                {qualityCards.map((card) => (
                  <Grid item xs={12} sm={6} lg={3} key={card.key}>
                    <Paper className="metric-card" elevation={0}>
                      <Typography className="metric-label">{card.label}</Typography>
                      <Typography variant="h3">
                        {dataQuality ? dataQuality[card.key] : "—"}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Stack>
          </Paper>

          <Paper className="workspace-panel" elevation={0}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h5">Визуальные дашборды</Typography>
                <Typography className="muted-copy">
                  Наглядная картина по ремонтам, качеству OCR и точкам накопления ручной работы.
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={12} lg={4}>
                  <Paper className="dashboard-visual-card" elevation={0}>
                    <Stack spacing={1.25}>
                      <Box>
                        <Typography className="metric-label">Ремонтный контур</Typography>
                        <Typography variant="h6">Статусы и поток документов</Typography>
                      </Box>
                      {repairVisualBars.length > 0 ? (
                        <Stack spacing={1}>
                          {repairVisualBars.map((item) => (
                            <Box key={item.label} className="dashboard-bar-row">
                              <Stack direction="row" justifyContent="space-between" spacing={1}>
                                <Typography>{item.label}</Typography>
                                <Typography className="dashboard-bar-value">{item.value}</Typography>
                              </Stack>
                              <Box className="dashboard-bar-track">
                                <Box
                                  className={`dashboard-bar-fill tone-${item.tone}`}
                                  sx={{ width: buildDashboardVisualBarWidth(item.value, repairVisualMax) }}
                                />
                              </Box>
                              {item.hint ? <Typography className="muted-copy">{item.hint}</Typography> : null}
                            </Box>
                          ))}
                        </Stack>
                      ) : (
                        <Typography className="muted-copy">Данных для визуализации пока нет.</Typography>
                      )}
                    </Stack>
                  </Paper>
                </Grid>
                <Grid item xs={12} lg={4}>
                  <Paper className="dashboard-visual-card" elevation={0}>
                    <Stack spacing={1.25}>
                      <Box>
                        <Typography className="metric-label">OCR и контроль</Typography>
                        <Typography variant="h6">Качество распознавания</Typography>
                      </Box>
                      {qualityVisualBars.length > 0 ? (
                        <Stack spacing={1}>
                          {qualityVisualBars.map((item) => (
                            <Box key={item.label} className="dashboard-bar-row">
                              <Stack direction="row" justifyContent="space-between" spacing={1}>
                                <Typography>{item.label}</Typography>
                                <Typography className="dashboard-bar-value">{item.value}</Typography>
                              </Stack>
                              <Box className="dashboard-bar-track">
                                <Box
                                  className={`dashboard-bar-fill tone-${item.tone}`}
                                  sx={{ width: buildDashboardVisualBarWidth(item.value, qualityVisualMax) }}
                                />
                              </Box>
                              {item.hint ? <Typography className="muted-copy">{item.hint}</Typography> : null}
                            </Box>
                          ))}
                        </Stack>
                      ) : (
                        <Typography className="muted-copy">Критичных сигналов OCR сейчас нет.</Typography>
                      )}
                    </Stack>
                  </Paper>
                </Grid>
                <Grid item xs={12} lg={4}>
                  <Paper className="dashboard-visual-card" elevation={0}>
                    <Stack spacing={1.25}>
                      <Box>
                        <Typography className="metric-label">Точки внимания</Typography>
                        <Typography variant="h6">Где копится разбор</Typography>
                      </Box>
                      {attentionVisualBars.length > 0 ? (
                        <Stack spacing={1}>
                          {attentionVisualBars.map((item) => (
                            <Box key={item.label} className="dashboard-bar-row">
                              <Stack direction="row" justifyContent="space-between" spacing={1}>
                                <Typography>{item.label}</Typography>
                                <Typography className="dashboard-bar-value">{item.value}</Typography>
                              </Stack>
                              <Box className="dashboard-bar-track">
                                <Box
                                  className={`dashboard-bar-fill tone-${item.tone}`}
                                  sx={{ width: buildDashboardVisualBarWidth(item.value, attentionVisualMax) }}
                                />
                              </Box>
                              {item.hint ? <Typography className="muted-copy">{item.hint}</Typography> : null}
                            </Box>
                          ))}
                        </Stack>
                      ) : (
                        <Typography className="muted-copy">Нечего выносить в приоритетный разбор.</Typography>
                      )}
                      {topAttentionServices.length > 0 ? (
                        <Stack spacing={0.75}>
                          <Divider />
                          <Typography className="metric-label">Сервисы с накоплением ремонтов</Typography>
                          {topAttentionServices.map((item) => (
                            <Stack
                              key={`dashboard-service-${item.service_id}`}
                              direction="row"
                              justifyContent="space-between"
                              spacing={1}
                              alignItems="center"
                            >
                              <Box sx={{ minWidth: 0 }}>
                                <Typography>{item.name}</Typography>
                                <Typography className="muted-copy">
                                  {item.city || "Город не указан"}
                                  {item.last_repair_date ? ` · последний ремонт ${item.last_repair_date}` : ""}
                                </Typography>
                              </Box>
                              <Chip size="small" variant="outlined" label={`${item.repairs_total} ремонтов`} />
                            </Stack>
                          ))}
                        </Stack>
                      ) : null}
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>
            </Stack>
          </Paper>

          <Paper className="workspace-panel" elevation={0}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="h5">Что требует внимания</Typography>
                <Typography className="muted-copy">
                  Полный рабочий список скрыт с главной страницы и открывается по отдельной кнопке.
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                <Button
                  variant="contained"
                  color="warning"
                  size="large"
                  onClick={() => setShowQualityDialog(true)}
                  sx={{
                    minWidth: { xs: "100%", sm: 180 },
                    whiteSpace: "nowrap",
                    fontWeight: 800,
                    textTransform: "none",
                  }}
                >
                  Внимание !!!
                </Button>
                <Typography className="muted-copy">
                  Всего записей для разбора: {(
                    (dataQualityDetails?.counts.documents || 0) +
                    (dataQualityDetails?.counts.services || 0) +
                    (dataQualityDetails?.counts.works || 0) +
                    (dataQualityDetails?.counts.parts || 0) +
                    (dataQualityDetails?.counts.conflicts || 0)
                  )}
                </Typography>
              </Stack>
            </Stack>
          </Paper>
          <Dialog
            open={showQualityDialog}
            onClose={() => setShowQualityDialog(false)}
            fullWidth
            maxWidth="lg"
          >
            <DialogTitle>Внимание !!!</DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <Typography className="muted-copy">
                  Детализация по проблемным документам, предварительным справочникам и конфликтам импорта.
                </Typography>
                <Tabs
                  value={activeQualityTab}
                  onChange={(_event, value: QualityDetailTab) => setActiveQualityTab(value)}
                  variant="scrollable"
                  scrollButtons="auto"
                  allowScrollButtonsMobile
                >
                  <Tab label={`Документы · ${dataQualityDetails?.counts.documents || 0}`} value="documents" />
                  <Tab label={`Сервисы · ${dataQualityDetails?.counts.services || 0}`} value="services" />
                  <Tab label={`Работы · ${dataQualityDetails?.counts.works || 0}`} value="works" />
                  <Tab label={`Материалы · ${dataQualityDetails?.counts.parts || 0}`} value="parts" />
                  <Tab label={`Конфликты · ${dataQualityDetails?.counts.conflicts || 0}`} value="conflicts" />
                </Tabs>

                {activeQualityTab === "documents" ? (
                  <Stack spacing={1.5}>
                    {dataQualityDetails?.documents.length ? (
                      dataQualityDetails.documents.map((item) => (
                        <Paper className="repair-line" key={`quality-document-${item.document_id}`} elevation={0}>
                          <Stack spacing={1}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              justifyContent="space-between"
                              spacing={1}
                              alignItems={{ xs: "flex-start", sm: "center" }}
                            >
                              <Typography variant="subtitle1">{item.original_filename}</Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip
                                  size="small"
                                  color={statusColor(item.document_status as DocumentStatus)}
                                  label={formatDocumentStatusLabel(item.document_status)}
                                />
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={`OCR ${formatConfidence(item.ocr_confidence)}`}
                                />
                              </Stack>
                            </Stack>
                            <Typography className="muted-copy">
                              {formatQualityVehicle(item)}
                              {item.repair_date ? ` · ${item.repair_date}` : ""}
                              {item.repair_status ? ` · ${formatRepairStatus(item.repair_status)}` : ""}
                            </Typography>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                              <Button
                                size="small"
                                variant="outlined"
                                disabled={!item.repair_id}
                                onClick={() => {
                                  setShowQualityDialog(false);
                                  void openQualityRepair(item.document_id, item.repair_id);
                                }}
                              >
                                Открыть ремонт
                              </Button>
                            </Stack>
                          </Stack>
                        </Paper>
                      ))
                    ) : (
                      <Typography className="muted-copy">Сейчас проблемных документов в выборке нет.</Typography>
                    )}
                  </Stack>
                ) : null}

                {activeQualityTab === "services" ? (
                  <Stack spacing={1.5}>
                    {dataQualityDetails?.services.length ? (
                      dataQualityDetails.services.map((item) => (
                        <Paper className="repair-line" key={`quality-service-${item.service_id}`} elevation={0}>
                          <Stack spacing={1}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              justifyContent="space-between"
                              spacing={1}
                              alignItems={{ xs: "flex-start", sm: "center" }}
                            >
                              <Typography variant="subtitle1">{item.name}</Typography>
                              <Chip size="small" color="warning" label="Предварительный" />
                            </Stack>
                            <Typography className="muted-copy">
                              {[item.city, `ремонтов ${item.repairs_total}`, item.last_repair_date ? `последний ${item.last_repair_date}` : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </Typography>
                            {user?.role === "admin" ? (
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setShowQualityDialog(false);
                                    void openQualityService(item.name);
                                  }}
                                >
                                  Открыть в админке
                                </Button>
                              </Stack>
                            ) : null}
                          </Stack>
                        </Paper>
                      ))
                    ) : (
                      <Typography className="muted-copy">Неподтверждённых сервисов в выборке нет.</Typography>
                    )}
                  </Stack>
                ) : null}

                {activeQualityTab === "works" ? (
                  <Stack spacing={1.5}>
                    {dataQualityDetails?.works.length ? (
                      dataQualityDetails.works.map((item) => (
                        <Paper className="repair-line" key={`quality-work-${item.work_id}`} elevation={0}>
                          <Stack spacing={1}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              justifyContent="space-between"
                              spacing={1}
                              alignItems={{ xs: "flex-start", sm: "center" }}
                            >
                              <Typography variant="subtitle1">{item.work_name}</Typography>
                              <Chip size="small" color="warning" label={formatMoney(item.line_total)} />
                            </Stack>
                            <Typography className="muted-copy">
                              {formatQualityVehicle(item)} · {item.repair_date} · ремонт #{item.repair_id}
                            </Typography>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                              <Button
                                size="small"
                                variant="outlined"
                                disabled={!item.repair_id}
                                onClick={() => {
                                  setShowQualityDialog(false);
                                  void openQualityRepair(item.document_id, item.repair_id);
                                }}
                              >
                                Открыть ремонт
                              </Button>
                            </Stack>
                          </Stack>
                        </Paper>
                      ))
                    ) : (
                      <Typography className="muted-copy">Неподтверждённых работ в выборке нет.</Typography>
                    )}
                  </Stack>
                ) : null}

                {activeQualityTab === "parts" ? (
                  <Stack spacing={1.5}>
                    {dataQualityDetails?.parts.length ? (
                      dataQualityDetails.parts.map((item) => (
                        <Paper className="repair-line" key={`quality-part-${item.part_id}`} elevation={0}>
                          <Stack spacing={1}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              justifyContent="space-between"
                              spacing={1}
                              alignItems={{ xs: "flex-start", sm: "center" }}
                            >
                              <Typography variant="subtitle1">{item.part_name}</Typography>
                              <Chip size="small" color="warning" label={formatMoney(item.line_total)} />
                            </Stack>
                            <Typography className="muted-copy">
                              {formatQualityVehicle(item)} · {item.repair_date} · ремонт #{item.repair_id}
                            </Typography>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                              <Button
                                size="small"
                                variant="outlined"
                                disabled={!item.repair_id}
                                onClick={() => {
                                  setShowQualityDialog(false);
                                  void openQualityRepair(item.document_id, item.repair_id);
                                }}
                              >
                                Открыть ремонт
                              </Button>
                            </Stack>
                          </Stack>
                        </Paper>
                      ))
                    ) : (
                      <Typography className="muted-copy">Неподтверждённых материалов в выборке нет.</Typography>
                    )}
                  </Stack>
                ) : null}

                {activeQualityTab === "conflicts" ? (
                  <Stack spacing={1.5}>
                    {dataQualityDetails?.conflicts.length ? (
                      dataQualityDetails.conflicts.map((item) => (
                        <Paper className="repair-line" key={`quality-conflict-${item.conflict_id}`} elevation={0}>
                          <Stack spacing={1}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              justifyContent="space-between"
                              spacing={1}
                              alignItems={{ xs: "flex-start", sm: "center" }}
                            >
                              <Typography variant="subtitle1">{item.entity_type}</Typography>
                              <Chip size="small" color="warning" label="Ожидает решения" />
                            </Stack>
                            <Typography className="muted-copy">
                              {[item.conflict_key, item.source_filename, formatQualityVehicle(item), item.created_at ? formatDateTime(item.created_at) : null]
                                .filter(Boolean)
                                .join(" · ")}
                            </Typography>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                              {user?.role === "admin" ? (
                                <Button
                                  size="small"
                                  variant="contained"
                                  onClick={() => {
                                    void openImportConflict(item.conflict_id);
                                  }}
                                >
                                  Разобрать конфликт
                                </Button>
                              ) : null}
                              {item.document_id && item.repair_id ? (
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setShowQualityDialog(false);
                                    void openQualityRepair(item.document_id, item.repair_id);
                                  }}
                                >
                                  Открыть ремонт
                                </Button>
                              ) : null}
                            </Stack>
                          </Stack>
                        </Paper>
                      ))
                    ) : (
                      <Typography className="muted-copy">Конфликтов импорта в выборке нет.</Typography>
                    )}
                  </Stack>
                ) : null}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowQualityDialog(false)}>Закрыть</Button>
            </DialogActions>
          </Dialog>
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
              <Grid item xs={12} md={7}>
              <Paper className="workspace-panel" elevation={0}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h5">Загрузка заказ-наряда</Typography>
                    <Typography className="muted-copy">
                      После загрузки система сама распознаёт документ, сопоставляет машину и сервис, сверяет данные по базе, справочникам и истории, а затем показывает короткий итог.
                    </Typography>
                  </Box>

                  <Box component="form" onSubmit={handleUpload}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          select
                          label="Техника"
                          value={uploadForm.vehicleId}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, vehicleId: event.target.value }))
                          }
                          fullWidth
                          helperText="Можно оставить пустым: OCR попробует определить технику по документу"
                        >
                          <MenuItem value="">Определить автоматически после OCR</MenuItem>
                          {vehicles.map((vehicle) => (
                            <MenuItem key={vehicle.id} value={String(vehicle.id)}>
                              {formatVehicle(vehicle)}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          select
                          label="Вид документа"
                          value={uploadForm.documentKind}
                          onChange={(event) =>
                            setUploadForm((current) => ({
                              ...current,
                              documentKind: event.target.value as DocumentKind,
                            }))
                          }
                          fullWidth
                          required
                        >
                          {rootDocumentKindOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          label="Дата ремонта"
                          type="date"
                          value={uploadForm.repairDate}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, repairDate: event.target.value }))
                          }
                          InputLabelProps={{ shrink: true }}
                          fullWidth
                          helperText="Необязательно. Если оставить пустым, система попытается распознать дату из файла"
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          label="Пробег"
                          type="number"
                          value={uploadForm.mileage}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, mileage: event.target.value }))
                          }
                          fullWidth
                          helperText="Необязательно. OCR попытается найти пробег автоматически"
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Номер заказ-наряда"
                          value={uploadForm.orderNumber}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, orderNumber: event.target.value }))
                          }
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Причина ремонта"
                          value={uploadForm.reason}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, reason: event.target.value }))
                          }
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label="Комментарий сотрудника"
                          value={uploadForm.employeeComment}
                          onChange={(event) =>
                            setUploadForm((current) => ({
                              ...current,
                              employeeComment: event.target.value,
                            }))
                          }
                          fullWidth
                          multiline
                          minRows={2}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label="Примечание к документу"
                          value={uploadForm.notes}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, notes: event.target.value }))
                          }
                          fullWidth
                          multiline
                          minRows={2}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Paper className="file-drop" elevation={0}>
                          <Stack
                            direction={{ xs: "column", sm: "row" }}
                            spacing={2}
                            justifyContent="space-between"
                            alignItems={{ xs: "stretch", sm: "center" }}
                          >
                            <Box>
                              <Typography variant="subtitle1">Файл документа</Typography>
                              <Typography className="muted-copy">
                                Поддерживаются PDF и изображения. Для PDF с текстовым слоем OCR срабатывает автоматически, для фото и сканов используется локальное распознавание.
                              </Typography>
                            </Box>
                            <input
                              ref={uploadFileInputRef}
                              hidden
                              type="file"
                              accept=".pdf,image/*"
                              onClick={(event) => {
                                event.currentTarget.value = "";
                              }}
                              onChange={(event) => {
                                const nextFile = event.target.files?.[0] ?? null;
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
                              }}
                            />
                            <Button
                              variant="outlined"
                              onClick={() => uploadFileInputRef.current?.click()}
                              sx={{
                                flexShrink: 0,
                                width: { xs: "100%", sm: "auto" },
                                minWidth: { xs: 0, sm: 152 },
                                whiteSpace: "normal",
                                textAlign: "center",
                                fontWeight: 700,
                                textTransform: "none",
                              }}
                            >
                              Выбрать файл
                            </Button>
                          </Stack>
                          {selectedFile ? (
                            <Alert severity="success" className="selected-file-alert">
                              <Typography className="selected-file-title">Файл выбран</Typography>
                              <Typography className="selected-file">{selectedFile.name}</Typography>
                              <Typography className="muted-copy">
                                Файл пока только выбран локально. Можно загружать сразу: техника, дата и пробег теперь необязательны, OCR попытается заполнить их автоматически.
                              </Typography>
                            </Alert>
                          ) : (
                            <Typography className="selected-file">Файл ещё не выбран</Typography>
                          )}
                          {selectedFile && uploadMissingRequirements.length > 0 ? (
                            <Alert severity="info">
                              Для загрузки ещё нужно указать: {uploadMissingRequirements.join(", ")}.
                            </Alert>
                          ) : selectedFile ? (
                            <Alert severity="info">
                              После загрузки система создаст черновик ремонта, выполнит OCR, проверит машину, сервис, справочники и историю, а затем подготовит короткий итог по заказ-наряду.
                            </Alert>
                          ) : null}
                        </Paper>
                      </Grid>
                      <Grid item xs={12}>
                        <Button
                          type="submit"
                          variant="contained"
                          size="large"
                          disabled={uploadLoading || uploadMissingRequirements.length > 0}
                        >
                          {uploadLoading ? "Загрузка..." : "Загрузить и запустить проверку"}
                        </Button>
                      </Grid>
                      {lastUploadedDocument ? (
                        <Grid item xs={12}>
                          <Paper className="repair-summary upload-result-card" elevation={0}>
                            <Stack spacing={1.5}>
                              <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1}
                                justifyContent="space-between"
                                alignItems={{ xs: "flex-start", sm: "center" }}
                              >
                                <Box>
                                  <Typography variant="subtitle1">Короткий итог по загрузке</Typography>
                                  <Typography className="muted-copy">
                                    Система приняла заказ-наряд и подготовила карточку ремонта для автоматической проверки.
                                  </Typography>
                                </Box>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    label={formatDocumentKind(lastUploadedDocument.kind)}
                                  />
                                  {lastUploadedDocument.latest_import_job ? (
                                    <Chip
                                      size="small"
                                      color={importJobStatusColor(lastUploadedDocument.latest_import_job.status)}
                                      label={`OCR: ${formatStatus(lastUploadedDocument.latest_import_job.status)}`}
                                    />
                                  ) : null}
                                  <Chip
                                    size="small"
                                    color={statusColor(lastUploadedDocument.status)}
                                    label={formatDocumentStatusLabel(lastUploadedDocument.status)}
                                  />
                                </Stack>
                              </Stack>
                              <Typography>{isDocumentAwaitingOcr(lastUploadedDocument.status) || documentHasActiveImportJob(lastUploadedDocument)
                                ? `Заказ-наряд ${lastUploadedDocument.repair.order_number || "без номера"} загружен. Сейчас идет распознавание и автоматическая сверка по машине, сервису, справочникам и истории.`
                                : `Заказ-наряд ${lastUploadedDocument.repair.order_number || "без номера"} загружен и обработан. Карточка ремонта заполнена, можно открыть итог проверки.`}</Typography>
                              {lastUploadedDocument.latest_import_job?.error_message ? (
                                <Alert severity="warning">
                                  OCR-задача завершилась с ошибкой: {lastUploadedDocument.latest_import_job.error_message}
                                </Alert>
                              ) : null}
                              <Typography className="selected-file">{lastUploadedDocument.original_filename}</Typography>
                              <Typography className="muted-copy">
                                Машина: {!isPlaceholderVehicle(lastUploadedDocument.vehicle.external_id)
                                  ? formatVehicle(lastUploadedDocument.vehicle)
                                  : "не определена автоматически"}
                              </Typography>
                              <Typography className="muted-copy">
                                Сервис: {lastUploadedDocument.parsed_payload?.extracted_fields?.service_name
                                  ? String(lastUploadedDocument.parsed_payload.extracted_fields.service_name)
                                  : "будет уточнен после проверки"}
                              </Typography>
                              <Typography className="muted-copy">
                                Ремонт #{lastUploadedDocument.repair.id}
                                {lastUploadedDocument.repair.order_number
                                  ? ` · ${lastUploadedDocument.repair.order_number}`
                                  : ""}
                                {lastUploadedDocument.repair.repair_date ? ` · ${lastUploadedDocument.repair.repair_date}` : ""}
                                {lastUploadedDocument.repair.mileage > 0 ? ` · пробег ${lastUploadedDocument.repair.mileage}` : ""}
                              </Typography>
                              <Typography className="muted-copy">
                                Статус: {isDocumentAwaitingOcr(lastUploadedDocument.status)
                                  ? "идет автоматическая проверка"
                                  : "автоматическая обработка выполнена"}
                                {typeof lastUploadedDocument.ocr_confidence === "number"
                                  ? ` · OCR ${formatConfidence(lastUploadedDocument.ocr_confidence)}`
                                  : ""}
                              </Typography>
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                <Button
                                  variant="contained"
                                  onClick={() => {
                                    void openRepairByIds(
                                      lastUploadedDocument.id,
                                      lastUploadedDocument.repair.id,
                                    );
                                  }}
                                >
                                  Открыть итог по заказ-наряду
                                </Button>
                                <Button
                                  variant="outlined"
                                  onClick={() => {
                                    setLastUploadedDocument(null);
                                  }}
                                >
                                  Скрыть
                                </Button>
                              </Stack>
                            </Stack>
                          </Paper>
                        </Grid>
                      ) : null}
                    </Grid>
                  </Box>
                </Stack>
              </Paper>
              </Grid>
            ) : null}

            <Grid item xs={12} md={activeWorkspaceTab === "documents" ? 5 : 12}>
              <Stack spacing={3}>
                {activeWorkspaceTab === "admin" && user?.role === "admin" ? (
                  <Paper className="workspace-panel" elevation={0}>
                    <Stack spacing={1.5}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1.5}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", md: "center" }}
                      >
                        <Box>
                          <Typography variant="h5">Администрирование</Typography>
                          <Typography className="muted-copy">
                            Основные справочники и правила системы разнесены по отдельным вкладкам.
                          </Typography>
                        </Box>
                        <Button variant="outlined" onClick={() => openTechAdmin()}>
                          Открыть тех. админку
                        </Button>
                      </Stack>
                      <Tabs
                        value={activeAdminTab}
                        onChange={(_event, value: AdminTab) => handleAdminTabChange(value)}
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                      >
                        <Tab label="Сотрудники" value="employees" />
                        <Tab label="Сервисы" value="services" />
                        <Tab label="Резервные копии" value="backups" />
                        <Tab label="Контроль" value="control" />
                        <Tab label="Нормо-часы" value="labor_norms" />
                        <Tab label="Импорт истории" value="imports" />
                      </Tabs>
                      <Typography className="muted-copy">{adminTabDescriptions[activeAdminTab]}</Typography>
                    </Stack>
                  </Paper>
                ) : null}
                {activeWorkspaceTab === "tech_admin" && user?.role === "admin" ? (
                  <Paper className="workspace-panel" elevation={0}>
                    <Stack spacing={1.5}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        spacing={1.5}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", md: "center" }}
                      >
                        <Box>
                          <Typography variant="h5">Техническая админка</Typography>
                          <Typography className="muted-copy">
                            Отдельный экран для OCR-обучения, выбора шаблонов и правил извлечения полей.
                          </Typography>
                        </Box>
                        <Button variant="outlined" onClick={closeTechAdmin}>
                          Вернуться в админку
                        </Button>
                      </Stack>
                      <Tabs
                        value={activeTechAdminTab}
                        onChange={(_event, value: TechAdminTab) => handleTechAdminTabChange(value)}
                        variant="scrollable"
                        scrollButtons="auto"
                        allowScrollButtonsMobile
                      >
                        <Tab label="Обучение OCR" value="learning" />
                        <Tab label="Выбор шаблона" value="matchers" />
                        <Tab label="Извлечение полей" value="rules" />
                      </Tabs>
                      <Typography className="muted-copy">{techAdminTabDescriptions[activeTechAdminTab]}</Typography>
                      <Alert severity={systemStatus?.password_recovery_email_configured ? "success" : "warning"}>
                        {systemStatus?.password_recovery_email_configured
                          ? "Письма для восстановления пароля отправляются автоматически."
                          : "Письма для восстановления пароля пока не настроены. Сейчас система работает в ручном режиме."}
                      </Alert>
                    </Stack>
                  </Paper>
                ) : null}
                {activeWorkspaceTab === "documents" ? (
                  <Paper className="workspace-panel" elevation={0}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h5">Очередь проверки</Typography>
                      <Typography className="muted-copy">
                        Сначала показываются подозрительные и проблемные заказ-наряды по доступной технике.
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {reviewQueueFilters.map((filter) => (
                        <Chip
                          key={filter.key}
                          label={`${filter.label} · ${reviewQueueCounts[filter.key] || 0}`}
                          color={selectedReviewCategory === filter.key ? "primary" : "default"}
                          variant={selectedReviewCategory === filter.key ? "filled" : "outlined"}
                          onClick={() => {
                            setSelectedReviewCategory(filter.key);
                          }}
                        />
                      ))}
                    </Stack>
                    <Typography className="muted-copy">
                      Показано {reviewQueue.length} из {reviewQueueCounts[selectedReviewCategory] || 0} по выбранному фильтру.
                    </Typography>
                    <Stack spacing={1.5}>
                      {reviewQueue.map((item) => (
                        <Paper className="document-row" key={`review-${item.document.id}`} elevation={0}>
                          <Stack spacing={1.25}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              alignItems={{ xs: "flex-start", sm: "center" }}
                              justifyContent="space-between"
                            >
                              <Typography variant="subtitle1">{item.document.original_filename}</Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={formatDocumentKind(item.document.kind)}
                                />
                                <Chip
                                  size="small"
                                  color={reviewPriorityColor(item.priority_bucket)}
                                  label={formatReviewPriority(item.priority_bucket)}
                                />
                                <Chip
                                  size="small"
                                  color={statusColor(item.document.status)}
                                  label={formatDocumentStatusLabel(item.document.status)}
                                />
                              </Stack>
                            </Stack>
                            <Typography className="muted-copy">{formatVehicle(item.vehicle)}</Typography>
                            <Typography className="muted-copy">
                              Ремонт #{item.repair.id}
                              {item.repair.order_number ? ` · ${item.repair.order_number}` : ""}
                              {" · "}
                              {item.repair.repair_date}
                              {" · "}
                              пробег {item.repair.mileage}
                            </Typography>
                            <Typography className="muted-copy">
                              Приоритет {item.priority_score} · OCR {formatConfidence(item.document.ocr_confidence)} · нерешённых проверок {item.repair.unresolved_checks_total}
                            </Typography>
                            {item.extracted_order_number ? (
                              <Typography className="muted-copy">
                                OCR: заказ-наряд {item.extracted_order_number}
                                {item.extracted_grand_total !== null
                                  ? ` · итог ${formatMoney(item.extracted_grand_total)}`
                                  : ""}
                              </Typography>
                            ) : null}
                            {item.issue_titles.length > 0 ? (
                              <Typography className="muted-copy">
                                Требует внимания: {item.issue_titles.slice(0, 3).join(", ")}
                                {item.issue_titles.length > 3 ? ` и ещё ${item.issue_titles.length - 3}` : ""}
                              </Typography>
                            ) : null}
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  void handleOpenReviewQueueItem(item);
                                }}
                              >
                                Открыть ремонт
                              </Button>
                              {user?.role === "admin" ? (
                                <Button
                                  size="small"
                                  variant="text"
                                  disabled={reprocessLoading}
                                  onClick={() => {
                                    void handleReprocessDocumentById(item.document.id, item.repair.id);
                                  }}
                                >
                                  {reprocessLoading && selectedDocumentId === item.document.id ? "Повтор..." : "Повторить OCR"}
                                </Button>
                              ) : null}
                            </Stack>
                          </Stack>
                        </Paper>
                      ))}
                      {reviewQueue.length === 0 ? (
                        <Typography className="muted-copy">
                          По выбранному фильтру элементов нет.
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>
                  </Paper>
                ) : null}

                {activeWorkspaceTab === "documents" ? (
                  <Paper className="workspace-panel" elevation={0}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h5">Последние документы</Typography>
                      <Typography className="muted-copy">
                        Последние загруженные заказ-наряды и сканы по доступной технике.
                      </Typography>
                    </Box>
                    {user?.role === "admin" ? (
                      <Paper className="repair-line" elevation={0}>
                        <Stack spacing={1.25}>
                          <Box>
                            <Typography className="metric-label">Массовая переобработка заказ-нарядов</Typography>
                            <Typography className="muted-copy">
                              Пересчитывает OCR, строки работ и применимость нормо-часов по уже загруженным документам.
                            </Typography>
                          </Box>
                          <Grid container spacing={1.5}>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                label="Сколько документов"
                                type="number"
                                value={batchReprocessLimit}
                                onChange={(event) => setBatchReprocessLimit(event.target.value)}
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={5}>
                              <TextField
                                select
                                label="Статус документов"
                                value={batchReprocessStatusFilter}
                                onChange={(event) => setBatchReprocessStatusFilter(event.target.value)}
                                fullWidth
                              >
                                <MenuItem value="">Все рабочие статусы</MenuItem>
                                <MenuItem value="uploaded">Загружен</MenuItem>
                                <MenuItem value="recognized">Распознан</MenuItem>
                                <MenuItem value="partially_recognized">Распознан частично</MenuItem>
                                <MenuItem value="needs_review">Требует ручной проверки</MenuItem>
                                <MenuItem value="confirmed">Подтвержден</MenuItem>
                                <MenuItem value="ocr_error">Ошибка OCR</MenuItem>
                              </TextField>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                select
                                label="Какие документы брать"
                                value={batchReprocessPrimaryOnly}
                                onChange={(event) => setBatchReprocessPrimaryOnly(event.target.value as "false" | "true")}
                                fullWidth
                              >
                                <MenuItem value="false">Все заказ-наряды и повторные сканы</MenuItem>
                                <MenuItem value="true">Только основные документы</MenuItem>
                              </TextField>
                            </Grid>
                          </Grid>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                              variant="contained"
                              disabled={batchReprocessLoading}
                              onClick={() => {
                                void handleBatchReprocessDocuments();
                              }}
                            >
                              {batchReprocessLoading ? "Переобработка..." : "Массово пересчитать документы"}
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                    ) : null}
                    <Stack spacing={1.5}>
                      {documents.map((document) => (
                        <Paper
                          className={`document-row${selectedDocumentId === document.id ? " document-row-active" : ""}`}
                          key={document.id}
                          elevation={0}
                        >
                          <Stack spacing={1.25}>
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1}
                              alignItems={{ xs: "flex-start", sm: "center" }}
                              justifyContent="space-between"
                            >
                              <Typography variant="subtitle1">{document.original_filename}</Typography>
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip size="small" variant="outlined" label={formatDocumentKind(document.kind)} />
                                {document.latest_import_job ? (
                                  <Chip
                                    size="small"
                                    color={importJobStatusColor(document.latest_import_job.status)}
                                    label={`OCR: ${formatStatus(document.latest_import_job.status)}`}
                                  />
                                ) : null}
                                <Chip
                                  size="small"
                                  color={statusColor(document.status)}
                                  label={formatDocumentStatusLabel(document.status)}
                                />
                              </Stack>
                            </Stack>
                            <Typography className="muted-copy">
                              {formatVehicle(document.vehicle)}
                            </Typography>
                            <Typography className="muted-copy">
                              Ремонт #{document.repair.id} · {document.repair.repair_date} · пробег {document.repair.mileage}
                            </Typography>
                            {document.latest_import_job ? (
                              <Typography className="muted-copy">
                                OCR-задача: {formatStatus(document.latest_import_job.status)}
                                {document.latest_import_job.attempts > 0 ? ` · попытка ${document.latest_import_job.attempts}` : ""}
                              </Typography>
                            ) : null}
                            {document.parsed_payload?.extracted_fields?.order_number ? (
                              <Typography className="muted-copy">
                                OCR: заказ-наряд {document.parsed_payload.extracted_fields.order_number}
                              </Typography>
                            ) : null}
                            {document.parsed_payload?.extracted_fields?.plate_number ||
                            document.parsed_payload?.extracted_fields?.vin ? (
                              <Typography className="muted-copy">
                                OCR:{" "}
                                {[
                                  document.parsed_payload?.extracted_fields?.plate_number
                                    ? `госномер ${document.parsed_payload.extracted_fields.plate_number}`
                                    : null,
                                  document.parsed_payload?.extracted_fields?.vin
                                    ? `VIN ${document.parsed_payload.extracted_fields.vin}`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </Typography>
                            ) : null}
                            {document.parsed_payload?.extracted_fields?.grand_total ? (
                              <Typography className="muted-copy">
                                OCR: итог {formatMoney(document.parsed_payload.extracted_fields.grand_total)}
                              </Typography>
                            ) : null}
                            {document.parsed_payload?.extracted_items ? (
                              <Typography className="muted-copy">
                                OCR: работ {document.parsed_payload.extracted_items.works?.length || 0}, запчастей {document.parsed_payload.extracted_items.parts?.length || 0}
                              </Typography>
                            ) : null}
                            {document.parsed_payload?.manual_review_reasons?.length ? (
                              <Typography className="muted-copy">
                                Проверить вручную: {formatManualReviewReasons(document.parsed_payload.manual_review_reasons)}
                              </Typography>
                            ) : null}
                            {document.latest_import_job?.error_message ? (
                              <Alert severity="warning">Ошибка OCR: {document.latest_import_job.error_message}</Alert>
                            ) : null}
                            {formatOcrProfileMeta(document.parsed_payload ?? null) ? (
                              <Typography className="muted-copy">
                                {formatOcrProfileMeta(document.parsed_payload ?? null)}
                              </Typography>
                            ) : null}
                            {formatLaborNormApplicability(document.parsed_payload ?? null) ? (
                              <Typography className="muted-copy">
                                {formatLaborNormApplicability(document.parsed_payload ?? null)}
                              </Typography>
                            ) : null}
                            {document.notes ? (
                              <Typography className="muted-copy">{document.notes}</Typography>
                            ) : null}
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  void handleOpenRepair(document);
                                }}
                              >
                                Открыть ремонт
                              </Button>
                              {user?.role === "admin" ? (
                                <Button
                                  size="small"
                                  variant="text"
                                  disabled={reprocessLoading || document.status === "archived"}
                                  onClick={() => {
                                    void handleReprocessDocument(document);
                                  }}
                                >
                                  {reprocessLoading && selectedDocumentId === document.id ? "Повтор..." : "Повторить OCR"}
                                </Button>
                              ) : null}
                              {user?.role === "admin" && document.is_primary ? (
                                <Button
                                  size="small"
                                  variant="text"
                                  color="error"
                                  disabled={repairDeleteLoading}
                                  onClick={() => {
                                    void handleDeleteRepair(document.repair.id);
                                  }}
                                >
                                  {repairDeleteLoading ? "Удаление..." : "Удалить"}
                                </Button>
                              ) : null}
                              {user?.role === "admin" && document.status !== "archived" ? (
                                <Button
                                  size="small"
                                  variant="text"
                                  disabled={documentArchiveLoadingId === document.id}
                                  onClick={() => {
                                    void handleArchiveDocument(document.id, document.repair.id);
                                  }}
                                >
                                  {documentArchiveLoadingId === document.id ? "Архивация..." : "В архив"}
                                </Button>
                              ) : null}
                            </Stack>
                          </Stack>
                        </Paper>
                      ))}
                      {documents.length === 0 ? (
                        <Typography className="muted-copy">
                          Документы ещё не загружались.
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>
                  </Paper>
                ) : null}

                {activeWorkspaceTab === "admin" && activeAdminTab === "employees" && user?.role === "admin" ? (
                  <Paper className="workspace-panel" elevation={0}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="h5">Сотрудники и доступ</Typography>
                        <Typography className="muted-copy">
                          Администратор создаёт учётные записи сотрудников и закрепляет за ними технику.
                        </Typography>
                      </Box>
                      <Grid container spacing={1.5}>
                        <Grid item xs={12} sm={8}>
                          <TextField
                            label="Поиск по имени, логину или почте"
                            value={userSearch}
                            onChange={(event) => setUserSearch(event.target.value)}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button variant="outlined" onClick={() => void handleUserSearch()} disabled={userLoading}>
                              {userLoading ? "Загрузка..." : "Обновить"}
                            </Button>
                            <Button
                              variant="text"
                              disabled={userLoading}
                              onClick={() => {
                                setUserSearch("");
                                if (token) {
                                  void loadUsers(token, "");
                                }
                              }}
                            >
                              Сбросить
                            </Button>
                          </Stack>
                        </Grid>
                      </Grid>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button
                          variant={showUserEditor ? "outlined" : "contained"}
                          onClick={() => setShowUserEditor((current) => !current)}
                        >
                          {showUserEditor ? "Скрыть форму сотрудника" : "Добавить сотрудника"}
                        </Button>
                      </Stack>
                      {showUserEditor ? (
                        <Paper className="repair-line" elevation={0}>
                          <Stack spacing={1.25}>
                            <Typography className="metric-label">Создание и редактирование пользователя</Typography>
                            <Grid container spacing={1.5}>
                              <Grid item xs={12} sm={4}>
                                <TextField
                                  label="ФИО"
                                  value={userForm.full_name}
                                  onChange={(event) =>
                                    setUserForm((current) => ({ ...current, full_name: event.target.value }))
                                  }
                                  fullWidth
                                />
                              </Grid>
                              <Grid item xs={12} sm={2}>
                                <TextField
                                  label="Логин"
                                  value={userForm.login}
                                  onChange={(event) =>
                                    setUserForm((current) => ({ ...current, login: event.target.value }))
                                  }
                                  fullWidth
                                />
                              </Grid>
                              <Grid item xs={12} sm={3}>
                                <TextField
                                  label="Почта"
                                  value={userForm.email}
                                  onChange={(event) =>
                                    setUserForm((current) => ({ ...current, email: event.target.value }))
                                  }
                                  fullWidth
                                />
                              </Grid>
                              <Grid item xs={12} sm={2}>
                                <TextField
                                  select
                                  label="Роль"
                                  value={userForm.role}
                                  onChange={(event) =>
                                    setUserForm((current) => ({ ...current, role: event.target.value as UserRole }))
                                  }
                                  fullWidth
                                >
                                  <MenuItem value="employee">Сотрудник</MenuItem>
                                  <MenuItem value="admin">Админ</MenuItem>
                                </TextField>
                              </Grid>
                              <Grid item xs={12} sm={2}>
                                <TextField
                                  select
                                  label="Статус"
                                  value={userForm.is_active}
                                  onChange={(event) =>
                                    setUserForm((current) => ({
                                      ...current,
                                      is_active: event.target.value as "true" | "false",
                                    }))
                                  }
                                  fullWidth
                                >
                                  <MenuItem value="true">Активен</MenuItem>
                                  <MenuItem value="false">Отключен</MenuItem>
                                </TextField>
                              </Grid>
                              <Grid item xs={12} sm={4}>
                                <TextField
                                  label={userForm.id ? "Новый пароль, если нужно сменить" : "Пароль"}
                                  type="password"
                                  value={userForm.password}
                                  onChange={(event) =>
                                    setUserForm((current) => ({ ...current, password: event.target.value }))
                                  }
                                  fullWidth
                                />
                              </Grid>
                            </Grid>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                              <Button
                                variant="contained"
                                disabled={userSaving}
                                onClick={() => {
                                  void handleSaveUser();
                                }}
                              >
                                {userSaving ? "Сохранение..." : userForm.id ? "Сохранить пользователя" : "Создать пользователя"}
                              </Button>
                              <Button
                                variant="text"
                                disabled={userSaving}
                                onClick={() => {
                                  resetUserEditor();
                                  setShowUserEditor(false);
                                }}
                              >
                                Сбросить форму
                              </Button>
                            </Stack>
                          </Stack>
                        </Paper>
                      ) : null}
                      <Typography className="muted-copy">Найдено пользователей: {usersTotal}</Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} lg={5}>
                          {userLoading ? (
                            <Stack spacing={1} alignItems="center">
                              <CircularProgress size={24} />
                              <Typography className="muted-copy">Загрузка сотрудников...</Typography>
                            </Stack>
                          ) : usersList.length > 0 ? (
                            <Stack spacing={1}>
                              {usersList.map((item) => {
                                const activeAssignments = item.assignments.filter((assignment) => isAssignmentActive(assignment)).length;
                                return (
                                  <Paper
                                    className={`document-row${selectedManagedUserId === item.id ? " document-row-active" : ""}`}
                                    key={`user-${item.id}`}
                                    elevation={0}
                                  >
                                    <Stack spacing={0.75}>
                                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                                        <Typography>{item.full_name}</Typography>
                                        <Stack direction="row" spacing={1}>
                                          <Chip size="small" variant="outlined" label={formatUserRoleLabel(item.role)} />
                                          <Chip
                                            size="small"
                                            color={item.is_active ? "success" : "default"}
                                            label={item.is_active ? "Активен" : "Отключен"}
                                          />
                                        </Stack>
                                      </Stack>
                                      <Typography className="muted-copy">
                                        {item.login} · {item.email}
                                      </Typography>
                                      <Typography className="muted-copy">
                                        Активных назначений техники: {activeAssignments}
                                      </Typography>
                                      <Stack direction="row" spacing={1}>
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          onClick={() => {
                                            setSelectedManagedUserId(item.id);
                                          }}
                                        >
                                          Открыть доступы
                                        </Button>
                                        <Button
                                          size="small"
                                          variant="text"
                                          onClick={() => handleEditUser(item)}
                                        >
                                          Редактировать
                                        </Button>
                                      </Stack>
                                    </Stack>
                                  </Paper>
                                );
                              })}
                            </Stack>
                          ) : (
                            <Typography className="muted-copy">Пользователи пока не заведены.</Typography>
                          )}
                        </Grid>
                        <Grid item xs={12} lg={7}>
                          {selectedManagedUser ? (
                            <Stack spacing={1.5}>
                              <Paper className="repair-line" elevation={0}>
                                <Stack spacing={0.75}>
                                  <Typography variant="h6">{selectedManagedUser.full_name}</Typography>
                                  <Typography className="muted-copy">
                                    {selectedManagedUser.login} · {selectedManagedUser.email}
                                  </Typography>
                                  <Typography className="muted-copy">
                                    {formatUserRoleLabel(selectedManagedUser.role)} · {selectedManagedUser.is_active ? "активен" : "отключен"}
                                  </Typography>
                                </Stack>
                              </Paper>
                              <Paper className="repair-line" elevation={0}>
                                <Stack spacing={1.25}>
                                  <Typography className="metric-label">Сброс пароля сотрудника</Typography>
                                  <Grid container spacing={1.5}>
                                    <Grid item xs={12} sm={8}>
                                      <TextField
                                        label="Новый пароль для сотрудника"
                                        type="password"
                                        value={adminResetPasswordValue}
                                        onChange={(event) => setAdminResetPasswordValue(event.target.value)}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                      <Button
                                        fullWidth
                                        variant="contained"
                                        disabled={userSaving}
                                        onClick={() => {
                                          void handleAdminResetUserPassword();
                                        }}
                                      >
                                        {userSaving ? "Сохранение..." : "Сбросить пароль"}
                                      </Button>
                                    </Grid>
                                  </Grid>
                                </Stack>
                              </Paper>
                              <Paper className="repair-line" elevation={0}>
                                <Stack spacing={1.25}>
                                  <Typography className="metric-label">Добавить технику в зону ответственности</Typography>
                                  <Grid container spacing={1.5}>
                                    <Grid item xs={12} sm={5}>
                                      <TextField
                                        label="Найти технику по госномеру, VIN, марке"
                                        value={userVehicleSearch}
                                        onChange={(event) => setUserVehicleSearch(event.target.value)}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={12} sm={3}>
                                      <TextField
                                        label="Дата начала"
                                        type="date"
                                        value={userAssignmentForm.starts_at}
                                        onChange={(event) =>
                                          setUserAssignmentForm((current) => ({ ...current, starts_at: event.target.value }))
                                        }
                                        InputLabelProps={{ shrink: true }}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={12} sm={3}>
                                      <TextField
                                        label="Дата окончания"
                                        type="date"
                                        value={userAssignmentForm.ends_at}
                                        onChange={(event) =>
                                          setUserAssignmentForm((current) => ({ ...current, ends_at: event.target.value }))
                                        }
                                        InputLabelProps={{ shrink: true }}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={12} sm={2}>
                                      <Button
                                        fullWidth
                                        variant="outlined"
                                        disabled={userVehicleSearchLoading}
                                        onClick={() => {
                                          void handleSearchVehiclesForAssignment();
                                        }}
                                      >
                                        {userVehicleSearchLoading ? "Поиск..." : "Найти"}
                                      </Button>
                                    </Grid>
                                    <Grid item xs={12}>
                                      <TextField
                                        label="Комментарий к назначению"
                                        value={userAssignmentForm.comment}
                                        onChange={(event) =>
                                          setUserAssignmentForm((current) => ({ ...current, comment: event.target.value }))
                                        }
                                        fullWidth
                                        multiline
                                        minRows={2}
                                      />
                                    </Grid>
                                  </Grid>
                                  {userVehicleSearchResults.length > 0 ? (
                                    <Stack spacing={1}>
                                      {userVehicleSearchResults.map((vehicle) => (
                                        <Paper className="repair-line" key={`assign-vehicle-${vehicle.id}`} elevation={0}>
                                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                                            <Box>
                                              <Typography>{formatVehicle(vehicle)}</Typography>
                                              <Typography className="muted-copy">
                                                {formatVehicleTypeLabel(vehicle.vehicle_type)} · {vehicle.vin || "VIN не указан"}
                                              </Typography>
                                            </Box>
                                            <Button
                                              size="small"
                                              variant="contained"
                                              disabled={userAssignmentSaving}
                                              onClick={() => {
                                                void handleCreateUserAssignment(vehicle.id);
                                              }}
                                            >
                                              Закрепить
                                            </Button>
                                          </Stack>
                                        </Paper>
                                      ))}
                                    </Stack>
                                  ) : (
                                    <Typography className="muted-copy">
                                      Введите запрос и нажмите «Найти», чтобы подобрать технику для сотрудника.
                                    </Typography>
                                  )}
                                </Stack>
                              </Paper>
                              <Paper className="repair-line" elevation={0}>
                                <Stack spacing={1.25}>
                                  <Typography className="metric-label">Текущие и прошлые назначения техники</Typography>
                                  {selectedManagedUser.assignments.length > 0 ? (
                                    <Stack spacing={1}>
                                      {selectedManagedUser.assignments.map((assignment) => (
                                        <Paper className="repair-line" key={`assignment-${assignment.id}`} elevation={0}>
                                          <Stack spacing={0.75}>
                                            <Stack direction="row" justifyContent="space-between" spacing={1}>
                                              <Typography>{formatVehicle(assignment.vehicle)}</Typography>
                                              <Chip
                                                size="small"
                                                color={isAssignmentActive(assignment) ? "success" : "default"}
                                                label={isAssignmentActive(assignment) ? "Активно" : "Закрыто"}
                                              />
                                            </Stack>
                                            <Typography className="muted-copy">
                                              {assignment.starts_at} {assignment.ends_at ? `— ${assignment.ends_at}` : "— без даты окончания"}
                                            </Typography>
                                            {assignment.comment ? (
                                              <Typography className="muted-copy">{assignment.comment}</Typography>
                                            ) : null}
                                            {isAssignmentActive(assignment) ? (
                                              <Stack direction="row" spacing={1}>
                                                <Button
                                                  size="small"
                                                  variant="text"
                                                  disabled={userAssignmentSaving}
                                                  onClick={() => {
                                                    void handleCloseUserAssignment(assignment);
                                                  }}
                                                >
                                                  Закрыть доступ сегодня
                                                </Button>
                                              </Stack>
                                            ) : null}
                                          </Stack>
                                        </Paper>
                                      ))}
                                    </Stack>
                                  ) : (
                                    <Typography className="muted-copy">За этим сотрудником техника ещё не закреплялась.</Typography>
                                  )}
                                </Stack>
                              </Paper>
                            </Stack>
                          ) : (
                            <Typography className="muted-copy">Выберите сотрудника слева, чтобы управлять доступом к технике.</Typography>
                          )}
                        </Grid>
                      </Grid>
                    </Stack>
                  </Paper>
                ) : null}

                {activeWorkspaceTab === "admin" && activeAdminTab === "services" && user?.role === "admin" ? (
                  <Paper className="workspace-panel" elevation={0}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="h5">Справочник сервисов</Typography>
                        <Typography className="muted-copy">
                          Каталог сервисов для OCR, ручной правки ремонтов и нормализации названий.
                        </Typography>
                      </Box>
                      <Grid container spacing={1.5}>
                        <Grid item xs={12} sm={5}>
                          <TextField
                            label="Поиск по названию, городу или контакту"
                            value={serviceQuery}
                            onChange={(event) => setServiceQuery(event.target.value)}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            select
                            label="Город"
                            value={serviceCityFilter}
                            onChange={(event) => setServiceCityFilter(event.target.value)}
                            fullWidth
                          >
                            <MenuItem value="">Все города</MenuItem>
                            {serviceCities.map((city) => (
                              <MenuItem key={city} value={city}>
                                {city}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid item xs={12} sm={3}>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button variant="outlined" onClick={() => void handleServiceSearch()} disabled={serviceLoading}>
                              {serviceLoading ? "Загрузка..." : "Обновить"}
                            </Button>
                            <Button
                              variant="text"
                              disabled={serviceLoading}
                              onClick={() => {
                                setServiceQuery("");
                                setServiceCityFilter("");
                                if (token) {
                                  void loadServices(token, "", "");
                                }
                              }}
                            >
                              Сбросить
                            </Button>
                          </Stack>
                        </Grid>
                      </Grid>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button
                          variant={showServiceEditor ? "outlined" : "contained"}
                          onClick={() => setShowServiceEditor((current) => !current)}
                        >
                          {showServiceEditor ? "Скрыть карточку сервиса" : "Открыть форму редактирования"}
                        </Button>
                      </Stack>
                      {showServiceEditor ? (
                        <Paper className="repair-line" elevation={0}>
                          <Stack spacing={1.25}>
                            <Typography className="metric-label">
                              Редактирование карточки сервиса
                            </Typography>
                            <Typography className="muted-copy">
                              Сервисы из папки `Сервисы` синхронизируются автоматически. При необходимости можно добавить сервис вручную.
                            </Typography>
                            <Grid container spacing={1.5}>
                              <Grid item xs={12} sm={4}>
                                <TextField
                                  label="Название"
                                  value={serviceForm.name}
                                  onChange={(event) =>
                                    setServiceForm((current) => ({ ...current, name: event.target.value }))
                                  }
                                  fullWidth
                                />
                              </Grid>
                              <Grid item xs={12} sm={3}>
                                <TextField
                                  label="Город"
                                  value={serviceForm.city}
                                  onChange={(event) =>
                                    setServiceForm((current) => ({ ...current, city: event.target.value }))
                                  }
                                  fullWidth
                                />
                              </Grid>
                              <Grid item xs={12} sm={3}>
                                <TextField
                                  label="Контакт"
                                  value={serviceForm.contact}
                                  onChange={(event) =>
                                    setServiceForm((current) => ({ ...current, contact: event.target.value }))
                                  }
                                  fullWidth
                                />
                              </Grid>
                              <Grid item xs={12} sm={2}>
                                <TextField
                                  select
                                  label="Статус"
                                  value={serviceForm.status}
                                  onChange={(event) =>
                                    setServiceForm((current) => ({
                                      ...current,
                                      status: event.target.value as ServiceStatus,
                                    }))
                                  }
                                  fullWidth
                                >
                                  <MenuItem value="preliminary">Предварительный</MenuItem>
                                  <MenuItem value="confirmed">Подтверждён</MenuItem>
                                  <MenuItem value="archived">Архив</MenuItem>
                                </TextField>
                              </Grid>
                              <Grid item xs={12}>
                                <TextField
                                  label="Комментарий"
                                  value={serviceForm.comment}
                                  onChange={(event) =>
                                    setServiceForm((current) => ({ ...current, comment: event.target.value }))
                                  }
                                  fullWidth
                                  multiline
                                  minRows={2}
                                />
                              </Grid>
                            </Grid>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                              <Button
                                variant="contained"
                                disabled={serviceSaving}
                                onClick={() => {
                                  void handleSaveService();
                                }}
                              >
                                {serviceSaving ? "Сохранение..." : serviceForm.id ? "Сохранить сервис" : "Создать сервис"}
                              </Button>
                              <Button
                                variant="text"
                                disabled={serviceSaving}
                                onClick={() => {
                                  resetServiceEditor();
                                  setShowServiceEditor(false);
                                }}
                              >
                                Сбросить форму
                              </Button>
                            </Stack>
                          </Stack>
                        </Paper>
                      ) : null}
                      <Typography className="muted-copy">
                        В справочнике сервисов {services.length} записей по текущему фильтру.
                      </Typography>
                      {serviceLoading ? (
                        <Stack spacing={1} alignItems="center">
                          <CircularProgress size={24} />
                          <Typography className="muted-copy">Загрузка сервисов...</Typography>
                        </Stack>
                      ) : services.length > 0 ? (
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                          <Button
                            variant="outlined"
                            onClick={() => setShowServiceListDialog(true)}
                          >
                            Открыть список сервисов
                          </Button>
                          <Typography className="muted-copy">
                            Полный список сервисов скрыт с основной страницы.
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography className="muted-copy">По текущему фильтру сервисы не найдены.</Typography>
                      )}
                      <Dialog
                        open={showServiceListDialog}
                        onClose={() => setShowServiceListDialog(false)}
                        fullWidth
                        maxWidth="lg"
                      >
                        <DialogTitle>Справочник сервисов</DialogTitle>
                        <DialogContent dividers>
                          {services.length > 0 ? (
                            <Stack spacing={1}>
                              {services.map((item) => (
                                <Paper className="repair-line" key={`service-${item.id}`} elevation={0}>
                                  <Stack spacing={0.5}>
                                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                                      <Typography>{item.name}</Typography>
                                      <Chip
                                        size="small"
                                        color={item.status === "confirmed" ? "success" : item.status === "preliminary" ? "warning" : "default"}
                                        label={formatStatus(item.status)}
                                      />
                                    </Stack>
                                    <Typography className="muted-copy">
                                      {item.city || "Без города"}
                                      {item.contact ? ` · ${item.contact}` : ""}
                                    </Typography>
                                    {item.comment ? <Typography className="muted-copy">{item.comment}</Typography> : null}
                                    <Stack direction="row" spacing={1}>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => {
                                          setShowServiceListDialog(false);
                                          handleEditService(item);
                                        }}
                                      >
                                        Редактировать
                                      </Button>
                                    </Stack>
                                  </Stack>
                                </Paper>
                              ))}
                            </Stack>
                          ) : (
                            <Typography className="muted-copy">По текущему фильтру сервисы не найдены.</Typography>
                          )}
                        </DialogContent>
                      </Dialog>
                    </Stack>
                  </Paper>
                ) : null}

                {activeWorkspaceTab === "admin" && activeAdminTab === "backups" && user?.role === "admin" ? (
                  <Paper className="workspace-panel" elevation={0}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="h5">Резервные копии</Typography>
                        <Typography className="muted-copy">
                          Полный backup включает базу данных и все файлы из `storage`. Для восстановления введите точный код копии.
                        </Typography>
                      </Box>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button
                          variant="contained"
                          disabled={backupActionLoading}
                          onClick={() => {
                            void handleCreateBackup();
                          }}
                        >
                          {backupActionLoading ? "Выполнение..." : "Создать резервную копию"}
                        </Button>
                        <Button
                          variant="outlined"
                          disabled={backupsLoading || backupActionLoading}
                          onClick={() => {
                            if (token) {
                              void loadBackups(token);
                            }
                          }}
                        >
                          {backupsLoading ? "Обновление..." : "Обновить список"}
                        </Button>
                      </Stack>
                      {backupsLoading ? (
                        <Stack spacing={1} alignItems="center">
                          <CircularProgress size={24} />
                          <Typography className="muted-copy">Загрузка резервных копий...</Typography>
                        </Stack>
                      ) : backups.length > 0 ? (
                        <Stack spacing={1}>
                          {backups.map((item) => (
                            <Paper className="repair-line" key={item.backup_id} elevation={0}>
                              <Stack spacing={1}>
                                <Stack
                                  direction={{ xs: "column", sm: "row" }}
                                  spacing={1}
                                  justifyContent="space-between"
                                  alignItems={{ xs: "flex-start", sm: "center" }}
                                >
                                  <Box>
                                    <Typography>{item.filename}</Typography>
                                    <Typography className="muted-copy">
                                      Код: {item.backup_id}
                                    </Typography>
                                  </Box>
                                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    <Chip size="small" variant="outlined" label={formatStatus(item.backup_type)} />
                                    <Chip size="small" variant="outlined" label={formatStatus(item.source)} />
                                    <Chip
                                      size="small"
                                      color={item.status === "ready" ? "success" : "warning"}
                                      label={formatStatus(item.status)}
                                    />
                                  </Stack>
                                </Stack>
                                <Typography className="muted-copy">
                                  {formatDateTime(item.created_at)} · {formatFileSize(item.size_bytes)} · таблиц {item.tables_total} · файлов {item.storage_files_total}
                                </Typography>
                                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={backupActionLoading || item.status !== "ready"}
                                    onClick={() => {
                                      void handleDownloadBackup(item);
                                    }}
                                  >
                                    Скачать
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="text"
                                    color="warning"
                                    disabled={backupActionLoading || item.status !== "ready"}
                                    onClick={() => {
                                      openBackupRestoreDialog(item);
                                    }}
                                  >
                                    Восстановить
                                  </Button>
                                </Stack>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      ) : (
                        <Alert severity="info">
                          Резервные копии пока не создавались.
                        </Alert>
                      )}
                      <Dialog
                        open={backupRestoreDialogOpen}
                        onClose={closeBackupRestoreDialog}
                        fullWidth
                        maxWidth="sm"
                      >
                        <DialogTitle>Подтверждение восстановления</DialogTitle>
                        <DialogContent dividers>
                          <Stack spacing={1.5}>
                            <Alert severity="warning">
                              Восстановление перезапишет текущую базу и файлы `storage`.
                            </Alert>
                            <Typography>
                              Для подтверждения введите код копии:
                              {" "}
                              <strong>{backupRestoreTarget?.backup_id || "—"}</strong>
                            </Typography>
                            <TextField
                              fullWidth
                              label="Код резервной копии"
                              value={backupRestoreConfirmValue}
                              onChange={(event) => setBackupRestoreConfirmValue(event.target.value)}
                            />
                          </Stack>
                        </DialogContent>
                        <DialogActions>
                          <Button onClick={closeBackupRestoreDialog} disabled={backupActionLoading}>
                            Отмена
                          </Button>
                          <Button
                            color="warning"
                            variant="contained"
                            disabled={backupActionLoading || backupRestoreConfirmValue.trim() !== (backupRestoreTarget?.backup_id || "")}
                            onClick={() => {
                              void handleRestoreBackup();
                            }}
                          >
                            {backupActionLoading ? "Восстановление..." : "Восстановить"}
                          </Button>
                        </DialogActions>
                      </Dialog>
                    </Stack>
                  </Paper>
                ) : null}

                {activeWorkspaceTab === "admin" && activeAdminTab === "control" && user?.role === "admin" ? (
                  <Paper className="workspace-panel" elevation={0}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="h5">Правила OCR и очереди проверки</Typography>
                        <Typography className="muted-copy">
                          Настройка причин ручной проверки, весов приоритета и группы приоритета без участия разработчика.
                        </Typography>
                      </Box>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button
                          variant={showReviewRuleEditor ? "outlined" : "contained"}
                          onClick={() => setShowReviewRuleEditor((current) => !current)}
                        >
                          {showReviewRuleEditor ? "Скрыть форму правила" : "Добавить правило"}
                        </Button>
                      </Stack>
                      {showReviewRuleEditor ? (
                        <Paper className="repair-line" elevation={0}>
                          <Stack spacing={1.25}>
                            <Typography className="metric-label">
                              Создание и редактирование правила
                            </Typography>
                            <Grid container spacing={1.5}>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                select
                                label="Тип правила"
                                value={reviewRuleForm.rule_type}
                                onChange={(event) =>
                                  setReviewRuleForm((current) => ({ ...current, rule_type: event.target.value }))
                                }
                                fullWidth
                                disabled={reviewRuleForm.id !== null}
                              >
                                {["manual_review_reason", "document_status", "repair_status", "check_severity", "signal"]
                                  .filter((item, index, array) => array.indexOf(item) === index)
                                  .map((item) => (
                                    <MenuItem key={item} value={item}>
                                      {formatReviewRuleTypeLabel(item)}
                                    </MenuItem>
                                  ))}
                                {reviewRuleTypes
                                  .filter((item) => !["manual_review_reason", "document_status", "repair_status", "check_severity", "signal"].includes(item))
                                  .map((item) => (
                                    <MenuItem key={item} value={item}>
                                      {formatReviewRuleTypeLabel(item)}
                                    </MenuItem>
                                  ))}
                              </TextField>
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                label="Код"
                                value={reviewRuleForm.code}
                                onChange={(event) =>
                                  setReviewRuleForm((current) => ({ ...current, code: event.target.value }))
                                }
                                fullWidth
                                disabled={reviewRuleForm.id !== null}
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Название"
                                value={reviewRuleForm.title}
                                onChange={(event) =>
                                  setReviewRuleForm((current) => ({ ...current, title: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={2}>
                              <TextField
                                label="Вес"
                                type="number"
                                value={reviewRuleForm.weight}
                                onChange={(event) =>
                                  setReviewRuleForm((current) => ({ ...current, weight: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                select
                                label="Группа приоритета"
                                value={reviewRuleForm.bucket_override}
                                onChange={(event) =>
                                  setReviewRuleForm((current) => ({ ...current, bucket_override: event.target.value }))
                                }
                                fullWidth
                              >
                                <MenuItem value="">Без переопределения</MenuItem>
                                <MenuItem value="review">Обычный</MenuItem>
                                <MenuItem value="critical">Критичный</MenuItem>
                                <MenuItem value="suspicious">Подозрительный</MenuItem>
                              </TextField>
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                select
                                label="Активность"
                                value={reviewRuleForm.is_active}
                                onChange={(event) =>
                                  setReviewRuleForm((current) => ({
                                    ...current,
                                    is_active: event.target.value as "true" | "false",
                                  }))
                                }
                                fullWidth
                              >
                                <MenuItem value="true">Активно</MenuItem>
                                <MenuItem value="false">Отключено</MenuItem>
                              </TextField>
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                label="Порядок"
                                type="number"
                                value={reviewRuleForm.sort_order}
                                onChange={(event) =>
                                  setReviewRuleForm((current) => ({ ...current, sort_order: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                label="Примечание"
                                value={reviewRuleForm.notes}
                                onChange={(event) =>
                                  setReviewRuleForm((current) => ({ ...current, notes: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                          </Grid>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                              variant="contained"
                              disabled={reviewRuleSaving}
                              onClick={() => {
                                void handleSaveReviewRule();
                              }}
                            >
                              {reviewRuleSaving ? "Сохранение..." : reviewRuleForm.id ? "Сохранить правило" : "Создать правило"}
                            </Button>
                            <Button
                              variant="text"
                              disabled={reviewRuleSaving}
                              onClick={() => {
                                resetReviewRuleEditor();
                                setShowReviewRuleEditor(false);
                              }}
                            >
                              Сбросить форму
                            </Button>
                          </Stack>
                          </Stack>
                        </Paper>
                      ) : null}
                      <Typography className="muted-copy">
                        В справочнике правил {reviewRules.length} записей.
                      </Typography>
                      {reviewRules.length > 0 ? (
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                          <Button
                            variant="outlined"
                            onClick={() => setShowReviewRuleListDialog(true)}
                          >
                            Открыть список правил
                          </Button>
                          <Typography className="muted-copy">
                            Полный список правил скрыт с основной страницы.
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography className="muted-copy">Правила пока не загружены.</Typography>
                      )}
                      <Dialog
                        open={showReviewRuleListDialog}
                        onClose={() => setShowReviewRuleListDialog(false)}
                        fullWidth
                        maxWidth="lg"
                      >
                        <DialogTitle>Правила OCR и очереди проверки</DialogTitle>
                        <DialogContent dividers>
                          {reviewRules.length > 0 ? (
                            <Stack spacing={1}>
                              {reviewRules.map((item) => (
                                <Paper className="repair-line" key={`review-rule-${item.id}`} elevation={0}>
                                  <Stack spacing={0.5}>
                                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                                      <Typography>{item.title}</Typography>
                                      <Stack direction="row" spacing={1}>
                                        <Chip
                                          size="small"
                                          color={item.is_active ? "success" : "default"}
                                          label={item.is_active ? "Активно" : "Отключено"}
                                        />
                                        <Chip size="small" variant="outlined" label={`${formatReviewRuleTypeLabel(item.rule_type)}: ${item.code}`} />
                                      </Stack>
                                    </Stack>
                                    <Typography className="muted-copy">
                                      Вес {item.weight}
                                      {item.bucket_override ? ` · группа ${formatReviewBucketLabel(item.bucket_override)}` : ""}
                                      {` · порядок ${item.sort_order}`}
                                    </Typography>
                                    {item.notes ? <Typography className="muted-copy">{item.notes}</Typography> : null}
                                    <Stack direction="row" spacing={1}>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => {
                                          setShowReviewRuleListDialog(false);
                                          handleEditReviewRule(item);
                                        }}
                                      >
                                        Редактировать
                                      </Button>
                                    </Stack>
                                  </Stack>
                                </Paper>
                              ))}
                            </Stack>
                          ) : (
                            <Typography className="muted-copy">Правила пока не загружены.</Typography>
                          )}
                        </DialogContent>
                      </Dialog>
                    </Stack>
                  </Paper>
                ) : null}

                {activeWorkspaceTab === "tech_admin" && activeTechAdminTab === "learning" && user?.role === "admin" ? (
                  <Paper className="workspace-panel" elevation={0}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="h5">Очередь обучения OCR</Typography>
                        <Typography className="muted-copy">
                          Сигналы строятся из ручных исправлений администратора и показывают, где OCR регулярно ошибается или ничего не извлекает.
                        </Typography>
                      </Box>
                      <Grid container spacing={1.5}>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            select
                            label="Статус"
                            value={ocrLearningStatusFilter}
                            onChange={(event) => setOcrLearningStatusFilter(event.target.value)}
                            fullWidth
                          >
                            <MenuItem value="">Все кроме отклонённых</MenuItem>
                            {ocrLearningStatuses.map((item) => (
                              <MenuItem key={item} value={item}>
                                {formatOcrLearningStatusLabel(item)}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            select
                            label="Поле"
                            value={ocrLearningTargetFieldFilter}
                            onChange={(event) => setOcrLearningTargetFieldFilter(event.target.value)}
                            fullWidth
                          >
                            <MenuItem value="">Все поля</MenuItem>
                            {ocrLearningTargetFields.map((item) => (
                              <MenuItem key={item} value={item}>
                                {formatOcrFieldLabel(item)}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            select
                            label="Шаблон OCR"
                            value={ocrLearningProfileScopeFilter}
                            onChange={(event) => setOcrLearningProfileScopeFilter(event.target.value)}
                            fullWidth
                          >
                            <MenuItem value="">Все шаблоны</MenuItem>
                            {ocrLearningProfileScopes.map((item) => (
                              <MenuItem key={item} value={item}>
                                {formatOcrProfileName(item)}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                      </Grid>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button
                          variant="outlined"
                          onClick={() => {
                            if (token) {
                              void loadOcrLearningSignals(token);
                            }
                          }}
                          disabled={ocrLearningLoading}
                        >
                          {ocrLearningLoading ? "Загрузка..." : "Обновить"}
                        </Button>
                        <Button
                          variant="text"
                          disabled={ocrLearningLoading}
                          onClick={() => {
                            setOcrLearningStatusFilter("");
                            setOcrLearningTargetFieldFilter("");
                            setOcrLearningProfileScopeFilter("");
                            if (token) {
                              void loadOcrLearningSignals(token, "", "", "");
                            }
                          }}
                        >
                          Сбросить фильтр
                        </Button>
                      </Stack>
                      {ocrLearningSummaries.length > 0 ? (
                        <Stack spacing={1}>
                          {ocrLearningSummaries.slice(0, 6).map((item, index) => (
                            <Paper className="repair-line" key={`ocr-learning-summary-${index}`} elevation={0}>
                              <Stack spacing={0.5}>
                                <Typography>{item.suggestion_summary}</Typography>
                                <Typography className="muted-copy">
                                  Сигналов {item.count}
                                  {item.ocr_profile_scope ? ` · шаблон ${formatOcrProfileName(item.ocr_profile_scope)}` : ""}
                                  {` · поле ${formatOcrFieldLabel(item.target_field)}`}
                                  {` · тип ${formatOcrSignalTypeLabel(item.signal_type)}`}
                                </Typography>
                                {item.example_services.length > 0 ? (
                                  <Typography className="muted-copy">
                                    Сервисы: {item.example_services.join(", ")}
                                  </Typography>
                                ) : null}
                                {item.example_filenames.length > 0 ? (
                                  <Typography className="muted-copy">
                                    Файлы: {item.example_filenames.join(", ")}
                                  </Typography>
                                ) : null}
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      ) : null}
                      {ocrLearningSignals.length > 0 ? (
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                          <Button
                            variant="outlined"
                            disabled={ocrLearningLoading}
                            onClick={() => setShowOcrLearningListDialog(true)}
                          >
                            Открыть список сигналов
                          </Button>
                          <Typography className="muted-copy">
                            На основной странице показана только сводка, полный список сигналов скрыт.
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography className="muted-copy">
                          Сигналы обучения пока не накоплены.
                        </Typography>
                      )}
                      <Dialog
                        open={showOcrLearningListDialog}
                        onClose={() => setShowOcrLearningListDialog(false)}
                        fullWidth
                        maxWidth="lg"
                      >
                        <DialogTitle>Сигналы обучения OCR</DialogTitle>
                        <DialogContent dividers>
                          {ocrLearningSignals.length > 0 ? (
                            <Stack spacing={1}>
                              {ocrLearningSignals.map((item) => (
                                <Paper className="repair-line" key={`ocr-learning-${item.id}`} elevation={0}>
                                  <Stack spacing={0.5}>
                                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                                      <Typography>
                                        {formatOcrFieldLabel(item.target_field)} · {formatOcrSignalTypeLabel(item.signal_type)}
                                      </Typography>
                                      <Stack direction="row" spacing={1}>
                                        <Chip size="small" variant="outlined" label={formatOcrLearningStatusLabel(item.status)} />
                                        {item.ocr_profile_scope ? (
                                          <Chip size="small" variant="outlined" label={formatOcrProfileName(item.ocr_profile_scope)} />
                                        ) : null}
                                      </Stack>
                                    </Stack>
                                    <Typography className="muted-copy">
                                      Ремонт #{item.repair_id}
                                      {item.document_id ? ` · документ #${item.document_id}` : ""}
                                      {item.service_name ? ` · ${item.service_name}` : ""}
                                      {item.document_filename ? ` · ${item.document_filename}` : ""}
                                    </Typography>
                                    <Typography className="muted-copy">
                                      OCR: {item.extracted_value || "не извлечено"}
                                      {` · Исправлено: ${item.corrected_value}`}
                                    </Typography>
                                    {item.suggestion_summary ? (
                                      <Typography className="muted-copy">{item.suggestion_summary}</Typography>
                                    ) : null}
                                    {item.text_excerpt ? (
                                      <Typography className="muted-copy">
                                        Фрагмент: {item.text_excerpt.slice(0, 180)}
                                        {item.text_excerpt.length > 180 ? "..." : ""}
                                      </Typography>
                                    ) : null}
                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        disabled={ocrLearningDraftId === item.id}
                                        onClick={() => {
                                          void handleLoadOcrLearningDraft(item.id, "ocr_rule");
                                        }}
                                      >
                                        В OCR-правило
                                      </Button>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        disabled={ocrLearningDraftId === item.id}
                                        onClick={() => {
                                          void handleLoadOcrLearningDraft(item.id, "matcher");
                                        }}
                                      >
                                        В правило выбора
                                      </Button>
                                      {item.status !== "reviewed" ? (
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          disabled={ocrLearningUpdateId === item.id}
                                          onClick={() => {
                                            void handleUpdateOcrLearningSignal(item.id, "reviewed");
                                          }}
                                        >
                                          Пометить просмотренным
                                        </Button>
                                      ) : null}
                                      {item.status !== "applied" ? (
                                        <Button
                                          size="small"
                                          variant="text"
                                          disabled={ocrLearningUpdateId === item.id}
                                          onClick={() => {
                                            void handleUpdateOcrLearningSignal(item.id, "applied");
                                          }}
                                        >
                                          Применить
                                        </Button>
                                      ) : null}
                                      {item.status !== "rejected" ? (
                                        <Button
                                          size="small"
                                          variant="text"
                                          disabled={ocrLearningUpdateId === item.id}
                                          onClick={() => {
                                            void handleUpdateOcrLearningSignal(item.id, "rejected");
                                          }}
                                        >
                                          Отклонить
                                        </Button>
                                      ) : null}
                                    </Stack>
                                  </Stack>
                                </Paper>
                              ))}
                            </Stack>
                          ) : (
                            <Typography className="muted-copy">
                              Сигналы обучения пока не накоплены.
                            </Typography>
                          )}
                        </DialogContent>
                      </Dialog>
                    </Stack>
                  </Paper>
                ) : null}

                {activeWorkspaceTab === "tech_admin" &&
                activeTechAdminTab === "matchers" &&
                user?.role === "admin" ? (
                  <Paper className="workspace-panel" elevation={0}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="h5">Автовыбор шаблона OCR</Typography>
                        <Typography className="muted-copy">
                          Правила выбора шаблона распознавания по типу файла, имени файла, сервису и текстовым признакам документа. Если правил нет, используется история ремонта и затем базовый шаблон.
                        </Typography>
                      </Box>
                      <Grid container spacing={1.5}>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            select
                            label="Шаблон OCR"
                            value={ocrProfileMatcherProfileFilter}
                            onChange={(event) => setOcrProfileMatcherProfileFilter(event.target.value)}
                            fullWidth
                          >
                            <MenuItem value="">Все шаблоны</MenuItem>
                            {ocrProfileMatcherProfiles.map((item) => (
                              <MenuItem key={item} value={item}>
                                {formatOcrProfileName(item)}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid item xs={12} sm={8}>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                              variant="outlined"
                              onClick={() => {
                                if (token) {
                                  void loadOcrProfileMatchers(token, ocrProfileMatcherProfileFilter);
                                }
                              }}
                            >
                              Обновить список
                            </Button>
                            <Button
                              variant="text"
                              onClick={() => {
                                setOcrProfileMatcherProfileFilter("");
                                if (token) {
                                  void loadOcrProfileMatchers(token, "");
                                }
                              }}
                            >
                              Сбросить фильтр
                            </Button>
                          </Stack>
                        </Grid>
                      </Grid>
                      <Paper className="repair-line" elevation={0}>
                        <Stack spacing={1.25}>
                          <Typography className="metric-label">
                            Создание и редактирование правила выбора шаблона
                          </Typography>
                          <Grid container spacing={1.5}>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                label="Шаблон OCR"
                                value={ocrProfileMatcherForm.profile_scope}
                                onChange={(event) =>
                                  setOcrProfileMatcherForm((current) => ({ ...current, profile_scope: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={5}>
                              <TextField
                                label="Название"
                                value={ocrProfileMatcherForm.title}
                                onChange={(event) =>
                                  setOcrProfileMatcherForm((current) => ({ ...current, title: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={2}>
                              <TextField
                                select
                                label="Тип файла"
                                value={ocrProfileMatcherForm.source_type}
                                onChange={(event) =>
                                  setOcrProfileMatcherForm((current) => ({ ...current, source_type: event.target.value }))
                                }
                                fullWidth
                              >
                                <MenuItem value="">Любой</MenuItem>
                                <MenuItem value="pdf">PDF</MenuItem>
                                <MenuItem value="image">Изображение</MenuItem>
                              </TextField>
                            </Grid>
                            <Grid item xs={12} sm={2}>
                              <TextField
                                label="Приоритет"
                                value={ocrProfileMatcherForm.priority}
                                onChange={(event) =>
                                  setOcrProfileMatcherForm((current) => ({ ...current, priority: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Шаблон имени файла"
                                value={ocrProfileMatcherForm.filename_pattern}
                                onChange={(event) =>
                                  setOcrProfileMatcherForm((current) => ({ ...current, filename_pattern: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Текстовый признак"
                                value={ocrProfileMatcherForm.text_pattern}
                                onChange={(event) =>
                                  setOcrProfileMatcherForm((current) => ({ ...current, text_pattern: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Признак сервиса"
                                value={ocrProfileMatcherForm.service_name_pattern}
                                onChange={(event) =>
                                  setOcrProfileMatcherForm((current) => ({
                                    ...current,
                                    service_name_pattern: event.target.value,
                                  }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                select
                                label="Активность"
                                value={ocrProfileMatcherForm.is_active}
                                onChange={(event) =>
                                  setOcrProfileMatcherForm((current) => ({
                                    ...current,
                                    is_active: event.target.value as "true" | "false",
                                  }))
                                }
                                fullWidth
                              >
                                <MenuItem value="true">Активно</MenuItem>
                                <MenuItem value="false">Отключено</MenuItem>
                              </TextField>
                            </Grid>
                            <Grid item xs={12} sm={9}>
                              <TextField
                                label="Примечание"
                                value={ocrProfileMatcherForm.notes}
                                onChange={(event) =>
                                  setOcrProfileMatcherForm((current) => ({ ...current, notes: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                          </Grid>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                              variant="contained"
                              disabled={ocrProfileMatcherSaving}
                              onClick={() => {
                                void handleSaveOcrProfileMatcher();
                              }}
                            >
                              {ocrProfileMatcherSaving
                                ? "Сохранение..."
                                : ocrProfileMatcherForm.id
                                  ? "Сохранить правило выбора"
                                  : "Создать правило выбора"}
                            </Button>
                            <Button variant="text" disabled={ocrProfileMatcherSaving} onClick={resetOcrProfileMatcherEditor}>
                              Сбросить форму
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                      <Typography className="muted-copy">
                        В правилах выбора шаблона {ocrProfileMatchers.length} записей.
                      </Typography>
                      {ocrProfileMatchers.length > 0 ? (
                        <Stack spacing={1}>
                          {ocrProfileMatchers.map((item) => (
                            <Paper className="repair-line" key={`ocr-matcher-${item.id}`} elevation={0}>
                              <Stack spacing={0.5}>
                                <Stack direction="row" justifyContent="space-between" spacing={1}>
                                  <Typography>{item.title}</Typography>
                                  <Stack direction="row" spacing={1}>
                                    <Chip
                                      size="small"
                                      color={item.is_active ? "success" : "default"}
                                      label={item.is_active ? "Активно" : "Отключено"}
                                    />
                                    <Chip size="small" variant="outlined" label={formatOcrProfileName(item.profile_scope)} />
                                  </Stack>
                                </Stack>
                                <Typography className="muted-copy">
                                  {item.source_type ? `тип файла ${formatSourceTypeLabel(item.source_type)} · ` : ""}
                                  {`приоритет ${item.priority}`}
                                </Typography>
                                <Typography className="muted-copy">
                                  Файл: {item.filename_pattern || "—"}
                                  {` · Текст: ${item.text_pattern || "—"}`}
                                  {` · Сервис: ${item.service_name_pattern || "—"}`}
                                </Typography>
                                {item.notes ? <Typography className="muted-copy">{item.notes}</Typography> : null}
                                <Stack direction="row" spacing={1}>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => handleEditOcrProfileMatcher(item)}
                                  >
                                    Редактировать
                                  </Button>
                                </Stack>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      ) : (
                        <Typography className="muted-copy">Правила выбора шаблона по текущему фильтру не найдены.</Typography>
                      )}
                    </Stack>
                  </Paper>
                ) : null}

                {activeWorkspaceTab === "tech_admin" &&
                activeTechAdminTab === "rules" &&
                user?.role === "admin" ? (
                  <Paper className="workspace-panel" elevation={0}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="h5">Правила извлечения полей OCR</Typography>
                        <Typography className="muted-copy">
                          Шаблоны и правила поиска для извлечения номера заказ-наряда, даты, пробега, VIN, сервиса и сумм из разных форматов документов.
                        </Typography>
                      </Box>
                      <Grid container spacing={1.5}>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            select
                            label="Шаблон OCR"
                            value={ocrRuleProfileFilter}
                            onChange={(event) => setOcrRuleProfileFilter(event.target.value)}
                            fullWidth
                          >
                            <MenuItem value="">Все шаблоны</MenuItem>
                            {ocrRuleProfiles.map((item) => (
                              <MenuItem key={item} value={item}>
                                {formatOcrProfileName(item)}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid item xs={12} sm={8}>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                              variant="outlined"
                              onClick={() => {
                                if (token) {
                                  void loadOcrRules(token, ocrRuleProfileFilter);
                                }
                              }}
                            >
                              Обновить список
                            </Button>
                            <Button
                              variant="text"
                              onClick={() => {
                                setOcrRuleProfileFilter("");
                                if (token) {
                                  void loadOcrRules(token, "");
                                }
                              }}
                            >
                              Сбросить фильтр
                            </Button>
                          </Stack>
                        </Grid>
                      </Grid>
                      <Paper className="repair-line" elevation={0}>
                        <Stack spacing={1.25}>
                          <Typography className="metric-label">
                            Создание и редактирование OCR-правила
                          </Typography>
                          <Grid container spacing={1.5}>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                label="Шаблон OCR"
                                value={ocrRuleForm.profile_scope}
                                onChange={(event) =>
                                  setOcrRuleForm((current) => ({ ...current, profile_scope: event.target.value }))
                                }
                                helperText="Например: Базовый или код шаблона сервиса"
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                select
                                label="Поле"
                                value={ocrRuleForm.target_field}
                                onChange={(event) =>
                                  setOcrRuleForm((current) => ({ ...current, target_field: event.target.value }))
                                }
                                fullWidth
                              >
                                {[
                                  "order_number",
                                  "repair_date",
                                  "mileage",
                                  "plate_number",
                                  "vin",
                                  "service_name",
                                  "work_total",
                                  "parts_total",
                                  "vat_total",
                                  "grand_total",
                                  ...ocrRuleTargetFields.filter(
                                    (item) =>
                                      ![
                                        "order_number",
                                        "repair_date",
                                        "mileage",
                                        "plate_number",
                                        "vin",
                                        "service_name",
                                        "work_total",
                                        "parts_total",
                                        "vat_total",
                                        "grand_total",
                                      ].includes(item),
                                  ),
                                ].map((item) => (
                                  <MenuItem key={item} value={item}>
                                    {formatOcrFieldLabel(item)}
                                  </MenuItem>
                                ))}
                              </TextField>
                            </Grid>
                            <Grid item xs={12} sm={2}>
                              <TextField
                                select
                                label="Обработка значения"
                                value={ocrRuleForm.value_parser}
                                onChange={(event) =>
                                  setOcrRuleForm((current) => ({ ...current, value_parser: event.target.value }))
                                }
                                fullWidth
                              >
                                <MenuItem value="raw">Без обработки</MenuItem>
                                <MenuItem value="date">Дата</MenuItem>
                                <MenuItem value="amount">Сумма</MenuItem>
                                <MenuItem value="digits_int">Целое число</MenuItem>
                              </TextField>
                            </Grid>
                            <Grid item xs={12} sm={2}>
                              <TextField
                                label="Уверенность"
                                value={ocrRuleForm.confidence}
                                onChange={(event) =>
                                  setOcrRuleForm((current) => ({ ...current, confidence: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={2}>
                              <TextField
                                label="Приоритет"
                                value={ocrRuleForm.priority}
                                onChange={(event) =>
                                  setOcrRuleForm((current) => ({ ...current, priority: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                select
                                label="Активность"
                                value={ocrRuleForm.is_active}
                                onChange={(event) =>
                                  setOcrRuleForm((current) => ({
                                    ...current,
                                    is_active: event.target.value as "true" | "false",
                                  }))
                                }
                                fullWidth
                              >
                                <MenuItem value="true">Активно</MenuItem>
                                <MenuItem value="false">Отключено</MenuItem>
                              </TextField>
                            </Grid>
                            <Grid item xs={12} sm={9}>
                              <TextField
                                label="Выражение поиска"
                                value={ocrRuleForm.pattern}
                                onChange={(event) =>
                                  setOcrRuleForm((current) => ({ ...current, pattern: event.target.value }))
                                }
                                fullWidth
                                multiline
                                minRows={3}
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <TextField
                                label="Примечание"
                                value={ocrRuleForm.notes}
                                onChange={(event) =>
                                  setOcrRuleForm((current) => ({ ...current, notes: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                          </Grid>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                              variant="contained"
                              disabled={ocrRuleSaving}
                              onClick={() => {
                                void handleSaveOcrRule();
                              }}
                            >
                              {ocrRuleSaving ? "Сохранение..." : ocrRuleForm.id ? "Сохранить OCR-правило" : "Создать OCR-правило"}
                            </Button>
                            <Button variant="text" disabled={ocrRuleSaving} onClick={resetOcrRuleEditor}>
                              Сбросить форму
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                      <Typography className="muted-copy">
                        В OCR-справочнике {ocrRules.length} правил по текущему фильтру.
                      </Typography>
                      {ocrRules.length > 0 ? (
                        <Stack spacing={1}>
                          {ocrRules.map((item) => (
                            <Paper className="repair-line" key={`ocr-rule-${item.id}`} elevation={0}>
                              <Stack spacing={0.5}>
                                <Stack direction="row" justifyContent="space-between" spacing={1}>
                                  <Typography>{formatOcrFieldLabel(item.target_field)}</Typography>
                                  <Stack direction="row" spacing={1}>
                                    <Chip
                                      size="small"
                                      color={item.is_active ? "success" : "default"}
                                      label={item.is_active ? "Активно" : "Отключено"}
                                    />
                                    <Chip size="small" variant="outlined" label={formatOcrProfileName(item.profile_scope)} />
                                  </Stack>
                                </Stack>
                                <Typography className="muted-copy">
                                  обработка {formatValueParserLabel(item.value_parser)} · уверенность {item.confidence} · приоритет {item.priority}
                                </Typography>
                                <Typography className="muted-copy" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                  {item.pattern}
                                </Typography>
                                {item.notes ? <Typography className="muted-copy">{item.notes}</Typography> : null}
                                <Stack direction="row" spacing={1}>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => handleEditOcrRule(item)}
                                  >
                                    Редактировать
                                  </Button>
                                </Stack>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      ) : (
                        <Typography className="muted-copy">OCR-правила по текущему фильтру не найдены.</Typography>
                      )}
                    </Stack>
                  </Paper>
                ) : null}

                {activeWorkspaceTab === "admin" && activeAdminTab === "imports" && user?.role === "admin" ? (
                  <Paper className="workspace-panel" elevation={0}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="h5">Импорт исторических ремонтов</Typography>
                        <Typography className="muted-copy">
                          Загрузите Excel-выгрузку вида `2025 для ИИ.xlsx`. Импорт собирает строки в ремонты, связывает их с техникой,
                          создаёт предварительные сервисы при необходимости и выносит проблемы в конфликты.
                        </Typography>
                      </Box>
                      <Paper className="repair-line" elevation={0}>
                        <Stack spacing={1.25}>
                          <Grid container spacing={1.5}>
                            <Grid item xs={12} sm={5}>
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                                <Button component="label" variant="outlined">
                                  Выбрать .xlsx
                                  <input
                                    hidden
                                    type="file"
                                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                    onChange={(event) => setHistoricalImportFile(event.target.files?.[0] ?? null)}
                                  />
                                </Button>
                                <Typography className="muted-copy">
                                  {historicalImportFile ? historicalImportFile.name : "Файл не выбран"}
                                </Typography>
                              </Stack>
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                label="Сколько новых ремонтов за запуск"
                                type="number"
                                value={historicalImportLimit}
                                onChange={(event) => setHistoricalImportLimit(event.target.value)}
                                helperText="Оставьте пустым для полного импорта"
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                <Button
                                  variant="contained"
                                  disabled={historicalImportLoading || !historicalImportFile}
                                  onClick={() => {
                                    void handleHistoricalRepairImport();
                                  }}
                                >
                                  {historicalImportLoading ? "Импорт..." : "Импортировать историю"}
                                </Button>
                                <Button
                                  variant="text"
                                  disabled={(historicalImportJobsLoading || historicalWorkReferenceLoading || importConflictsLoading) || !token}
                                  onClick={() => {
                                    if (token) {
                                      void Promise.all([
                                        loadHistoricalImportJobs(token),
                                        loadHistoricalWorkReference(token),
                                        loadImportConflicts(token),
                                      ]);
                                    }
                                  }}
                                >
                                  Обновить журнал
                                </Button>
                              </Stack>
                            </Grid>
                          </Grid>
                          <Alert severity="info">
                            Для первого запуска безопаснее идти батчами по `500-1000` новых ремонтов: дубликаты будут пропущены, конфликты
                            попадут в дашборд качества данных.
                          </Alert>
                        </Stack>
                      </Paper>

                      {historicalImportResult ? (
                        <Paper className="repair-line" elevation={0}>
                          <Stack spacing={1}>
                            <Typography className="metric-label">Последний результат импорта</Typography>
                            <Typography>
                              {historicalImportResult.source_filename} · статус {formatStatus(historicalImportResult.status)}
                            </Typography>
                            <Typography className="muted-copy">
                              Строк {historicalImportResult.rows_total} · групп ремонтов {historicalImportResult.grouped_repairs} · создано{" "}
                              {historicalImportResult.created_repairs} · дублей {historicalImportResult.duplicate_repairs} · конфликтов{" "}
                              {historicalImportResult.conflicts_created}
                            </Typography>
                            <Typography className="muted-copy">
                              Сервисов создано {historicalImportResult.created_services} · строк работ {historicalImportResult.created_works} ·
                              строк материалов {historicalImportResult.created_parts}
                            </Typography>
                            {historicalImportResult.sample_conflicts.length > 0 ? (
                              <Stack spacing={0.5}>
                                {historicalImportResult.sample_conflicts.map((item, index) => (
                                  <Typography className="muted-copy" key={`historical-import-conflict-${index}`}>
                                    {item}
                                  </Typography>
                                ))}
                              </Stack>
                            ) : null}
                            {historicalImportResult.first_repair_id ? (
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                <Button
                                  variant="outlined"
                                  onClick={() => {
                                    void openRepairByIds(null, historicalImportResult.first_repair_id as number);
                                  }}
                                >
                                  Открыть первый импортированный ремонт
                                </Button>
                              </Stack>
                            ) : null}
                          </Stack>
                        </Paper>
                      ) : null}

                      <Paper className="repair-line" elevation={0}>
                        <Stack spacing={1.25}>
                          <Box>
                            <Typography className="metric-label">Динамический справочник работ</Typography>
                            <Typography className="muted-copy">
                              Каталог собирается из архива `2025 для ИИ` и автоматически дополняется новыми подтвержденными ремонтами.
                              Его можно использовать как актуальный эталон по ценам, повторяемости и пробегам.
                            </Typography>
                          </Box>
                          <Grid container spacing={1.5}>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                fullWidth
                                label="Поиск по работе, коду или сервису"
                                value={historicalWorkReferenceQuery}
                                onChange={(event) => setHistoricalWorkReferenceQuery(event.target.value)}
                              />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                fullWidth
                                type="number"
                                label="Мин. повторений"
                                value={historicalWorkReferenceMinSamples}
                                onChange={(event) => setHistoricalWorkReferenceMinSamples(event.target.value)}
                              />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <Button
                                fullWidth
                                variant="contained"
                                disabled={historicalWorkReferenceLoading || !token}
                                onClick={() => {
                                  if (token) {
                                    void loadHistoricalWorkReference(token);
                                  }
                                }}
                              >
                                {historicalWorkReferenceLoading ? "Загрузка..." : "Обновить справочник"}
                              </Button>
                            </Grid>
                          </Grid>
                            <Typography className="muted-copy">
                              Найдено агрегированных работ: {historicalWorkReferenceTotal}
                            </Typography>
                          {historicalWorkReferenceLoading ? (
                            <Typography className="muted-copy">Собираем динамический справочник работ...</Typography>
                          ) : historicalWorkReference.length > 0 ? (
                            <Stack spacing={1}>
                              {historicalWorkReference.map((item) => (
                                <Paper className="repair-line" key={item.key} elevation={0}>
                                  <Stack spacing={0.75}>
                                    <Stack
                                      direction={{ xs: "column", sm: "row" }}
                                      spacing={1}
                                      justifyContent="space-between"
                                      alignItems={{ xs: "flex-start", sm: "center" }}
                                    >
                                      <Box>
                                        <Typography>{item.work_name}</Typography>
                                        <Typography className="muted-copy">
                                          {item.work_code ? `${item.work_code} · ` : ""}
                                          ремонтов {item.sample_repairs} · строк {item.sample_lines} · сервисов {item.services_count}
                                        </Typography>
                                      </Box>
                                      <Chip size="small" variant="outlined" label={`Медиана ${formatMoney(item.median_line_total) || "—"}`} />
                                    </Stack>
                                    <Typography className="muted-copy">
                                      Архив 2025: ремонтов {item.historical_sample_repairs} · строк {item.historical_sample_lines}
                                      {` · `}
                                      Новые подтвержденные: ремонтов {item.operational_sample_repairs} · строк {item.operational_sample_lines}
                                    </Typography>
                                    <Typography className="muted-copy">
                                      Кол-во {formatCompactNumber(item.median_quantity)} · цена {formatMoney(item.median_price) || "—"} ·
                                      диапазон {formatMoney(item.min_line_total) || "—"} - {formatMoney(item.max_line_total) || "—"}
                                    </Typography>
                                    <Typography className="muted-copy">
                                      Типы ТС: {item.vehicle_types.join(", ") || "—"}
                                      {item.median_mileage !== null ? ` · медианный пробег ${item.median_mileage}` : ""}
                                      {item.min_mileage !== null && item.max_mileage !== null ? ` · диапазон пробега ${item.min_mileage}-${item.max_mileage}` : ""}
                                      {item.median_standard_hours !== null ? ` · норма ${formatHours(item.median_standard_hours)}` : ""}
                                      {item.median_actual_hours !== null ? ` · факт ${formatHours(item.median_actual_hours)}` : ""}
                                      {item.recent_repair_date ? ` · последнее использование ${formatDateValue(item.recent_repair_date)}` : ""}
                                      {item.recent_operational_repair_date
                                        ? ` · последняя новая запись ${formatDateValue(item.recent_operational_repair_date)}`
                                        : ""}
                                    </Typography>
                                    {item.top_services.length > 0 ? (
                                      <Typography className="muted-copy">
                                        Часто встречается:{" "}
                                        {item.top_services
                                          .map((service) => `${service.service_name} (${service.samples})`)
                                          .join(", ")}
                                      </Typography>
                                    ) : null}
                                  </Stack>
                                </Paper>
                              ))}
                            </Stack>
                          ) : (
                            <Typography className="muted-copy">
                              Справочник пока пуст. Сначала импортируйте `2025 для ИИ.xlsx` или накопите подтвержденные ремонты.
                            </Typography>
                          )}
                        </Stack>
                      </Paper>

                      <Paper className="repair-line" elevation={0}>
                        <Stack spacing={1}>
                          <Typography className="metric-label">Журнал импортов</Typography>
                          {historicalImportJobsLoading ? (
                            <Typography className="muted-copy">Загрузка журнала импортов...</Typography>
                          ) : historicalImportJobs.length > 0 ? (
                            historicalImportJobs.map((job) => (
                              <Paper className="repair-line" key={`historical-job-${job.id}`} elevation={0}>
                                <Stack spacing={0.5}>
                                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                                    <Typography>{job.source_filename}</Typography>
                                    <Chip
                                      size="small"
                                      color={job.status === "failed" ? "error" : job.status === "completed_with_conflicts" ? "warning" : "default"}
                                      label={formatStatus(job.status)}
                                    />
                                  </Stack>
                                  <Typography className="muted-copy">
                                    Job #{job.id} · {formatDateTime(job.created_at)}
                                  </Typography>
                                  {job.summary ? (
                                    <Typography className="muted-copy">
                                      Создано {String(job.summary.created_repairs ?? "0")} · конфликтов{" "}
                                      {String(job.summary.conflicts_created ?? "0")} · дублей {String(job.summary.duplicate_repairs ?? "0")}
                                    </Typography>
                                  ) : null}
                                  {job.error_message ? <Typography className="muted-copy">{job.error_message}</Typography> : null}
                                </Stack>
                              </Paper>
                            ))
                          ) : (
                            <Typography className="muted-copy">Исторические импорты пока не запускались.</Typography>
                          )}
                        </Stack>
                      </Paper>

                      <Paper className="repair-line" elevation={0}>
                        <Stack spacing={1}>
                          <Typography className="metric-label">Конфликты импорта в работе</Typography>
                          {importConflictsLoading ? (
                            <Typography className="muted-copy">Загрузка конфликтов...</Typography>
                          ) : importConflicts.length > 0 ? (
                            importConflicts.map((item) => (
                              <Paper className="repair-line" key={`import-conflict-${item.id}`} elevation={0}>
                                <Stack spacing={0.75}>
                                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                                    <Typography>{item.entity_type}</Typography>
                                    <Chip size="small" color="warning" label={formatStatus(item.status)} />
                                  </Stack>
                                  <Typography className="muted-copy">
                                    {[item.conflict_key, item.source_filename, formatDateTime(item.created_at)].filter(Boolean).join(" · ")}
                                  </Typography>
                                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      onClick={() => {
                                        void openImportConflict(item.id);
                                      }}
                                    >
                                      Разобрать
                                    </Button>
                                  </Stack>
                                </Stack>
                              </Paper>
                            ))
                          ) : (
                            <Typography className="muted-copy">Открытых конфликтов импорта сейчас нет.</Typography>
                          )}
                        </Stack>
                      </Paper>
                    </Stack>
                  </Paper>
                ) : null}

                {activeWorkspaceTab === "admin" && activeAdminTab === "labor_norms" && user?.role === "admin" ? (
                  <Paper className="workspace-panel" elevation={0}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="h5">Справочник нормо-часов</Typography>
                        <Typography className="muted-copy">
                          Администратор управляет каталогами, правилами применимости, импортом и отдельными строками без участия разработчика.
                        </Typography>
                      </Box>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                          variant={showLaborNormCatalogEditor ? "outlined" : "contained"}
                          onClick={() => setShowLaborNormCatalogEditor((current) => !current)}
                        >
                          {showLaborNormCatalogEditor ? "Скрыть каталог" : "Каталоги и применимость"}
                        </Button>
                        <Button
                          variant={showLaborNormImport ? "outlined" : "contained"}
                          onClick={() => setShowLaborNormImport((current) => !current)}
                        >
                          {showLaborNormImport ? "Скрыть импорт" : "Импорт справочника"}
                        </Button>
                        <Button
                          variant={showLaborNormEntryEditor ? "outlined" : "contained"}
                          onClick={() => setShowLaborNormEntryEditor((current) => !current)}
                        >
                          {showLaborNormEntryEditor ? "Скрыть форму записи" : "Добавить запись"}
                        </Button>
                      </Stack>
                      {showLaborNormCatalogEditor ? (
                      <Paper className="repair-line" elevation={0}>
                        <Stack spacing={1.25}>
                          <Typography className="metric-label">
                            Каталоги и правила применимости
                          </Typography>
                          <Grid container spacing={1.5}>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Код каталога"
                                value={laborNormCatalogForm.scope}
                                onChange={(event) =>
                                  setLaborNormCatalogForm((current) => ({ ...current, scope: event.target.value }))
                                }
                                fullWidth
                                disabled={editingLaborNormCatalogId !== null}
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Название каталога"
                                value={laborNormCatalogForm.catalog_name}
                                onChange={(event) =>
                                  setLaborNormCatalogForm((current) => ({ ...current, catalog_name: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Семейство бренда"
                                value={laborNormCatalogForm.brand_family}
                                onChange={(event) =>
                                  setLaborNormCatalogForm((current) => ({ ...current, brand_family: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                select
                                label="Тип техники"
                                value={laborNormCatalogForm.vehicle_type}
                                onChange={(event) =>
                                  setLaborNormCatalogForm((current) => ({
                                    ...current,
                                    vehicle_type: event.target.value as "" | VehicleType,
                                  }))
                                }
                                fullWidth
                              >
                                <MenuItem value="">Любой</MenuItem>
                                <MenuItem value="truck">Грузовик</MenuItem>
                                <MenuItem value="trailer">Прицеп</MenuItem>
                              </TextField>
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                label="Год от"
                                type="number"
                                value={laborNormCatalogForm.year_from}
                                onChange={(event) =>
                                  setLaborNormCatalogForm((current) => ({ ...current, year_from: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                label="Год до"
                                type="number"
                                value={laborNormCatalogForm.year_to}
                                onChange={(event) =>
                                  setLaborNormCatalogForm((current) => ({ ...current, year_to: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                label="Приоритет"
                                type="number"
                                value={laborNormCatalogForm.priority}
                                onChange={(event) =>
                                  setLaborNormCatalogForm((current) => ({ ...current, priority: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                select
                                label="Авто-матчинг"
                                value={laborNormCatalogForm.auto_match_enabled}
                                onChange={(event) =>
                                  setLaborNormCatalogForm((current) => ({
                                    ...current,
                                    auto_match_enabled: event.target.value as "true" | "false",
                                  }))
                                }
                                fullWidth
                              >
                                <MenuItem value="true">Включён</MenuItem>
                                <MenuItem value="false">Выключен</MenuItem>
                              </TextField>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                select
                                label="Статус"
                                value={laborNormCatalogForm.status}
                                onChange={(event) =>
                                  setLaborNormCatalogForm((current) => ({ ...current, status: event.target.value }))
                                }
                                fullWidth
                              >
                                <MenuItem value="preliminary">Предварительный</MenuItem>
                                <MenuItem value="confirmed">Подтверждён</MenuItem>
                                <MenuItem value="merged">Объединён</MenuItem>
                                <MenuItem value="archived">Архив</MenuItem>
                              </TextField>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="VIN-префиксы"
                                value={laborNormCatalogForm.vin_prefixes}
                                onChange={(event) =>
                                  setLaborNormCatalogForm((current) => ({ ...current, vin_prefixes: event.target.value }))
                                }
                                helperText="По одному значению в строке"
                                fullWidth
                                multiline
                                minRows={3}
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Ключевые бренды"
                                value={laborNormCatalogForm.brand_keywords}
                                onChange={(event) =>
                                  setLaborNormCatalogForm((current) => ({ ...current, brand_keywords: event.target.value }))
                                }
                                helperText="Например: dongfeng, dfh4180"
                                fullWidth
                                multiline
                                minRows={3}
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Ключевые модели"
                                value={laborNormCatalogForm.model_keywords}
                                onChange={(event) =>
                                  setLaborNormCatalogForm((current) => ({ ...current, model_keywords: event.target.value }))
                                }
                                helperText="Например: тягач"
                                fullWidth
                                multiline
                                minRows={3}
                              />
                            </Grid>
                            <Grid item xs={12}>
                              <TextField
                                label="Примечание"
                                value={laborNormCatalogForm.notes}
                                onChange={(event) =>
                                  setLaborNormCatalogForm((current) => ({ ...current, notes: event.target.value }))
                                }
                                fullWidth
                                multiline
                                minRows={2}
                              />
                            </Grid>
                          </Grid>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                              variant="contained"
                              disabled={laborNormCatalogSaving}
                              onClick={() => {
                                void handleSaveLaborNormCatalog();
                              }}
                            >
                              {laborNormCatalogSaving
                                ? "Сохранение..."
                                : editingLaborNormCatalogId
                                  ? "Сохранить каталог"
                                  : "Создать каталог"}
                            </Button>
                            <Button
                              variant="text"
                              onClick={() => {
                                resetLaborNormCatalogEditor();
                                setShowLaborNormCatalogEditor(false);
                              }}
                              disabled={laborNormCatalogSaving}
                            >
                              Сбросить форму
                            </Button>
                          </Stack>
                          {laborNormCatalogs.length > 0 ? (
                            <Stack spacing={1}>
                              {laborNormCatalogs.map((item) => (
                                <Paper className="repair-line" key={`catalog-${item.id}`} elevation={0}>
                                  <Stack spacing={0.75}>
                                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                                      <Typography>{item.catalog_name}</Typography>
                                      <Stack direction="row" spacing={1}>
                                        <Chip
                                          size="small"
                                          color={item.auto_match_enabled ? "success" : "default"}
                                          label={item.auto_match_enabled ? "Авто-матчинг" : "Только вручную"}
                                        />
                                        <Chip size="small" variant="outlined" label={formatCatalogCodeLabel(item.scope)} />
                                      </Stack>
                                    </Stack>
                                    <Typography className="muted-copy">
                                      {item.brand_family ? `${item.brand_family} · ` : ""}
                                      {item.vehicle_type === "truck"
                                        ? "Грузовик"
                                        : item.vehicle_type === "trailer"
                                          ? "Прицеп"
                                          : "Тип не ограничен"}
                                      {item.year_from !== null || item.year_to !== null
                                        ? ` · годы ${item.year_from ?? "—"}-${item.year_to ?? "—"}`
                                        : ""}
                                      {` · приоритет ${item.priority}`}
                                      {` · статус ${formatStatus(item.status)}`}
                                    </Typography>
                                    <Typography className="muted-copy">
                                      Бренды: {(item.brand_keywords || []).join(", ") || "—"}
                                      {` · модели: ${(item.model_keywords || []).join(", ") || "—"}`}
                                      {` · VIN: ${(item.vin_prefixes || []).join(", ") || "—"}`}
                                    </Typography>
                                    {item.notes ? <Typography className="muted-copy">{item.notes}</Typography> : null}
                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => handleEditLaborNormCatalog(item)}
                                      >
                                        Редактировать
                                      </Button>
                                      <Button
                                        size="small"
                                        variant="text"
                                        onClick={() => handleCatalogScopeSelected(item.scope)}
                                      >
                                        Использовать в импорте
                                      </Button>
                                    </Stack>
                                  </Stack>
                                </Paper>
                              ))}
                            </Stack>
                          ) : (
                            <Typography className="muted-copy">
                              Каталоги ещё не настроены.
                            </Typography>
                          )}
                        </Stack>
                      </Paper>
                      ) : null}
                      <Grid container spacing={1.5}>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            label="Поиск по коду или названию"
                            value={laborNormQuery}
                            onChange={(event) => setLaborNormQuery(event.target.value)}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            select
                            label="Каталог"
                            value={laborNormScope}
                            onChange={(event) => setLaborNormScope(event.target.value)}
                            fullWidth
                          >
                            <MenuItem value="">Все каталоги</MenuItem>
                            {laborNormScopes.map((scope) => (
                              <MenuItem key={scope} value={scope}>
                                {formatCatalogCodeLabel(scope)}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                          <TextField
                            select
                            label="Категория"
                            value={laborNormCategory}
                            onChange={(event) => setLaborNormCategory(event.target.value)}
                            fullWidth
                          >
                            <MenuItem value="">Все категории</MenuItem>
                            {laborNormCategories.map((category) => (
                              <MenuItem key={category} value={category}>
                                {category}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                      </Grid>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button variant="outlined" onClick={() => void handleLaborNormSearch()} disabled={laborNormLoading}>
                          {laborNormLoading ? "Загрузка..." : "Обновить список"}
                        </Button>
                        <Button
                          variant="text"
                          onClick={() => {
                            setLaborNormQuery("");
                            setLaborNormScope("");
                            setLaborNormCategory("");
                            if (token) {
                              void loadLaborNormCatalog(token, "", "", "");
                            }
                          }}
                          disabled={laborNormLoading}
                        >
                          Сбросить фильтр
                        </Button>
                      </Stack>
                      {showLaborNormImport ? (
                      <Paper className="repair-line" elevation={0}>
                        <Stack spacing={1.25}>
                          <Typography className="metric-label">
                            Импорт / обновление каталога
                          </Typography>
                          <Grid container spacing={1.5}>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                select
                                label="Каталог"
                                value={laborNormImportScope}
                                onChange={(event) => handleCatalogScopeSelected(event.target.value)}
                                fullWidth
                              >
                                {laborNormCatalogs.length === 0 ? (
                                  <MenuItem value="" disabled>
                                    Сначала создайте каталог
                                  </MenuItem>
                                ) : null}
                                {laborNormCatalogs.map((item) => (
                                  <MenuItem key={`import-${item.scope}`} value={item.scope}>
                                    {item.catalog_name} · {formatCatalogCodeLabel(item.scope)}
                                  </MenuItem>
                                ))}
                              </TextField>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Семейство бренда"
                                value={laborNormImportBrandFamily}
                                onChange={(event) => setLaborNormImportBrandFamily(event.target.value)}
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Название каталога"
                                value={laborNormImportCatalogName}
                                onChange={(event) => setLaborNormImportCatalogName(event.target.value)}
                                fullWidth
                              />
                            </Grid>
                          </Grid>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                            <Button component="label" variant="outlined">
                              Выбрать .xlsx/.csv
                              <input
                                hidden
                                type="file"
                                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                                onChange={(event) => setLaborNormFile(event.target.files?.[0] ?? null)}
                              />
                            </Button>
                            <Typography className="muted-copy">
                              {laborNormFile ? laborNormFile.name : "Файл не выбран"}
                            </Typography>
                          </Stack>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                              variant="contained"
                              disabled={laborNormImportLoading || !laborNormFile || !laborNormImportScope}
                              onClick={() => {
                                void handleLaborNormImport();
                              }}
                            >
                              {laborNormImportLoading ? "Импорт..." : "Импортировать справочник"}
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                      ) : null}
                      {showLaborNormEntryEditor ? (
                      <Paper className="repair-line" elevation={0}>
                        <Stack spacing={1.25}>
                          <Typography className="metric-label">
                            Ручное добавление и правка строк
                          </Typography>
                          <Grid container spacing={1.5}>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                select
                                label="Каталог"
                                value={laborNormEntryForm.scope}
                                onChange={(event) =>
                                  setLaborNormEntryForm((current) => ({ ...current, scope: event.target.value }))
                                }
                                fullWidth
                              >
                                {laborNormCatalogs.length === 0 ? (
                                  <MenuItem value="" disabled>
                                    Сначала создайте каталог
                                  </MenuItem>
                                ) : null}
                                {laborNormCatalogs.map((item) => (
                                  <MenuItem key={`entry-${item.scope}`} value={item.scope}>
                                    {item.catalog_name} · {item.scope}
                                  </MenuItem>
                                ))}
                              </TextField>
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                label="Код"
                                value={laborNormEntryForm.code}
                                onChange={(event) =>
                                  setLaborNormEntryForm((current) => ({ ...current, code: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                label="Категория"
                                value={laborNormEntryForm.category}
                                onChange={(event) =>
                                  setLaborNormEntryForm((current) => ({ ...current, category: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={3}>
                              <TextField
                                label="Нормо-часы"
                                value={laborNormEntryForm.standard_hours}
                                onChange={(event) =>
                                  setLaborNormEntryForm((current) => ({ ...current, standard_hours: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                label="Название на русском"
                                value={laborNormEntryForm.name_ru}
                                onChange={(event) =>
                                  setLaborNormEntryForm((current) => ({ ...current, name_ru: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <TextField
                                label="Альтернативное название на русском"
                                value={laborNormEntryForm.name_ru_alt}
                                onChange={(event) =>
                                  setLaborNormEntryForm((current) => ({ ...current, name_ru_alt: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Название на китайском"
                                value={laborNormEntryForm.name_cn}
                                onChange={(event) =>
                                  setLaborNormEntryForm((current) => ({ ...current, name_cn: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                              <TextField
                                label="Название на английском"
                                value={laborNormEntryForm.name_en}
                                onChange={(event) =>
                                  setLaborNormEntryForm((current) => ({ ...current, name_en: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={2}>
                              <TextField
                                label="Лист"
                                value={laborNormEntryForm.source_sheet}
                                onChange={(event) =>
                                  setLaborNormEntryForm((current) => ({ ...current, source_sheet: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={2}>
                              <TextField
                                label="Источник"
                                value={laborNormEntryForm.source_file}
                                onChange={(event) =>
                                  setLaborNormEntryForm((current) => ({ ...current, source_file: event.target.value }))
                                }
                                fullWidth
                              />
                            </Grid>
                            <Grid item xs={12} sm={2}>
                              <TextField
                                select
                                label="Статус"
                                value={laborNormEntryForm.status}
                                onChange={(event) =>
                                  setLaborNormEntryForm((current) => ({ ...current, status: event.target.value }))
                                }
                                fullWidth
                              >
                                <MenuItem value="preliminary">Предварительный</MenuItem>
                                <MenuItem value="confirmed">Подтверждён</MenuItem>
                                <MenuItem value="merged">Объединён</MenuItem>
                                <MenuItem value="archived">Архив</MenuItem>
                              </TextField>
                            </Grid>
                          </Grid>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                              variant="contained"
                              disabled={laborNormEntrySaving}
                              onClick={() => {
                                void handleSaveLaborNormEntry();
                              }}
                            >
                              {laborNormEntrySaving
                                ? "Сохранение..."
                                : laborNormEntryForm.id
                                  ? "Сохранить запись"
                                  : "Создать запись"}
                            </Button>
                            <Button
                              variant="text"
                              disabled={laborNormEntrySaving}
                              onClick={() => {
                                resetLaborNormEntryEditor();
                                setShowLaborNormEntryEditor(false);
                              }}
                            >
                              Сбросить форму
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                      ) : null}
                      <Typography className="muted-copy">
                        В каталоге {laborNormTotal} записей
                        {laborNormSourceFiles.length > 0 ? ` · источники: ${laborNormSourceFiles.join(", ")}` : ""}
                      </Typography>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                        <Button
                          variant="outlined"
                          disabled={laborNormLoading || laborNorms.length === 0}
                          onClick={() => setShowLaborNormListDialog(true)}
                        >
                          Открыть список записей
                        </Button>
                        <Typography className="muted-copy">
                          Полный список скрыт с основной страницы, чтобы не растягивать экран.
                        </Typography>
                      </Stack>
                      {laborNormLoading ? (
                        <Stack spacing={1} alignItems="center">
                          <CircularProgress size={24} />
                          <Typography className="muted-copy">Загрузка каталога...</Typography>
                        </Stack>
                      ) : laborNorms.length === 0 ? (
                        <Typography className="muted-copy">По текущему фильтру записи не найдены.</Typography>
                      ) : null}
                      <Dialog
                        open={showLaborNormListDialog}
                        onClose={() => setShowLaborNormListDialog(false)}
                        fullWidth
                        maxWidth="lg"
                      >
                        <DialogTitle>Записи нормо-часов</DialogTitle>
                        <DialogContent dividers>
                          {laborNorms.length > 0 ? (
                            <Stack spacing={1}>
                              {laborNorms.map((item) => (
                                <Paper className="repair-line" key={item.id} elevation={0}>
                                  <Stack spacing={0.5}>
                                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                                      <Typography>{item.code} · {item.name_ru}</Typography>
                                      <Typography>{formatHours(item.standard_hours) || "—"}</Typography>
                                    </Stack>
                                    <Typography className="muted-copy">
                                      {item.catalog_name || item.scope}
                                      {item.brand_family ? ` · ${item.brand_family}` : ""}
                                      {item.category ? ` · ${item.category}` : " · Без категории"}
                                      {item.name_ru_alt ? ` · доп. название: ${item.name_ru_alt}` : ""}
                                      {` · статус ${formatStatus(item.status)}`}
                                    </Typography>
                                    <Typography className="muted-copy">
                                      Источник: {item.source_file || "—"}
                                      {item.source_sheet ? ` · лист ${item.source_sheet}` : ""}
                                    </Typography>
                                    <Stack direction="row" spacing={1} flexWrap="wrap">
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => {
                                          setShowLaborNormListDialog(false);
                                          handleEditLaborNormItem(item);
                                        }}
                                      >
                                        Редактировать
                                      </Button>
                                      {item.status !== "archived" ? (
                                        <Button
                                          size="small"
                                          variant="text"
                                          disabled={laborNormEntrySaving}
                                          onClick={() => {
                                            void handleArchiveLaborNormItem(item);
                                          }}
                                        >
                                          В архив
                                        </Button>
                                      ) : null}
                                    </Stack>
                                  </Stack>
                                </Paper>
                              ))}
                            </Stack>
                          ) : (
                            <Typography className="muted-copy">По текущему фильтру записи не найдены.</Typography>
                          )}
                        </DialogContent>
                      </Dialog>
                    </Stack>
                  </Paper>
                ) : null}

                {activeWorkspaceTab === "repair" ? (
                  <Box sx={{ width: "100%", maxWidth: 1120, mx: "auto" }}>
                    <Stack spacing={2}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                      >
                        {repairHasReturnTarget ? (
                          <Button variant="text" onClick={returnFromRepairPage}>
                            {workspaceTabReturnLabels[repairReturnTabRef.current]}
                          </Button>
                        ) : <Box />}
                        <Typography className="muted-copy">
                          Отчёт открыт отдельной страницей и выведен по центру экрана.
                        </Typography>
                      </Stack>
                      <Paper className="workspace-panel" elevation={0}>
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="h5">Карточка ремонта</Typography>
                          <Typography className="muted-copy">
                            Сначала короткий вывод для руководителя, затем полная расшифровка проверки по кнопке и все рабочие детали ремонта.
                          </Typography>
                        </Box>
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
                                    <Paper className="repair-line repair-review-split" elevation={0}>
                                      <Stack spacing={1.25} sx={{ height: "100%" }}>
                                        <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                                          <Box>
                                            <Typography variant="subtitle1">Документ</Typography>
                                            <Typography className="muted-copy">{selectedRepairDocument.original_filename}</Typography>
                                          </Box>
                                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                                            <Chip size="small" variant="outlined" label={formatDocumentKind(selectedRepairDocument.kind)} />
                                            <Chip
                                              size="small"
                                              color={statusColor(selectedRepairDocument.status as DocumentStatus)}
                                              label={formatDocumentStatusLabel(selectedRepairDocument.status)}
                                            />
                                          </Stack>
                                        </Stack>
                                        <Typography className="muted-copy">
                                          {formatDateTime(selectedRepairDocument.created_at)} · {formatSourceTypeLabel(selectedRepairDocument.source_type)}
                                          {" · "}OCR {formatConfidence(selectedRepairDocument.ocr_confidence)}
                                        </Typography>
                                        <Box className="repair-review-preview">
                                          {reviewDocumentPreviewLoading ? (
                                            <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ minHeight: 320 }}>
                                              <CircularProgress size={24} />
                                              <Typography className="muted-copy">Загружаю превью документа...</Typography>
                                            </Stack>
                                          ) : reviewDocumentPreviewKind === "image" && reviewDocumentPreviewUrl ? (
                                            <Box
                                              component="img"
                                              src={reviewDocumentPreviewUrl}
                                              alt={selectedRepairDocument.original_filename}
                                              sx={{
                                                width: "100%",
                                                maxHeight: 520,
                                                objectFit: "contain",
                                                display: "block",
                                                borderRadius: 2,
                                              }}
                                            />
                                          ) : reviewDocumentPreviewKind === "pdf" && reviewDocumentPreviewUrl ? (
                                            <Box
                                              component="iframe"
                                              src={reviewDocumentPreviewUrl}
                                              title={selectedRepairDocument.original_filename}
                                              sx={{
                                                width: "100%",
                                                minHeight: { xs: 360, lg: 520 },
                                                border: 0,
                                                borderRadius: 2,
                                                backgroundColor: "#fff",
                                              }}
                                            />
                                          ) : (
                                            <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ minHeight: 320 }}>
                                              <Typography className="muted-copy">
                                                Для этого типа файла встроенное превью недоступно.
                                              </Typography>
                                            </Stack>
                                          )}
                                        </Box>
                                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            disabled={documentOpenLoadingId === selectedRepairDocument.id}
                                            onClick={() => {
                                              void handleOpenDocumentFile(selectedRepairDocument.id);
                                            }}
                                          >
                                            {documentOpenLoadingId === selectedRepairDocument.id ? "Открытие..." : "Открыть отдельно"}
                                          </Button>
                                          <Typography className="muted-copy">
                                            Версий OCR: {selectedRepairDocument.versions.length}
                                          </Typography>
                                        </Stack>
                                      </Stack>
                                    </Paper>
                                  </Grid>
                                  <Grid item xs={12} lg={6}>
                                    <Stack spacing={1.5}>
                                      {canLinkVehicleFromSelectedDocument ? (
                                        <Paper className="repair-line repair-review-split" elevation={0}>
                                          <Stack spacing={1.25}>
                                            <Box>
                                              <Typography variant="subtitle1">Привязка техники</Typography>
                                              <Typography className="muted-copy">
                                                Заказ-наряд пока висит на placeholder-технике. Найдите существующую карточку и перепривяжите ремонт прямо из review.
                                              </Typography>
                                            </Box>
                                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
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
                                            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                              <TextField
                                                fullWidth
                                                label="Найти технику"
                                                value={reviewVehicleSearch}
                                                onChange={(event) => setReviewVehicleSearch(event.target.value)}
                                                helperText="Поиск по госномеру, VIN, марке или модели."
                                              />
                                              <Button
                                                variant="outlined"
                                                disabled={reviewVehicleSearchLoading || reviewVehicleLinkingId !== null}
                                                onClick={() => {
                                                  void handleSearchReviewVehicles();
                                                }}
                                              >
                                                {reviewVehicleSearchLoading ? "Поиск..." : "Найти"}
                                              </Button>
                                            </Stack>
                                            {reviewVehicleSearchResults.length > 0 ? (
                                              <Stack spacing={1}>
                                                {reviewVehicleSearchResults.map((vehicle) => (
                                                  <Paper className="repair-line" key={`review-vehicle-${vehicle.id}`} elevation={0}>
                                                    <Stack
                                                      direction={{ xs: "column", sm: "row" }}
                                                      spacing={1}
                                                      justifyContent="space-between"
                                                      alignItems={{ xs: "flex-start", sm: "center" }}
                                                    >
                                                      <Box>
                                                        <Typography>{formatVehicle(vehicle)}</Typography>
                                                        <Typography className="muted-copy">
                                                          {formatVehicleTypeLabel(vehicle.vehicle_type)} · {vehicle.vin || "VIN не указан"}
                                                        </Typography>
                                                      </Box>
                                                      <Button
                                                        size="small"
                                                        variant="contained"
                                                        disabled={reviewVehicleLinkingId !== null}
                                                        onClick={() => {
                                                          void handleLinkReviewVehicle(vehicle.id);
                                                        }}
                                                      >
                                                        {reviewVehicleLinkingId === vehicle.id ? "Привязка..." : "Выбрать технику"}
                                                      </Button>
                                                    </Stack>
                                                  </Paper>
                                                ))}
                                              </Stack>
                                            ) : reviewVehicleSearch.trim() && !reviewVehicleSearchLoading ? (
                                              <Typography className="muted-copy">
                                                По этому запросу техника не найдена. {user?.role === "admin" ? "Ниже можно создать новую карточку техники." : ""}
                                              </Typography>
                                            ) : null}
                                          </Stack>
                                        </Paper>
                                      ) : null}

                                      <Paper className="repair-line repair-review-split" elevation={0}>
                                        <Stack spacing={1.25}>
                                          <Box>
                                            <Typography variant="subtitle1">Сервис ремонта</Typography>
                                            <Typography className="muted-copy">
                                              Назначьте сервис из справочника или создайте новый прямо из review.
                                            </Typography>
                                          </Box>
                                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            <Chip
                                              size="small"
                                              variant="outlined"
                                              label={`В ремонте: ${selectedRepair.service?.name || "не назначен"}`}
                                            />
                                            {selectedRepairDocumentOcrServiceName ? (
                                              <Chip
                                                size="small"
                                                variant="outlined"
                                                color="warning"
                                                label={`OCR: ${selectedRepairDocumentOcrServiceName}`}
                                              />
                                            ) : null}
                                          </Stack>
                                          <TextField
                                            fullWidth
                                            label="Выбрать сервис"
                                            value={reviewServiceName}
                                            onChange={(event) => setReviewServiceName(event.target.value)}
                                            inputProps={{ list: "review-services-list" }}
                                            helperText={
                                              services.length > 0
                                                ? "Справочник включает сервисы из папки `Сервисы` и ручные добавления."
                                                : "Список сервисов будет доступен после загрузки справочника."
                                            }
                                          />
                                          <datalist id="review-services-list">
                                            {services.map((item) => (
                                              <option key={`review-service-option-${item.id}`} value={item.name} />
                                            ))}
                                          </datalist>
                                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                            <Button
                                              variant="contained"
                                              disabled={reviewServiceAssigning || reviewServiceSaving || reviewFieldSaving || reviewVehicleLinkingId !== null}
                                              onClick={() => {
                                                void handleAssignReviewService();
                                              }}
                                            >
                                              {reviewServiceAssigning ? "Назначение..." : "Назначить сервис"}
                                            </Button>
                                            <Button
                                              variant="outlined"
                                              disabled={reviewServiceAssigning || reviewServiceSaving || reviewFieldSaving || reviewVehicleLinkingId !== null}
                                              onClick={() => {
                                                setShowReviewServiceEditor((current) => !current);
                                                setReviewServiceForm((current) => ({
                                                  ...current,
                                                  name: current.name || reviewServiceName || selectedRepairDocumentOcrServiceName,
                                                }));
                                              }}
                                            >
                                              {showReviewServiceEditor ? "Скрыть создание" : "Создать новый сервис"}
                                            </Button>
                                            {selectedRepair.service ? (
                                              <Button
                                                variant="text"
                                                disabled={reviewServiceAssigning || reviewServiceSaving || reviewFieldSaving || reviewVehicleLinkingId !== null}
                                                onClick={() => {
                                                  setReviewServiceName("");
                                                  void assignReviewService("");
                                                }}
                                              >
                                                Очистить сервис
                                              </Button>
                                            ) : null}
                                          </Stack>
                                          {showReviewServiceEditor ? (
                                            <Grid container spacing={1.5}>
                                              <Grid item xs={12} sm={6}>
                                                <TextField
                                                  fullWidth
                                                  label="Название сервиса"
                                                  value={reviewServiceForm.name}
                                                  onChange={(event) =>
                                                    setReviewServiceForm((current) => ({
                                                      ...current,
                                                      name: event.target.value,
                                                    }))
                                                  }
                                                />
                                              </Grid>
                                              <Grid item xs={12} sm={6}>
                                                <TextField
                                                  fullWidth
                                                  label="Город"
                                                  value={reviewServiceForm.city}
                                                  onChange={(event) =>
                                                    setReviewServiceForm((current) => ({
                                                      ...current,
                                                      city: event.target.value,
                                                    }))
                                                  }
                                                />
                                              </Grid>
                                              <Grid item xs={12} sm={6}>
                                                <TextField
                                                  fullWidth
                                                  label="Контакт"
                                                  value={reviewServiceForm.contact}
                                                  onChange={(event) =>
                                                    setReviewServiceForm((current) => ({
                                                      ...current,
                                                      contact: event.target.value,
                                                    }))
                                                  }
                                                />
                                              </Grid>
                                              {user?.role === "admin" ? (
                                                <Grid item xs={12} sm={6}>
                                                  <TextField
                                                    select
                                                    fullWidth
                                                    label="Статус"
                                                    value={reviewServiceForm.status}
                                                    onChange={(event) =>
                                                      setReviewServiceForm((current) => ({
                                                        ...current,
                                                        status: event.target.value as ServiceStatus,
                                                      }))
                                                    }
                                                  >
                                                    <MenuItem value="confirmed">Подтверждён</MenuItem>
                                                    <MenuItem value="preliminary">Предварительный</MenuItem>
                                                  </TextField>
                                                </Grid>
                                              ) : null}
                                              <Grid item xs={12}>
                                                <TextField
                                                  fullWidth
                                                  multiline
                                                  minRows={2}
                                                  label="Комментарий"
                                                  value={reviewServiceForm.comment}
                                                  onChange={(event) =>
                                                    setReviewServiceForm((current) => ({
                                                      ...current,
                                                      comment: event.target.value,
                                                    }))
                                                  }
                                                  helperText={
                                                    user?.role === "admin"
                                                      ? undefined
                                                      : "Сервис будет создан как предварительный и сразу станет доступен для назначения."
                                                  }
                                                />
                                              </Grid>
                                              <Grid item xs={12}>
                                                <Button
                                                  variant="contained"
                                                  disabled={reviewServiceSaving || reviewServiceAssigning}
                                                  onClick={() => {
                                                    void handleCreateReviewService();
                                                  }}
                                                >
                                                  {reviewServiceSaving ? "Создание..." : "Создать и назначить"}
                                                </Button>
                                              </Grid>
                                            </Grid>
                                          ) : null}
                                        </Stack>
                                      </Paper>

                                      <Paper className="repair-line repair-review-split" elevation={0}>
                                        <Stack spacing={1.25}>
                                          <Box>
                                            <Typography variant="subtitle1">Сверка обязательных полей</Typography>
                                            <Typography className="muted-copy">
                                              Перед подтверждением проверьте обязательные поля и при необходимости поправьте их прямо здесь.
                                            </Typography>
                                          </Box>
                                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                            <Chip
                                              size="small"
                                              color={canConfirmSelectedReview ? "success" : "warning"}
                                              label={`Готово ${reviewReadyFieldsCount}/${reviewRequiredFieldComparisons.length}`}
                                            />
                                            <Button
                                              size="small"
                                              variant="outlined"
                                              disabled={reviewFieldSaving}
                                              onClick={() => {
                                                setShowReviewFieldEditor((current) => !current);
                                              }}
                                            >
                                              {showReviewFieldEditor ? "Скрыть правки" : "Править поля"}
                                            </Button>
                                            <Button
                                              size="small"
                                              variant="text"
                                              disabled={reviewFieldSaving}
                                              onClick={fillReviewFieldDraftFromOcr}
                                            >
                                              Заполнить из OCR
                                            </Button>
                                          </Stack>
                                          {!canConfirmSelectedReview ? (
                                            <Alert severity="warning">
                                              Для подтверждения нужно заполнить: {reviewMissingRequiredFields.join(", ")}.
                                            </Alert>
                                          ) : null}
                                          <Grid container spacing={1.25}>
                                            {reviewRequiredFieldComparisons.map((item) => (
                                              <Grid item xs={12} sm={6} key={item.key}>
                                                <Paper className="repair-line" elevation={0}>
                                                  <Stack spacing={0.75}>
                                                    <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                                                      <Typography className="metric-label">{item.label}</Typography>
                                                      <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                                                        <Chip
                                                          size="small"
                                                          color={getReviewComparisonColor(item.status)}
                                                          label={getReviewComparisonLabel(item.status)}
                                                        />
                                                        <Chip
                                                          size="small"
                                                          variant="outlined"
                                                          color={getConfidenceColor(item.confidenceValue)}
                                                          label={formatConfidenceLabel(item.confidenceValue)}
                                                        />
                                                      </Stack>
                                                    </Stack>
                                                    <Typography>В ремонте: {item.currentDisplay}</Typography>
                                                    <Typography className="muted-copy">OCR: {item.ocrDisplay}</Typography>
                                                  </Stack>
                                                </Paper>
                                              </Grid>
                                            ))}
                                          </Grid>
                                          {showReviewFieldEditor && reviewFieldDraft ? (
                                            <Grid container spacing={1.5}>
                                              <Grid item xs={12} sm={6}>
                                                <TextField
                                                  fullWidth
                                                  label="Номер заказ-наряда"
                                                  value={reviewFieldDraft.order_number}
                                                  onChange={(event) => updateReviewFieldDraft("order_number", event.target.value)}
                                                />
                                              </Grid>
                                              <Grid item xs={12} sm={6}>
                                                <TextField
                                                  type="date"
                                                  fullWidth
                                                  label="Дата ремонта"
                                                  value={reviewFieldDraft.repair_date}
                                                  onChange={(event) => updateReviewFieldDraft("repair_date", event.target.value)}
                                                  InputLabelProps={{ shrink: true }}
                                                />
                                              </Grid>
                                              <Grid item xs={12} sm={6}>
                                                <TextField
                                                  fullWidth
                                                  label="Пробег"
                                                  value={reviewFieldDraft.mileage}
                                                  onChange={(event) => updateReviewFieldDraft("mileage", event.target.value)}
                                                />
                                              </Grid>
                                              <Grid item xs={12} sm={6}>
                                                <TextField
                                                  fullWidth
                                                  label="Итоговая сумма"
                                                  value={reviewFieldDraft.grand_total}
                                                  onChange={(event) => updateReviewFieldDraft("grand_total", event.target.value)}
                                                />
                                              </Grid>
                                              <Grid item xs={12} sm={4}>
                                                <TextField
                                                  fullWidth
                                                  label="Работы"
                                                  value={reviewFieldDraft.work_total}
                                                  onChange={(event) => updateReviewFieldDraft("work_total", event.target.value)}
                                                />
                                              </Grid>
                                              <Grid item xs={12} sm={4}>
                                                <TextField
                                                  fullWidth
                                                  label="Запчасти"
                                                  value={reviewFieldDraft.parts_total}
                                                  onChange={(event) => updateReviewFieldDraft("parts_total", event.target.value)}
                                                />
                                              </Grid>
                                              <Grid item xs={12} sm={4}>
                                                <TextField
                                                  fullWidth
                                                  label="НДС"
                                                  value={reviewFieldDraft.vat_total}
                                                  onChange={(event) => updateReviewFieldDraft("vat_total", event.target.value)}
                                                />
                                              </Grid>
                                              <Grid item xs={12}>
                                                <TextField
                                                  fullWidth
                                                  multiline
                                                  minRows={2}
                                                  label="Причина ремонта"
                                                  value={reviewFieldDraft.reason}
                                                  onChange={(event) => updateReviewFieldDraft("reason", event.target.value)}
                                                />
                                              </Grid>
                                              <Grid item xs={12}>
                                                <TextField
                                                  fullWidth
                                                  multiline
                                                  minRows={2}
                                                  label="Комментарий сотрудника"
                                                  value={reviewFieldDraft.employee_comment}
                                                  onChange={(event) => updateReviewFieldDraft("employee_comment", event.target.value)}
                                                />
                                              </Grid>
                                              <Grid item xs={12}>
                                                <Button
                                                  variant="contained"
                                                  disabled={reviewFieldSaving}
                                                  onClick={() => {
                                                    void handleSaveReviewFields();
                                                  }}
                                                >
                                                  {reviewFieldSaving ? "Сохранение..." : "Сохранить поля проверки"}
                                                </Button>
                                              </Grid>
                                            </Grid>
                                          ) : null}
                                        </Stack>
                                      </Paper>

                                      <Paper className="repair-line repair-review-split" elevation={0}>
                                        <Stack spacing={1.25}>
                                          <Box>
                                            <Typography variant="subtitle1">Распознанные данные</Typography>
                                            <Typography className="muted-copy">
                                              Полная сводка по шапке документа и строкам OCR перед подтверждением.
                                            </Typography>
                                          </Box>
                                          {selectedRepairDocumentFieldSnapshots.length > 0 ? (
                                            <Box className="ocr-lines-grid">
                                              {selectedRepairDocumentFieldSnapshots.map((item) => (
                                                <Paper className="ocr-line-card" key={`review-field-${item.key}`} elevation={0}>
                                                  <Stack spacing={1}>
                                                    <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                                                      <Typography className="metric-label">{item.label}</Typography>
                                                      <Chip
                                                        size="small"
                                                        variant="outlined"
                                                        color={getConfidenceColor(item.confidenceValue)}
                                                        label={formatConfidenceLabel(item.confidenceValue)}
                                                      />
                                                    </Stack>
                                                    <Typography className="ocr-line-title">{item.value}</Typography>
                                                  </Stack>
                                                </Paper>
                                              ))}
                                            </Box>
                                          ) : null}
                                          <Grid container spacing={1.5}>
                                            <Grid item xs={12} sm={6}>
                                              <Typography className="metric-label">Номер заказ-наряда</Typography>
                                              <Typography>{String(selectedRepairDocumentExtractedFields?.order_number || "—")}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                              <Typography className="metric-label">Дата ремонта</Typography>
                                              <Typography>{String(selectedRepairDocumentExtractedFields?.repair_date || "—")}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                              <Typography className="metric-label">Сервис по OCR</Typography>
                                              <Typography>{selectedRepairDocumentOcrServiceName || "—"}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                              <Typography className="metric-label">Пробег</Typography>
                                              <Typography>{String(selectedRepairDocumentExtractedFields?.mileage || "—")}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                              <Typography className="metric-label">Госномер</Typography>
                                              <Typography>{String(selectedRepairDocumentExtractedFields?.plate_number || "—")}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                              <Typography className="metric-label">VIN</Typography>
                                              <Typography>{String(selectedRepairDocumentExtractedFields?.vin || "—")}</Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                              <Typography className="metric-label">Итоговая сумма</Typography>
                                              <Typography>
                                                {typeof selectedRepairDocumentExtractedFields?.grand_total === "number"
                                                  ? formatMoney(selectedRepairDocumentExtractedFields.grand_total)
                                                  : "—"}
                                              </Typography>
                                            </Grid>
                                            <Grid item xs={12} sm={6}>
                                              <Typography className="metric-label">Строки документа</Typography>
                                              <Typography>
                                                Работ {selectedRepairDocumentWorks.length} · Запчастей {selectedRepairDocumentParts.length}
                                              </Typography>
                                            </Grid>
                                          </Grid>
                                          {Array.isArray(selectedRepairDocumentPayload?.manual_review_reasons) &&
                                          selectedRepairDocumentPayload.manual_review_reasons.length > 0 ? (
                                            <Typography className="muted-copy">
                                              Требует ручной проверки: {formatManualReviewReasons(selectedRepairDocumentPayload.manual_review_reasons)}
                                            </Typography>
                                          ) : null}
                                          {formatOcrProfileMeta(selectedRepairDocumentPayload) ? (
                                            <Typography className="muted-copy">
                                              {formatOcrProfileMeta(selectedRepairDocumentPayload)}
                                            </Typography>
                                          ) : null}
                                          {formatLaborNormApplicability(selectedRepairDocumentPayload) ? (
                                            <Typography className="muted-copy">
                                              {formatLaborNormApplicability(selectedRepairDocumentPayload)}
                                            </Typography>
                                          ) : null}
                                          {selectedRepairDocumentWorks.length > 0 ? (
                                            <Stack spacing={1}>
                                              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                                <Typography className="metric-label">Работы OCR</Typography>
                                                <Chip size="small" variant="outlined" label={`${selectedRepairDocumentWorks.length} строк`} />
                                              </Stack>
                                              <Box className="ocr-lines-grid">
                                                {selectedRepairDocumentWorks.slice(0, 8).map((item, index) => {
                                                  const name = readStringValue(item, "work_name", "name") || `Работа ${index + 1}`;
                                                  const code = readStringValue(item, "work_code");
                                                  const quantity = readNumberValue(item, "quantity");
                                                  const unitName = formatOcrLineUnit(readStringValue(item, "unit_name"));
                                                  const price = readNumberValue(item, "price");
                                                  const lineTotal = readNumberValue(item, "line_total");
                                                  const standardHours = readNumberValue(item, "standard_hours");
                                                  const actualHours = readNumberValue(item, "actual_hours");

                                                  return (
                                                    <Paper className="ocr-line-card" key={`review-work-${index}`} elevation={0}>
                                                      <Stack spacing={1}>
                                                        <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="flex-start">
                                                          <Box sx={{ minWidth: 0 }}>
                                                            <Typography className="ocr-line-title">{name}</Typography>
                                                            {code ? (
                                                              <Typography className="muted-copy">Код: {code}</Typography>
                                                            ) : null}
                                                          </Box>
                                                          <Typography className="ocr-line-total">{formatMoney(lineTotal) || "—"}</Typography>
                                                        </Stack>
                                                        <Box className="ocr-line-meta">
                                                          <span>{`Кол-во ${quantity !== null ? formatCompactNumber(quantity) : "—"}${unitName ? ` ${unitName}` : ""}`}</span>
                                                          <span>{`Цена ${formatMoney(price) || "—"}`}</span>
                                                          <span>{`Сумма ${formatMoney(lineTotal) || "—"}`}</span>
                                                          {standardHours !== null ? <span>{`Норма ${formatHours(standardHours)}`}</span> : null}
                                                          {actualHours !== null ? <span>{`Факт ${formatHours(actualHours)}`}</span> : null}
                                                        </Box>
                                                      </Stack>
                                                    </Paper>
                                                  );
                                                })}
                                              </Box>
                                              {selectedRepairDocumentWorks.length > 8 ? (
                                                <Typography className="muted-copy">
                                                  И ещё {selectedRepairDocumentWorks.length - 8} строк работ.
                                                </Typography>
                                              ) : null}
                                            </Stack>
                                          ) : null}
                                          {selectedRepairDocumentParts.length > 0 ? (
                                            <Stack spacing={1}>
                                              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                                <Typography className="metric-label">Запчасти OCR</Typography>
                                                <Chip size="small" variant="outlined" label={`${selectedRepairDocumentParts.length} строк`} />
                                              </Stack>
                                              <Box className="ocr-lines-grid">
                                                {selectedRepairDocumentParts.slice(0, 8).map((item, index) => {
                                                  const name = readStringValue(item, "part_name", "name") || `Запчасть ${index + 1}`;
                                                  const article = readStringValue(item, "article");
                                                  const quantity = readNumberValue(item, "quantity");
                                                  const unitName = formatOcrLineUnit(readStringValue(item, "unit_name"));
                                                  const price = readNumberValue(item, "price");
                                                  const lineTotal = readNumberValue(item, "line_total");

                                                  return (
                                                    <Paper className="ocr-line-card" key={`review-part-${index}`} elevation={0}>
                                                      <Stack spacing={1}>
                                                        <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="flex-start">
                                                          <Box sx={{ minWidth: 0 }}>
                                                            <Typography className="ocr-line-title">{name}</Typography>
                                                            {article ? (
                                                              <Typography className="muted-copy">Артикул: {article}</Typography>
                                                            ) : null}
                                                          </Box>
                                                          <Typography className="ocr-line-total">{formatMoney(lineTotal) || "—"}</Typography>
                                                        </Stack>
                                                        <Box className="ocr-line-meta">
                                                          <span>{`Кол-во ${quantity !== null ? formatCompactNumber(quantity) : "—"}${unitName ? ` ${unitName}` : ""}`}</span>
                                                          <span>{`Цена ${formatMoney(price) || "—"}`}</span>
                                                          <span>{`Сумма ${formatMoney(lineTotal) || "—"}`}</span>
                                                        </Box>
                                                      </Stack>
                                                    </Paper>
                                                  );
                                                })}
                                              </Box>
                                              {selectedRepairDocumentParts.length > 8 ? (
                                                <Typography className="muted-copy">
                                                  И ещё {selectedRepairDocumentParts.length - 8} строк запчастей.
                                                </Typography>
                                              ) : null}
                                            </Stack>
                                          ) : null}
                                        </Stack>
                                      </Paper>
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
                          <Stack spacing={2}>
                            {activeRepairTab === "overview" ? (
                              <Paper className="repair-summary" elevation={0}>
                              <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    label="Заказ-наряд"
                                    value={repairDraft.order_number}
                                    onChange={(event) => updateRepairDraftField("order_number", event.target.value)}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    label="Сервис"
                                    value={repairDraft.service_name}
                                    onChange={(event) => updateRepairDraftField("service_name", event.target.value)}
                                    inputProps={{ list: "known-services-list" }}
                                    helperText={services.length > 0 ? "Выберите сервис из справочника, синхронизируемого из папки `Сервисы`." : undefined}
                                    fullWidth
                                  />
                                  <datalist id="known-services-list">
                                    {services.map((item) => (
                                      <option key={`service-option-${item.id}`} value={item.name} />
                                    ))}
                                  </datalist>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    type="date"
                                    label="Дата ремонта"
                                    value={repairDraft.repair_date}
                                    onChange={(event) => updateRepairDraftField("repair_date", event.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    type="number"
                                    label="Пробег"
                                    value={repairDraft.mileage}
                                    onChange={(event) => updateRepairDraftField("mileage", Number(event.target.value))}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  <TextField
                                    type="number"
                                    label="Работы"
                                    value={repairDraft.work_total}
                                    onChange={(event) => updateRepairDraftField("work_total", Number(event.target.value))}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  <TextField
                                    type="number"
                                    label="Запчасти"
                                    value={repairDraft.parts_total}
                                    onChange={(event) => updateRepairDraftField("parts_total", Number(event.target.value))}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  <TextField
                                    type="number"
                                    label="НДС"
                                    value={repairDraft.vat_total}
                                    onChange={(event) => updateRepairDraftField("vat_total", Number(event.target.value))}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  <TextField
                                    type="number"
                                    label="Итого"
                                    value={repairDraft.grand_total}
                                    onChange={(event) => updateRepairDraftField("grand_total", Number(event.target.value))}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid item xs={12}>
                                  <TextField
                                    label="Причина ремонта"
                                    value={repairDraft.reason}
                                    onChange={(event) => updateRepairDraftField("reason", event.target.value)}
                                    fullWidth
                                    multiline
                                    minRows={2}
                                  />
                                </Grid>
                                <Grid item xs={12}>
                                  <TextField
                                    label="Комментарий сотрудника"
                                    value={repairDraft.employee_comment}
                                    onChange={(event) => updateRepairDraftField("employee_comment", event.target.value)}
                                    fullWidth
                                    multiline
                                    minRows={2}
                                  />
                                </Grid>
                              </Grid>
                              </Paper>
                            ) : null}

                            {activeRepairTab === "works" ? (
                              <Stack spacing={1}>
                              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                <Typography variant="h6">Работы</Typography>
                                <Button size="small" variant="text" onClick={addWorkDraft}>Добавить работу</Button>
                              </Stack>
                              {repairDraft.works.map((item, index) => (
                                <Paper className="repair-line" key={`work-${index}`} elevation={0}>
                                  <Grid container spacing={1.5}>
                                    <Grid item xs={12}>
                                      <TextField
                                        label="Наименование работы"
                                        value={item.work_name}
                                        onChange={(event) => updateWorkDraft(index, "work_name", event.target.value)}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        label="Код"
                                        value={item.work_code}
                                        onChange={(event) => updateWorkDraft(index, "work_code", event.target.value)}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        type="number"
                                        label="Кол-во"
                                        value={item.quantity}
                                        onChange={(event) => updateWorkDraft(index, "quantity", Number(event.target.value))}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        type="number"
                                        label="Нормо-часы"
                                        value={item.standard_hours}
                                        onChange={(event) => updateWorkDraft(index, "standard_hours", event.target.value === "" ? "" : Number(event.target.value))}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        type="number"
                                        label="Факт-часы"
                                        value={item.actual_hours}
                                        onChange={(event) => updateWorkDraft(index, "actual_hours", event.target.value === "" ? "" : Number(event.target.value))}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        type="number"
                                        label="Цена"
                                        value={item.price}
                                        onChange={(event) => updateWorkDraft(index, "price", Number(event.target.value))}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        type="number"
                                        label="Сумма"
                                        value={item.line_total}
                                        onChange={(event) => updateWorkDraft(index, "line_total", Number(event.target.value))}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={12}>
                                      <Button size="small" color="error" onClick={() => removeWorkDraft(index)}>
                                        Удалить работу
                                      </Button>
                                    </Grid>
                                  </Grid>
                                </Paper>
                              ))}
                              </Stack>
                            ) : null}

                            {activeRepairTab === "parts" ? (
                              <Stack spacing={1}>
                              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                <Typography variant="h6">Запчасти</Typography>
                                <Button size="small" variant="text" onClick={addPartDraft}>Добавить запчасть</Button>
                              </Stack>
                              {repairDraft.parts.map((item, index) => (
                                <Paper className="repair-line" key={`part-${index}`} elevation={0}>
                                  <Grid container spacing={1.5}>
                                    <Grid item xs={12}>
                                      <TextField
                                        label="Наименование запчасти"
                                        value={item.part_name}
                                        onChange={(event) => updatePartDraft(index, "part_name", event.target.value)}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        label="Артикул"
                                        value={item.article}
                                        onChange={(event) => updatePartDraft(index, "article", event.target.value)}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        label="Ед. изм."
                                        value={item.unit_name}
                                        onChange={(event) => updatePartDraft(index, "unit_name", event.target.value)}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={4}>
                                      <TextField
                                        type="number"
                                        label="Кол-во"
                                        value={item.quantity}
                                        onChange={(event) => updatePartDraft(index, "quantity", Number(event.target.value))}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={4}>
                                      <TextField
                                        type="number"
                                        label="Цена"
                                        value={item.price}
                                        onChange={(event) => updatePartDraft(index, "price", Number(event.target.value))}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={4}>
                                      <TextField
                                        type="number"
                                        label="Сумма"
                                        value={item.line_total}
                                        onChange={(event) => updatePartDraft(index, "line_total", Number(event.target.value))}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={12}>
                                      <Button size="small" color="error" onClick={() => removePartDraft(index)}>
                                        Удалить запчасть
                                      </Button>
                                    </Grid>
                                  </Grid>
                                </Paper>
                              ))}
                              </Stack>
                            ) : null}
                          </Stack>
                        ) : (
                          <>
                            {activeRepairTab === "overview" ? (
                              renderRepairOverviewReport()
                            ) : null}

                            {activeRepairTab === "documents" ? (
                              <Stack spacing={1}>
                              <Typography variant="h6">Документы ремонта</Typography>
                              {selectedRepair.status !== "archived" ? (
                                <Paper className="repair-line" elevation={0}>
                                  <Stack spacing={1.5}>
                                    <Typography className="muted-copy">
                                      Добавьте повторный скан, корректирующий файл или дополнительный документ в текущий ремонт.
                                    </Typography>
                                    <TextField
                                      select
                                      label="Вид документа"
                                      value={attachedDocumentKind}
                                      onChange={(event) =>
                                        setAttachedDocumentKind(event.target.value as DocumentKind)
                                      }
                                      fullWidth
                                    >
                                      {documentKindOptions.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                          {option.label}
                                        </MenuItem>
                                      ))}
                                    </TextField>
                                    <TextField
                                      label="Примечание к новому документу"
                                      value={attachedDocumentNotes}
                                      onChange={(event) => setAttachedDocumentNotes(event.target.value)}
                                      fullWidth
                                      multiline
                                      minRows={2}
                                    />
                                    <Stack
                                      direction={{ xs: "column", sm: "row" }}
                                      spacing={1}
                                      justifyContent="space-between"
                                      alignItems={{ xs: "flex-start", sm: "center" }}
                                    >
                                      <input
                                        ref={attachedFileInputRef}
                                        hidden
                                        type="file"
                                        accept=".pdf,image/*"
                                        onClick={(event) => {
                                          event.currentTarget.value = "";
                                        }}
                                        onChange={(event) =>
                                          setAttachedDocumentFile(event.target.files?.[0] ?? null)
                                        }
                                      />
                                      <Button variant="outlined" onClick={() => attachedFileInputRef.current?.click()}>
                                        Выбрать файл
                                      </Button>
                                      <Typography className="muted-copy">
                                        {attachedDocumentFile ? attachedDocumentFile.name : "Файл не выбран"}
                                      </Typography>
                                    </Stack>
                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                      <Button
                                        variant="contained"
                                        disabled={attachDocumentLoading || !attachedDocumentFile}
                                        onClick={() => {
                                          void handleAttachDocumentToRepair();
                                        }}
                                      >
                                        {attachDocumentLoading ? "Загрузка..." : "Добавить документ"}
                                      </Button>
                                    </Stack>
                                  </Stack>
                                </Paper>
                              ) : (
                                <Alert severity="info">
                                  Архивный ремонт доступен только для просмотра и экспорта.
                                </Alert>
                              )}
                              {selectedRepair.documents.length > 0 ? (
                                selectedRepair.documents.map((document) => (
                                  <Paper className="repair-line" key={document.id} elevation={0}>
                                    <Stack spacing={1}>
                                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                        <Typography>{document.original_filename}</Typography>
                                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                          {document.is_primary ? <Chip size="small" label="основной" /> : null}
                                          <Chip size="small" variant="outlined" label={formatDocumentKind(document.kind)} />
                                          {document.latest_import_job ? (
                                            <Chip
                                              size="small"
                                              color={importJobStatusColor(document.latest_import_job.status)}
                                              label={`OCR: ${formatStatus(document.latest_import_job.status)}`}
                                            />
                                          ) : null}
                                          <Chip
                                            size="small"
                                            color={statusColor(document.status as DocumentStatus)}
                                            label={formatDocumentStatusLabel(document.status)}
                                          />
                                        </Stack>
                                      </Stack>
                                      <Typography className="muted-copy">
                                        {formatDateTime(document.created_at)} · {formatSourceTypeLabel(document.source_type)} · OCR {formatConfidence(document.ocr_confidence)}
                                      </Typography>
                                      {document.latest_import_job ? (
                                        <Typography className="muted-copy">
                                          OCR-задача: {formatStatus(document.latest_import_job.status)}
                                          {document.latest_import_job.attempts > 0 ? ` · попытка ${document.latest_import_job.attempts}` : ""}
                                        </Typography>
                                      ) : null}
                                      {document.notes ? (
                                        <Typography className="muted-copy">{document.notes}</Typography>
                                      ) : null}
                                      {document.latest_import_job?.error_message ? (
                                        <Alert severity="warning">Ошибка OCR: {document.latest_import_job.error_message}</Alert>
                                      ) : null}
                                      <Stack direction="row" spacing={1} flexWrap="wrap">
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          disabled={documentOpenLoadingId === document.id}
                                          onClick={() => {
                                            void handleOpenDocumentFile(document.id);
                                          }}
                                        >
                                          {documentOpenLoadingId === document.id ? "Открытие..." : "Открыть файл"}
                                        </Button>
                                        {user?.role === "admin" ? (
                                          <Button
                                            size="small"
                                            variant="text"
                                            disabled={reprocessLoading || document.status === "archived" || selectedRepair.status === "archived"}
                                            onClick={() => {
                                              void handleReprocessDocumentById(document.id, selectedRepair.id);
                                            }}
                                          >
                                            {reprocessLoading && selectedDocumentId === document.id ? "Повтор..." : "Повторить OCR"}
                                          </Button>
                                        ) : null}
                                        {user?.role === "admin" &&
                                        (document.kind === "order" || document.kind === "repeat_scan") &&
                                        !document.is_primary &&
                                        document.status !== "archived" &&
                                        selectedRepair.status !== "archived" ? (
                                          <>
                                            <Button
                                              size="small"
                                              variant="text"
                                              disabled={documentComparisonLoadingId === document.id}
                                              onClick={() => {
                                                void handleCompareWithPrimary(document.id);
                                              }}
                                            >
                                              {documentComparisonLoadingId === document.id ? "Сравнение..." : "Сравнить с основным"}
                                            </Button>
                                            <Button
                                              size="small"
                                              variant="text"
                                              disabled={primaryDocumentLoadingId === document.id}
                                              onClick={() => {
                                                void handleSetPrimaryDocument(document.id);
                                              }}
                                            >
                                              {primaryDocumentLoadingId === document.id ? "Смена..." : "Сделать основным"}
                                            </Button>
                                          </>
                                        ) : null}
                                        {user?.role === "admin" &&
                                        document.status !== "archived" &&
                                        selectedRepair.status !== "archived" ? (
                                          <Button
                                            size="small"
                                            variant="text"
                                            disabled={documentArchiveLoadingId === document.id}
                                            onClick={() => {
                                              void handleArchiveDocument(document.id, selectedRepair.id);
                                            }}
                                          >
                                            {documentArchiveLoadingId === document.id ? "Архивация..." : "В архив"}
                                          </Button>
                                        ) : null}
                                      </Stack>
                                      <Stack spacing={1}>
                                        <Typography className="metric-label">
                                          Версии обработки: {document.versions.length}
                                        </Typography>
                                        {document.versions.map((version) => (
                                          <Box key={version.id}>
                                            <Typography className="muted-copy">
                                              v{version.version_number} · {formatDateTime(version.created_at)}
                                              {version.change_summary ? ` · ${version.change_summary}` : ""}
                                            </Typography>
                                            {version.parsed_payload?.processor ? (
                                              <Typography className="muted-copy">
                                                Процессор: {String(version.parsed_payload.processor)}
                                              </Typography>
                                            ) : null}
                                            {version.parsed_payload?.manual_review_reasons &&
                                            Array.isArray(version.parsed_payload.manual_review_reasons) &&
                                            version.parsed_payload.manual_review_reasons.length > 0 ? (
                                              <Typography className="muted-copy">
                                                Ручная проверка: {formatManualReviewReasons(version.parsed_payload.manual_review_reasons)}
                                              </Typography>
                                            ) : null}
                                            {formatOcrProfileMeta(version.parsed_payload) ? (
                                              <Typography className="muted-copy">
                                                {formatOcrProfileMeta(version.parsed_payload)}
                                              </Typography>
                                            ) : null}
                                            {formatLaborNormApplicability(version.parsed_payload) ? (
                                              <Typography className="muted-copy">
                                                {formatLaborNormApplicability(version.parsed_payload)}
                                              </Typography>
                                            ) : null}
                                          </Box>
                                        ))}
                                      </Stack>
                                    </Stack>
                                  </Paper>
                                ))
                              ) : (
                                <Typography className="muted-copy">Документы к ремонту пока не привязаны.</Typography>
                              )}
                              </Stack>
                            ) : null}

                            {activeRepairTab === "documents" && documentComparison ? (
                              <Stack spacing={1}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                  <Typography variant="h6">Сравнение документов</Typography>
                                  <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => {
                                      setDocumentComparison(null);
                                    }}
                                  >
                                    Закрыть
                                  </Button>
                                </Stack>
                                <Paper className="repair-line" elevation={0}>
                                  <Stack spacing={1.25}>
                                    <Typography>
                                      {documentComparison.left_document.original_filename} против {documentComparison.right_document.original_filename}
                                    </Typography>
                                    <Typography className="muted-copy">
                                      Работы: {documentComparison.works_count_left} / {documentComparison.works_count_right}
                                      {" · "}
                                      Запчасти: {documentComparison.parts_count_left} / {documentComparison.parts_count_right}
                                    </Typography>
                                    {documentComparison.compared_fields.map((field) => (
                                      <Box key={field.field_name}>
                                        <Typography className="metric-label">{field.label}</Typography>
                                        <Typography className="muted-copy">
                                          {field.left_value || "—"} / {field.right_value || "—"}
                                          {field.is_different ? " · отличается" : " · совпадает"}
                                        </Typography>
                                      </Box>
                                    ))}
                                    <TextField
                                      label="Комментарий по сверке"
                                      value={documentComparisonComment}
                                      onChange={(event) => setDocumentComparisonComment(event.target.value)}
                                      fullWidth
                                      multiline
                                      minRows={2}
                                    />
                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                      <Button
                                        variant="outlined"
                                        disabled={documentComparisonReviewLoading}
                                        onClick={() => {
                                          void handleReviewDocumentComparison("keep_current_primary");
                                        }}
                                      >
                                        {documentComparisonReviewLoading ? "Сохранение..." : "Оставить текущий основной"}
                                      </Button>
                                      <Button
                                        variant="contained"
                                        disabled={documentComparisonReviewLoading}
                                        onClick={() => {
                                          void handleReviewDocumentComparison("make_document_primary");
                                        }}
                                      >
                                        Сделать сравниваемый основным
                                      </Button>
                                      <Button
                                        variant="text"
                                        disabled={documentComparisonReviewLoading}
                                        onClick={() => {
                                          void handleReviewDocumentComparison("mark_reviewed");
                                        }}
                                      >
                                        Отметить как проверенное
                                      </Button>
                                    </Stack>
                                  </Stack>
                                </Paper>
                              </Stack>
                            ) : null}

                            {activeRepairTab === "works" ? (
                              <Stack spacing={1}>
                              <Typography variant="h6">Работы</Typography>
                              {selectedRepair.works.length > 0 ? (
                                selectedRepair.works.map((item) => (
                                  <Paper className="repair-line" key={item.id} elevation={0}>
                                    <Stack spacing={0.75}>
                                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                                        <Box>
                                          <Typography>{item.work_name}</Typography>
                                          <Typography className="muted-copy">
                                            {item.work_code ? `${item.work_code} · ` : ""}
                                            Кол-во {item.quantity}
                                            {formatHours(item.standard_hours) ? ` · норма ${formatHours(item.standard_hours)}` : ""}
                                            {formatHours(item.actual_hours) ? ` · факт ${formatHours(item.actual_hours)}` : ""}
                                          </Typography>
                                        </Box>
                                        <Typography>{formatMoney(item.line_total) || "—"}</Typography>
                                      </Stack>
                                      {formatWorkLaborNormMeta(item) ? (
                                        <Typography className="muted-copy">
                                          {formatWorkLaborNormMeta(item)}
                                        </Typography>
                                      ) : null}
                                    </Stack>
                                  </Paper>
                                ))
                              ) : (
                                <Typography className="muted-copy">Строки работ не распознаны.</Typography>
                              )}
                              </Stack>
                            ) : null}

                            {activeRepairTab === "parts" ? (
                              <Stack spacing={1}>
                              <Typography variant="h6">Запчасти</Typography>
                              {selectedRepair.parts.length > 0 ? (
                                selectedRepair.parts.map((item) => (
                                  <Paper className="repair-line" key={item.id} elevation={0}>
                                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                                      <Box>
                                        <Typography>{item.part_name}</Typography>
                                        <Typography className="muted-copy">
                                          {item.article ? `${item.article} · ` : ""}
                                          {item.quantity} {item.unit_name || "шт"}
                                        </Typography>
                                      </Box>
                                      <Typography>{formatMoney(item.line_total) || "—"}</Typography>
                                    </Stack>
                                  </Paper>
                                ))
                              ) : (
                                <Typography className="muted-copy">Строки запчастей не распознаны.</Typography>
                              )}
                              </Stack>
                            ) : null}

                            {activeRepairTab === "checks" ? (
                              <Stack spacing={1}>
                              <Typography variant="h6">Проверки</Typography>
                              {selectedRepair.checks.length > 0 ? (
                                selectedRepair.checks.map((check) => {
                                  const payloadDetails = buildCheckPayloadDetails(check);
                                  const linkedRepairId = getCheckLinkedRepairId(check);

                                  return (
                                    <Paper className="repair-line" key={check.id} elevation={0}>
                                      <Stack spacing={1}>
                                        <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                          <Typography>{check.title}</Typography>
                                          <Stack direction="row" spacing={1}>
                                            <Chip
                                              size="small"
                                              color={checkSeverityColor(check.severity)}
                                              label={formatStatus(check.severity)}
                                            />
                                            <Chip
                                              size="small"
                                              color={check.is_resolved ? "success" : "default"}
                                              label={check.is_resolved ? "решено" : "открыто"}
                                            />
                                          </Stack>
                                        </Stack>
                                        {check.details ? (
                                          <Typography className="muted-copy">{check.details}</Typography>
                                        ) : null}
                                        {payloadDetails.length > 0 ? (
                                          <Stack spacing={0.5}>
                                            {payloadDetails.map((line, index) => (
                                              <Typography className="muted-copy" key={`check-payload-${check.id}-${index}`}>
                                                {line}
                                              </Typography>
                                            ))}
                                          </Stack>
                                        ) : null}
                                        {linkedRepairId !== null ? (
                                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                            <Button
                                              size="small"
                                              variant="text"
                                              onClick={() => {
                                                void openRepairByIds(null, linkedRepairId);
                                              }}
                                            >
                                              Открыть предыдущий ремонт
                                            </Button>
                                          </Stack>
                                        ) : null}
                                        {readCheckResolutionMeta(check)?.user_name ? (
                                          <Typography className="muted-copy">
                                            Последнее действие: {readCheckResolutionMeta(check)?.user_name}
                                            {readCheckResolutionMeta(check)?.resolved_at
                                              ? ` · ${formatDateTime(String(readCheckResolutionMeta(check)?.resolved_at))}`
                                              : ""}
                                            {readCheckResolutionMeta(check)?.comment
                                              ? ` · ${String(readCheckResolutionMeta(check)?.comment)}`
                                              : ""}
                                          </Typography>
                                        ) : null}
                                        <TextField
                                          label="Комментарий по проверке"
                                          value={checkComments[check.id] || ""}
                                          onChange={(event) =>
                                            setCheckComments((current) => ({
                                              ...current,
                                              [check.id]: event.target.value,
                                            }))
                                          }
                                          fullWidth
                                          multiline
                                          minRows={2}
                                        />
                                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                          <Button
                                            size="small"
                                            variant="contained"
                                            disabled={checkActionLoadingId === check.id || check.is_resolved}
                                            onClick={() => {
                                              void handleCheckResolution(check.id, true);
                                            }}
                                          >
                                            {checkActionLoadingId === check.id ? "Сохранение..." : "Закрыть проверку"}
                                          </Button>
                                          <Button
                                            size="small"
                                            variant="outlined"
                                            disabled={checkActionLoadingId === check.id || !check.is_resolved}
                                            onClick={() => {
                                              void handleCheckResolution(check.id, false);
                                            }}
                                          >
                                            Вернуть в работу
                                          </Button>
                                        </Stack>
                                      </Stack>
                                    </Paper>
                                  );
                                })
                              ) : (
                                <Typography className="muted-copy">Подозрительные проверки не найдены.</Typography>
                              )}
                              </Stack>
                            ) : null}

                            {activeRepairTab === "history" ? (
                              <Stack spacing={1}>
                              <Typography variant="h6">Журнал событий</Typography>
                              <TextField
                                label="Поиск по истории"
                                value={historySearch}
                                onChange={(event) => setHistorySearch(event.target.value)}
                                fullWidth
                              />
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {historyFilters.map((filter) => (
                                  <Chip
                                    key={filter.key}
                                    label={filter.label}
                                    color={historyFilter === filter.key ? "primary" : "default"}
                                    variant={historyFilter === filter.key ? "filled" : "outlined"}
                                    onClick={() => {
                                      setHistoryFilter(filter.key);
                                    }}
                                  />
                                ))}
                              </Stack>
                              <Typography className="muted-copy">
                                Найдено событий: {filteredDocumentHistory.length + filteredRepairHistory.length}
                              </Typography>
                              </Stack>
                            ) : null}

                            {activeRepairTab === "history" ? (
                              <Stack spacing={1}>
                              <Typography variant="h6">История по документам</Typography>
                              {filteredDocumentHistory.length > 0 ? (
                                filteredDocumentHistory.map((entry) => (
                                  <Paper className="repair-line" key={`document-history-${entry.id}`} elevation={0}>
                                    <Stack spacing={1}>
                                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                        <Typography>
                                          {entry.user_name || "Система"} · {formatHistoryActionLabel(entry.action_type)}
                                        </Typography>
                                        <Typography className="muted-copy">{formatDateTime(entry.created_at)}</Typography>
                                      </Stack>
                                      <Typography className="muted-copy">
                                        {entry.document_filename || "Документ"}
                                        {entry.document_kind ? ` · ${formatDocumentKind(entry.document_kind)}` : ""}
                                      </Typography>
                                      {renderHistoryDetails(
                                        `document-${entry.id}`,
                                        buildDocumentHistoryDetails(entry),
                                      )}
                                    </Stack>
                                  </Paper>
                                ))
                              ) : (
                                <Typography className="muted-copy">По текущему фильтру событий по документам нет.</Typography>
                              )}
                              </Stack>
                            ) : null}

                            {activeRepairTab === "history" ? (
                              <Stack spacing={1}>
                              <Typography variant="h6">История изменений</Typography>
                              {filteredRepairHistory.length > 0 ? (
                                filteredRepairHistory.map((entry) => (
                                  <Paper className="repair-line" key={entry.id} elevation={0}>
                                    <Stack spacing={1}>
                                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                        <Typography>
                                          {entry.user_name || "Система"} · {formatHistoryActionLabel(entry.action_type)}
                                        </Typography>
                                        <Typography className="muted-copy">{formatDateTime(entry.created_at)}</Typography>
                                      </Stack>
                                      {renderHistoryDetails(
                                        `repair-${entry.id}`,
                                        buildRepairHistoryDetails(entry),
                                      )}
                                    </Stack>
                                  </Paper>
                                ))
                              ) : (
                                <Typography className="muted-copy">По текущему фильтру событий по ремонту нет.</Typography>
                              )}
                              </Stack>
                            ) : null}
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
                      </Stack>
                      </Paper>
                    </Stack>
                  </Box>
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
                  <Paper className="workspace-panel" elevation={0}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h5">Техника</Typography>
                      <Typography className="muted-copy">
                        Поиск по технике, фильтр по типу и просмотр активных связок по выбранной единице.
                      </Typography>
                    </Box>
                    {fleetViewMode === "detail" ? (
                      <Stack spacing={2}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Button variant="text" onClick={returnToFleetList}>
                            Назад к списку
                          </Button>
                          <Typography className="muted-copy">
                            Возврат сохранит фильтры и позицию списка.
                          </Typography>
                        </Stack>
                        {renderSelectedFleetVehicleDetail()}
                      </Stack>
                    ) : (
                      <Stack spacing={1.5}>
                        <Grid container spacing={1.5}>
                          <Grid item xs={12} md={4}>
                            <TextField
                              label="Поиск по VIN, госномеру, бренду или модели"
                              value={fleetQuery}
                              onChange={(event) => setFleetQuery(event.target.value)}
                              fullWidth
                            />
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              select
                              label="Тип техники"
                              value={fleetVehicleTypeFilter}
                              onChange={(event) => setFleetVehicleTypeFilter(event.target.value as "" | VehicleType)}
                              fullWidth
                            >
                              <MenuItem value="">Все</MenuItem>
                              <MenuItem value="truck">Грузовики</MenuItem>
                              <MenuItem value="trailer">Прицепы</MenuItem>
                            </TextField>
                          </Grid>
                          <Grid item xs={12} md={4}>
                            <TextField
                              select
                              label="Статус"
                              value={fleetStatusFilter}
                              onChange={(event) => setFleetStatusFilter(event.target.value as "" | VehicleStatus)}
                              fullWidth
                            >
                              <MenuItem value="">Все</MenuItem>
                              <MenuItem value="active">В работе</MenuItem>
                              <MenuItem value="in_repair">В ремонте</MenuItem>
                              <MenuItem value="waiting_repair">Ожидает ремонта</MenuItem>
                              <MenuItem value="inactive">Не используется</MenuItem>
                              <MenuItem value="decommissioned">Списан</MenuItem>
                              <MenuItem value="archived">Архив</MenuItem>
                            </TextField>
                          </Grid>
                        </Grid>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button
                            variant="outlined"
                            disabled={fleetLoading}
                            onClick={() => {
                              if (token) {
                                void loadFleetVehicles(token);
                              }
                            }}
                          >
                            {fleetLoading ? "Загрузка..." : "Обновить список"}
                          </Button>
                          <Button
                            variant="text"
                            disabled={fleetLoading}
                            onClick={() => {
                              setFleetQuery("");
                              setFleetVehicleTypeFilter("");
                              setFleetStatusFilter("");
                              if (token) {
                                void loadFleetVehicles(token, "", "", "");
                              }
                            }}
                          >
                            Сбросить фильтр
                          </Button>
                        </Stack>
                        <Typography className="muted-copy">
                          Найдено {fleetVehicles.length} из {fleetVehiclesTotal}
                        </Typography>
                        {fleetLoading ? (
                          <Stack spacing={1} alignItems="center" className="repair-placeholder">
                            <CircularProgress size={24} />
                            <Typography className="muted-copy">Загрузка списка техники...</Typography>
                          </Stack>
                        ) : fleetVehicles.length > 0 ? (
                          <Stack spacing={1}>
                            {fleetVehicles.map((vehicle) => (
                              <Paper
                                key={`fleet-${vehicle.id}`}
                                className={`document-row${selectedFleetVehicleId === vehicle.id ? " document-row-active" : ""}`}
                                elevation={0}
                              >
                                <Stack spacing={1}>
                                  <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                    <Box>
                                      <Typography>{formatVehicle(vehicle)}</Typography>
                                      <Typography className="muted-copy">
                                        {vehicle.vin || "VIN не указан"}
                                      </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1}>
                                      <Chip size="small" variant="outlined" label={formatVehicleTypeLabel(vehicle.vehicle_type)} />
                                      <Chip size="small" color={vehicleStatusColor(vehicle.status)} label={formatVehicleStatusLabel(vehicle.status)} />
                                    </Stack>
                                  </Stack>
                                  <Typography className="muted-copy">
                                    Водитель: {vehicle.current_driver_name || "не указан"}
                                    {vehicle.mechanic_name ? ` · механик: ${vehicle.mechanic_name}` : ""}
                                  </Typography>
                                  <Typography className="muted-copy">
                                    История 2025:{" "}
                                    {vehicle.historical_repairs_total > 0
                                      ? `${vehicle.historical_repairs_total} ремонтов${
                                          vehicle.historical_last_repair_date
                                            ? ` · последний ${formatDateValue(vehicle.historical_last_repair_date)}`
                                            : ""
                                        }`
                                      : "не найдена"}
                                  </Typography>
                                  <Stack direction="row" spacing={1}>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      onClick={() => {
                                        openFleetVehicleCard(vehicle.id);
                                      }}
                                    >
                                      Открыть карточку
                                    </Button>
                                  </Stack>
                                </Stack>
                              </Paper>
                            ))}
                          </Stack>
                        ) : (
                          <Typography className="muted-copy">По текущему фильтру техника не найдена.</Typography>
                        )}
                      </Stack>
                    )}
                  </Stack>
                  </Paper>
                ) : null}
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}
