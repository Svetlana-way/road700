import { type ComponentProps } from "react";
import { WorkspaceDocumentsPanel } from "../components/WorkspaceDocumentsPanel";
import type { WorkspaceTab } from "./appRoute";

type WorkspaceDocumentsPanelProps = ComponentProps<typeof WorkspaceDocumentsPanel>;
type DocumentsUploadProps = WorkspaceDocumentsPanelProps["uploadProps"];
type ReviewQueueProps = WorkspaceDocumentsPanelProps["reviewQueueProps"];
type DocumentsListProps = WorkspaceDocumentsPanelProps["documentsListProps"];
export type BuildDocumentsWorkspacePropsParams = {
  activeWorkspaceTab: WorkspaceTab;
  uploadForm: DocumentsUploadProps["uploadForm"];
  vehicles: DocumentsUploadProps["vehicles"];
  rootDocumentKindOptions: DocumentsUploadProps["rootDocumentKindOptions"];
  selectedFile: DocumentsUploadProps["selectedFile"];
  uploadMissingRequirements: DocumentsUploadProps["uploadMissingRequirements"];
  uploadLoading: DocumentsUploadProps["uploadLoading"];
  lastUploadedDocument: DocumentsUploadProps["lastUploadedDocument"];
  uploadFileInputRef: DocumentsUploadProps["uploadFileInputRef"];
  handleUpload: DocumentsUploadProps["onSubmit"];
  updateUploadFormField: DocumentsUploadProps["onUploadFieldChange"];
  handleUploadFileSelect: DocumentsUploadProps["onFileSelect"];
  openRepairByIds: (...args: Parameters<DocumentsUploadProps["onOpenUploadedRepair"]>) => void | Promise<void>;
  setLastUploadedDocument: (value: DocumentsUploadProps["lastUploadedDocument"]) => void;
  formatVehicle: DocumentsUploadProps["formatVehicle"];
  formatDocumentKind: DocumentsUploadProps["formatDocumentKind"];
  importJobStatusColor: DocumentsUploadProps["importJobStatusColor"];
  formatStatus: DocumentsUploadProps["formatStatus"];
  statusColor: DocumentsUploadProps["statusColor"];
  formatDocumentStatusLabel: DocumentsUploadProps["formatDocumentStatusLabel"];
  isDocumentAwaitingOcr: DocumentsUploadProps["isDocumentAwaitingOcr"];
  documentHasActiveImportJob: DocumentsUploadProps["documentHasActiveImportJob"];
  isPlaceholderVehicle: DocumentsUploadProps["isPlaceholderVehicle"];
  formatConfidence: DocumentsUploadProps["formatConfidence"];
  reviewQueueFilters: ReviewQueueProps["reviewQueueFilters"];
  reviewQueueCounts: ReviewQueueProps["reviewQueueCounts"];
  selectedReviewCategory: ReviewQueueProps["selectedReviewCategory"];
  reviewQueue: ReviewQueueProps["reviewQueue"];
  userRole: ReviewQueueProps["userRole"];
  reprocessLoading: ReviewQueueProps["reprocessLoading"];
  selectedDocumentId: ReviewQueueProps["selectedDocumentId"];
  setSelectedReviewCategory: ReviewQueueProps["onSelectCategory"];
  handleOpenRepair: (documentId: number, repairId: number) => void | Promise<void>;
  handleReprocessDocumentById: ReviewQueueProps["onReprocessDocumentById"];
  reviewPriorityColor: ReviewQueueProps["reviewPriorityColor"];
  formatReviewPriority: ReviewQueueProps["formatReviewPriority"];
  formatMoney: ReviewQueueProps["formatMoney"];
  documents: DocumentsListProps["documents"];
  batchReprocessLimit: DocumentsListProps["batchReprocessLimit"];
  batchReprocessStatusFilter: DocumentsListProps["batchReprocessStatusFilter"];
  batchReprocessPrimaryOnly: DocumentsListProps["batchReprocessPrimaryOnly"];
  batchReprocessLoading: DocumentsListProps["batchReprocessLoading"];
  repairDeleteLoading: DocumentsListProps["repairDeleteLoading"];
  documentArchiveLoadingId: DocumentsListProps["documentArchiveLoadingId"];
  setBatchReprocessLimit: DocumentsListProps["onBatchReprocessLimitChange"];
  setBatchReprocessStatusFilter: DocumentsListProps["onBatchReprocessStatusFilterChange"];
  setBatchReprocessPrimaryOnly: DocumentsListProps["onBatchReprocessPrimaryOnlyChange"];
  handleBatchReprocessDocuments: () => void | Promise<void>;
  handleReprocessDocument: DocumentsListProps["onReprocessDocument"];
  handleDeleteRepair: DocumentsListProps["onDeleteRepair"];
  handleArchiveDocument: DocumentsListProps["onArchiveDocument"];
  formatManualReviewReasons: DocumentsListProps["formatManualReviewReasons"];
  formatOcrProfileMeta: DocumentsListProps["formatOcrProfileMeta"];
  formatLaborNormApplicability: DocumentsListProps["formatLaborNormApplicability"];
};

