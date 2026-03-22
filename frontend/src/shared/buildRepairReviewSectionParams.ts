import {
  formatCompactNumber,
  formatConfidence,
  formatConfidenceLabel,
  formatDateTime,
  formatDocumentKind,
  formatDocumentStatusLabel,
  formatHours,
  formatLaborNormApplicability,
  formatManualReviewReasons,
  formatMoney,
  formatOcrProfileMeta,
  formatSourceTypeLabel,
  formatVehicleTypeLabel,
  getConfidenceColor,
  statusColor,
} from "./displayFormatters";
import { formatVehicle } from "./fleetDocumentHelpers";
import type { BuildRepairWorkspacePropsParams } from "./buildRepairWorkspaceProps";
import {
  formatOcrLineUnit,
  readNumberValue,
  readStringValue,
} from "./repairReportHelpers";
import { getReviewComparisonColor, getReviewComparisonLabel } from "./repairUiHelpers";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

type RepairReviewSectionParams = Pick<
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
  | "setShowReviewFieldEditor"
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
  | "handleOpenDocumentFile"
  | "setReviewVehicleSearch"
  | "handleSearchReviewVehicles"
  | "handleLinkReviewVehicle"
  | "setReviewServiceName"
  | "setShowReviewServiceEditor"
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
  | "getReviewComparisonColor"
  | "getReviewComparisonLabel"
  | "getConfidenceColor"
  | "formatConfidenceLabel"
  | "formatMoney"
  | "formatCompactNumber"
  | "formatHours"
  | "formatManualReviewReasons"
  | "formatOcrProfileMeta"
  | "formatLaborNormApplicability"
  | "readStringValue"
  | "readNumberValue"
  | "formatOcrLineUnit"
  | "formatDocumentKind"
  | "statusColor"
  | "formatDocumentStatusLabel"
  | "formatDateTime"
  | "formatSourceTypeLabel"
  | "formatConfidence"
  | "formatVehicle"
  | "formatVehicleTypeLabel"
>;

export function buildRepairReviewSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): RepairReviewSectionParams {
  const { rootState, servicesAdmin, repairDerivedViewModel, repairReviewWorkflow, repairWorkspaceActions, repairDocumentsWorkflow } =
    context;

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
    setShowReviewFieldEditor: repairReviewWorkflow.setShowReviewFieldEditor,
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
    handleOpenDocumentFile: repairDocumentsWorkflow.handleOpenDocumentFile,
    setReviewVehicleSearch: repairReviewWorkflow.setReviewVehicleSearch,
    handleSearchReviewVehicles: repairReviewWorkflow.handleSearchReviewVehicles,
    handleLinkReviewVehicle: repairReviewWorkflow.handleLinkReviewVehicle,
    setReviewServiceName: repairReviewWorkflow.setReviewServiceName,
    setShowReviewServiceEditor: repairReviewWorkflow.setShowReviewServiceEditor,
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
    getReviewComparisonColor,
    getReviewComparisonLabel,
    getConfidenceColor,
    formatConfidenceLabel,
    formatMoney,
    formatCompactNumber,
    formatHours,
    formatManualReviewReasons,
    formatOcrProfileMeta,
    formatLaborNormApplicability,
    readStringValue,
    readNumberValue,
    formatOcrLineUnit,
    formatDocumentKind,
    statusColor,
    formatDocumentStatusLabel,
    formatDateTime,
    formatSourceTypeLabel,
    formatConfidence,
    formatVehicle,
    formatVehicleTypeLabel,
  };
}
