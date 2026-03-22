import { documentKindOptions, historyFilters } from "./appUiConfig";
import {
  checkSeverityColor,
  executiveRiskColor,
  formatExecutiveRiskLabel,
  formatHistoryActionLabel,
  formatRepairStatus,
  formatReviewPriority,
  formatStatus,
  importJobStatusColor,
  reviewPriorityColor,
} from "./displayFormatters";
import { isPlaceholderVehicle } from "./fleetDocumentHelpers";
import type { BuildRepairWorkspacePropsParams } from "./buildRepairWorkspaceProps";
import {
  buildCheckPayloadDetails,
  formatWorkLaborNormMeta,
  getCheckLinkedRepairId,
  readCheckResolutionMeta,
} from "./repairReportHelpers";
import {
  historyDetailFormatters,
  type WorkspaceContentSectionBuilderContext,
} from "./workspaceContentSectionBuilderContext";

type RepairDetailSectionParams = Pick<
  BuildRepairWorkspacePropsParams,
  | "selectedRepairAwaitingOcr"
  | "selectedRepairUnresolvedChecks"
  | "selectedRepairHasBlockingFindings"
  | "selectedRepairComparisonAttentionCount"
  | "selectedRepairDocumentManualReviewReasons"
  | "selectedRepairReportSections"
  | "showRepairOverviewDetails"
  | "setShowRepairOverviewDetails"
  | "openRepairByIds"
  | "isPlaceholderVehicle"
  | "formatRepairStatus"
  | "executiveRiskColor"
  | "formatExecutiveRiskLabel"
  | "buildCheckPayloadDetails"
  | "getCheckLinkedRepairId"
  | "checkSeverityColor"
  | "formatStatus"
  | "documentKindOptions"
  | "attachedDocumentKind"
  | "attachedDocumentNotes"
  | "attachedDocumentFile"
  | "attachedFileInputRef"
  | "attachDocumentLoading"
  | "reprocessLoading"
  | "selectedDocumentId"
  | "documentComparisonLoadingId"
  | "primaryDocumentLoadingId"
  | "documentArchiveLoadingId"
  | "documentComparison"
  | "documentComparisonComment"
  | "documentComparisonReviewLoading"
  | "setAttachedDocumentKind"
  | "setAttachedDocumentNotes"
  | "setAttachedDocumentFile"
  | "handleAttachDocumentToRepair"
  | "handleReprocessDocumentById"
  | "handleCompareWithPrimary"
  | "handleSetPrimaryDocument"
  | "handleArchiveDocument"
  | "setDocumentComparison"
  | "setDocumentComparisonComment"
  | "handleReviewDocumentComparison"
  | "importJobStatusColor"
  | "filteredDocumentHistory"
  | "filteredRepairHistory"
  | "historySearch"
  | "historyFilter"
  | "historyFilters"
  | "checkComments"
  | "checkActionLoadingId"
  | "setHistorySearch"
  | "setHistoryFilter"
  | "setCheckComments"
  | "handleCheckResolution"
  | "formatWorkLaborNormMeta"
  | "readCheckResolutionMeta"
  | "formatHistoryActionLabel"
  | "historyDetailFormatters"
  | "reviewPriorityColor"
  | "formatReviewPriority"
>;

export function buildRepairDetailSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): RepairDetailSectionParams {
  const { rootState, documentsWorkspace, navigation, repairDerivedViewModel, repairWorkspaceActions, repairDocumentsWorkflow, repairHistoryFilters } =
    context;

  return {
    selectedRepairAwaitingOcr: repairDerivedViewModel.selectedRepairAwaitingOcr,
    selectedRepairUnresolvedChecks: repairDerivedViewModel.selectedRepairUnresolvedChecks,
    selectedRepairHasBlockingFindings: repairDerivedViewModel.selectedRepairHasBlockingFindings,
    selectedRepairComparisonAttentionCount: repairDerivedViewModel.selectedRepairComparisonAttentionCount,
    selectedRepairDocumentManualReviewReasons: repairDerivedViewModel.selectedRepairDocumentManualReviewReasons,
    selectedRepairReportSections: repairDerivedViewModel.selectedRepairReportSections,
    showRepairOverviewDetails: rootState.showRepairOverviewDetails,
    setShowRepairOverviewDetails: rootState.setShowRepairOverviewDetails,
    openRepairByIds: navigation.openRepairByIds,
    isPlaceholderVehicle,
    formatRepairStatus,
    executiveRiskColor,
    formatExecutiveRiskLabel,
    buildCheckPayloadDetails,
    getCheckLinkedRepairId,
    checkSeverityColor,
    formatStatus,
    documentKindOptions,
    attachedDocumentKind: repairDocumentsWorkflow.attachedDocumentKind,
    attachedDocumentNotes: repairDocumentsWorkflow.attachedDocumentNotes,
    attachedDocumentFile: repairDocumentsWorkflow.attachedDocumentFile,
    attachedFileInputRef: rootState.attachedFileInputRef,
    attachDocumentLoading: repairDocumentsWorkflow.attachDocumentLoading,
    reprocessLoading: documentsWorkspace.reprocessLoading,
    selectedDocumentId: rootState.selectedDocumentId,
    documentComparisonLoadingId: repairDocumentsWorkflow.documentComparisonLoadingId,
    primaryDocumentLoadingId: repairDocumentsWorkflow.primaryDocumentLoadingId,
    documentArchiveLoadingId: documentsWorkspace.documentArchiveLoadingId,
    documentComparison: repairDocumentsWorkflow.documentComparison,
    documentComparisonComment: repairDocumentsWorkflow.documentComparisonComment,
    documentComparisonReviewLoading: repairDocumentsWorkflow.documentComparisonReviewLoading,
    setAttachedDocumentKind: repairDocumentsWorkflow.setAttachedDocumentKind,
    setAttachedDocumentNotes: repairDocumentsWorkflow.setAttachedDocumentNotes,
    setAttachedDocumentFile: repairDocumentsWorkflow.setAttachedDocumentFile,
    handleAttachDocumentToRepair: repairDocumentsWorkflow.handleAttachDocumentToRepair,
    handleReprocessDocumentById: documentsWorkspace.handleReprocessDocumentById,
    handleCompareWithPrimary: repairDocumentsWorkflow.handleCompareWithPrimary,
    handleSetPrimaryDocument: repairDocumentsWorkflow.handleSetPrimaryDocument,
    handleArchiveDocument: documentsWorkspace.handleArchiveDocument,
    setDocumentComparison: repairDocumentsWorkflow.setDocumentComparison,
    setDocumentComparisonComment: repairDocumentsWorkflow.setDocumentComparisonComment,
    handleReviewDocumentComparison: repairDocumentsWorkflow.handleReviewDocumentComparison,
    importJobStatusColor,
    filteredDocumentHistory: repairHistoryFilters.filteredDocumentHistory,
    filteredRepairHistory: repairHistoryFilters.filteredRepairHistory,
    historySearch: rootState.historySearch,
    historyFilter: rootState.historyFilter,
    historyFilters,
    checkComments: rootState.checkComments,
    checkActionLoadingId: repairWorkspaceActions.checkActionLoadingId,
    setHistorySearch: rootState.setHistorySearch,
    setHistoryFilter: rootState.setHistoryFilter,
    setCheckComments: rootState.setCheckComments,
    handleCheckResolution: repairWorkspaceActions.handleCheckResolution,
    formatWorkLaborNormMeta,
    readCheckResolutionMeta,
    formatHistoryActionLabel,
    historyDetailFormatters,
    reviewPriorityColor,
    formatReviewPriority,
  };
}
