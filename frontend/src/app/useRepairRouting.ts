import { useAppNavigation } from "../hooks/useAppNavigation";
import { useRepairDetailLoader } from "../hooks/useRepairDetailLoader";
import { resolveRepairDocumentId } from "../entities/repair/helpers";
import type { RepairDetail } from "../contracts/domain/repair";
import type { DocumentItem } from "../contracts/domain/workspace";

type AppRootState = ReturnType<typeof import("../hooks/useAppRootState").useAppRootState>;
type DocumentsWorkspaceState = ReturnType<typeof import("../hooks/useDocumentsWorkspace").useDocumentsWorkspace>;
type WorkspaceSupportModulesState =
  ReturnType<typeof import("../hooks/useWorkspaceSupportModules").useWorkspaceSupportModules>;

type UseRepairRoutingParams = {
  token: string;
  rootState: AppRootState;
  documentsWorkspace: DocumentsWorkspaceState;
  workspaceSupportModules: WorkspaceSupportModulesState;
};

export function useRepairRouting({
  token,
  rootState,
  documentsWorkspace,
  workspaceSupportModules,
}: UseRepairRoutingParams) {
  const repairDetailLoader = useRepairDetailLoader<RepairDetail, DocumentItem>({
    setErrorMessage: rootState.setErrorMessage,
    setSelectedRepair: rootState.setSelectedRepair,
    setSelectedDocumentId: rootState.setSelectedDocumentId,
    setLastUploadedDocument: documentsWorkspace.setLastUploadedDocument,
    setCheckComments: rootState.setCheckComments,
    setHistoryFilter: rootState.setHistoryFilter,
    setHistorySearch: rootState.setHistorySearch,
    isEditingRepairRef: rootState.isEditingRepairRef,
    syncRepairDraftFromRepairRef: rootState.syncRepairDraftFromRepairRef,
    resetRepairDocumentsWorkflowStateRef: rootState.resetRepairDocumentsWorkflowStateRef,
  });
  const { repairLoading, loadRepairDetail, invalidateRepairDetailLoaderState } = repairDetailLoader;
  const selectedRepairDefaultDocumentId = rootState.selectedRepair
    ? resolveRepairDocumentId(rootState.selectedRepair, null)
    : null;
  const navigation = useAppNavigation({
    userRole: rootState.user?.role,
    token,
    activeWorkspaceTab: rootState.activeWorkspaceTab,
    setActiveWorkspaceTab: rootState.setActiveWorkspaceTab,
    activeAdminTab: rootState.activeAdminTab,
    setActiveAdminTab: rootState.setActiveAdminTab,
    activeTechAdminTab: rootState.activeTechAdminTab,
    setActiveTechAdminTab: rootState.setActiveTechAdminTab,
    activeRepairTab: rootState.activeRepairTab,
    setActiveRepairTab: rootState.setActiveRepairTab,
    showTechAdminTab: rootState.showTechAdminTab,
    setShowTechAdminTab: rootState.setShowTechAdminTab,
    fleetViewMode: workspaceSupportModules.fleetWorkspace.fleetViewMode,
    setFleetViewMode: workspaceSupportModules.fleetWorkspace.setFleetViewMode,
    selectedFleetVehicleId: workspaceSupportModules.fleetWorkspace.selectedFleetVehicleId,
    selectedFleetVehicleMissing: workspaceSupportModules.fleetWorkspace.selectedFleetVehicleMissing,
    setSelectedFleetVehicleId: workspaceSupportModules.fleetWorkspace.setSelectedFleetVehicleId,
    selectedRepairId: rootState.selectedRepair?.id ?? null,
    selectedRepairDefaultDocumentId,
    selectedDocumentId: rootState.selectedDocumentId,
    setSelectedDocumentId: rootState.setSelectedDocumentId,
    clearSelectedRepair: () => {
      invalidateRepairDetailLoaderState();
      rootState.setSelectedRepair(null);
    },
    loadRepairDetail,
  });

  return {
    repairLoading,
    loadRepairDetail,
    invalidateRepairDetailLoaderState,
    navigation,
  };
}
