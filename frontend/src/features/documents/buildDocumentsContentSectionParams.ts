import {
  formatDocumentKind,
  formatDocumentStatusLabel,
  formatLaborNormApplicability,
  formatManualReviewReasons,
  formatOcrProfileMeta,
  importJobStatusColor,
  isDocumentAwaitingOcr,
  statusColor,
} from "../../entities/document/formatters";
import { formatReviewPriority, reviewPriorityColor } from "../../entities/repair/formatters";
import { rootDocumentKindOptions, reviewQueueFilters } from "../../shared/appUiConfig";
import {
  formatConfidence,
  formatMoney,
  formatStatus,
} from "../../shared/formattersCore";
import { documentHasActiveImportJob } from "../../entities/document/formatters";
import { formatVehicle, isPlaceholderVehicle } from "../../entities/vehicle/helpers";
import type { BuildDocumentsWorkspacePropsParams } from "./buildDocumentsWorkspaceProps";
import type { WorkspaceContentSectionBuilderContext } from "../../shared/workspaceContentSectionBuilderContext";

export function buildDocumentsContentSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): BuildDocumentsWorkspacePropsParams {
  const {
    rootState,
    documentsWorkspace,
    navigation,
    repairDerivedViewModel,
    repairEditingWorkflow,
    repairWorkspaceActions,
    fleetWorkspace,
  } = context;

  return {
    activeWorkspaceTab: rootState.activeWorkspaceTab,
    uploadForm: documentsWorkspace.uploadForm,
    vehicles: fleetWorkspace.vehicleOptions.filter((item) => !isPlaceholderVehicle(item.external_id)),
    rootDocumentKindOptions,
    selectedFiles: documentsWorkspace.selectedFiles,
    uploadMissingRequirements: repairDerivedViewModel.uploadMissingRequirements,
    uploadLoading: documentsWorkspace.uploadLoading,
    lastUploadedDocument: documentsWorkspace.lastUploadedDocument,
    uploadFileInputRef: documentsWorkspace.uploadFileInputRef,
    handleUpload: documentsWorkspace.handleUpload,
    updateUploadFormField: documentsWorkspace.updateUploadFormField,
    handleUploadFileSelect: documentsWorkspace.handleUploadFileSelect,
    openRepairByIds: navigation.openRepairByIds,
    setLastUploadedDocument: documentsWorkspace.setLastUploadedDocument,
    formatVehicle,
    formatDocumentKind,
    importJobStatusColor,
    formatStatus,
    statusColor,
    formatDocumentStatusLabel,
    isDocumentAwaitingOcr,
    documentHasActiveImportJob,
    isPlaceholderVehicle,
    formatConfidence,
    reviewQueueFilters,
    reviewQueueCounts: rootState.reviewQueueCounts,
    reviewQueueTotal: rootState.reviewQueueTotal,
    reviewQueueLimit: rootState.reviewQueueLimit,
    reviewQueueOffset: rootState.reviewQueueOffset,
    selectedReviewCategory: rootState.selectedReviewCategory,
    reviewQueue: rootState.reviewQueue,
    userRole: rootState.user?.role,
    reprocessLoading: documentsWorkspace.reprocessLoading,
    reprocessLoadingId: documentsWorkspace.reprocessLoadingId,
    selectedDocumentId: rootState.selectedDocumentId,
    setSelectedReviewCategory: (category) => {
      rootState.setReviewQueueOffset(0);
      rootState.setSelectedReviewCategory(category);
    },
    goToPreviousReviewQueuePage: () => {
      rootState.setReviewQueueOffset((current) => Math.max(0, current - rootState.reviewQueueLimit));
    },
    goToNextReviewQueuePage: () => {
      rootState.setReviewQueueOffset((current) => current + rootState.reviewQueueLimit);
    },
    handleOpenRepair: repairWorkspaceActions.handleOpenRepair,
    handleReprocessDocumentById: documentsWorkspace.handleReprocessDocumentById,
    reviewPriorityColor,
    formatReviewPriority,
    formatMoney,
    documents: rootState.documents,
    batchReprocessLimit: documentsWorkspace.batchReprocessLimit,
    batchReprocessStatusFilter: documentsWorkspace.batchReprocessStatusFilter,
    batchReprocessPrimaryOnly: documentsWorkspace.batchReprocessPrimaryOnly,
    batchReprocessLoading: documentsWorkspace.batchReprocessLoading,
    repairDeleteLoading: repairEditingWorkflow.repairDeleteLoading,
    documentArchiveLoadingId: documentsWorkspace.documentArchiveLoadingId,
    setBatchReprocessLimit: documentsWorkspace.setBatchReprocessLimit,
    setBatchReprocessStatusFilter: documentsWorkspace.setBatchReprocessStatusFilter,
    setBatchReprocessPrimaryOnly: documentsWorkspace.setBatchReprocessPrimaryOnly,
    handleBatchReprocessDocuments: documentsWorkspace.handleBatchReprocessDocuments,
    handleReprocessDocument: documentsWorkspace.handleReprocessDocument,
    handleDeleteRepair: repairEditingWorkflow.handleDeleteRepair,
    handleArchiveDocument: documentsWorkspace.handleArchiveDocument,
    formatManualReviewReasons,
    formatOcrProfileMeta,
    formatLaborNormApplicability,
  };
}
