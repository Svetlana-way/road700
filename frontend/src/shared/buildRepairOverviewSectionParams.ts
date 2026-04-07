import type { BuildRepairWorkspacePropsParams } from "./buildRepairWorkspaceProps";
import {
  checkSeverityColor,
  executiveRiskColor,
  formatExecutiveRiskLabel,
  formatRepairStatus,
  formatStatus,
} from "./displayFormatters";
import { isPlaceholderVehicle } from "./fleetDocumentHelpers";
import { buildCheckPayloadDetails, getCheckLinkedRepairId } from "./repairReportHelpers";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

type RepairOverviewSectionParams = Pick<
  BuildRepairWorkspacePropsParams,
  | "overviewRepairDocument"
  | "selectedDocumentReport"
  | "selectedDocumentReportLoading"
  | "selectedRepairAwaitingOcr"
  | "selectedRepairUnresolvedChecks"
  | "selectedRepairHasBlockingFindings"
  | "overviewReviewRequiredFieldComparisons"
  | "selectedRepairComparisonAttentionCount"
  | "overviewRepairDocumentWorksCount"
  | "overviewRepairDocumentPartsCount"
  | "overviewRepairDocumentManualReviewReasons"
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
>;

export function buildRepairOverviewSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): RepairOverviewSectionParams {
  const { rootState, navigation, repairDerivedViewModel } = context;

  return {
    overviewRepairDocument: repairDerivedViewModel.overviewRepairDocument,
    selectedDocumentReport: repairDerivedViewModel.selectedDocumentReport,
    selectedDocumentReportLoading: repairDerivedViewModel.selectedDocumentReportLoading,
    selectedRepairAwaitingOcr: repairDerivedViewModel.selectedRepairAwaitingOcr,
    selectedRepairUnresolvedChecks: repairDerivedViewModel.selectedRepairUnresolvedChecks,
    selectedRepairHasBlockingFindings: repairDerivedViewModel.selectedRepairHasBlockingFindings,
    overviewReviewRequiredFieldComparisons: repairDerivedViewModel.overviewReviewRequiredFieldComparisons,
    selectedRepairComparisonAttentionCount: repairDerivedViewModel.selectedRepairComparisonAttentionCount,
    overviewRepairDocumentWorksCount: repairDerivedViewModel.overviewRepairDocumentWorksCount,
    overviewRepairDocumentPartsCount: repairDerivedViewModel.overviewRepairDocumentPartsCount,
    overviewRepairDocumentManualReviewReasons: repairDerivedViewModel.overviewRepairDocumentManualReviewReasons,
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
  };
}
