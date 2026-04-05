import { documentKindOptions } from "./appUiConfig";
import type { BuildRepairWorkspacePropsParams } from "./buildRepairWorkspaceProps";
import { importJobStatusColor } from "./displayFormatters";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

type RepairDocumentsSectionParams = Pick<
  BuildRepairWorkspacePropsParams,
  | "documentKindOptions"
  | "attachedDocumentKind"
  | "attachedDocumentNotes"
  | "attachedDocumentFiles"
  | "attachedFileInputRef"
  | "attachDocumentLoading"
  | "reprocessLoading"
  | "reprocessLoadingId"
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
>;

export function buildRepairDocumentsSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): RepairDocumentsSectionParams {
  const { rootState, documentsWorkspace, repairDocumentsWorkflow } = context;

  return {
    documentKindOptions,
    attachedDocumentKind: repairDocumentsWorkflow.attachedDocumentKind,
    attachedDocumentNotes: repairDocumentsWorkflow.attachedDocumentNotes,
    attachedDocumentFiles: repairDocumentsWorkflow.attachedDocumentFiles,
    attachedFileInputRef: rootState.attachedFileInputRef,
    attachDocumentLoading: repairDocumentsWorkflow.attachDocumentLoading,
    reprocessLoading: documentsWorkspace.reprocessLoading,
    reprocessLoadingId: documentsWorkspace.reprocessLoadingId,
    documentComparisonLoadingId: repairDocumentsWorkflow.documentComparisonLoadingId,
    primaryDocumentLoadingId: repairDocumentsWorkflow.primaryDocumentLoadingId,
    documentArchiveLoadingId: documentsWorkspace.documentArchiveLoadingId,
    documentComparison: repairDocumentsWorkflow.documentComparison,
    documentComparisonComment: repairDocumentsWorkflow.documentComparisonComment,
    documentComparisonReviewLoading: repairDocumentsWorkflow.documentComparisonReviewLoading,
    setAttachedDocumentKind: repairDocumentsWorkflow.setAttachedDocumentKind,
    setAttachedDocumentNotes: repairDocumentsWorkflow.setAttachedDocumentNotes,
    setAttachedDocumentFile: repairDocumentsWorkflow.setAttachedDocumentFiles,
    handleAttachDocumentToRepair: repairDocumentsWorkflow.handleAttachDocumentToRepair,
    handleReprocessDocumentById: documentsWorkspace.handleReprocessDocumentById,
    handleCompareWithPrimary: repairDocumentsWorkflow.handleCompareWithPrimary,
    handleSetPrimaryDocument: repairDocumentsWorkflow.handleSetPrimaryDocument,
    handleArchiveDocument: documentsWorkspace.handleArchiveDocument,
    setDocumentComparison: repairDocumentsWorkflow.setDocumentComparison,
    setDocumentComparisonComment: repairDocumentsWorkflow.setDocumentComparisonComment,
    handleReviewDocumentComparison: repairDocumentsWorkflow.handleReviewDocumentComparison,
    importJobStatusColor,
  };
}
