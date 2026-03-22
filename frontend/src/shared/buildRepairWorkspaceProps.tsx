import { type ComponentProps, type Dispatch, type SetStateAction } from "react";
import { HistoryDetailsPreview } from "../components/HistoryDetailsPreview";
import { RepairWorkspacePanel } from "../components/RepairWorkspacePanel";
import { type WorkspaceTab } from "./appRoute";
import {
  buildDocumentHistoryDetails,
  buildRepairHistoryDetails,
  type HistoryDetailFormatters,
} from "./historyDetails";
import type { ServiceFormState } from "./workspaceFormTypes";

type RepairWorkspacePanelProps = ComponentProps<typeof RepairWorkspacePanel>;
type RepairWorkspaceContentProps = RepairWorkspacePanelProps["contentProps"];
type ReviewDecisionProps = NonNullable<RepairWorkspaceContentProps["reviewDecisionProps"]>;
type RepairTabsProps = NonNullable<RepairWorkspaceContentProps["repairTabsProps"]>;
type RepairEditProps = NonNullable<RepairTabsProps["editProps"]>;
type RepairOverviewProps = RepairTabsProps["overviewProps"];
type RepairDocumentsProps = RepairTabsProps["documentsProps"];
type RepairReadOnlyProps = RepairTabsProps["readOnlyProps"];
type ReviewActionType = "confirm" | "employee_confirm" | "send_to_review";
export type BuildRepairWorkspacePropsParams = {
  repairHasReturnTarget: boolean;
  workspaceTabReturnLabels: Record<WorkspaceTab, string>;
  repairReturnTab: WorkspaceTab;
  returnFromRepairPage: NonNullable<RepairWorkspacePanelProps["onReturn"]>;
  userRole: RepairWorkspaceContentProps["userRole"];
  repairLoading: RepairWorkspaceContentProps["repairLoading"];
  selectedRepair: RepairWorkspaceContentProps["selectedRepair"];
  selectedReviewItem: RepairWorkspaceContentProps["selectedReviewItem"];
  isEditingRepair: RepairWorkspaceContentProps["isEditingRepair"];
  saveRepairLoading: RepairWorkspaceContentProps["saveRepairLoading"];
  repairDraft: RepairEditProps["repairDraft"] | null;
  repairExportLoading: RepairWorkspaceContentProps["repairExportLoading"];
  repairArchiveLoading: RepairWorkspaceContentProps["repairArchiveLoading"];
  repairDeleteLoading: RepairWorkspaceContentProps["repairDeleteLoading"];
  handleCancelRepairEdit: RepairWorkspaceContentProps["onCancelEdit"];
  handleSaveRepair: () => void | Promise<void>;
  handleExportRepair: () => void | Promise<void>;
  handleStartRepairEdit: RepairWorkspaceContentProps["onStartEdit"];
  handleArchiveRepair: () => void | Promise<void>;
  handleDeleteRepair: RepairWorkspaceContentProps["onDeleteRepair"];
  selectedRepairDocument: ReviewDecisionProps["selectedRepairDocument"];
  reviewDocumentPreviewLoading: ReviewDecisionProps["reviewDocumentPreviewLoading"];
  reviewDocumentPreviewKind: ReviewDecisionProps["reviewDocumentPreviewKind"];
  reviewDocumentPreviewUrl: ReviewDecisionProps["reviewDocumentPreviewUrl"];
  documentOpenLoadingId: ReviewDecisionProps["documentOpenLoadingId"];
  canLinkVehicleFromSelectedDocument: ReviewDecisionProps["canLinkVehicleFromSelectedDocument"];
  selectedRepairDocumentExtractedFields: ReviewDecisionProps["selectedRepairDocumentExtractedFields"];
  reviewVehicleSearch: ReviewDecisionProps["reviewVehicleSearch"];
  reviewVehicleSearchLoading: ReviewDecisionProps["reviewVehicleSearchLoading"];
  reviewVehicleLinkingId: ReviewDecisionProps["reviewVehicleLinkingId"];
  reviewVehicleSearchResults: ReviewDecisionProps["reviewVehicleSearchResults"];
  selectedRepairDocumentOcrServiceName: ReviewDecisionProps["selectedRepairDocumentOcrServiceName"];
  reviewServiceName: ReviewDecisionProps["reviewServiceName"];
  services: ReviewDecisionProps["services"] & RepairEditProps["services"];
  reviewServiceAssigning: ReviewDecisionProps["reviewServiceAssigning"];
  reviewServiceSaving: ReviewDecisionProps["reviewServiceSaving"];
  reviewFieldSaving: ReviewDecisionProps["reviewFieldSaving"];
  showReviewServiceEditor: ReviewDecisionProps["showReviewServiceEditor"];
  reviewServiceForm: ReviewDecisionProps["reviewServiceForm"];
  canConfirmSelectedReview: ReviewDecisionProps["canConfirmSelectedReview"];
  reviewReadyFieldsCount: ReviewDecisionProps["reviewReadyFieldsCount"];
  reviewRequiredFieldComparisons: ReviewDecisionProps["reviewRequiredFieldComparisons"];
  showReviewFieldEditor: ReviewDecisionProps["showReviewFieldEditor"];
  setShowReviewFieldEditor: Dispatch<SetStateAction<ReviewDecisionProps["showReviewFieldEditor"]>>;
  reviewFieldDraft: ReviewDecisionProps["reviewFieldDraft"];
  reviewMissingRequiredFields: ReviewDecisionProps["reviewMissingRequiredFields"];
  selectedRepairDocumentFieldSnapshots: ReviewDecisionProps["selectedRepairDocumentFieldSnapshots"];
  selectedRepairDocumentPayload: ReviewDecisionProps["selectedRepairDocumentPayload"];
  selectedRepairDocumentWorks: ReviewDecisionProps["selectedRepairDocumentWorks"];
  selectedRepairDocumentParts: ReviewDecisionProps["selectedRepairDocumentParts"];
  reviewActionComment: ReviewDecisionProps["reviewActionComment"];
  reviewActionLoading: ReviewDecisionProps["reviewActionLoading"];
  canCreateVehicleFromSelectedDocument: ReviewDecisionProps["canCreateVehicleFromSelectedDocument"];
  documentVehicleForm: ReviewDecisionProps["documentVehicleForm"];
  documentVehicleSaving: ReviewDecisionProps["documentVehicleSaving"];
  handleOpenDocumentFile: ReviewDecisionProps["onOpenDocumentFile"];
  setReviewVehicleSearch: ReviewDecisionProps["onSearchVehicleChange"];
  handleSearchReviewVehicles: () => void | Promise<void>;
  handleLinkReviewVehicle: ReviewDecisionProps["onLinkVehicle"];
  setReviewServiceName: ReviewDecisionProps["onServiceNameChange"];
  setShowReviewServiceEditor: Dispatch<SetStateAction<ReviewDecisionProps["showReviewServiceEditor"]>>;
  setReviewServiceForm: Dispatch<SetStateAction<ServiceFormState>>;
  assignReviewService: (value: string) => void | Promise<void>;
  handleAssignReviewService: () => void | Promise<void>;
  handleCreateReviewService: () => void | Promise<void>;
  fillReviewFieldDraftFromOcr: ReviewDecisionProps["onFillFieldsFromOcr"];
  updateReviewFieldDraft: ReviewDecisionProps["onReviewFieldDraftChange"];
  handleSaveReviewFields: () => void | Promise<void>;
  setReviewActionComment: ReviewDecisionProps["onReviewActionCommentChange"];
  handleReviewAction: (action: ReviewActionType) => void | Promise<void>;
  setDocumentVehicleForm: Dispatch<SetStateAction<ReviewDecisionProps["documentVehicleForm"]>>;
  handleCreateVehicleFromDocument: () => void | Promise<void>;
  getReviewComparisonColor: ReviewDecisionProps["getReviewComparisonColor"];
  getReviewComparisonLabel: ReviewDecisionProps["getReviewComparisonLabel"];
  getConfidenceColor: ReviewDecisionProps["getConfidenceColor"];
  formatConfidenceLabel: ReviewDecisionProps["formatConfidenceLabel"];
  formatMoney: ReviewDecisionProps["formatMoney"];
  formatCompactNumber: ReviewDecisionProps["formatCompactNumber"];
  formatHours: ReviewDecisionProps["formatHours"];
  formatManualReviewReasons: ReviewDecisionProps["formatManualReviewReasons"];
  formatOcrProfileMeta: ReviewDecisionProps["formatOcrProfileMeta"];
  formatLaborNormApplicability: ReviewDecisionProps["formatLaborNormApplicability"];
  readStringValue: ReviewDecisionProps["readStringValue"];
  readNumberValue: ReviewDecisionProps["readNumberValue"];
  formatOcrLineUnit: ReviewDecisionProps["formatOcrLineUnit"];
  formatDocumentKind: ReviewDecisionProps["formatDocumentKind"];
  statusColor: ReviewDecisionProps["statusColor"];
  formatDocumentStatusLabel: ReviewDecisionProps["formatDocumentStatusLabel"];
  formatDateTime: ReviewDecisionProps["formatDateTime"];
  formatSourceTypeLabel: RepairDocumentsProps["formatSourceTypeLabel"];
  formatConfidence: ReviewDecisionProps["formatConfidence"];
  formatVehicle: ReviewDecisionProps["formatVehicle"];
  formatVehicleTypeLabel: ReviewDecisionProps["formatVehicleTypeLabel"];
  activeRepairTab: RepairTabsProps["activeRepairTab"];
  repairTabDescriptions: RepairTabsProps["repairTabDescriptions"];
  handleRepairTabChange: RepairTabsProps["onRepairTabChange"];
  updateRepairDraftField: RepairEditProps["onRepairFieldChange"];
  addWorkDraft: RepairEditProps["onAddWorkDraft"];
  updateWorkDraft: RepairEditProps["onUpdateWorkDraft"];
  removeWorkDraft: RepairEditProps["onRemoveWorkDraft"];
  addPartDraft: RepairEditProps["onAddPartDraft"];
  updatePartDraft: RepairEditProps["onUpdatePartDraft"];
  removePartDraft: RepairEditProps["onRemovePartDraft"];
  selectedRepairAwaitingOcr: RepairOverviewProps["selectedRepairAwaitingOcr"];
  selectedRepairUnresolvedChecks: Array<unknown>;
  selectedRepairHasBlockingFindings: RepairOverviewProps["selectedRepairHasBlockingFindings"];
  selectedRepairComparisonAttentionCount: RepairOverviewProps["selectedRepairComparisonAttentionCount"];
  selectedRepairDocumentManualReviewReasons: RepairOverviewProps["selectedRepairDocumentManualReviewReasons"];
  selectedRepairReportSections: RepairOverviewProps["selectedRepairReportSections"];
  showRepairOverviewDetails: RepairOverviewProps["showRepairOverviewDetails"];
  setShowRepairOverviewDetails: Dispatch<SetStateAction<RepairOverviewProps["showRepairOverviewDetails"]>>;
  openRepairByIds: (documentId: number | null, repairId: number) => void | Promise<void>;
  isPlaceholderVehicle: RepairOverviewProps["isPlaceholderVehicle"];
  formatRepairStatus: RepairOverviewProps["formatRepairStatus"];
  executiveRiskColor: RepairOverviewProps["executiveRiskColor"];
  formatExecutiveRiskLabel: RepairOverviewProps["formatExecutiveRiskLabel"];
  buildCheckPayloadDetails: RepairOverviewProps["buildCheckPayloadDetails"];
  getCheckLinkedRepairId: RepairOverviewProps["getCheckLinkedRepairId"];
  checkSeverityColor: RepairOverviewProps["checkSeverityColor"];
  formatStatus: RepairOverviewProps["formatStatus"];
  documentKindOptions: RepairDocumentsProps["documentKindOptions"];
  attachedDocumentKind: RepairDocumentsProps["attachedDocumentKind"];
  attachedDocumentNotes: RepairDocumentsProps["attachedDocumentNotes"];
  attachedDocumentFile: RepairDocumentsProps["attachedDocumentFile"];
  attachedFileInputRef: RepairDocumentsProps["attachedFileInputRef"];
  attachDocumentLoading: RepairDocumentsProps["attachDocumentLoading"];
  reprocessLoading: RepairDocumentsProps["reprocessLoading"];
  selectedDocumentId: RepairDocumentsProps["selectedDocumentId"];
  documentComparisonLoadingId: RepairDocumentsProps["documentComparisonLoadingId"];
  primaryDocumentLoadingId: RepairDocumentsProps["primaryDocumentLoadingId"];
  documentArchiveLoadingId: RepairDocumentsProps["documentArchiveLoadingId"];
  documentComparison: RepairDocumentsProps["documentComparison"];
  documentComparisonComment: RepairDocumentsProps["documentComparisonComment"];
  documentComparisonReviewLoading: RepairDocumentsProps["documentComparisonReviewLoading"];
  setAttachedDocumentKind: RepairDocumentsProps["onAttachedDocumentKindChange"];
  setAttachedDocumentNotes: RepairDocumentsProps["onAttachedDocumentNotesChange"];
  setAttachedDocumentFile: RepairDocumentsProps["onAttachedDocumentFileChange"];
  handleAttachDocumentToRepair: () => void | Promise<void>;
  handleReprocessDocumentById: RepairDocumentsProps["onReprocessDocumentById"];
  handleCompareWithPrimary: RepairDocumentsProps["onCompareWithPrimary"];
  handleSetPrimaryDocument: RepairDocumentsProps["onSetPrimaryDocument"];
  handleArchiveDocument: RepairDocumentsProps["onArchiveDocument"];
  setDocumentComparison: Dispatch<SetStateAction<RepairDocumentsProps["documentComparison"]>>;
  setDocumentComparisonComment: RepairDocumentsProps["onDocumentComparisonCommentChange"];
  handleReviewDocumentComparison: RepairDocumentsProps["onReviewDocumentComparison"];
  importJobStatusColor: RepairDocumentsProps["importJobStatusColor"];
  filteredDocumentHistory: RepairReadOnlyProps["filteredDocumentHistory"];
  filteredRepairHistory: RepairReadOnlyProps["filteredRepairHistory"];
  historySearch: RepairReadOnlyProps["historySearch"];
  historyFilter: RepairReadOnlyProps["historyFilter"];
  historyFilters: RepairReadOnlyProps["historyFilters"];
  checkComments: RepairReadOnlyProps["checkComments"];
  checkActionLoadingId: RepairReadOnlyProps["checkActionLoadingId"];
  setHistorySearch: RepairReadOnlyProps["onHistorySearchChange"];
  setHistoryFilter: RepairReadOnlyProps["onHistoryFilterChange"];
  setCheckComments: Dispatch<SetStateAction<RepairReadOnlyProps["checkComments"]>>;
  handleCheckResolution: RepairReadOnlyProps["onCheckResolution"];
  formatWorkLaborNormMeta: RepairReadOnlyProps["formatWorkLaborNormMeta"];
  readCheckResolutionMeta: RepairReadOnlyProps["readCheckResolutionMeta"];
  formatHistoryActionLabel: RepairReadOnlyProps["formatHistoryActionLabel"];
  historyDetailFormatters: HistoryDetailFormatters;
  reviewPriorityColor: RepairWorkspaceContentProps["reviewPriorityColor"];
  formatReviewPriority: RepairWorkspaceContentProps["formatReviewPriority"];
};

