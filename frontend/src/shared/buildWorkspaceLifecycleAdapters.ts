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
  setVehicles: WorkspaceStateAppliers["setVehicles"];
  setDocuments: WorkspaceStateAppliers["setDocuments"];
  setReviewQueue: WorkspaceStateAppliers["setReviewQueue"];
  setReviewQueueCounts: WorkspaceStateAppliers["setReviewQueueCounts"];
  setSelectedDocumentId: WorkspaceStateAppliers["setSelectedDocumentId"];
  setSelectedRepair: Dispatch<SetStateAction<RepairDetail | null>>;
  setLastUploadedDocument: Dispatch<SetStateAction<DocumentItem | null>>;
  setErrorMessage: WorkspaceStateAppliers["setErrorMessage"];
  applyBootstrapVehicleList: WorkspaceStateAppliers["applyBootstrapVehicleList"];
  applyBootstrapUsers: WorkspaceStateAppliers["applyBootstrapUsers"];
  applyBootstrapLaborNorms: WorkspaceStateAppliers["applyBootstrapLaborNorms"];
  applyBootstrapServices: WorkspaceStateAppliers["applyBootstrapServices"];
  applyBootstrapReviewRules: WorkspaceStateAppliers["applyBootstrapReviewRules"];
  applyBootstrapOcrAdmin: WorkspaceStateAppliers["applyBootstrapOcrAdmin"];
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
  setVehicles,
  setDocuments,
  setReviewQueue,
  setReviewQueueCounts,
  setSelectedDocumentId,
  setSelectedRepair,
  setLastUploadedDocument,
  setErrorMessage,
  applyBootstrapVehicleList,
  applyBootstrapUsers,
  applyBootstrapLaborNorms,
  applyBootstrapServices,
  applyBootstrapReviewRules,
  applyBootstrapOcrAdmin,
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
      setVehicles,
      setDocuments,
      setReviewQueue,
      setReviewQueueCounts,
      setSelectedDocumentId,
      clearSelectedRepair: () => {
        setSelectedRepair(null);
      },
      setLastUploadedDocument,
      setErrorMessage,
      applyBootstrapVehicleList,
      applyBootstrapUsers,
      applyBootstrapLaborNorms,
      applyBootstrapServices,
      applyBootstrapReviewRules,
      applyBootstrapOcrAdmin,
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
