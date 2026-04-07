import { useEffect, useRef, useState } from "react";
import { ApiError, apiRequest } from "../shared/api";
import type { DocumentReport, RepairDetail } from "../shared/repairDetailTypes";

type UseSelectedDocumentReportParams = {
  token: string | null;
  selectedDocumentId: number | null;
  selectedRepair: Pick<RepairDetail, "id" | "updated_at" | "documents"> | null;
  setErrorMessage: (message: string) => void;
};

export function useSelectedDocumentReport({
  token,
  selectedDocumentId,
  selectedRepair,
  setErrorMessage,
}: UseSelectedDocumentReportParams) {
  const [selectedDocumentReport, setSelectedDocumentReport] = useState<DocumentReport | null>(null);
  const [selectedDocumentReportLoading, setSelectedDocumentReportLoading] = useState(false);
  const documentReportRequestIdRef = useRef(0);

  useEffect(() => {
    const documentStillVisible =
      selectedDocumentId !== null && selectedRepair?.documents.some((item) => item.id === selectedDocumentId);

    if (!token || selectedDocumentId === null || !documentStillVisible) {
      documentReportRequestIdRef.current += 1;
      setSelectedDocumentReport(null);
      setSelectedDocumentReportLoading(false);
      return;
    }

    const requestId = documentReportRequestIdRef.current + 1;
    documentReportRequestIdRef.current = requestId;
    setSelectedDocumentReport((current) => (current?.report_document_id === selectedDocumentId ? current : null));
    setSelectedDocumentReportLoading(true);

    void apiRequest<DocumentReport>(`/documents/${selectedDocumentId}/report`, { method: "GET" }, token)
      .then((payload) => {
        if (documentReportRequestIdRef.current !== requestId) {
          return;
        }
        setSelectedDocumentReport(payload);
      })
      .catch((error) => {
        if (documentReportRequestIdRef.current !== requestId) {
          return;
        }
        setSelectedDocumentReport(null);
        if (!(error instanceof ApiError && error.status === 404)) {
          setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить отчёт по документу");
        }
      })
      .finally(() => {
        if (documentReportRequestIdRef.current === requestId) {
          setSelectedDocumentReportLoading(false);
        }
      });
  }, [token, selectedDocumentId, selectedRepair?.id, selectedRepair?.updated_at, selectedRepair?.documents, setErrorMessage]);

  return {
    selectedDocumentReport,
    selectedDocumentReportLoading,
  };
}
