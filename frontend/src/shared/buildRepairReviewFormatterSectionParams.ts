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
import { formatOcrLineUnit, readNumberValue, readStringValue } from "./repairReportHelpers";
import { getReviewComparisonColor, getReviewComparisonLabel } from "./repairUiHelpers";

type RepairReviewFormatterSectionParams = Pick<
  BuildRepairWorkspacePropsParams,
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

export function buildRepairReviewFormatterSectionParams(): RepairReviewFormatterSectionParams {
  return {
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
