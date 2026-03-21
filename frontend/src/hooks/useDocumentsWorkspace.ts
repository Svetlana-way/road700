import { useRef, useState, type FormEvent } from "react";
import { apiRequest } from "../shared/api";
import { parseOrderNumberFromFilename, parseRepairDateFromFilename } from "../shared/fleetDocumentHelpers";
import type {
  DocumentItem,
  DocumentStatus,
  UserRole,
} from "../shared/workspaceBootstrapTypes";
import type { UploadFormState } from "../shared/workspaceFormTypes";

type DocumentUploadResponse = {
  document: DocumentItem;
  message: string;
  job_id?: number | null;
  import_status?: string | null;
};

type DocumentBatchProcessResponse = {
  processed_count: number;
  document_ids: number[];
  job_ids?: number[];
  status_counts: Record<string, number>;
  message: string;
};

type UseDocumentsWorkspaceParams = {
  token: string | null;
  userRole: UserRole | null | undefined;
  emptyUploadForm: () => UploadFormState;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  refreshWorkspace: () => Promise<void>;
  openRepairByIds: (documentId: number | null, repairId: number) => Promise<void>;
  selectedDocumentId: number | null;
  selectedRepairId: number | null;
  formatDocumentStatusLabel: (status: string | null | undefined) => string;
};

export function useDocumentsWorkspace({
  token,
  userRole,
  emptyUploadForm,
  setErrorMessage,
  setSuccessMessage,
  refreshWorkspace,
  openRepairByIds,
  selectedDocumentId,
  selectedRepairId,
  formatDocumentStatusLabel,
}: UseDocumentsWorkspaceParams) {
  const [uploadForm, setUploadForm] = useState<UploadFormState>(emptyUploadForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastUploadedDocument, setLastUploadedDocument] = useState<DocumentItem | null>(null);
  const uploadFileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [reprocessLoading, setReprocessLoading] = useState(false);
  const [batchReprocessLoading, setBatchReprocessLoading] = useState(false);
  const [batchReprocessLimit, setBatchReprocessLimit] = useState("50");
  const [batchReprocessStatusFilter, setBatchReprocessStatusFilter] = useState("");
  const [batchReprocessPrimaryOnly, setBatchReprocessPrimaryOnly] = useState<"false" | "true">("false");
  const [documentArchiveLoadingId, setDocumentArchiveLoadingId] = useState<number | null>(null);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedFile) {
      setErrorMessage("Сначала выберите файл");
      return;
    }

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
      body.append("file", selectedFile);

      const result = await apiRequest<DocumentUploadResponse>(
        "/documents/upload",
        {
          method: "POST",
          body,
        },
        token,
      );

      setSuccessMessage(result.message);
      setLastUploadedDocument(result.document);
      setUploadForm(emptyUploadForm());
      setSelectedFile(null);
      await refreshWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить документ");
    } finally {
      setUploadLoading(false);
    }
  }

  function updateUploadFormField(field: keyof UploadFormState, value: string) {
    setUploadForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleUploadFileSelect(nextFile: File | null) {
    setLastUploadedDocument(null);
    setSelectedFile(nextFile);
    if (!nextFile) {
      return;
    }

    const parsedRepairDate = parseRepairDateFromFilename(nextFile.name);
    const parsedOrderNumber = parseOrderNumberFromFilename(nextFile.name);
    setUploadForm((current) => ({
      ...current,
      repairDate: parsedRepairDate || current.repairDate,
      orderNumber: current.orderNumber.trim() || !parsedOrderNumber ? current.orderNumber : parsedOrderNumber,
    }));
  }

  async function handleReprocessDocumentById(documentId: number, repairId: number) {
    if (!token) {
      return;
    }
    setReprocessLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<{ message: string }>(
        `/documents/${documentId}/process`,
        { method: "POST" },
        token,
      );
      setSuccessMessage(result.message);
      await refreshWorkspace();
      await openRepairByIds(documentId, repairId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось повторно распознать документ");
    } finally {
      setReprocessLoading(false);
    }
  }

  async function handleReprocessDocument(document: DocumentItem) {
    await handleReprocessDocumentById(document.id, document.repair.id);
  }

  async function handleBatchReprocessDocuments() {
    if (!token || userRole !== "admin") {
      return;
    }

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

      const statusSummary = Object.entries(result.status_counts)
        .map(([status, count]) => `${formatDocumentStatusLabel(status)}: ${count}`)
        .join(", ");

      setSuccessMessage(
        statusSummary
          ? `Переобработано ${result.processed_count} документов. ${statusSummary}`
          : `Переобработано ${result.processed_count} документов.`,
      );
      await refreshWorkspace();
      if (selectedDocumentId !== null && selectedRepairId !== null) {
        await openRepairByIds(selectedDocumentId, selectedRepairId);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось запустить массовую переобработку");
    } finally {
      setBatchReprocessLoading(false);
    }
  }

  async function handleArchiveDocument(documentId: number, repairId: number) {
    if (!token || userRole !== "admin") {
      return;
    }

    setDocumentArchiveLoadingId(documentId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const updatedDocument = await apiRequest<DocumentItem>(
        `/documents/${documentId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "archived" satisfies DocumentStatus }),
        },
        token,
      );
      setSuccessMessage(`Документ ${updatedDocument.original_filename} отправлен в архив`);
      await refreshWorkspace();
      if (selectedRepairId === repairId) {
        await openRepairByIds(updatedDocument.id, repairId);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось отправить документ в архив");
    } finally {
      setDocumentArchiveLoadingId(null);
    }
  }

  function resetDocumentsWorkspaceState() {
    setUploadForm(emptyUploadForm());
    setSelectedFile(null);
    setLastUploadedDocument(null);
    setUploadLoading(false);
    setReprocessLoading(false);
    setBatchReprocessLoading(false);
    setBatchReprocessLimit("50");
    setBatchReprocessStatusFilter("");
    setBatchReprocessPrimaryOnly("false");
    setDocumentArchiveLoadingId(null);
  }

  return {
    uploadForm,
    selectedFile,
    lastUploadedDocument,
    setLastUploadedDocument,
    uploadFileInputRef,
    uploadLoading,
    reprocessLoading,
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
