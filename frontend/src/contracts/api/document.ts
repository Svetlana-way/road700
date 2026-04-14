import type { DocumentItem } from "../domain/workspace";

export type DocumentUploadResponse = {
  document: DocumentItem;
  message: string;
  job_id?: number | null;
  import_status?: string | null;
};

export type DocumentBatchProcessResponse = {
  processed_count: number;
  document_ids: number[];
  job_ids?: number[];
  status_counts: Record<string, number>;
  message: string;
};
