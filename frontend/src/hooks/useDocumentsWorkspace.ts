import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DocumentBatchProcessResponse, DocumentUploadResponse } from "../contracts/api/document";
import { apiRequest } from "../shared/apiCore";
import { parseOrderNumberFromFilename, parseRepairDateFromFilename } from "../entities/vehicle/helpers";
import type { WorkspaceTab } from "../shared/appRoute";
import type {
  DocumentItem,
  DocumentStatus,
  UserRole,
} from "../contracts/domain/workspace";
import type { UploadFormState } from "../shared/workspaceFormTypes";

type UseDocumentsWorkspaceParams = {
  token: string | null;
  userRole: UserRole | null | undefined;
  activeWorkspaceTab: WorkspaceTab;
  emptyUploadForm: () => UploadFormState;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  refreshWorkspace: (scope?: "full" | "documents") => Promise<void>;
  openRepairByIds: (documentId: number | null, repairId: number) => Promise<void>;
  selectedDocumentId: number | null;
  selectedRepairId: number | null;
  formatStatus: (status: string) => string;
};

export function useDocumentsWorkspace({
  token,
  userRole,
  activeWorkspaceTab,
  emptyUploadForm,
  setErrorMessage,
  setSuccessMessage,
  refreshWorkspace,
  openRepairByIds,
  selectedDocumentId,
  selectedRepairId,
  formatStatus,
}: UseDocumentsWorkspaceParams) {
  const [uploadForm, setUploadForm] = useState<UploadFormState>(emptyUploadForm);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [lastUploadedDocument, setLastUploadedDocument] = useState<DocumentItem | null>(null);
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [reprocessLoading, setReprocessLoading] = useState(false);
  const [reprocessLoadingId, setReprocessLoadingId] = useState<number | null>(null);
  const [batchReprocessLoading, setBatchReprocessLoading] = useState(false);
  const [batchReprocessLimit, setBatchReprocessLimit] = useState("50");
  const [batchReprocessStatusFilter, setBatchReprocessStatusFilter] = useState("");
  const [batchReprocessPrimaryOnly, setBatchReprocessPrimaryOnly] = useState<"false" | "true">("false");
  const [documentArchiveLoadingId, setDocumentArchiveLoadingId] = useState<number | null>(null);
  const uploadRequestIdRef = useRef(0);
  const reprocessRequestIdRef = useRef(0);
  const batchReprocessRequestIdRef = useRef(0);
  const documentArchiveRequestIdRef = useRef(0);

  useEffect(() => {
    uploadRequestIdRef.current += 1;
    reprocessRequestIdRef.current += 1;
    batchReprocessRequestIdRef.current += 1;
    documentArchiveRequestIdRef.current += 1;
    setUploadLoading(false);
    setReprocessLoading(false);
    setReprocessLoadingId(null);
    setBatchReprocessLoading(false);
    setDocumentArchiveLoadingId(null);
  }, [activeWorkspaceTab, selectedDocumentId, selectedRepairId, token]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || selectedFiles.length === 0) {
      setErrorMessage("Сначала выберите файл");
      return;
    }

    const requestId = uploadRequestIdRef.current + 1;
    uploadRequestIdRef.current = requestId;
    setUploadLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const body = new FormData();
      body.append("kind", uploadForm.documentKind);
      if (uploadForm.vehicleId) {
        body.append("vehicle_id", uploadForm.vehicleId);
      }
      if (uploadForm.repairDate) {
        body.append("repair_date", uploadForm.repairDate);
      }
      if (uploadForm.mileage.trim()) {
        body.append("mileage", uploadForm.mileage);
      }
      if (uploadForm.orderNumber.trim()) {
        body.append("order_number", uploadForm.orderNumber);
      }
      if (uploadForm.reason.trim()) {
        body.append("reason", uploadForm.reason);
      }
      if (uploadForm.employeeComment.trim()) {
        body.append("employee_comment", uploadForm.employeeComment);
      }
      if (uploadForm.notes.trim()) {
        body.append("notes", uploadForm.notes);
      }
      for (const file of selectedFiles) {
        body.append("files", file);
      }

      const result = await apiRequest<DocumentUploadResponse>(
        "/documents/upload",
        {
          method: "POST",
          body,
        },
        token,
      );
      if (uploadRequestIdRef.current !== requestId) {
        return;
      }

      setSuccessMessage(result.message);
      setLastUploadedDocument(result.document);
      setUploadForm(emptyUploadForm());
      setSelectedFiles([]);
      await refreshWorkspace("documents");
    } catch (error) {
      if (uploadRequestIdRef.current !== requestId) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить документ");
    } finally {
      if (uploadRequestIdRef.current === requestId) {
        setUploadLoading(false);
      }
    }
  }

  function updateUploadFormField(field: keyof UploadFormState, value: string) {
    setUploadForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleUploadFileSelect(nextFiles: File[]) {
    setLastUploadedDocument(null);
    setSelectedFiles(nextFiles);
    if (nextFiles.length === 0) {
      return;
    }

    const firstFile = nextFiles[0];
    const parsedRepairDate = parseRepairDateFromFilename(firstFile.name);
    const parsedOrderNumber = parseOrderNumberFromFilename(firstFile.name);
    setUploadForm((current) => ({
      ...current,
      repairDate: parsedRepairDate || current.repairDate,
      orderNumber: current.orderNumber.trim() || !parsedOrderNumber ? current.orderNumber : parsedOrderNumber,
    }));
  }

  async function handleReprocessDocumentById(
    documentId: number,
    repairId: number,
    documentStatus?: DocumentStatus | string | null,
    repairStatus?: string | null,
  ) {
    if (!token) {
      return;
    }
    if (documentStatus === "archived" || repairStatus === "archived") {
      setErrorMessage("Архивный ремонт доступен только для просмотра и экспорта");
      return;
    }
    const requestId = reprocessRequestIdRef.current + 1;
    reprocessRequestIdRef.current = requestId;
    setReprocessLoading(true);
    setReprocessLoadingId(documentId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<{ message: string }>(
        `/documents/${documentId}/process`,
        { method: "POST" },
        token,
      );
      if (reprocessRequestIdRef.current !== requestId) {
        return;
      }
      setSuccessMessage(result.message);
      await refreshWorkspace("documents");
      if (reprocessRequestIdRef.current !== requestId) {
        return;
      }
      await openRepairByIds(documentId, repairId);
    } catch (error) {
      if (reprocessRequestIdRef.current !== requestId) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Не удалось повторно распознать документ");
    } finally {
      if (reprocessRequestIdRef.current === requestId) {
        setReprocessLoading(false);
        setReprocessLoadingId(null);
      }
    }
  }

  async function handleReprocessDocument(document: DocumentItem) {
    await handleReprocessDocumentById(document.id, document.repair.id, document.status, document.repair.status);
  }

  async function handleBatchReprocessDocuments() {
    if (!token || userRole !== "admin") {
      return;
    }

    const requestId = batchReprocessRequestIdRef.current + 1;
    batchReprocessRequestIdRef.current = requestId;
    setBatchReprocessLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const normalizedLimit = String(Math.min(500, Math.max(1, Number(batchReprocessLimit || "50") || 50)));
      const params = new URLSearchParams();
      params.set("limit", normalizedLimit);
      if (batchReprocessStatusFilter) {
        params.set("status", batchReprocessStatusFilter);
      }
      if (batchReprocessPrimaryOnly === "true") {
        params.set("only_primary", "true");
      }

      const result = await apiRequest<DocumentBatchProcessResponse>(
        `/documents/reprocess-existing?${params.toString()}`,
        { method: "POST" },
        token,
      );
      if (batchReprocessRequestIdRef.current !== requestId) {
        return;
      }

      const statusSummary = Object.entries(result.status_counts)
        .map(([status, count]) => `${formatStatus(status)}: ${count}`)
        .join(", ");

      setSuccessMessage(
        statusSummary
          ? `Переобработано ${result.processed_count} документов. ${statusSummary}`
          : `Переобработано ${result.processed_count} документов.`,
      );
      await refreshWorkspace("documents");
      if (batchReprocessRequestIdRef.current !== requestId) {
        return;
      }
      if (activeWorkspaceTab === "repair" && selectedDocumentId !== null && selectedRepairId !== null) {
        await openRepairByIds(selectedDocumentId, selectedRepairId);
      }
    } catch (error) {
      if (batchReprocessRequestIdRef.current !== requestId) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Не удалось запустить массовую переобработку");
    } finally {
      if (batchReprocessRequestIdRef.current === requestId) {
        setBatchReprocessLoading(false);
      }
    }
  }

  async function handleArchiveDocument(documentId: number, repairId: number) {
    if (!token || userRole !== "admin") {
      return;
    }

    const requestId = documentArchiveRequestIdRef.current + 1;
    documentArchiveRequestIdRef.current = requestId;
    setDocumentArchiveLoadingId(documentId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const updatedDocument = await apiRequest<DocumentItem>(
        `/documents/${documentId}/archive`,
        {
          method: "POST",
        },
        token,
      );
      if (documentArchiveRequestIdRef.current !== requestId) {
        return;
      }
      setSuccessMessage(`Документ ${updatedDocument.original_filename} отправлен в архив`);
      await refreshWorkspace("documents");
      if (documentArchiveRequestIdRef.current !== requestId) {
        return;
      }
      if (activeWorkspaceTab === "repair" && selectedRepairId === repairId) {
        await openRepairByIds(selectedDocumentId === documentId ? null : selectedDocumentId, repairId);
      }
    } catch (error) {
      if (documentArchiveRequestIdRef.current !== requestId) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Не удалось отправить документ в архив");
    } finally {
      if (documentArchiveRequestIdRef.current === requestId) {
        setDocumentArchiveLoadingId(null);
      }
    }
  }

  function resetDocumentsWorkspaceState() {
    uploadRequestIdRef.current += 1;
    reprocessRequestIdRef.current += 1;
    batchReprocessRequestIdRef.current += 1;
    documentArchiveRequestIdRef.current += 1;
    setUploadForm(emptyUploadForm());
    setSelectedFiles([]);
    setLastUploadedDocument(null);
    setUploadLoading(false);
    setReprocessLoading(false);
    setReprocessLoadingId(null);
    setBatchReprocessLoading(false);
    setBatchReprocessLimit("50");
    setBatchReprocessStatusFilter("");
    setBatchReprocessPrimaryOnly("false");
    setDocumentArchiveLoadingId(null);
  }

  return {
    uploadForm,
    selectedFiles,
    lastUploadedDocument,
    setLastUploadedDocument,
    uploadFileInputRef,
    uploadLoading,
    reprocessLoading,
    reprocessLoadingId,
    batchReprocessLoading,
    batchReprocessLimit,
    setBatchReprocessLimit,
    batchReprocessStatusFilter,
    setBatchReprocessStatusFilter,
    batchReprocessPrimaryOnly,
    setBatchReprocessPrimaryOnly,
    documentArchiveLoadingId,
    handleUpload,
    updateUploadFormField,
    handleUploadFileSelect,
    handleReprocessDocumentById,
    handleReprocessDocument,
    handleBatchReprocessDocuments,
    handleArchiveDocument,
    resetDocumentsWorkspaceState,
  };
}
