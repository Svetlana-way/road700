import type { BuildRepairWorkspacePropsParams } from "./buildRepairWorkspaceProps";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

type RepairReviewActionSectionParams = Pick<
  BuildRepairWorkspacePropsParams,
  | "handleOpenDocumentFile"
  | "setReviewVehicleSearch"
  | "handleSearchReviewVehicles"
  | "handleLinkReviewVehicle"
  | "setReviewServiceName"
  | "setShowReviewServiceEditor"
  | "setShowReviewFieldEditor"
  | "setReviewServiceForm"
  | "assignReviewService"
  | "handleAssignReviewService"
  | "handleCreateReviewService"
  | "fillReviewFieldDraftFromOcr"
  | "updateReviewFieldDraft"
  | "handleSaveReviewFields"
  | "setReviewActionComment"
  | "handleReviewAction"
  | "setDocumentVehicleForm"
  | "handleCreateVehicleFromDocument"
>;

export function buildRepairReviewActionSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): RepairReviewActionSectionParams {
  const { rootState, repairReviewWorkflow, repairWorkspaceActions, repairDocumentsWorkflow } = context;

  return {
    handleOpenDocumentFile: repairDocumentsWorkflow.handleOpenDocumentFile,
    setReviewVehicleSearch: repairReviewWorkflow.setReviewVehicleSearch,
    handleSearchReviewVehicles: repairReviewWorkflow.handleSearchReviewVehicles,
    handleLinkReviewVehicle: repairReviewWorkflow.handleLinkReviewVehicle,
    setReviewServiceName: repairReviewWorkflow.setReviewServiceName,
    setShowReviewServiceEditor: repairReviewWorkflow.setShowReviewServiceEditor,
    setShowReviewFieldEditor: repairReviewWorkflow.setShowReviewFieldEditor,
    setReviewServiceForm: repairReviewWorkflow.setReviewServiceForm,
    assignReviewService: repairReviewWorkflow.assignReviewService,
    handleAssignReviewService: repairReviewWorkflow.handleAssignReviewService,
    handleCreateReviewService: repairReviewWorkflow.handleCreateReviewService,
    fillReviewFieldDraftFromOcr: repairReviewWorkflow.fillReviewFieldDraftFromOcr,
    updateReviewFieldDraft: repairReviewWorkflow.updateReviewFieldDraft,
    handleSaveReviewFields: repairReviewWorkflow.handleSaveReviewFields,
    setReviewActionComment: repairReviewWorkflow.setReviewActionComment,
    handleReviewAction: repairReviewWorkflow.handleReviewAction,
    setDocumentVehicleForm: rootState.setDocumentVehicleForm,
    handleCreateVehicleFromDocument: repairWorkspaceActions.handleCreateVehicleFromDocument,
  };
}
