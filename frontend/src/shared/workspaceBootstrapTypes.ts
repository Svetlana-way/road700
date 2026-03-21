export type UserRole = "admin" | "employee";
export type VehicleType = "truck" | "trailer";
export type VehicleStatus =
  | "active"
  | "in_repair"
  | "waiting_repair"
  | "inactive"
  | "decommissioned"
  | "archived";
export type DocumentKind = "order" | "repeat_scan" | "attachment" | "confirmation";
export type ServiceStatus = "preliminary" | "confirmed" | "archived";
export type ImportJobStatus =
  | "queued"
  | "retry"
  | "draft"
  | "processing"
  | "completed"
  | "completed_with_conflicts"
  | "failed";
export type DocumentStatus =
  | "uploaded"
  | "recognized"
  | "partially_recognized"
  | "needs_review"
  | "confirmed"
  | "ocr_error"
  | "archived";

export type DashboardSummary = {
  vehicles_total: number;
  repairs_total: number;
  repairs_draft: number;
  repairs_suspicious: number;
  documents_total: number;
  documents_review_queue: number;
};

export type DashboardDataQuality = {
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

export type DashboardDataQualityDetails = {
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

export type GlobalSearchDocumentItem = {
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

export type GlobalSearchRepairItem = {
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

export type GlobalSearchVehicleItem = {
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

export type GlobalSearchResponse = {
  query: string;
  documents_total: number;
  repairs_total: number;
  vehicles_total: number;
  documents: GlobalSearchDocumentItem[];
  repairs: GlobalSearchRepairItem[];
  vehicles: GlobalSearchVehicleItem[];
};

export type User = {
  id: number;
  full_name: string;
  login: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

export type UserAssignment = {
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

export type UserItem = User & {
  created_at: string;
  updated_at: string;
  assignments: UserAssignment[];
};

export type UsersResponse = {
  items: UserItem[];
  total: number;
};

export type Vehicle = {
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

export type VehiclesResponse = {
  items: Vehicle[];
  total: number;
  limit: number;
  offset: number;
};

export type VehicleLink = {
  id: number;
  left_vehicle_id: number;
  right_vehicle_id: number;
  starts_at: string;
  ends_at: string | null;
  comment: string | null;
};

export type VehicleActiveAssignment = {
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

export type VehicleRepairHistoryItem = {
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

export type VehicleHistorySummary = {
  repairs_total: number;
  documents_total: number;
  confirmed_repairs: number;
  suspicious_repairs: number;
  last_repair_date: string | null;
  last_mileage: number | null;
};

export type VehicleHistoricalRepairHistoryItem = {
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

export type VehicleHistoricalHistorySummary = {
  repairs_total: number;
  services_total: number;
  total_spend: number;
  first_repair_date: string | null;
  last_repair_date: string | null;
  last_mileage: number | null;
};

export type VehicleDetail = Vehicle & {
  active_links: VehicleLink[];
  active_assignments: VehicleActiveAssignment[];
  repair_history: VehicleRepairHistoryItem[];
  history_summary: VehicleHistorySummary;
  historical_repair_history: VehicleHistoricalRepairHistoryItem[];
  historical_history_summary: VehicleHistoricalHistorySummary;
};

export type VehiclePreview = {
  id: number;
  external_id?: string | null;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
};

export type ServiceItem = {
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

export type ServicesResponse = {
  items: ServiceItem[];
  total: number;
  limit: number;
  offset: number;
  cities: string[];
};

export type OcrRuleItem = {
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

export type OcrRuleResponse = {
  items: OcrRuleItem[];
  profile_scopes: string[];
  target_fields: string[];
};

export type OcrProfileMatcherItem = {
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

export type OcrProfileMatcherResponse = {
  items: OcrProfileMatcherItem[];
  profile_scopes: string[];
};

export type OcrLearningSignalItem = {
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

export type OcrLearningSummaryItem = {
  target_field: string;
  ocr_profile_scope: string | null;
  signal_type: string;
  count: number;
  suggestion_summary: string;
  example_services: string[];
  example_filenames: string[];
};

export type OcrLearningResponse = {
  items: OcrLearningSignalItem[];
  summaries: OcrLearningSummaryItem[];
  total: number;
  statuses: string[];
  target_fields: string[];
  profile_scopes: string[];
};

export type DocumentItem = {
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

export type DocumentsResponse = {
  items: DocumentItem[];
};

export type DocumentComparisonResponse = {
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

export type LaborNormCatalogItem = {
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

export type LaborNormCatalogConfigItem = {
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

export type LaborNormCatalogConfigResponse = {
  items: LaborNormCatalogConfigItem[];
  scopes: string[];
};

export type LaborNormCatalogResponse = {
  items: LaborNormCatalogItem[];
  total: number;
  limit: number;
  offset: number;
  scopes: string[];
  categories: string[];
  source_files: string[];
};

export type ReviewPriorityBucket = "review" | "critical" | "suspicious";
export type ReviewQueueCategory =
  | "all"
  | "suspicious"
  | "ocr_error"
  | "partial_recognition"
  | "employee_confirmation"
  | "manual_review";

export type ReviewQueueItem = {
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

export type ReviewQueueResponse = {
  items: ReviewQueueItem[];
  counts: Record<ReviewQueueCategory, number>;
  total: number;
  limit: number;
  offset: number;
};

export type ReviewRuleItem = {
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

export type ReviewRuleResponse = {
  items: ReviewRuleItem[];
  rule_types: string[];
};

export type SystemStatus = {
  password_recovery_delivery_mode: "email" | "manual";
  password_recovery_email_configured: boolean;
  ocr_backend: "vision" | "tesseract" | null;
  pdf_renderer: "pdftoppm" | "sips" | null;
  image_ocr_available: boolean;
  pdf_scan_ocr_available: boolean;
  vision_available: boolean;
  tesseract_available: boolean;
  pdftoppm_available: boolean;
  sips_available: boolean;
};

export type LoadedWorkspaceData = {
  me: User;
  dashboard: DashboardSummary;
  dataQualityPayload: DashboardDataQuality;
  dataQualityDetailsPayload: DashboardDataQualityDetails;
  vehicleList: VehiclesResponse;
  recentDocuments: DocumentsResponse;
  reviewQueueData: ReviewQueueResponse;
  laborNormCatalog: LaborNormCatalogResponse | null;
  laborNormCatalogConfigs: LaborNormCatalogConfigResponse | null;
  servicesPayload: ServicesResponse;
  reviewRulesPayload: ReviewRuleResponse | null;
  ocrRulesPayload: OcrRuleResponse | null;
  ocrProfileMatchersPayload: OcrProfileMatcherResponse | null;
  ocrLearningPayload: OcrLearningResponse | null;
  usersPayload: UsersResponse | null;
  systemStatusPayload: SystemStatus | null;
};
