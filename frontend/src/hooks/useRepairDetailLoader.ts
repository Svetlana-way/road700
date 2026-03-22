import { useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { apiRequest } from "../shared/api";
import type { RepairDocumentItem } from "../shared/repairDetailTypes";
import { resolveRepairDocumentId, type RepairDetailForDraft } from "../shared/repairUiHelpers";

type RepairDocumentVersionLike = {
  parsed_payload: Record<string, unknown> | null;
};

type RepairDocumentLike = Pick<
  RepairDocumentItem,
  "id" | "mime_type" | "status" | "is_primary" | "ocr_confidence" | "review_queue_priority" | "notes" | "created_at"
> & {
  versions: RepairDocumentVersionLike[];
};

type RepairDetailLike = Omit<RepairDetailForDraft, "documents"> & {
  id: number;
  documents: RepairDocumentLike[];
};

type LastUploadedDocumentLike = {
  id: number;
  parsed_payload?: Record<string, unknown> | null;
  mime_type?: string | null;
  status: string;
  is_primary?: boolean;
  ocr_confidence?: number | null;
  review_queue_priority?: number;
  notes: string | null;
  created_at: string;
  repair: {
    id: number;
    order_number: string | null;
    repair_date: string;
    mileage: number;
    status: string;
  };
};

type UseRepairDetailLoaderParams<TRepair extends RepairDetailLike, TLastUploadedDocument extends LastUploadedDocumentLike> = {
  setErrorMessage: (message: string) => void;
  setSelectedRepair: (repair: TRepair) => void;
  setSelectedDocumentId: Dispatch<SetStateAction<number | null>>;
  setLastUploadedDocument: Dispatch<SetStateAction<TLastUploadedDocument | null>>;
  setCheckComments: Dispatch<SetStateAction<Record<number, string>>>;
  setHistoryFilter: (value: "all") => void;
  setHistorySearch: (value: string) => void;
  isEditingRepairRef: MutableRefObject<boolean>;
  syncRepairDraftFromRepairRef: MutableRefObject<(repair: TRepair) => void>;
  resetRepairDocumentsWorkflowStateRef: MutableRefObject<() => void>;
};

export function useRepairDetailLoader<
  TRepair extends RepairDetailLike,
  TLastUploadedDocument extends LastUploadedDocumentLike,
>({
  setErrorMessage,
  setSelectedRepair,
  setSelectedDocumentId,
  setLastUploadedDocument,
  setCheckComments,
  setHistoryFilter,
  setHistorySearch,
  isEditingRepairRef,
  syncRepairDraftFromRepairRef,
  resetRepairDocumentsWorkflowStateRef,
}: UseRepairDetailLoaderParams<TRepair, TLastUploadedDocument>) {
  const [repairLoading, setRepairLoading] = useState(false);

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
      const payload = await apiRequest<TRepair>(`/repairs/${repairId}`, { method: "GET" }, activeToken);
      setSelectedRepair(payload);
      if (resetTransientState) {
        setCheckComments({});
        resetRepairDocumentsWorkflowStateRef.current();
        setHistoryFilter("all");
        setHistorySearch("");
      }
      setSelectedDocumentId((current) => resolveRepairDocumentId(payload, preferredDocumentId ?? current));
      if (!isEditingRepairRef.current) {
        syncRepairDraftFromRepairRef.current(payload);
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
          status: refreshedDocument.status,
          is_primary: refreshedDocument.is_primary,
          ocr_confidence: refreshedDocument.ocr_confidence,
          review_queue_priority: refreshedDocument.review_queue_priority,
          notes: refreshedDocument.notes,
          created_at: refreshedDocument.created_at,
          parsed_payload: latestVersion?.parsed_payload ?? current.parsed_payload,
          repair: {
            id: payload.id,
            order_number: payload.order_number,
            repair_date: payload.repair_date,
            mileage: payload.mileage,
            status: payload.status,
          },
        } as TLastUploadedDocument;
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

  return {
    repairLoading,
    loadRepairDetail,
  };
}