export function buildRepairWorkspaceProps(params: BuildRepairWorkspacePropsParams): RepairWorkspacePanelProps {
  const openAttachedFilePicker = () => {
    if (params.attachedFileInputRef && typeof params.attachedFileInputRef !== "function") {
      params.attachedFileInputRef.current?.click();
    }
  };

  return {
    returnLabel: params.repairHasReturnTarget ? params.workspaceTabReturnLabels[params.repairReturnTab] : null,
    onReturn: params.repairHasReturnTarget ? params.returnFromRepairPage : null,
    contentProps: {
      userRole: params.userRole,
      repairLoading: params.repairLoading,
      selectedRepair: params.selectedRepair,
      selectedReviewItem: params.selectedReviewItem,
      isEditingRepair: params.isEditingRepair,
      saveRepairLoading: params.saveRepairLoading,
      hasRepairDraft: Boolean(params.repairDraft),
      repairExportLoading: params.repairExportLoading,
      repairArchiveLoading: params.repairArchiveLoading,
      repairDeleteLoading: params.repairDeleteLoading,
      onCancelEdit: params.handleCancelRepairEdit,
      onSaveRepair: () => {
        void params.handleSaveRepair();
      },
      onExportRepair: () => {
        void params.handleExportRepair();
      },
      onStartEdit: params.handleStartRepairEdit,
      onArchiveRepair: () => {
        void params.handleArchiveRepair();
      },
      onDeleteRepair: (repairId) => {
        void params.handleDeleteRepair(repairId);
      },
      reviewDecisionProps:
        params.selectedRepair
          ? {
              userRole: params.userRole,
              selectedRepairStatus: params.selectedRepair.status,
              selectedReviewItem: params.selectedReviewItem,
              selectedRepair: params.selectedRepair,
              selectedRepairDocument: params.selectedRepairDocument,
              reviewDocumentPreviewLoading: params.reviewDocumentPreviewLoading,
              reviewDocumentPreviewKind: params.reviewDocumentPreviewKind,
              reviewDocumentPreviewUrl: params.reviewDocumentPreviewUrl,
              documentOpenLoadingId: params.documentOpenLoadingId,
              canLinkVehicleFromSelectedDocument: params.canLinkVehicleFromSelectedDocument,
              selectedRepairDocumentExtractedFields: params.selectedRepairDocumentExtractedFields,
              reviewVehicleSearch: params.reviewVehicleSearch,
              reviewVehicleSearchLoading: params.reviewVehicleSearchLoading,
              reviewVehicleLinkingId: params.reviewVehicleLinkingId,
              reviewVehicleSearchResults: params.reviewVehicleSearchResults,
              selectedRepairDocumentOcrServiceName: params.selectedRepairDocumentOcrServiceName,
              reviewServiceName: params.reviewServiceName,
              services: params.services,
              reviewServiceAssigning: params.reviewServiceAssigning,
              reviewServiceSaving: params.reviewServiceSaving,
              reviewFieldSaving: params.reviewFieldSaving,
              showReviewServiceEditor: params.showReviewServiceEditor,
              reviewServiceForm: params.reviewServiceForm,
              canConfirmSelectedReview: params.canConfirmSelectedReview,
              reviewReadyFieldsCount: params.reviewReadyFieldsCount,
              reviewRequiredFieldComparisons: params.reviewRequiredFieldComparisons,
              showReviewFieldEditor: params.showReviewFieldEditor,
              reviewFieldDraft: params.reviewFieldDraft,
              reviewMissingRequiredFields: params.reviewMissingRequiredFields,
              selectedRepairDocumentFieldSnapshots: params.selectedRepairDocumentFieldSnapshots,
              selectedRepairDocumentPayload: params.selectedRepairDocumentPayload,
              selectedRepairDocumentWorks: params.selectedRepairDocumentWorks,
              selectedRepairDocumentParts: params.selectedRepairDocumentParts,
              reviewActionComment: params.reviewActionComment,
              reviewActionLoading: params.reviewActionLoading,
              canCreateVehicleFromSelectedDocument: params.canCreateVehicleFromSelectedDocument,
              isEditingRepair: params.isEditingRepair,
              documentVehicleForm: params.documentVehicleForm,
              documentVehicleSaving: params.documentVehicleSaving,
              onOpenDocumentFile: (documentId) => {
                void params.handleOpenDocumentFile(documentId);
              },
              onSearchVehicleChange: params.setReviewVehicleSearch,
              onSearchVehicles: () => {
                void params.handleSearchReviewVehicles();
              },
              onLinkVehicle: (vehicleId) => {
                void params.handleLinkReviewVehicle(vehicleId);
              },
              onServiceNameChange: params.setReviewServiceName,
              onToggleServiceCreate: () => {
                params.setShowReviewServiceEditor((current) => !current);
                params.setReviewServiceForm((current) => ({
                  ...current,
                  name: current.name || params.reviewServiceName || params.selectedRepairDocumentOcrServiceName,
                }));
              },
              onClearService: () => {
                params.setReviewServiceName("");
                void params.assignReviewService("");
              },
              onServiceFormChange: (field, value) => {
                params.setReviewServiceForm((current) => ({
                  ...current,
                  [field]: value,
                }));
              },
              onAssignService: () => {
                void params.handleAssignReviewService();
              },
              onCreateService: () => {
                void params.handleCreateReviewService();
              },
              onToggleFieldEditor: () => {
                params.setShowReviewFieldEditor((current) => !current);
              },
              onFillFieldsFromOcr: params.fillReviewFieldDraftFromOcr,
              onReviewFieldDraftChange: params.updateReviewFieldDraft,
              onSaveReviewFields: () => {
                void params.handleSaveReviewFields();
              },
              onReviewActionCommentChange: params.setReviewActionComment,
              onConfirm: () => {
                void params.handleReviewAction(params.userRole === "admin" ? "confirm" : "employee_confirm");
              },
              onSendToReview: () => {
                void params.handleReviewAction("send_to_review");
              },
              onDocumentVehicleFormChange: (field, value) => {
                params.setDocumentVehicleForm((current) => ({
                  ...current,
                  [field]: value,
                }));
              },
              onCreateVehicle: () => {
                void params.handleCreateVehicleFromDocument();
              },
              getReviewComparisonColor: params.getReviewComparisonColor,
              getReviewComparisonLabel: params.getReviewComparisonLabel,
              getConfidenceColor: params.getConfidenceColor,
              formatConfidenceLabel: params.formatConfidenceLabel,
              formatMoney: params.formatMoney,
              formatCompactNumber: params.formatCompactNumber,
              formatHours: params.formatHours,
              formatManualReviewReasons: params.formatManualReviewReasons,
              formatOcrProfileMeta: params.formatOcrProfileMeta,
              formatLaborNormApplicability: params.formatLaborNormApplicability,
              readStringValue: params.readStringValue,
              readNumberValue: params.readNumberValue,
              formatOcrLineUnit: params.formatOcrLineUnit,
              formatDocumentKind: params.formatDocumentKind,
              statusColor: params.statusColor,
              formatDocumentStatusLabel: params.formatDocumentStatusLabel,
              formatDateTime: params.formatDateTime,
              formatSourceTypeLabel: params.formatSourceTypeLabel,
              formatConfidence: params.formatConfidence,
              formatVehicle: params.formatVehicle,
              formatVehicleTypeLabel: params.formatVehicleTypeLabel,
            }
          : null,
      repairTabsProps:
        params.selectedRepair
          ? {
              activeRepairTab: params.activeRepairTab,
              repairTabDescriptions: params.repairTabDescriptions,
              isEditingRepair: params.isEditingRepair,
              selectedRepair: params.selectedRepair,
              onRepairTabChange: params.handleRepairTabChange,
              editProps:
                params.isEditingRepair && params.repairDraft
                  ? {
                      activeRepairTab: params.activeRepairTab,
                      repairDraft: params.repairDraft,
                      services: params.services,
                      onRepairFieldChange: params.updateRepairDraftField,
                      onAddWorkDraft: params.addWorkDraft,
                      onUpdateWorkDraft: params.updateWorkDraft,
                      onRemoveWorkDraft: params.removeWorkDraft,
                      onAddPartDraft: params.addPartDraft,
                      onUpdatePartDraft: params.updatePartDraft,
                      onRemovePartDraft: params.removePartDraft,
                    }
                  : null,
              overviewProps: {
                selectedRepair: params.selectedRepair,
                selectedRepairDocument: params.selectedRepairDocument,
                selectedRepairAwaitingOcr: params.selectedRepairAwaitingOcr,
                selectedRepairUnresolvedChecksCount: params.selectedRepairUnresolvedChecks.length,
                selectedRepairHasBlockingFindings: params.selectedRepairHasBlockingFindings,
                reviewRequiredFieldComparisons: params.reviewRequiredFieldComparisons,
                selectedRepairComparisonAttentionCount: params.selectedRepairComparisonAttentionCount,
                selectedRepairDocumentWorksCount: params.selectedRepairDocumentWorks.length,
                selectedRepairDocumentPartsCount: params.selectedRepairDocumentParts.length,
                selectedRepairDocumentManualReviewReasons: params.selectedRepairDocumentManualReviewReasons,
                selectedRepairReportSections: params.selectedRepairReportSections,
                showRepairOverviewDetails: params.showRepairOverviewDetails,
                onToggleShowDetails: () => params.setShowRepairOverviewDetails((current) => !current),
                onOpenLinkedRepair: (repairId) => {
                  void params.openRepairByIds(null, repairId);
                },
                isPlaceholderVehicle: params.isPlaceholderVehicle,
                formatVehicle: params.formatVehicle,
                formatRepairStatus: params.formatRepairStatus,
                executiveRiskColor: params.executiveRiskColor,
                formatExecutiveRiskLabel: params.formatExecutiveRiskLabel,
                statusColor: params.statusColor,
                formatDocumentStatusLabel: params.formatDocumentStatusLabel,
                formatCompactNumber: params.formatCompactNumber,
                formatMoney: params.formatMoney,
                formatConfidence: params.formatConfidence,
                formatManualReviewReasons: params.formatManualReviewReasons,
                buildCheckPayloadDetails: params.buildCheckPayloadDetails,
                getCheckLinkedRepairId: params.getCheckLinkedRepairId,
                checkSeverityColor: params.checkSeverityColor,
                formatStatus: params.formatStatus,
              },
              documentsProps: {
                userRole: params.userRole,
                selectedRepair: params.selectedRepair,
                documentKindOptions: params.documentKindOptions,
                attachedDocumentKind: params.attachedDocumentKind,
                attachedDocumentNotes: params.attachedDocumentNotes,
                attachedDocumentFile: params.attachedDocumentFile,
                attachedFileInputRef: params.attachedFileInputRef,
                attachDocumentLoading: params.attachDocumentLoading,
                documentOpenLoadingId: params.documentOpenLoadingId,
                reprocessLoading: params.reprocessLoading,
                selectedDocumentId: params.selectedDocumentId,
                documentComparisonLoadingId: params.documentComparisonLoadingId,
                primaryDocumentLoadingId: params.primaryDocumentLoadingId,
                documentArchiveLoadingId: params.documentArchiveLoadingId,
                documentComparison: params.documentComparison,
                documentComparisonComment: params.documentComparisonComment,
                documentComparisonReviewLoading: params.documentComparisonReviewLoading,
                onAttachedDocumentKindChange: params.setAttachedDocumentKind,
                onAttachedDocumentNotesChange: params.setAttachedDocumentNotes,
                onAttachedDocumentFileChange: params.setAttachedDocumentFile,
                onOpenAttachedFilePicker: openAttachedFilePicker,
                onAttachDocument: () => {
                  void params.handleAttachDocumentToRepair();
                },
                onOpenDocumentFile: (documentId) => {
                  void params.handleOpenDocumentFile(documentId);
                },
                onReprocessDocumentById: (documentId, repairId) => {
                  void params.handleReprocessDocumentById(documentId, repairId);
                },
                onCompareWithPrimary: (documentId) => {
                  void params.handleCompareWithPrimary(documentId);
                },
                onSetPrimaryDocument: (documentId) => {
                  void params.handleSetPrimaryDocument(documentId);
                },
                onArchiveDocument: (documentId, repairId) => {
                  void params.handleArchiveDocument(documentId, repairId);
                },
                onCloseDocumentComparison: () => {
                  params.setDocumentComparison(null);
                },
                onDocumentComparisonCommentChange: params.setDocumentComparisonComment,
                onReviewDocumentComparison: (action) => {
                  void params.handleReviewDocumentComparison(action);
                },
                formatDocumentKind: params.formatDocumentKind,
                importJobStatusColor: params.importJobStatusColor,
                formatStatus: params.formatStatus,
                statusColor: params.statusColor,
                formatDocumentStatusLabel: params.formatDocumentStatusLabel,
                formatDateTime: params.formatDateTime,
                formatSourceTypeLabel: params.formatSourceTypeLabel,
                formatConfidence: params.formatConfidence,
                formatManualReviewReasons: params.formatManualReviewReasons,
                formatOcrProfileMeta: params.formatOcrProfileMeta,
                formatLaborNormApplicability: params.formatLaborNormApplicability,
              },
              readOnlyProps: {
                activeRepairTab: params.activeRepairTab,
                selectedRepair: params.selectedRepair,
                filteredDocumentHistory: params.filteredDocumentHistory,
                filteredRepairHistory: params.filteredRepairHistory,
                historySearch: params.historySearch,
                historyFilter: params.historyFilter,
                historyFilters: params.historyFilters,
                checkComments: params.checkComments,
                checkActionLoadingId: params.checkActionLoadingId,
                onHistorySearchChange: params.setHistorySearch,
                onHistoryFilterChange: params.setHistoryFilter,
                onCheckCommentChange: (checkId, value) =>
                  params.setCheckComments((current) => ({
                    ...current,
                    [checkId]: value,
                  })),
                onCheckResolution: (checkId, isResolved) => {
                  void params.handleCheckResolution(checkId, isResolved);
                },
                onOpenLinkedRepair: (repairId) => {
                  void params.openRepairByIds(null, repairId);
                },
                formatMoney: params.formatMoney,
                formatHours: params.formatHours,
                formatStatus: params.formatStatus,
                formatWorkLaborNormMeta: params.formatWorkLaborNormMeta,
                buildCheckPayloadDetails: params.buildCheckPayloadDetails,
                getCheckLinkedRepairId: params.getCheckLinkedRepairId,
                checkSeverityColor: params.checkSeverityColor,
                readCheckResolutionMeta: params.readCheckResolutionMeta,
                formatDateTime: params.formatDateTime,
                formatHistoryActionLabel: params.formatHistoryActionLabel,
                formatDocumentKind: params.formatDocumentKind,
                buildDocumentHistoryDetails: (entry) =>
                  buildDocumentHistoryDetails(entry, params.historyDetailFormatters),
                buildRepairHistoryDetails: (entry) =>
                  buildRepairHistoryDetails(entry, params.historyDetailFormatters),
                renderHistoryDetails: (_entryKey, lines) => <HistoryDetailsPreview lines={lines} />,
              },
            }
          : null,
      formatRepairStatus: params.formatRepairStatus,
      reviewPriorityColor: params.reviewPriorityColor,
      formatReviewPriority: params.formatReviewPriority,
    },
  };
}
