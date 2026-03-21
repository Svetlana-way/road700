import type { ReviewComparisonStatus } from "./repairUiHelpers";
import type { DocumentKind, ServiceStatus, UserRole, VehicleType } from "./workspaceBootstrapTypes";

export type UserFormState = {
  id: number | null;
  full_name: string;
  login: string;
  email: string;
  role: UserRole;
  is_active: "true" | "false";
  password: string;
};

export type UserAssignmentFormState = {
  starts_at: string;
  ends_at: string;
  comment: string;
};

export type ServiceFormState = {
  id: number | null;
  name: string;
  city: string;
  contact: string;
  comment: string;
  status: ServiceStatus;
};

export type OcrRuleFormState = {
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

export type OcrProfileMatcherFormState = {
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

export type LaborNormCatalogFormState = {
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

export type LaborNormEntryFormState = {
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

export type ReviewRuleFormState = {
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

export type DocumentVehicleFormState = {
  vehicle_type: VehicleType;
  plate_number: string;
  vin: string;
  brand: string;
  model: string;
  year: string;
  comment: string;
};

export type UploadFormState = {
  vehicleId: string;
  documentKind: DocumentKind;
  repairDate: string;
  mileage: string;
  orderNumber: string;
  reason: string;
  employeeComment: string;
  notes: string;
};

export type ReviewServiceForm = {
  name: string;
  city: string;
  contact: string;
  status: ServiceStatus;
  comment: string;
};

export type ReviewRepairFieldsDraft = {
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

export type ReviewRequiredFieldComparisonItem = {
  key: string;
  label: string;
  currentValue: unknown;
  ocrValue: unknown;
  currentDisplay: string;
  ocrDisplay: string;
  confidenceValue: number | null;
  status: ReviewComparisonStatus;
};

export type ReviewExtractedFieldSnapshot = {
  key: string;
  label: string;
  value: string;
  confidenceValue: number | null;
};
