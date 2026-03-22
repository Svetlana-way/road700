import { useEffect } from "react";
import { createVehicleFormFromPayload } from "../shared/fleetDocumentHelpers";
import type { DocumentVehicleFormState } from "../shared/workspaceFormTypes";

type UseRepairPresentationStateParams = {
  selectedDocumentId: number | null;
  selectedRepairId: number | null;
  selectedRepairServiceName: string | null | undefined;
  selectedRepairDocumentPayload: Record<string, unknown> | null;
  selectedRepairDocumentPlateNumber: unknown;
  selectedRepairDocumentVin: unknown;
  selectedRepairDocumentOcrServiceName: unknown;
  setDocumentVehicleForm: (value: DocumentVehicleFormState) => void;
  setShowRepairOverviewDetails: (value: boolean) => void;
};

export function useRepairPresentationState({
  selectedDocumentId,
  selectedRepairId,
  selectedRepairServiceName,
  selectedRepairDocumentPayload,
  selectedRepairDocumentPlateNumber,
  selectedRepairDocumentVin,
  selectedRepairDocumentOcrServiceName,
  setDocumentVehicleForm,
  setShowRepairOverviewDetails,
}: UseRepairPresentationStateParams) {
  useEffect(() => {
    setDocumentVehicleForm(createVehicleFormFromPayload(selectedRepairDocumentPayload));
  }, [selectedDocumentId, selectedRepairDocumentPayload, setDocumentVehicleForm]);

  useEffect(() => {
    setShowRepairOverviewDetails(false);
  }, [
    selectedRepairId,
    selectedRepairServiceName,
    selectedRepairDocumentPlateNumber,
    selectedRepairDocumentVin,
    selectedRepairDocumentOcrServiceName,
    setShowRepairOverviewDetails,
  ]);
}
