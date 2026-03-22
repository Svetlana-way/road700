import { useEffect, useState } from "react";
import { apiRequest, downloadApiFile } from "../shared/api";
import type { ServiceItem, UserRole } from "../shared/workspaceBootstrapTypes";
import type { DocumentVehicleFormState } from "../shared/workspaceFormTypes";

type DocumentCreateVehicleResponse = {
  message: string;
  repair_id: number;
  created_new_vehicle: boolean;
  document: {
    id: number;
  };
};

type UseRepairWorkspaceActionsParams = {
  token: string | null;
  userRole: UserRole | null | undefined;
  selectedRepairId: number | null;
  selectedDocumentId: number | null;
  documentVehicleForm: DocumentVehicleFormState;
  checkComments: Record<number, string>;
  setCheckComments: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setServiceQuery: (value: string) => void;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  refreshWorkspace: () => Promise<void>;
  openRepairByIds: (documentId: number | null, repairId: number) => Promise<void>;
  openServicesAdmin: () => void;
  loadServices: (query?: string, city?: string) => Promise<void>;
  editService: (item: ServiceItem) => void;
  openRepairOverviewTab: () => void;
  startRepairEdit: () => void;
  cancelRepairEdit: () => void;
  setSelectedRepairFromApi: (repair: unknown) => void;
};

export function useRepairWorkspaceActions({
  token,
  userRole,
  selectedRepairId,
  selectedDocumentId,
  documentVehicleForm,
  checkComments,
  setCheckComments,
  setServiceQuery,
  setErrorMessage,
  setSuccessMessage,
  refreshWorkspace,
  openRepairByIds,
  openServicesAdmin,
  loadServices,
  editService,
  openRepairOverviewTab,
  startRepairEdit,
  cancelRepairEdit,
  setSelectedRepairFromApi,
}: UseRepairWorkspaceActionsParams) {
  const [repairExportLoading, setRepairExportLoading] = useState(false);
  const [documentVehicleSaving, setDocumentVehicleSaving] = useState(false);
  const [checkActionLoadingId, setCheckActionLoadingId] = useState<number | null>(null);

  useEffect(() => {
    if (token) {
      return;
    }
    setRepairExportLoading(false);
    setDocumentVehicleSaving(false);
    setCheckActionLoadingId(null);
  }, [token]);

  async function openQualityRepair(documentId: number | null, repairId: number | null) {
    if (!repairId) {
      return;
    }
    await openRepairByIds(documentId, repairId);
  }

  async function openQualityService(name: string) {
    openServicesAdmin();
    setServiceQuery(name);
    if (!token) {
      return;
    }
    try {
      await loadServices(name, "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось открыть список сервисов");
    }
  }

  async function handleExportRepair() {
    if (!token || !selectedRepairId) {
      return;
    }
    setRepairExportLoading(true);
    setErrorMessage("");
    try {
      await downloadApiFile(`/repairs/${selectedRepairId}/export`, token, `repair_${selectedRepairId}.xlsx`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось выгрузить карточку ремонта");
    } finally {
      setRepairExportLoading(false);
    }
  }

  async function handleOpenRepair(documentId: number | null, repairId: number) {
    await openRepairByIds(documentId, repairId);
  }

  async function handleCheckResolution(checkId: number, isResolved: boolean) {
    if (!token || !selectedRepairId) {
      return;
    }

    setCheckActionLoadingId(checkId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const updatedRepair = await apiRequest<unknown>(
        `/repairs/${selectedRepairId}/checks/${checkId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            is_resolved: isResolved,
            comment: checkComments[checkId]?.trim() || null,
          }),
        },
        token,
      );
      setSelectedRepairFromApi(updatedRepair);
      setCheckComments((current) => ({ ...current, [checkId]: "" }));
      setSuccessMessage(isResolved ? "Проверка закрыта" : "Проверка возвращена в работу");
      await refreshWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось обновить проверку ремонта");
    } finally {
      setCheckActionLoadingId(null);
    }
  }

  async function handleCreateVehicleFromDocument() {
    if (!token || !selectedRepairId || selectedDocumentId === null || userRole !== "admin") {
      return;
    }

    const normalizedPlate = documentVehicleForm.plate_number.trim();
    const normalizedVin = documentVehicleForm.vin.trim();
    if (!normalizedPlate && !normalizedVin) {
      setErrorMessage("Для создания карточки техники нужен хотя бы госномер или VIN");
      return;
    }

    setDocumentVehicleSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<DocumentCreateVehicleResponse>(
        `/documents/${selectedDocumentId}/create-vehicle`,
        {
          method: "POST",
          body: JSON.stringify({
            vehicle_type: documentVehicleForm.vehicle_type,
            plate_number: normalizedPlate || null,
            vin: normalizedVin || null,
            brand: documentVehicleForm.brand.trim() || null,
            model: documentVehicleForm.model.trim() || null,
            year: documentVehicleForm.year.trim() ? Number(documentVehicleForm.year.trim()) : null,
            comment: documentVehicleForm.comment.trim() || null,
          }),
        },
        token,
      );
      setSuccessMessage(result.message);
      await refreshWorkspace();
      await openRepairByIds(result.document.id, result.repair_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось создать карточку техники");
    } finally {
      setDocumentVehicleSaving(false);
    }
  }

  function handleEditService(item: ServiceItem) {
    openServicesAdmin();
    editService(item);
  }

  function handleStartRepairEdit() {
    openRepairOverviewTab();
    startRepairEdit();
  }

  function handleCancelRepairEdit() {
    cancelRepairEdit();
  }

  return {
    repairExportLoading,
    documentVehicleSaving,
    checkActionLoadingId,
    openQualityRepair,
    openQualityService,
    handleExportRepair,
    handleOpenRepair,
    handleCheckResolution,
    handleCreateVehicleFromDocument,
    handleEditService,
    handleStartRepairEdit,
    handleCancelRepairEdit,
  };
}
