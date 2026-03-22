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
>;

export function buildRepairOverviewSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): RepairOverviewSectionParams {
  const { rootState, navigation, repairDerivedViewModel } = context;

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
  };
}
