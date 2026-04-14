import { useEffect, useRef, useState } from "react";
import type { DocumentComparisonReviewResponse } from "../contracts/api/repairWorkflow";
import { downloadDocumentFile } from "../features/documents/api";
import { resolveSourceRepairDocument } from "../entities/repair/helpers";
import { apiRequest } from "../shared/apiCore";
import type {
  DocumentComparisonResponse,
  DocumentKind,
  UserRole,
} from "../contracts/domain/workspace";

type RepairDocumentLike = {
  id: number;
  is_primary: boolean;
  status: string;
};

type RepairLike = {
  id: number;
  source_document_id: number | null;
  status: string;
  documents: RepairDocumentLike[];
} | null;

type UseRepairDocumentsWorkflowParams = {
  token: string;
  userRole: UserRole | null | undefined;
  selectedRepair: RepairLike;
  refreshWorkspace: (scope?: "full" | "documents" | "metrics" | "review") => Promise<void>;
  openRepairByIds: (documentId: number | null, repairId: number) => Promise<void>;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
};

export function useRepairDocumentsWorkflow({
  token,
  userRole,
  selectedRepair,
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
  const [attachedDocumentFiles, setAttachedDocumentFiles] = useState<File[]>([]);
  const [documentComparison, setDocumentComparison] = useState<DocumentComparisonResponse | null>(null);
  const [documentComparisonComment, setDocumentComparisonComment] = useState("");
  const repairDocumentActionRequestIdRef = useRef(0);
  const documentComparisonRequestIdRef = useRef(0);
  const selectedRepairArchived = selectedRepair?.status === "archived";

  useEffect(() => {
    repairDocumentActionRequestIdRef.current += 1;
    documentComparisonRequestIdRef.current += 1;
    setAttachDocumentLoading(false);
    setDocumentOpenLoadingId(null);
    setPrimaryDocumentLoadingId(null);
    setDocumentComparisonLoadingId(null);
    setDocumentComparisonReviewLoading(false);
    setAttachedDocumentKind("repeat_scan");
    setAttachedDocumentNotes("");
    setAttachedDocumentFiles([]);
    setDocumentComparison(null);
    setDocumentComparisonComment("");
  }, [selectedRepair?.id]);

  useEffect(() => {
    if (!documentComparison || !selectedRepair) {
      return;
    }
    const leftDocumentExists = selectedRepair.documents.some((item) => item.id === documentComparison.left_document.id);
    const rightDocumentExists = selectedRepair.documents.some((item) => item.id === documentComparison.right_document.id);
    if (leftDocumentExists && rightDocumentExists) {
      return;
    }
    setDocumentComparison(null);
    setDocumentComparisonComment("");
    setDocumentComparisonReviewLoading(false);
  }, [documentComparison, selectedRepair]);

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
    if (!token || !selectedRepair || attachedDocumentFiles.length === 0) {
      setErrorMessage("Сначала выберите файл");
      return;
    }
    if (selectedRepairArchived) {
      setErrorMessage("Архивный ремонт доступен только для просмотра и экспорта");
      return;
    }

    const requestId = repairDocumentActionRequestIdRef.current + 1;
    repairDocumentActionRequestIdRef.current = requestId;
    setAttachDocumentLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const body = new FormData();
      body.append("repair_id", String(selectedRepair.id));
      body.append("kind", attachedDocumentKind);
      body.append("notes", attachedDocumentNotes);
      for (const file of attachedDocumentFiles) {
        body.append("files", file);
      }

      const result = await apiRequest<{ document: { id: number }; message: string }>(
        "/documents/upload-to-repair",
        {
          method: "POST",
          body,
        },
        token,
      );
      if (repairDocumentActionRequestIdRef.current !== requestId) {
        return;
      }

      setSuccessMessage(result.message);
      setAttachedDocumentNotes("");
      setAttachedDocumentFiles([]);
      await refreshWorkspace("documents");
      if (repairDocumentActionRequestIdRef.current !== requestId) {
        return;
      }
      await openRepairByIds(result.document.id, selectedRepair.id);
    } catch (error) {
      if (repairDocumentActionRequestIdRef.current !== requestId) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Не удалось прикрепить документ к ремонту");
    } finally {
      if (repairDocumentActionRequestIdRef.current === requestId) {
        setAttachDocumentLoading(false);
      }
    }
  }

  async function handleSetPrimaryDocument(documentId: number) {
    if (!token || !selectedRepair) {
      return;
    }
    if (userRole !== "admin") {
      setErrorMessage("Только администратор может назначить основной документ");
      return;
    }
    const targetDocument = selectedRepair.documents.find((item) => item.id === documentId) ?? null;
    if (selectedRepairArchived || targetDocument?.status === "archived") {
      setErrorMessage("Архивный ремонт доступен только для просмотра и экспорта");
      return;
    }

    const requestId = repairDocumentActionRequestIdRef.current + 1;
    repairDocumentActionRequestIdRef.current = requestId;
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
      if (repairDocumentActionRequestIdRef.current !== requestId) {
        return;
      }
      setSuccessMessage("Основной документ обновлён");
      await refreshWorkspace("documents");
      if (repairDocumentActionRequestIdRef.current !== requestId) {
        return;
      }
      await openRepairByIds(result.id, selectedRepair.id);
    } catch (error) {
      if (repairDocumentActionRequestIdRef.current !== requestId) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Не удалось назначить основной документ");
    } finally {
      if (repairDocumentActionRequestIdRef.current === requestId) {
        setPrimaryDocumentLoadingId(null);
      }
    }
  }

  async function handleCompareWithPrimary(documentId: number) {
    if (!token || !selectedRepair) {
      return;
    }

    const targetDocument = selectedRepair.documents.find((item) => item.id === documentId) ?? null;
    const primaryDocument = resolveSourceRepairDocument(selectedRepair);
    if (!primaryDocument) {
      setErrorMessage("У ремонта нет основного документа для сравнения");
      return;
    }
    if (primaryDocument.id === documentId) {
      setErrorMessage("Текущий документ уже является основным");
      return;
    }
    if (
      selectedRepairArchived ||
      targetDocument?.status === "archived" ||
      primaryDocument.status === "archived"
    ) {
      setErrorMessage("Архивный ремонт доступен только для просмотра и экспорта");
      return;
    }

    const requestId = documentComparisonRequestIdRef.current + 1;
    documentComparisonRequestIdRef.current = requestId;
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
      if (documentComparisonRequestIdRef.current !== requestId) {
        return;
      }
      setDocumentComparison(result);
      setDocumentComparisonComment("");
    } catch (error) {
      if (documentComparisonRequestIdRef.current !== requestId) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сравнить документы");
    } finally {
      if (documentComparisonRequestIdRef.current === requestId) {
        setDocumentComparisonLoadingId(null);
      }
    }
  }

  async function handleReviewDocumentComparison(
    action: "keep_current_primary" | "make_document_primary" | "mark_reviewed",
  ) {
    if (!token || !selectedRepair || !documentComparison) {
      return;
    }
    if (userRole !== "admin") {
      setErrorMessage("Только администратор может сохранить решение по сравнению документов");
      return;
    }
    if (
      selectedRepairArchived ||
      documentComparison.left_document.status === "archived" ||
      documentComparison.right_document.status === "archived"
    ) {
      setErrorMessage("Архивный ремонт доступен только для просмотра и экспорта");
      return;
    }

    const requestId = repairDocumentActionRequestIdRef.current + 1;
    repairDocumentActionRequestIdRef.current = requestId;
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
      if (repairDocumentActionRequestIdRef.current !== requestId) {
        return;
      }
      setSuccessMessage(result.message);
      setDocumentComparison(null);
      setDocumentComparisonComment("");
      await refreshWorkspace("documents");
      if (repairDocumentActionRequestIdRef.current !== requestId) {
        return;
      }
      await openRepairByIds(result.document_id, result.repair_id);
    } catch (error) {
      if (repairDocumentActionRequestIdRef.current !== requestId) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить решение по сверке документов");
    } finally {
      if (repairDocumentActionRequestIdRef.current === requestId) {
        setDocumentComparisonReviewLoading(false);
      }
    }
  }

  function resetRepairDocumentsWorkflowState() {
    repairDocumentActionRequestIdRef.current += 1;
    documentComparisonRequestIdRef.current += 1;
    setAttachDocumentLoading(false);
    setDocumentOpenLoadingId(null);
    setPrimaryDocumentLoadingId(null);
    setDocumentComparisonLoadingId(null);
    setDocumentComparisonReviewLoading(false);
    setAttachedDocumentKind("repeat_scan");
    setAttachedDocumentNotes("");
    setAttachedDocumentFiles([]);
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
    attachedDocumentFiles,
    setAttachedDocumentFiles,
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
