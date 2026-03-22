import { historyFilters } from "./appUiConfig";
import type { BuildRepairWorkspacePropsParams } from "./buildRepairWorkspaceProps";
import {
  formatHistoryActionLabel,
  formatReviewPriority,
  reviewPriorityColor,
} from "./displayFormatters";
import {
  formatWorkLaborNormMeta,
  readCheckResolutionMeta,
} from "./repairReportHelpers";
import {
  historyDetailFormatters,
  type WorkspaceContentSectionBuilderContext,
} from "./workspaceContentSectionBuilderContext";

type RepairHistoryChecksSectionParams = Pick<
  BuildRepairWorkspacePropsParams,
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

export function buildRepairHistoryChecksSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): RepairHistoryChecksSectionParams {
  const { rootState, repairWorkspaceActions, repairHistoryFilters } = context;

  return {
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
