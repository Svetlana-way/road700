import type { DocumentKind, ImportJobStatus } from "./workspaceBootstrapTypes";
import type { CheckSeverity } from "./workspaceViewTypes";

export type RepairVehicleInfo = {
  id: number;
  external_id: string | null;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
};

export type RepairServiceInfo = {
  id: number;
  name: string;
  city: string | null;
};

export type RepairWorkItem = {
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
};

export type RepairPartItem = {
  id: number;
  article: string | null;
  part_name: string;
  quantity: number;
  unit_name: string | null;
  price: number;
  line_total: number;
  status: string;
};

export type RepairCheck = {
  id: number;
  check_type: string;
  severity: CheckSeverity;
  title: string;
  details: string | null;
  calculation_payload: Record<string, unknown> | null;
  is_resolved: boolean;
  created_at: string;
};

export type RepairDocumentVersion = {
  id: number;
  version_number: number;
  created_at: string;
  change_summary: string | null;
  parsed_payload: Record<string, unknown> | null;
  field_confidence_map: Record<string, unknown> | null;
};

export type RepairDocumentItem = {
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
  versions: RepairDocumentVersion[];
};

export type RepairDocumentHistoryEntry = {
  id: number;
  action_type: string;
  created_at: string;
  user_name: string | null;
  document_id: number | null;
  document_filename: string | null;
  document_kind: DocumentKind | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

export type RepairHistoryEntry = {
  id: number;
  action_type: string;
  created_at: string;
  user_name: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

export type RepairExecutiveReport = {
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

export type RepairDetail = {
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
  vehicle: RepairVehicleInfo;
  service: RepairServiceInfo | null;
  works: RepairWorkItem[];
  parts: RepairPartItem[];
  checks: RepairCheck[];
  documents: RepairDocumentItem[];
  document_history: RepairDocumentHistoryEntry[];
  history: RepairHistoryEntry[];
  executive_report: RepairExecutiveReport;
};
