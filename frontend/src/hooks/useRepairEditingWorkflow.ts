import { useState } from "react";
import { apiRequest } from "../shared/api";
import { createRepairDraft, resolveRepairDocumentId, type EditablePartDraft, type EditableRepairDraft, type EditableWorkDraft, type RepairDetailForDraft } from "../shared/repairUiHelpers";
import type { WorkspaceTab } from "../shared/appRoute";
import type { RepairDetail } from "../shared/repairDetailTypes";

type RepairDeleteResponse = {
  message: string;
  deleted_repair_id: number;
};

type RepairEditingRecord = RepairDetail;

type UseRepairEditingWorkflowParams = {
  token: string;
  userRole: "admin" | "employee" | null | undefined;
  selectedRepair: RepairEditingRecord | null;
  refreshWorkspace: () => Promise<void>;
  setSelectedRepair: (repair: RepairEditingRecord | null) => void;
  setSelectedDocumentId: (value: number | null | ((current: number | null) => number | null)) => void;
  setActiveWorkspaceTab: (tab: WorkspaceTab) => void;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
};

export function useRepairEditingWorkflow({
  token,
  userRole,
  selectedRepair,
  refreshWorkspace,
  setSelectedRepair,
  setSelectedDocumentId,
  setActiveWorkspaceTab,
  setErrorMessage,
  setSuccessMessage,
}: UseRepairEditingWorkflowParams) {
  const [repairDraft, setRepairDraft] = useState<EditableRepairDraft | null>(null);
  const [isEditingRepair, setIsEditingRepair] = useState(false);
  const [saveRepairLoading, setSaveRepairLoading] = useState(false);
  const [repairArchiveLoading, setRepairArchiveLoading] = useState(false);
  const [repairDeleteLoading, setRepairDeleteLoading] = useState(false);

  function startRepairEdit() {
    if (!selectedRepair) {
      return;
    }
    setRepairDraft(createRepairDraft(selectedRepair));
    setIsEditingRepair(true);
  }

  function cancelRepairEdit() {
    if (selectedRepair) {
      setRepairDraft(createRepairDraft(selectedRepair));
    } else {
      setRepairDraft(null);
    }
    setIsEditingRepair(false);
  }

  function updateRepairDraftField<K extends keyof EditableRepairDraft>(field: K, value: EditableRepairDraft[K]) {
    setRepairDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateWorkDraft(index: number, field: keyof EditableWorkDraft, value: EditableWorkDraft[keyof EditableWorkDraft]) {
    setRepairDraft((current) => {
      if (!current) {
        return current;
      }
      const works = [...current.works];
      works[index] = { ...works[index], [field]: value };
      return { ...current, works };
    });
  }

  function updatePartDraft(index: number, field: keyof EditablePartDraft, value: EditablePartDraft[keyof EditablePartDraft]) {
    setRepairDraft((current) => {
      if (!current) {
        return current;
      }
      const parts = [...current.parts];
      parts[index] = { ...parts[index], [field]: value };
      return { ...current, parts };
    });
  }

  function addWorkDraft() {
    setRepairDraft((current) =>
      current
        ? {
            ...current,
            works: [
              ...current.works,
              {
                work_code: "",
                work_name: "",
                quantity: 1,
                standard_hours: "",
                actual_hours: "",
                price: 0,
                line_total: 0,
                status: "preliminary",
              },
            ],
          }
        : current,
    );
  }

  function addPartDraft() {
    setRepairDraft((current) =>
      current
        ? {
            ...current,
            parts: [
              ...current.parts,
              {
                article: "",
                part_name: "",
                quantity: 1,
                unit_name: "шт",
                price: 0,
                line_total: 0,
                status: "preliminary",
              },
            ],
          }
        : current,
    );
  }

  function removeWorkDraft(index: number) {
    setRepairDraft((current) =>
      current
        ? { ...current, works: current.works.filter((_, itemIndex) => itemIndex !== index) }
        : current,
    );
  }

  function removePartDraft(index: number) {
    setRepairDraft((current) =>
      current
        ? { ...current, parts: current.parts.filter((_, itemIndex) => itemIndex !== index) }
        : current,
    );
  }

  async function handleSaveRepair() {
    if (!token || !selectedRepair || !repairDraft) {
      return;
    }

    setSaveRepairLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload = {
        order_number: repairDraft.order_number || null,
        repair_date: repairDraft.repair_date,
        mileage: Number(repairDraft.mileage),
        reason: repairDraft.reason || null,
        employee_comment: repairDraft.employee_comment || null,
        service_name: repairDraft.service_name || null,
        work_total: Number(repairDraft.work_total),
        parts_total: Number(repairDraft.parts_total),
        vat_total: Number(repairDraft.vat_total),
        grand_total: Number(repairDraft.grand_total),
        status: repairDraft.status,
        is_preliminary: repairDraft.is_preliminary,
        works: repairDraft.works.map((item) => ({
          work_code: item.work_code || null,
          work_name: item.work_name,
          quantity: Number(item.quantity),
          standard_hours: item.standard_hours === "" ? null : Number(item.standard_hours),
          actual_hours: item.actual_hours === "" ? null : Number(item.actual_hours),
          price: Number(item.price),
          line_total: Number(item.line_total),
          status: item.status,
          reference_payload: { source: "manual_edit" },
        })),
        parts: repairDraft.parts.map((item) => ({
          article: item.article || null,
          part_name: item.part_name,
          quantity: Number(item.quantity),
          unit_name: item.unit_name || null,
          price: Number(item.price),
          line_total: Number(item.line_total),
          status: item.status,
        })),
      };

      const savedRepair = await apiRequest<RepairDetail>(
        `/repairs/${selectedRepair.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        token,
      );

      setSelectedRepair(savedRepair);
      setRepairDraft(createRepairDraft(savedRepair));
      setIsEditingRepair(false);
      setSuccessMessage("Карточка ремонта обновлена");
      await refreshWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось сохранить ремонт");
    } finally {
      setSaveRepairLoading(false);
    }
  }

  async function handleArchiveRepair() {
    if (!token || !selectedRepair || userRole !== "admin") {
      return;
    }

    setRepairArchiveLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const savedRepair = await apiRequest<RepairDetail>(
        `/repairs/${selectedRepair.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: "archived" }),
        },
        token,
      );
      setSelectedRepair(savedRepair);
      setRepairDraft(createRepairDraft(savedRepair));
      setIsEditingRepair(false);
      setSelectedDocumentId((current) => resolveRepairDocumentId(savedRepair, current));
      setSuccessMessage(`Ремонт #${savedRepair.id} отправлен в архив`);
      await refreshWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось отправить ремонт в архив");
    } finally {
      setRepairArchiveLoading(false);
    }
  }

  async function handleDeleteRepair(repairId: number) {
    if (!token || userRole !== "admin") {
      return;
    }
    const confirmed = window.confirm(
      "Удалить ошибочно введенный заказ-наряд вместе со связанными документами и OCR-данными?",
    );
    if (!confirmed) {
      return;
    }

    setRepairDeleteLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload = await apiRequest<RepairDeleteResponse>(
        `/repairs/${repairId}`,
        { method: "DELETE" },
        token,
      );
      if (selectedRepair?.id === repairId) {
        setSelectedRepair(null);
        setSelectedDocumentId(null);
        setActiveWorkspaceTab("documents");
      }
      setSuccessMessage(payload.message);
      await refreshWorkspace();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось удалить заказ-наряд");
    } finally {
      setRepairDeleteLoading(false);
    }
  }

  function syncRepairDraftFromRepair(repair: RepairEditingRecord) {
    setRepairDraft(createRepairDraft(repair));
  }

  function resetRepairEditingState() {
    setRepairDraft(null);
    setIsEditingRepair(false);
    setSaveRepairLoading(false);
    setRepairArchiveLoading(false);
    setRepairDeleteLoading(false);
  }

  return {
    repairDraft,
    setRepairDraft,
    isEditingRepair,
    saveRepairLoading,
    repairArchiveLoading,
    repairDeleteLoading,
    startRepairEdit,
    cancelRepairEdit,
    updateRepairDraftField,
    updateWorkDraft,
    updatePartDraft,
    addWorkDraft,
    addPartDraft,
    removeWorkDraft,
    removePartDraft,
    handleSaveRepair,
    handleArchiveRepair,
    handleDeleteRepair,
    syncRepairDraftFromRepair,
    resetRepairEditingState,
  };
}
