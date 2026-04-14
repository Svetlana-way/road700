import type { OcrLearningSignalItem } from "../domain/workspace";

export type OcrLearningDraftsResponse = {
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

export type LaborNormImportResponse = {
  message: string;
  filename: string;
  imported_at: string;
  created: number;
  updated: number;
  skipped: number;
};
