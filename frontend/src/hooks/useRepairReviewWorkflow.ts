import { useEffect, useRef, useState } from "react";
import { buildReviewFieldsPayload, buildServicePayload } from "../shared/adminPayloadBuilders";
import { apiRequest, downloadDocumentFile } from "../shared/api";
import { isPlaceholderVehicle } from "../shared/fleetDocumentHelpers";
import { createReviewRepairFieldsDraft, getDocumentPreviewKind } from "../shared/repairUiHelpers";
import type { RepairDetail } from "../shared/repairDetailTypes";
import type {
  DocumentItem,
  ServiceItem,
  UserRole,
  ReviewQueueItem,
  Vehicle,
  VehiclesResponse,
} from "../shared/workspaceBootstrapTypes";
import type { ReviewRepairFieldsDraft, ServiceFormState } from "../shared/workspaceFormTypes";

type RepairDocumentExtractedFields = Record<string, unknown> | null | undefined;
type RepairReviewRecord = RepairDetail;
type RepairReviewDocument = {
  id: number;
  mime_type: string | null;
};

type ReviewActionResponse = {
  message: string;
  document_id: number;
  repair_id: number;
  document_status: string;
  repair_status: string;
  queue_item: ReviewQueueItem | null;
};

type DocumentCreateVehicleResponse = {
  message: string;
  repair_id: number;
  created_new_vehicle: boolean;
  document: DocumentItem;
};

type UseRepairReviewWorkflowParams = {
  token: string;
  userRole: UserRole | null | undefined;
  selectedRepair: RepairReviewRecord | null;
  selectedRepairDocument: RepairReviewDocument | null;
  selectedReviewItem: ReviewQueueItem | null;
  selectedDocumentId: number | null;
  selectedRepairDocumentOcrServiceName: string;
  selectedRepairDocumentExtractedFields: RepairDocumentExtractedFields;
  defaultReviewServiceStatus: ServiceFormState["status"];
  isEditingRepair: boolean;
  loadServices: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  openRepairByIds: (documentId: number | null, repairId: number) => Promise<void>;
  setSelectedRepair: (repair: RepairReviewRecord) => void;
  setRepairDraft: (repair: RepairReviewRecord) => void;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
};

