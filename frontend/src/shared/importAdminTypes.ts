export type ImportStatus = "draft" | "processing" | "completed" | "completed_with_conflicts" | "failed";

export type HistoricalRepairImportResponse = {
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

export type HistoricalWorkReferenceServiceItem = {
  service_id: number | null;
  service_name: string;
  samples: number;
};

export type HistoricalWorkReferenceItem = {
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

export type HistoricalWorkReferenceResponse = {
  items: HistoricalWorkReferenceItem[];
  total: number;
  limit: number;
  q: string | null;
  min_samples: number;
};

export type ImportJobItem = {
  id: number;
  import_type: string;
  source_filename: string;
  status: ImportStatus;
  summary: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type ImportJobsResponse = {
  items: ImportJobItem[];
};

export type ImportConflictItem = {
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

export type ImportConflictsResponse = {
  items: ImportConflictItem[];
};

export type ImportConflictResolveResponse = {
  message: string;
  conflict: ImportConflictItem;
};