export function buildDocumentsWorkspaceProps(params: BuildDocumentsWorkspacePropsParams): WorkspaceDocumentsPanelProps {
  return {
    active: params.activeWorkspaceTab === "documents",
    uploadProps: {
      uploadForm: params.uploadForm,
      vehicles: params.vehicles,
      rootDocumentKindOptions: params.rootDocumentKindOptions,
      selectedFile: params.selectedFile,
      uploadMissingRequirements: params.uploadMissingRequirements,
      uploadLoading: params.uploadLoading,
      lastUploadedDocument: params.lastUploadedDocument,
      uploadFileInputRef: params.uploadFileInputRef,
      onSubmit: params.handleUpload,
      onUploadFieldChange: params.updateUploadFormField,
      onFileSelect: params.handleUploadFileSelect,
      onOpenFilePicker: () => params.uploadFileInputRef.current?.click(),
      onOpenUploadedRepair: (documentId, repairId) => {
        void params.openRepairByIds(documentId, repairId);
      },
      onHideUploadedResult: () => {
        params.setLastUploadedDocument(null);
      },
      formatVehicle: params.formatVehicle,
      formatDocumentKind: params.formatDocumentKind,
      importJobStatusColor: params.importJobStatusColor,
      formatStatus: params.formatStatus,
      statusColor: params.statusColor,
      formatDocumentStatusLabel: params.formatDocumentStatusLabel,
      isDocumentAwaitingOcr: params.isDocumentAwaitingOcr,
      documentHasActiveImportJob: params.documentHasActiveImportJob,
      isPlaceholderVehicle: params.isPlaceholderVehicle,
      formatConfidence: params.formatConfidence,
    },
    reviewQueueProps: {
      reviewQueueFilters: params.reviewQueueFilters,
      reviewQueueCounts: params.reviewQueueCounts,
      selectedReviewCategory: params.selectedReviewCategory,
      reviewQueue: params.reviewQueue,
      userRole: params.userRole,
      reprocessLoading: params.reprocessLoading,
      selectedDocumentId: params.selectedDocumentId,
      onSelectCategory: params.setSelectedReviewCategory,
      onOpenReviewQueueItem: (item) => {
        void params.handleOpenRepair(item.document.id, item.repair.id);
      },
      onReprocessDocumentById: (documentId, repairId) => {
        void params.handleReprocessDocumentById(documentId, repairId);
      },
      formatDocumentKind: params.formatDocumentKind,
      reviewPriorityColor: params.reviewPriorityColor,
      formatReviewPriority: params.formatReviewPriority,
      statusColor: params.statusColor,
      formatDocumentStatusLabel: params.formatDocumentStatusLabel,
      formatVehicle: params.formatVehicle,
      formatConfidence: params.formatConfidence,
      formatMoney: params.formatMoney,
    },
    documentsListProps: {
      userRole: params.userRole,
      documents: params.documents,
      selectedDocumentId: params.selectedDocumentId,
      batchReprocessLimit: params.batchReprocessLimit,
      batchReprocessStatusFilter: params.batchReprocessStatusFilter,
      batchReprocessPrimaryOnly: params.batchReprocessPrimaryOnly,
      batchReprocessLoading: params.batchReprocessLoading,
      reprocessLoading: params.reprocessLoading,
      repairDeleteLoading: params.repairDeleteLoading,
      documentArchiveLoadingId: params.documentArchiveLoadingId,
      onBatchReprocessLimitChange: params.setBatchReprocessLimit,
      onBatchReprocessStatusFilterChange: params.setBatchReprocessStatusFilter,
      onBatchReprocessPrimaryOnlyChange: params.setBatchReprocessPrimaryOnly,
      onBatchReprocess: () => {
        void params.handleBatchReprocessDocuments();
      },
      onOpenRepair: (document) => {
        void params.handleOpenRepair(document.id, document.repair.id);
      },
      onReprocessDocument: (document) => {
        void params.handleReprocessDocument(document);
      },
      onDeleteRepair: (repairId) => {
        void params.handleDeleteRepair(repairId);
      },
      onArchiveDocument: (documentId, repairId) => {
        void params.handleArchiveDocument(documentId, repairId);
      },
      formatDocumentKind: params.formatDocumentKind,
      importJobStatusColor: params.importJobStatusColor,
      formatStatus: params.formatStatus,
      statusColor: params.statusColor,
      formatDocumentStatusLabel: params.formatDocumentStatusLabel,
      formatVehicle: params.formatVehicle,
      formatMoney: params.formatMoney,
      formatManualReviewReasons: params.formatManualReviewReasons,
      formatOcrProfileMeta: params.formatOcrProfileMeta,
      formatLaborNormApplicability: params.formatLaborNormApplicability,
    },
  };
}
