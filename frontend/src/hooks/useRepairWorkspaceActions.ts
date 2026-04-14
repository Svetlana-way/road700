import { useEffect, useRef, useState } from "react";
import type { DocumentCreateVehicleResponse } from "../contracts/api/repairWorkflow";
import { apiRequest } from "../shared/apiCore";
import { downloadApiFile } from "../shared/apiFiles";
import type { RepairDetail } from "../contracts/domain/repair";
import type { ServiceItem, ServiceStatus, UserRole } from "../contracts/domain/workspace";
import type { DocumentVehicleFormState } from "../shared/workspaceFormTypes";

type UseRepairWorkspaceActionsParams = {
  token: string | null;
  userRole: UserRole | null | undefined;
  selectedRepairId: number | null;
  selectedDocumentId: number | null;
  selectedRepairStatus: string | null;
  selectedDocumentStatus: string | null;
  documentVehicleForm: DocumentVehicleFormState;
  checkComments: Record<number, string>;
  setCheckComments: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setServiceQuery: (value: string) => void;
  setServiceCityFilter: (value: string) => void;
  setServiceStatusFilter: (value: "" | ServiceStatus) => void;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
  refreshWorkspace: (scope?: "full" | "documents" | "metrics" | "review") => Promise<void>;
  openRepairByIds: (documentId: number | null, repairId: number) => Promise<void>;
  openServicesAdmin: () => void;
  loadServices: (query?: string, city?: string, statusFilter?: string) => Promise<void>;
  editService: (item: ServiceItem) => void;
  openRepairOverviewTab: () => void;
  startRepairEdit: () => void;
  cancelRepairEdit: () => void;
  setSelectedRepairFromApi: (repair: RepairDetail) => void;
};

