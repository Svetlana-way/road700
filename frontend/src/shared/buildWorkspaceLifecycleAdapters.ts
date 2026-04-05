import type { Dispatch, SetStateAction } from "react";
import type { WorkspaceResetters, WorkspaceStateAppliers } from "../hooks/useWorkspaceDataLifecycle";
import type { RepairDetail } from "./repairDetailTypes";
import type { DocumentItem } from "./workspaceBootstrapTypes";
import type { DocumentVehicleFormState } from "./workspaceFormTypes";

type BuildWorkspaceLifecycleAdaptersParams = {
  setUser: WorkspaceStateAppliers["setUser"];
  setSummary: WorkspaceStateAppliers["setSummary"];
  setDataQuality: WorkspaceStateAppliers["setDataQuality"];
  setDataQualityDetails: WorkspaceStateAppliers["setDataQualityDetails"];
  setDocuments: WorkspaceStateAppliers["setDocuments"];
  setReviewQueue: WorkspaceStateAppliers["setReviewQueue"];
  setReviewQueueCounts: WorkspaceStateAppliers["setReviewQueueCounts"];
  setSelectedDocumentId: WorkspaceStateAppliers["setSelectedDocumentId"];
  setSelectedRepair: Dispatch<SetStateAction<RepairDetail | null>>;
  invalidateRepairDetailLoaderState: () => void;
  setLastUploadedDocument: Dispatch<SetStateAction<DocumentItem | null>>;
  setErrorMessage: WorkspaceStateAppliers["setErrorMessage"];
  setShowTechAdminTab: WorkspaceResetters["setShowTechAdminTab"];
  setShowPasswordChange: WorkspaceResetters["setShowPasswordChange"];
  setActiveTechAdminTab: WorkspaceResetters["setActiveTechAdminTab"];
  setActiveQualityTab: WorkspaceResetters["setActiveQualityTab"];
  resetFleetState: WorkspaceResetters["resetFleetState"];
  resetOperationsState: WorkspaceResetters["resetOperationsState"];
  resetLaborNormsState: WorkspaceResetters["resetLaborNormsState"];
  resetReviewRulesState: WorkspaceResetters["resetReviewRulesState"];
  resetReviewWorkflowState: WorkspaceResetters["resetReviewWorkflowState"];
  resetRepairDocumentsWorkflowState: WorkspaceResetters["resetRepairDocumentsWorkflowState"];
  resetRepairEditingState: WorkspaceResetters["resetRepairEditingState"];
  resetDocumentsWorkspaceState: WorkspaceResetters["resetDocumentsWorkspaceState"];
  resetUsersState: WorkspaceResetters["resetUsersState"];
  resetServicesState: WorkspaceResetters["resetServicesState"];
  resetOcrAdminState: WorkspaceResetters["resetOcrAdminState"];
  resetBackupsState: WorkspaceResetters["resetBackupsState"];
  resetHistoricalImportsState: WorkspaceResetters["resetHistoricalImportsState"];
  setDocumentVehicleForm: Dispatch<SetStateAction<DocumentVehicleFormState>>;
  createEmptyDocumentVehicleForm: () => DocumentVehicleFormState;
};

export function buildWorkspaceLifecycleAdapters({
  setUser,
  setSummary,
  setDataQuality,
  setDataQualityDetails,
  setDocuments,
  setReviewQueue,
  setReviewQueueCounts,
  setSelectedDocumentId,
  setSelectedRepair,
  invalidateRepairDetailLoaderState,
  setLastUploadedDocument,
  setErrorMessage,
  setShowTechAdminTab,
  setShowPasswordChange,
  setActiveTechAdminTab,
  setActiveQualityTab,
  resetFleetState,
  resetOperationsState,
  resetLaborNormsState,
  resetReviewRulesState,
  resetReviewWorkflowState,
  resetRepairDocumentsWorkflowState,
  resetRepairEditingState,
  resetDocumentsWorkspaceState,
  resetUsersState,
  resetServicesState,
  resetOcrAdminState,
  resetBackupsState,
  resetHistoricalImportsState,
  setDocumentVehicleForm,
  createEmptyDocumentVehicleForm,
}: BuildWorkspaceLifecycleAdaptersParams): {
  workspaceState: WorkspaceStateAppliers;
  resetters: WorkspaceResetters;
} {
  return {
    workspaceState: {
      setUser,
      setSummary,
      setDataQuality,
      setDataQualityDetails,
      setDocuments,
      setReviewQueue,
      setReviewQueueCounts,
      setSelectedDocumentId,
      clearSelectedRepair: () => {
        invalidateRepairDetailLoaderState();
        setSelectedRepair(null);
      },
      setLastUploadedDocument,
      setErrorMessage,
    },
    resetters: {
      setShowTechAdminTab,
      setShowPasswordChange,
      setActiveTechAdminTab,
      setActiveQualityTab,
      resetFleetState,
      resetOperationsState,
      resetLaborNormsState,
      resetReviewRulesState,
      resetReviewWorkflowState,
      resetRepairDocumentsWorkflowState,
      resetRepairEditingState,
      resetDocumentsWorkspaceState,
      resetUsersState,
      resetServicesState,
      resetOcrAdminState,
      resetBackupsState,
      resetHistoricalImportsState,
      setDocumentVehicleFormToEmpty: () => {
        setDocumentVehicleForm(createEmptyDocumentVehicleForm());
      },
    },
  };
}