export function useRepairReviewWorkflow({
  token,
  userRole,
  selectedRepair,
  selectedRepairDocument,
  selectedReviewItem,
  selectedDocumentId,
  selectedRepairDocumentOcrServiceName,
  selectedRepairDocumentExtractedFields,
  defaultReviewServiceStatus,
  isEditingRepair,
  loadServices,
  refreshWorkspace,
  openRepairByIds,
  setSelectedRepair,
  setRepairDraft,
  setErrorMessage,
  setSuccessMessage,
}: UseRepairReviewWorkflowParams) {
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [reviewFieldSaving, setReviewFieldSaving] = useState(false);
  const [reviewVehicleSearch, setReviewVehicleSearch] = useState("");
  const [reviewVehicleSearchLoading, setReviewVehicleSearchLoading] = useState(false);
  const [reviewVehicleSearchResults, setReviewVehicleSearchResults] = useState<Vehicle[]>([]);
  const [reviewVehicleLinkingId, setReviewVehicleLinkingId] = useState<number | null>(null);
  const [reviewServiceAssigning, setReviewServiceAssigning] = useState(false);
  const [reviewServiceSaving, setReviewServiceSaving] = useState(false);
  const [reviewActionComment, setReviewActionComment] = useState("");
  const [reviewFieldDraft, setReviewFieldDraft] = useState<ReviewRepairFieldsDraft | null>(null);
  const [showReviewFieldEditor, setShowReviewFieldEditor] = useState(false);
  const [reviewServiceName, setReviewServiceName] = useState("");
  const [reviewServiceForm, setReviewServiceForm] = useState<ServiceFormState>(
    {
      id: null,
      name: selectedRepairDocumentOcrServiceName,
      city: "",
      contact: "",
      comment: "",
      status: defaultReviewServiceStatus,
    },
  );
  const [showReviewServiceEditor, setShowReviewServiceEditor] = useState(false);
  const [reviewDocumentPreviewUrl, setReviewDocumentPreviewUrl] = useState("");
  const [reviewDocumentPreviewLoading, setReviewDocumentPreviewLoading] = useState(false);
  const reviewDocumentPreviewObjectUrlRef = useRef("");

  const reviewDocumentPreviewKind = getDocumentPreviewKind(selectedRepairDocument?.mime_type);
  const selectedRepairDocumentId = selectedRepairDocument?.id ?? null;

  useEffect(() => {
    const nextServiceName = selectedRepair?.service?.name || selectedRepairDocumentOcrServiceName || "";
    setReviewVehicleSearch(
      typeof selectedRepairDocumentExtractedFields?.plate_number === "string"
        ? selectedRepairDocumentExtractedFields.plate_number
        : typeof selectedRepairDocumentExtractedFields?.vin === "string"
          ? selectedRepairDocumentExtractedFields.vin
          : "",
    );
    setReviewVehicleSearchResults([]);
    setReviewServiceName(nextServiceName);
    setReviewFieldDraft(selectedRepair ? createReviewRepairFieldsDraft(selectedRepair) : null);
    setReviewServiceForm({
      id: null,
      name: selectedRepairDocumentOcrServiceName,
      city: "",
      contact: "",
      comment: "",
      status: defaultReviewServiceStatus,
    });
    setShowReviewFieldEditor(false);
    setShowReviewServiceEditor(false);
  }, [
    defaultReviewServiceStatus,
    selectedRepair?.id,
    selectedRepair?.service?.name,
    selectedRepairDocumentExtractedFields?.plate_number,
    selectedRepairDocumentExtractedFields?.vin,
    selectedRepairDocumentOcrServiceName,
  ]);

  useEffect(() => {
    if (!token || !selectedRepairDocumentId || !reviewDocumentPreviewKind) {
      if (reviewDocumentPreviewObjectUrlRef.current) {
        URL.revokeObjectURL(reviewDocumentPreviewObjectUrlRef.current);
        reviewDocumentPreviewObjectUrlRef.current = "";
      }
      setReviewDocumentPreviewUrl("");
      setReviewDocumentPreviewLoading(false);
      return;
    }

    let isMounted = true;

    setReviewDocumentPreviewLoading(true);
    setReviewDocumentPreviewUrl("");
    void downloadDocumentFile(selectedRepairDocumentId, token)
      .then((url) => {
        if (!isMounted) {
          URL.revokeObjectURL(url);
          return;
        }
        if (reviewDocumentPreviewObjectUrlRef.current) {
          URL.revokeObjectURL(reviewDocumentPreviewObjectUrlRef.current);
        }
        reviewDocumentPreviewObjectUrlRef.current = url;
        setReviewDocumentPreviewUrl(url);
      })
      .catch((error) => {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить превью документа");
        }
      })
      .finally(() => {
        if (isMounted) {
          setReviewDocumentPreviewLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [reviewDocumentPreviewKind, selectedRepairDocumentId, setErrorMessage, token]);

  useEffect(() => {
    return () => {
      if (reviewDocumentPreviewObjectUrlRef.current) {
        URL.revokeObjectURL(reviewDocumentPreviewObjectUrlRef.current);
        reviewDocumentPreviewObjectUrlRef.current = "";
      }
    };
  }, []);

  async function handleReviewAction(action: "employee_confirm" | "confirm" | "send_to_review") {
    if (!token || !selectedReviewItem) {
      return;
    }

    setReviewActionLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<ReviewActionResponse>(
        `/review/queue/${selectedReviewItem.document.id}/action`,
        {
          method: "POST",
          body: JSON.stringify({
            action,
            comment: reviewActionComment.trim() || null,
          }),
        },
        token,
      );
      setSuccessMessage(result.message);
      setReviewActionComment("");
      await refreshWorkspace();
      await openRepairByIds(result.document_id, result.repair_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось применить действие по проверке");
    } finally {
      setReviewActionLoading(false);
    }
  }

  async function assignReviewService(serviceName: string) {
    if (!token || !selectedRepair) {
      return;
    }

    setReviewServiceAssigning(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const savedRepair = await apiRequest<RepairDetail>(
        `/repairs/${selectedRepair.id}/service`,
        {
          method: "PATCH",
          body: JSON.stringify({
            service_name: serviceName.trim() || null,
          }),
        },
        token,
      );
      setSelectedRepair(savedRepair);
      if (!isEditingRepair) {
        setRepairDraft(savedRepair);
      }
      setReviewServiceName(savedRepair.service?.name || "");
      setSuccessMessage(savedRepair.service ? "Сервис назначен ремонту" : "Сервис у ремонта очищен");
      await refreshWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось назначить сервис");
    } finally {
      setReviewServiceAssigning(false);
    }
  }

  async function handleAssignReviewService() {
    await assignReviewService(reviewServiceName);
  }

  async function handleCreateReviewService() {
    if (!token || !selectedRepair) {
      return;
    }
    if (!reviewServiceForm.name.trim()) {
      setErrorMessage("Название сервиса обязательно");
      return;
    }

    setReviewServiceSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const createdService = await apiRequest<ServiceItem>(
        "/services",
        {
          method: "POST",
          body: JSON.stringify(
            buildServicePayload(
              reviewServiceForm,
              userRole === "admin" ? reviewServiceForm.status : "preliminary",
            ),
          ),
        },
        token,
      );
      await loadServices();
      setReviewServiceForm({
        id: null,
        name: selectedRepairDocumentOcrServiceName,
        city: "",
        contact: "",
        comment: "",
        status: defaultReviewServiceStatus,
      });
      setShowReviewServiceEditor(false);
      await assignReviewService(createdService.name);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось создать сервис");
    } finally {
      setReviewServiceSaving(false);
    }
  }

  async function searchReviewVehicles(search: string) {
    if (!token) {
      return;
    }
    if (!search.trim()) {
      setReviewVehicleSearchResults([]);
      return;
    }

    setReviewVehicleSearchLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "20");
      params.set("search", search.trim());
      const payload = await apiRequest<VehiclesResponse>(`/vehicles?${params.toString()}`, { method: "GET" }, token);
      setReviewVehicleSearchResults(
        payload.items.filter((item) => !isPlaceholderVehicle(item.external_id)),
      );
    } finally {
      setReviewVehicleSearchLoading(false);
    }
  }

  async function handleSearchReviewVehicles() {
    if (!token) {
      return;
    }
    setErrorMessage("");
    try {
      await searchReviewVehicles(reviewVehicleSearch);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось найти технику");
    }
  }

  async function handleLinkReviewVehicle(vehicleId: number) {
    if (!token || !selectedDocumentId || !selectedRepair) {
      return;
    }

    setReviewVehicleLinkingId(vehicleId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<DocumentCreateVehicleResponse>(
        `/documents/${selectedDocumentId}/link-vehicle`,
        {
          method: "POST",
          body: JSON.stringify({ vehicle_id: vehicleId }),
        },
        token,
      );
      setSuccessMessage(result.message);
      setReviewVehicleSearchResults([]);
      await refreshWorkspace();
      await openRepairByIds(result.document.id, result.repair_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось привязать технику");
    } finally {
      setReviewVehicleLinkingId(null);
    }
  }

  function updateReviewFieldDraft<K extends keyof ReviewRepairFieldsDraft>(field: K, value: ReviewRepairFieldsDraft[K]) {
    setReviewFieldDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function fillReviewFieldDraftFromOcr() {
    setReviewFieldDraft((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        order_number:
          typeof selectedRepairDocumentExtractedFields?.order_number === "string"
            ? selectedRepairDocumentExtractedFields.order_number
            : current.order_number,
        repair_date:
          typeof selectedRepairDocumentExtractedFields?.repair_date === "string"
            ? selectedRepairDocumentExtractedFields.repair_date
            : current.repair_date,
        mileage:
          selectedRepairDocumentExtractedFields?.mileage !== null &&
          selectedRepairDocumentExtractedFields?.mileage !== undefined
            ? String(selectedRepairDocumentExtractedFields.mileage)
            : current.mileage,
        work_total:
          selectedRepairDocumentExtractedFields?.work_total !== null &&
          selectedRepairDocumentExtractedFields?.work_total !== undefined
            ? String(selectedRepairDocumentExtractedFields.work_total)
            : current.work_total,
        parts_total:
          selectedRepairDocumentExtractedFields?.parts_total !== null &&
          selectedRepairDocumentExtractedFields?.parts_total !== undefined
            ? String(selectedRepairDocumentExtractedFields.parts_total)
            : current.parts_total,
        vat_total:
          selectedRepairDocumentExtractedFields?.vat_total !== null &&
          selectedRepairDocumentExtractedFields?.vat_total !== undefined
            ? String(selectedRepairDocumentExtractedFields.vat_total)
            : current.vat_total,
        grand_total:
          selectedRepairDocumentExtractedFields?.grand_total !== null &&
          selectedRepairDocumentExtractedFields?.grand_total !== undefined
            ? String(selectedRepairDocumentExtractedFields.grand_total)
            : current.grand_total,
      };
    });
  }

  async function handleSaveReviewFields() {
    if (!token || !selectedRepair || !reviewFieldDraft) {
      return;
    }

    setReviewFieldSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const payload = buildReviewFieldsPayload(reviewFieldDraft);

      const savedRepair = await apiRequest<RepairDetail>(
        `/repairs/${selectedRepair.id}/review-fields`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        token,
      );
      setSelectedRepair(savedRepair);
      setRepairDraft(savedRepair);
      setReviewFieldDraft(createReviewRepairFieldsDraft(savedRepair));
      setSuccessMessage("Поля проверки сохранены");
      await refreshWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить поля проверки");
    } finally {
      setReviewFieldSaving(false);
    }
  }

  function resetReviewWorkflowState() {
    setReviewActionLoading(false);
    setReviewFieldSaving(false);
    setReviewVehicleSearch("");
    setReviewVehicleSearchLoading(false);
    setReviewVehicleSearchResults([]);
    setReviewVehicleLinkingId(null);
    setReviewServiceAssigning(false);
    setReviewServiceSaving(false);
    setReviewActionComment("");
    setReviewFieldDraft(null);
    setShowReviewFieldEditor(false);
    setReviewServiceName("");
    setReviewServiceForm({
      id: null,
      name: selectedRepairDocumentOcrServiceName,
      city: "",
      contact: "",
      comment: "",
      status: defaultReviewServiceStatus,
    });
    setShowReviewServiceEditor(false);
    setReviewDocumentPreviewUrl("");
    setReviewDocumentPreviewLoading(false);
  }

  return {
    reviewActionLoading,
    reviewActionComment,
    setReviewActionComment,
    reviewFieldSaving,
    reviewVehicleSearch,
    setReviewVehicleSearch,
    reviewVehicleSearchLoading,
    reviewVehicleSearchResults,
    reviewVehicleLinkingId,
    reviewServiceAssigning,
    reviewServiceSaving,
    reviewServiceName,
    setReviewServiceName,
    reviewServiceForm,
    setReviewServiceForm,
    showReviewServiceEditor,
    setShowReviewServiceEditor,
    reviewFieldDraft,
    showReviewFieldEditor,
    setShowReviewFieldEditor,
    reviewDocumentPreviewUrl,
    reviewDocumentPreviewLoading,
    reviewDocumentPreviewKind,
    handleReviewAction,
    assignReviewService,
    handleAssignReviewService,
    handleCreateReviewService,
    handleSearchReviewVehicles,
    handleLinkReviewVehicle,
    updateReviewFieldDraft,
    fillReviewFieldDraftFromOcr,
    handleSaveReviewFields,
    resetReviewWorkflowState,
  };
}
