import { formatCompactNumber, formatDateValue, formatHours, formatMoney } from "./displayFormatters";
import type { BuildAdminWorkspacePropsParams } from "./buildAdminWorkspaceProps";
import type { WorkspaceContentSectionBuilderContext } from "./workspaceContentSectionBuilderContext";

export type AdminHistoricalImportsSectionParams = Pick<
  BuildAdminWorkspacePropsParams,
  | "historicalImportLoading"
  | "historicalImportFile"
  | "historicalImportLimit"
  | "historicalImportResult"
  | "historicalImportJobs"
  | "historicalImportJobsLoading"
  | "historicalWorkReference"
  | "historicalWorkReferenceLoading"
  | "historicalWorkReferenceTotal"
  | "historicalWorkReferenceQuery"
  | "historicalWorkReferenceMinSamples"
  | "importConflicts"
  | "importConflictsLoading"
  | "setHistoricalImportFile"
  | "setHistoricalImportLimit"
  | "handleHistoricalRepairImport"
  | "refreshHistoricalImportsJournal"
  | "openRepairByIds"
  | "setHistoricalWorkReferenceQuery"
  | "setHistoricalWorkReferenceMinSamples"
  | "loadHistoricalWorkReference"
  | "openImportConflict"
  | "formatMoney"
  | "formatCompactNumber"
  | "formatHours"
  | "formatDateValue"
>;

export function buildAdminHistoricalImportsSectionParams(
  context: WorkspaceContentSectionBuilderContext,
): AdminHistoricalImportsSectionParams {
  const { historicalImportsAdmin, navigation } = context;

  return {
    historicalImportLoading: historicalImportsAdmin.historicalImportLoading,
    historicalImportFile: historicalImportsAdmin.historicalImportFile,
    historicalImportLimit: historicalImportsAdmin.historicalImportLimit,
    historicalImportResult: historicalImportsAdmin.historicalImportResult,
    historicalImportJobs: historicalImportsAdmin.historicalImportJobs,
    historicalImportJobsLoading: historicalImportsAdmin.historicalImportJobsLoading,
    historicalWorkReference: historicalImportsAdmin.historicalWorkReference,
    historicalWorkReferenceLoading: historicalImportsAdmin.historicalWorkReferenceLoading,
    historicalWorkReferenceTotal: historicalImportsAdmin.historicalWorkReferenceTotal,
    historicalWorkReferenceQuery: historicalImportsAdmin.historicalWorkReferenceQuery,
    historicalWorkReferenceMinSamples: historicalImportsAdmin.historicalWorkReferenceMinSamples,
    importConflicts: historicalImportsAdmin.importConflicts,
    importConflictsLoading: historicalImportsAdmin.importConflictsLoading,
    setHistoricalImportFile: historicalImportsAdmin.setHistoricalImportFile,
    setHistoricalImportLimit: historicalImportsAdmin.setHistoricalImportLimit,
    handleHistoricalRepairImport: historicalImportsAdmin.handleHistoricalRepairImport,
    refreshHistoricalImportsJournal: historicalImportsAdmin.refreshHistoricalImportsJournal,
    openRepairByIds: navigation.openRepairByIds,
    setHistoricalWorkReferenceQuery: historicalImportsAdmin.setHistoricalWorkReferenceQuery,
    setHistoricalWorkReferenceMinSamples: historicalImportsAdmin.setHistoricalWorkReferenceMinSamples,
    loadHistoricalWorkReference: historicalImportsAdmin.loadHistoricalWorkReference,
    openImportConflict: historicalImportsAdmin.openImportConflict,
    formatMoney,
    formatCompactNumber,
    formatHours,
    formatDateValue,
  };
}