export function useRepairWorkspaceActions({
  token,
  userRole,
  selectedRepairId,
  selectedDocumentId,
  selectedRepairStatus,
  selectedDocumentStatus,
  documentVehicleForm,
  checkComments,
  setCheckComments,
  setServiceQuery,
  setServiceCityFilter,
  setServiceStatusFilter,
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
  const [repairPdfExportLoading, setRepairPdfExportLoading] = useState(false);
  const [documentVehicleSaving, setDocumentVehicleSaving] = useState(false);
  const [checkActionLoadingId, setCheckActionLoadingId] = useState<number | null>(null);
  const repairWorkspaceActionRequestIdRef = useRef(0);

  useEffect(() => {
    repairWorkspaceActionRequestIdRef.current += 1;
    setRepairExportLoading(false);
    setRepairPdfExportLoading(false);
    setDocumentVehicleSaving(false);
    setCheckActionLoadingId(null);
  }, [selectedDocumentId, selectedRepairId, token]);

  useEffect(() => {
    setCheckComments({});
  }, [selectedRepairId, setCheckComments]);

  async function openQualityRepair(documentId: number | null, repairId: number | null) {
    if (!repairId) {
      return;
    }
    await openRepairByIds(documentId, repairId);
  }

  async function openQualityService(name: string) {
    if (userRole !== "admin") {
      return;
    }
    openServicesAdmin();
    setServiceQuery(name);
    setServiceCityFilter("");
    setServiceStatusFilter("");
    if (!token) {
      return;
    }
    try {
      await loadServices(name, "", "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось открыть список сервисов");
    }
  }

  async function handleExportRepair() {
    if (!token || (!selectedRepairId && selectedDocumentId === null)) {
      return;
    }
    setRepairExportLoading(true);
    setErrorMessage("");
    try {
      if (selectedDocumentId !== null) {
        await downloadApiFile(`/documents/${selectedDocumentId}/export`, token, `document_${selectedDocumentId}.xlsx`);
      } else if (selectedRepairId) {
        await downloadApiFile(`/repairs/${selectedRepairId}/export`, token, `repair_${selectedRepairId}.xlsx`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось выгрузить отчет");
    } finally {
      setRepairExportLoading(false);
    }
  }

  async function handleExportRepairPdf() {
    if (!token || (!selectedRepairId && selectedDocumentId === null)) {
      return;
    }
    setRepairPdfExportLoading(true);
    setErrorMessage("");
    try {
      if (selectedDocumentId !== null) {
        await downloadApiFile(`/documents/${selectedDocumentId}/export.pdf`, token, `document_${selectedDocumentId}.pdf`);
      } else if (selectedRepairId) {
        await downloadApiFile(`/repairs/${selectedRepairId}/export.pdf`, token, `repair_${selectedRepairId}.pdf`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось выгрузить отчет в PDF");
    } finally {
      setRepairPdfExportLoading(false);
    }
  }

  async function handleOpenRepair(documentId: number | null, repairId: number) {
    await openRepairByIds(documentId, repairId);
  }

  async function handleCheckResolution(checkId: number, isResolved: boolean) {
    if (!token || !selectedRepairId) {
      return;
    }
    if (selectedRepairStatus === "archived") {
      setErrorMessage("Архивный ремонт доступен только для просмотра и экспорта");
      return;
    }

    const requestId = repairWorkspaceActionRequestIdRef.current + 1;
    repairWorkspaceActionRequestIdRef.current = requestId;
    setCheckActionLoadingId(checkId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const updatedRepair = await apiRequest<RepairDetail>(
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
      if (repairWorkspaceActionRequestIdRef.current !== requestId) {
        return;
      }
      setSelectedRepairFromApi(updatedRepair);
      setCheckComments((current) => ({ ...current, [checkId]: "" }));
      setSuccessMessage(isResolved ? "Проверка закрыта" : "Проверка возвращена в работу");
      await refreshWorkspace("documents");
    } catch (error) {
      if (repairWorkspaceActionRequestIdRef.current !== requestId) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Не удалось обновить проверку ремонта");
    } finally {
      if (repairWorkspaceActionRequestIdRef.current === requestId) {
        setCheckActionLoadingId(null);
      }
    }
  }

  async function handleCreateVehicleFromDocument() {
    if (!token || !selectedRepairId || selectedDocumentId === null || userRole !== "admin") {
      return;
    }
    if (selectedRepairStatus === "archived" || selectedDocumentStatus === "archived") {
      setErrorMessage("Архивный ремонт доступен только для просмотра и экспорта");
      return;
    }

    const normalizedPlate = documentVehicleForm.plate_number.trim();
    const normalizedVin = documentVehicleForm.vin.trim();
    if (!normalizedPlate && !normalizedVin) {
      setErrorMessage("Для создания карточки техники нужен хотя бы госномер или VIN");
      return;
    }

    const requestId = repairWorkspaceActionRequestIdRef.current + 1;
    repairWorkspaceActionRequestIdRef.current = requestId;
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
      if (repairWorkspaceActionRequestIdRef.current !== requestId) {
        return;
      }
      setSuccessMessage(result.message);
      await refreshWorkspace("documents");
      if (repairWorkspaceActionRequestIdRef.current !== requestId) {
        return;
      }
      await openRepairByIds(result.document.id, result.repair_id);
    } catch (error) {
      if (repairWorkspaceActionRequestIdRef.current !== requestId) {
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Не удалось создать карточку техники");
    } finally {
      if (repairWorkspaceActionRequestIdRef.current === requestId) {
        setDocumentVehicleSaving(false);
      }
    }
  }

  function handleEditService(item: ServiceItem) {
    if (userRole !== "admin") {
      return;
    }
    openServicesAdmin();
    editService(item);
  }

  function handleStartRepairEdit() {
    if (userRole !== "admin") {
      setErrorMessage("Редактирование ремонта доступно только администратору");
      return;
    }
    if (selectedRepairStatus === "archived") {
      setErrorMessage("Архивный ремонт доступен только для просмотра и экспорта");
      return;
    }
    openRepairOverviewTab();
    startRepairEdit();
  }

  function handleCancelRepairEdit() {
    cancelRepairEdit();
  }

  return {
    repairExportLoading,
    repairPdfExportLoading,
    documentVehicleSaving,
    checkActionLoadingId,
    openQualityRepair,
    openQualityService,
    handleExportRepair,
    handleExportRepairPdf,
    handleOpenRepair,
    handleCheckResolution,
    handleCreateVehicleFromDocument,
    handleEditService,
    handleStartRepairEdit,
    handleCancelRepairEdit,
  };
}
