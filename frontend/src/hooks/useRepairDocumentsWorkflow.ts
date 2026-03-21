import { useState } from "react";
import { apiRequest, downloadDocumentFile } from "../shared/api";
import type {
  DocumentComparisonResponse,
  DocumentKind,
} from "../shared/workspaceBootstrapTypes";

type RepairDocumentLike = {
  id: number;
  is_primary: boolean;
};

type RepairLike = {
  id: number;
  documents: RepairDocumentLike[];
} | null;

type UseRepairDocumentsWorkflowParams = {
  token: string;
  selectedRepair: RepairLike;
  selectedDocumentId: number | null;
  refreshWorkspace: () => Promise<void>;
  openRepairByIds: (documentId: number | null, repairId: number) => Promise<void>;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
};

type DocumentComparisonReviewResponse = {
  message: string;
  action: string;
  document_id: number;
  repair_id: number;
  source_document_id: number | null;
};

export function useRepairDocumentsWorkflow({
  token,
  selectedRepair,
  selectedDocumentId,
  refreshWorkspace,
  openRepairByIds,
  setErrorMessage,
  setSuccessMessage,
}: UseRepairDocumentsWorkflowParams) {
  const [attachDocumentLoading, setAttachDocumentLoading] = useState(false);
  const [documentOpenLoadingId, setDocumentOpenLoadingId] = useState<number | null>(null);
  const [primaryDocumentLoadingId, setPrimaryDocumentLoadingId] = useState<number | null>(null);
  const [documentComparisonLoadingId, setDocumentComparisonLoadingId] = useState<number | null>(null);
  const [documentComparisonReviewLoading, setDocumentComparisonReviewLoading] = useState(false);
  const [attachedDocumentKind, setAttachedDocumentKind] = useState<DocumentKind>("repeat_scan");
  const [attachedDocumentNotes, setAttachedDocumentNotes] = useState("");
  const [attachedDocumentFile, setAttachedDocumentFile] = useState<File | null>(null);
  const [documentComparison, setDocumentComparison] = useState<DocumentComparisonResponse | null>(null);
  const [documentComparisonComment, setDocumentComparisonComment] = useState("");

  async function handleOpenDocumentFile(documentId: number) {
    if (!token) {
      return;
    }

    setDocumentOpenLoadingId(documentId);
    setErrorMessage("");
    try {
      const objectUrl = await downloadDocumentFile(documentId, token);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось открыть документ");
    } finally {
      setDocumentOpenLoadingId(null);
    }
  }

  async function handleAttachDocumentToRepair() {
    if (!token || !selectedRepair || !attachedDocumentFile) {
      setErrorMessage("Сначала выберите файл");
      return;
    }

    setAttachDocumentLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const body = new FormData();
      body.append("repair_id", String(selectedRepair.id));
      body.append("kind", attachedDocumentKind);
      body.append("notes", attachedDocumentNotes);
      body.append("file", attachedDocumentFile);

      const result = await apiRequest<{ document: { id: number }; message: string }>(
        "/documents/upload-to-repair",
        {
          method: "POST",
          body,
        },
        token,
      );

      setSuccessMessage(result.message);
      setAttachedDocumentNotes("");
      setAttachedDocumentFile(null);
      await refreshWorkspace();
      await openRepairByIds(result.document.id, selectedRepair.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось прикрепить документ к ремонту");
    } finally {
      setAttachDocumentLoading(false);
    }
  }

  async function handleSetPrimaryDocument(documentId: number) {
    if (!token || !selectedRepair) {
      return;
    }

    setPrimaryDocumentLoadingId(documentId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<{ id: number }>(
        `/documents/${documentId}/set-primary`,
        {
          method: "POST",
        },
        token,
      );
      setSuccessMessage("Основной документ обновлён");
      await refreshWorkspace();
      await openRepairByIds(result.id, selectedRepair.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось назначить основной документ");
    } finally {
      setPrimaryDocumentLoadingId(null);
    }
  }

  async function handleCompareWithPrimary(documentId: number) {
    if (!token || !selectedRepair) {
      return;
    }

    const primaryDocument = selectedRepair.documents.find((item) => item.is_primary);
    if (!primaryDocument || primaryDocument.id === documentId) {
      return;
    }

    setDocumentComparisonLoadingId(documentId);
    setErrorMessage("");
    try {
      const result = await apiRequest<DocumentComparisonResponse>(
        `/documents/${documentId}/compare?with_document_id=${primaryDocument.id}`,
        {
          method: "GET",
        },
        token,
      );
      setDocumentComparison(result);
      setDocumentComparisonComment("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сравнить документы");
    } finally {
      setDocumentComparisonLoadingId(null);
    }
  }

  async function handleReviewDocumentComparison(
    action: "keep_current_primary" | "make_document_primary" | "mark_reviewed",
  ) {
    if (!token || !selectedRepair || !documentComparison) {
      return;
    }

    setDocumentComparisonReviewLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<DocumentComparisonReviewResponse>(
        `/documents/${documentComparison.left_document.id}/compare/review`,
        {
          method: "POST",
          body: JSON.stringify({
            with_document_id: documentComparison.right_document.id,
            action,
            comment: documentComparisonComment.trim() || null,
          }),
        },
        token,
      );
      setSuccessMessage(result.message);
      setDocumentComparison(null);
      setDocumentComparisonComment("");
      await refreshWorkspace();
      await openRepairByIds(result.document_id, result.repair_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить решение по сверке документов");
    } finally {
      setDocumentComparisonReviewLoading(false);
    }
  }

  function resetRepairDocumentsWorkflowState() {
    setAttachDocumentLoading(false);
    setDocumentOpenLoadingId(null);
    setPrimaryDocumentLoadingId(null);
    setDocumentComparisonLoadingId(null);
    setDocumentComparisonReviewLoading(false);
    setAttachedDocumentKind("repeat_scan");
    setAttachedDocumentNotes("");
    setAttachedDocumentFile(null);
    setDocumentComparison(null);
    setDocumentComparisonComment("");
  }

  return {
    attachDocumentLoading,
    documentOpenLoadingId,
    primaryDocumentLoadingId,
    documentComparisonLoadingId,
    documentComparisonReviewLoading,
    attachedDocumentKind,
    setAttachedDocumentKind,
    attachedDocumentNotes,
    setAttachedDocumentNotes,
    attachedDocumentFile,
    setAttachedDocumentFile,
    documentComparison,
    setDocumentComparison,
    documentComparisonComment,
    setDocumentComparisonComment,
    handleOpenDocumentFile,
    handleAttachDocumentToRepair,
    handleSetPrimaryDocument,
    handleCompareWithPrimary,
    handleReviewDocumentComparison,
    resetRepairDocumentsWorkflowState,
  };
}
