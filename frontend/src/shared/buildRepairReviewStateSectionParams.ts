import type { BuildRepairWorkspacePropsParams } from "./buildRepairWorkspaceProps";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

type RepairReviewStateSectionParams = Pick<
  BuildRepairWorkspacePropsParams,
  | "selectedRepairDocument"
  | "reviewDocumentPreviewLoading"
  | "reviewDocumentPreviewKind"
  | "reviewDocumentPreviewUrl"
  | "documentOpenLoadingId"
  | "canLinkVehicleFromSelectedDocument"
  | "selectedRepairDocumentExtractedFields"
  | "reviewVehicleSearch"
  | "reviewVehicleSearchLoading"
  | "reviewVehicleLinkingId"
  | "reviewVehicleSearchResults"
  | "selectedRepairDocumentOcrServiceName"
  | "reviewServiceName"
  | "services"
  | "reviewServiceAssigning"
  | "reviewServiceSaving"
  | "reviewFieldSaving"
  | "showReviewServiceEditor"
  | "reviewServiceForm"
  | "canConfirmSelectedReview"
  | "reviewReadyFieldsCount"
  | "reviewRequiredFieldComparisons"
  | "showReviewFieldEditor"
  | "reviewFieldDraft"
  | "reviewMissingRequiredFields"
  | "selectedRepairDocumentFieldSnapshots"
  | "selectedRepairDocumentPayload"
  | "selectedRepairDocumentWorks"
  | "selectedRepairDocumentParts"
  | "reviewActionComment"
  | "reviewActionLoading"
  | "canCreateVehicleFromSelectedDocument"
  | "documentVehicleForm"
  | "documentVehicleSaving"
>;

export function buildRepairReviewStateSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): RepairReviewStateSectionParams {
  const {
    rootState,
    servicesAdmin,
    repairDerivedViewModel,
    repairReviewWorkflow,
    repairWorkspaceActions,
    repairDocumentsWorkflow,
  } = context;

  return {
    selectedRepairDocument: repairDerivedViewModel.selectedRepairDocument,
    reviewDocumentPreviewLoading: repairReviewWorkflow.reviewDocumentPreviewLoading,
    reviewDocumentPreviewKind: repairReviewWorkflow.reviewDocumentPreviewKind,
    reviewDocumentPreviewUrl: repairReviewWorkflow.reviewDocumentPreviewUrl,
    documentOpenLoadingId: repairDocumentsWorkflow.documentOpenLoadingId,
    canLinkVehicleFromSelectedDocument: repairDerivedViewModel.canLinkVehicleFromSelectedDocument,
    selectedRepairDocumentExtractedFields: repairDerivedViewModel.selectedRepairDocumentExtractedFields,
    reviewVehicleSearch: repairReviewWorkflow.reviewVehicleSearch,
    reviewVehicleSearchLoading: repairReviewWorkflow.reviewVehicleSearchLoading,
    reviewVehicleLinkingId: repairReviewWorkflow.reviewVehicleLinkingId,
    reviewVehicleSearchResults: repairReviewWorkflow.reviewVehicleSearchResults,
    selectedRepairDocumentOcrServiceName: repairDerivedViewModel.selectedRepairDocumentOcrServiceName,
    reviewServiceName: repairReviewWorkflow.reviewServiceName,
    services: servicesAdmin.services,
    reviewServiceAssigning: repairReviewWorkflow.reviewServiceAssigning,
    reviewServiceSaving: repairReviewWorkflow.reviewServiceSaving,
    reviewFieldSaving: repairReviewWorkflow.reviewFieldSaving,
    showReviewServiceEditor: repairReviewWorkflow.showReviewServiceEditor,
    reviewServiceForm: repairReviewWorkflow.reviewServiceForm,
    canConfirmSelectedReview: repairDerivedViewModel.canConfirmSelectedReview,
    reviewReadyFieldsCount: repairDerivedViewModel.reviewReadyFieldsCount,
    reviewRequiredFieldComparisons: repairDerivedViewModel.reviewRequiredFieldComparisons,
    showReviewFieldEditor: repairReviewWorkflow.showReviewFieldEditor,
    reviewFieldDraft: repairReviewWorkflow.reviewFieldDraft,
    reviewMissingRequiredFields: repairDerivedViewModel.reviewMissingRequiredFields,
    selectedRepairDocumentFieldSnapshots: repairDerivedViewModel.selectedRepairDocumentFieldSnapshots,
    selectedRepairDocumentPayload: repairDerivedViewModel.selectedRepairDocumentPayload,
    selectedRepairDocumentWorks: repairDerivedViewModel.selectedRepairDocumentWorks,
    selectedRepairDocumentParts: repairDerivedViewModel.selectedRepairDocumentParts,
    reviewActionComment: repairReviewWorkflow.reviewActionComment,
    reviewActionLoading: repairReviewWorkflow.reviewActionLoading,
    canCreateVehicleFromSelectedDocument: repairDerivedViewModel.canCreateVehicleFromSelectedDocument,
    documentVehicleForm: rootState.documentVehicleForm,
    documentVehicleSaving: repairWorkspaceActions.documentVehicleSaving,
  };
}
