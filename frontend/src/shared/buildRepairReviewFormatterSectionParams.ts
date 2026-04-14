import {
  formatDocumentKind,
  formatDocumentStatusLabel,
  formatLaborNormApplicability,
  formatManualReviewReasons,
  formatOcrProfileMeta,
  formatSourceTypeLabel,
  statusColor,
} from "../entities/document/formatters";
import { formatVehicleTypeLabel } from "../entities/vehicle/formatters";
import { formatVehicle } from "../entities/vehicle/helpers";
import {
  formatCompactNumber,
  formatConfidence,
  formatConfidenceLabel,
  formatDateTime,
  formatHours,
  formatMoney,
  getConfidenceColor,
} from "./formattersCore";
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
