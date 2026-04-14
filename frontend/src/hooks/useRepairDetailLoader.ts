import { useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { ApiError, apiRequest } from "../shared/apiCore";
import { getLatestRepairDocumentVersion } from "../entities/vehicle/helpers";
import type { RepairDocumentItem } from "../contracts/domain/repair";
import { resolveRepairDocumentId, type RepairDetailForDraft } from "../entities/repair/helpers";

type RepairDocumentVersionLike = {
  version_number?: number;
  parsed_payload: Record<string, unknown> | null;
  field_confidence_map?: Record<string, unknown> | null;
};

type RepairDocumentLike = Pick<
  RepairDocumentItem,
  | "id"
  | "mime_type"
  | "status"
  | "is_primary"
  | "ocr_confidence"
  | "review_queue_priority"
  | "notes"
  | "created_at"
  | "latest_import_job"
> & {
  versions: RepairDocumentVersionLike[];
};

type RepairDetailLike = Omit<RepairDetailForDraft, "documents"> & {
  id: number;
  vehicle?: {
    id: number;
    external_id: string | null;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  };
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
  latest_import_job?: RepairDocumentItem["latest_import_job"];
  notes: string | null;
  created_at: string;
  vehicle?: {
    id: number;
    external_id: string | null;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  };
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
  setSelectedRepair: (repair: TRepair | null) => void;
  setSelectedDocumentId: Dispatch<SetStateAction<number | null>>;
  setLastUploadedDocument: Dispatch<SetStateAction<TLastUploadedDocument | null>>;
  setCheckComments: Dispatch<SetStateAction<Record<number, string>>>;
  setHistoryFilter: (value: "all") => void;
  setHistorySearch: (value: string) => void;
  isEditingRepairRef: MutableRefObject<boolean>;
  syncRepairDraftFromRepairRef: MutableRefObject<(repair: TRepair) => void>;
  resetRepairDocumentsWorkflowStateRef: MutableRefObject<() => void>;
};

export type LoadRepairDetailResult = "loaded" | "not_found" | "error";

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
  const repairDetailRequestIdRef = useRef(0);

  async function loadRepairDetail(
    activeToken: string,
    repairId: number,
    preferredDocumentId: number | null | undefined,
    options?: { silent?: boolean; resetTransientState?: boolean },
  ): Promise<LoadRepairDetailResult> {
    const silent = options?.silent ?? false;
    const resetTransientState = options?.resetTransientState ?? true;

    if (!silent) {
      setRepairLoading(true);
      setErrorMessage("");
    }
    const requestId = repairDetailRequestIdRef.current + 1;
    repairDetailRequestIdRef.current = requestId;
    try {
      const payload = await apiRequest<TRepair>(`/repairs/${repairId}`, { method: "GET" }, activeToken);
      if (repairDetailRequestIdRef.current !== requestId) {
        return "error";
      }
      setSelectedRepair(payload);
      if (resetTransientState) {
        setCheckComments({});
        resetRepairDocumentsWorkflowStateRef.current();
        setHistoryFilter("all");
        setHistorySearch("");
      }
      setSelectedDocumentId((current) =>
        resolveRepairDocumentId(payload, preferredDocumentId !== undefined ? preferredDocumentId : current),
      );
      if (!isEditingRepairRef.current) {
        syncRepairDraftFromRepairRef.current(payload);
      }
      setLastUploadedDocument((current) => {
        if (!current) {
          return current;
        }
        const refreshedDocument = payload.documents.find((item) => item.id === current.id);
        if (!refreshedDocument) {
          return null;
        }
        const latestVersion = getLatestRepairDocumentVersion(refreshedDocument.versions);
        return {
          ...current,
          mime_type: refreshedDocument.mime_type,
          status: refreshedDocument.status,
          is_primary: refreshedDocument.is_primary,
          ocr_confidence: refreshedDocument.ocr_confidence,
          review_queue_priority: refreshedDocument.review_queue_priority,
          latest_import_job: refreshedDocument.latest_import_job,
          notes: refreshedDocument.notes,
          created_at: refreshedDocument.created_at,
          parsed_payload: latestVersion?.parsed_payload ?? null,
          vehicle: payload.vehicle ?? current.vehicle,
          repair: {
            id: payload.id,
            order_number: payload.order_number,
            repair_date: payload.repair_date,
            mileage: payload.mileage,
            status: payload.status,
          },
        } as TLastUploadedDocument;
      });
      return "loaded";
    } catch (error) {
      if (repairDetailRequestIdRef.current !== requestId) {
        return "error";
      }
      if (error instanceof ApiError && error.status === 404) {
        setSelectedRepair(null);
        setSelectedDocumentId(null);
        if (!silent) {
          setErrorMessage("Ремонт больше недоступен");
        }
        return "not_found";
      }
      if (!silent) {
        setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить ремонт");
      }
      return "error";
    } finally {
      if (!silent && repairDetailRequestIdRef.current === requestId) {
        setRepairLoading(false);
      }
    }
  }

  function invalidateRepairDetailLoaderState() {
    repairDetailRequestIdRef.current += 1;
    setRepairLoading(false);
  }

  return {
    repairLoading,
    loadRepairDetail,
    invalidateRepairDetailLoaderState,
  };
}
