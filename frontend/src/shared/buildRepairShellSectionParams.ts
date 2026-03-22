import { repairTabDescriptions, workspaceTabReturnLabels } from "./appUiConfig";
import type { BuildRepairWorkspacePropsParams } from "./buildRepairWorkspaceProps";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

type RepairShellSectionParams = Pick<
  BuildRepairWorkspacePropsParams,
  | "repairHasReturnTarget"
  | "workspaceTabReturnLabels"
  | "repairReturnTab"
  | "returnFromRepairPage"
  | "userRole"
  | "repairLoading"
  | "selectedRepair"
  | "selectedReviewItem"
  | "isEditingRepair"
  | "saveRepairLoading"
  | "repairDraft"
  | "repairExportLoading"
  | "repairArchiveLoading"
  | "repairDeleteLoading"
  | "handleCancelRepairEdit"
  | "handleSaveRepair"
  | "handleExportRepair"
  | "handleStartRepairEdit"
  | "handleArchiveRepair"
  | "handleDeleteRepair"
  | "activeRepairTab"
  | "repairTabDescriptions"
  | "handleRepairTabChange"
  | "updateRepairDraftField"
  | "addWorkDraft"
  | "updateWorkDraft"
  | "removeWorkDraft"
  | "addPartDraft"
  | "updatePartDraft"
  | "removePartDraft"
>;

export function buildRepairShellSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): RepairShellSectionParams {
  const { rootState, navigation, repairLoading, repairDerivedViewModel, repairEditingWorkflow, repairWorkspaceActions } =
    context;

  return {
    repairHasReturnTarget: navigation.repairHasReturnTarget,
    workspaceTabReturnLabels,
    repairReturnTab: navigation.repairReturnTab,
    returnFromRepairPage: navigation.returnFromRepairPage,
    userRole: rootState.user?.role,
    repairLoading,
    selectedRepair: rootState.selectedRepair,
    selectedReviewItem: repairDerivedViewModel.selectedReviewItem,
    isEditingRepair: repairEditingWorkflow.isEditingRepair,
    saveRepairLoading: repairEditingWorkflow.saveRepairLoading,
    repairDraft: repairEditingWorkflow.repairDraft,
    repairExportLoading: repairWorkspaceActions.repairExportLoading,
    repairArchiveLoading: repairEditingWorkflow.repairArchiveLoading,
    repairDeleteLoading: repairEditingWorkflow.repairDeleteLoading,
    handleCancelRepairEdit: repairWorkspaceActions.handleCancelRepairEdit,
    handleSaveRepair: repairEditingWorkflow.handleSaveRepair,
    handleExportRepair: repairWorkspaceActions.handleExportRepair,
    handleStartRepairEdit: repairWorkspaceActions.handleStartRepairEdit,
    handleArchiveRepair: repairEditingWorkflow.handleArchiveRepair,
    handleDeleteRepair: repairEditingWorkflow.handleDeleteRepair,
    activeRepairTab: rootState.activeRepairTab,
    repairTabDescriptions,
    handleRepairTabChange: navigation.handleRepairTabChange,
    updateRepairDraftField: repairEditingWorkflow.updateRepairDraftField,
    addWorkDraft: repairEditingWorkflow.addWorkDraft,
    updateWorkDraft: repairEditingWorkflow.updateWorkDraft,
    removeWorkDraft: repairEditingWorkflow.removeWorkDraft,
    addPartDraft: repairEditingWorkflow.addPartDraft,
    updatePartDraft: repairEditingWorkflow.updatePartDraft,
    removePartDraft: repairEditingWorkflow.removePartDraft,
  };
}
