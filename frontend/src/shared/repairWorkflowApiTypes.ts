import type { ReviewQueueItem } from "./workspaceBootstrapTypes";

export type ReviewActionResponse = {
  message: string;
  document_id: number;
  repair_id: number;
  document_status: string;
  repair_status: string;
  queue_item: ReviewQueueItem | null;
};

export type DocumentCreateVehicleResponse = {
  message: string;
  repair_id: number;
  created_new_vehicle: boolean;
  document: {
    id: number;
  };
};

export type DocumentComparisonReviewResponse = {
  message: string;
  action: string;
  document_id: number;
  repair_id: number;
  source_document_id: number | null;
};
