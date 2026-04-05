import {
  getExtractedFieldSourceLabel,
  getLatestRepairDocumentConfidenceMap,
  getLatestRepairDocumentPayload,
  getPayloadExtractedFields,
  getPayloadExtractedItems,
  isPlaceholderVehicle,
} from "../shared/fleetDocumentHelpers";
import {
  documentHasActiveImportJob,
  isDocumentAwaitingOcr,
} from "../shared/displayFormatters";
import {
  buildAttentionVisualBars,
  buildQualityVisualBars,
  buildRepairVisualBars,
} from "../shared/dashboardVisuals";
import {
  getReviewComparisonStatus,
  readConfidenceValue,
} from "../shared/repairUiHelpers";
import { groupRepairChecksForReport } from "../shared/repairReportHelpers";
import type { RepairDetail } from "../shared/repairDetailTypes";
import type {
  DashboardDataQuality,
  DashboardDataQualityDetails,
  ReviewDecisionItem,
  DashboardSummary,
  ReviewQueueItem,
  UserRole,
} from "../shared/workspaceBootstrapTypes";
import type {
  ReviewExtractedFieldSnapshot,
  ReviewRequiredFieldComparisonItem,
} from "../shared/workspaceFormTypes";

type RepairDetailLike = Pick<
  RepairDetail,
  | "id"
  | "source_document_id"
  | "order_number"
  | "repair_date"
  | "mileage"
  | "grand_total"
  | "status"
  | "is_partially_recognized"
  | "vehicle"
  | "service"
  | "documents"
  | "checks"
>;

type UseRepairDerivedViewModelParams = {
  selectedDocumentId: number | null;
  selectedFiles: File[];
  userRole: UserRole | null | undefined;
  selectedRepair: RepairDetailLike | null;
  reviewQueue: ReviewQueueItem[];
  summary: DashboardSummary | null;
  dataQuality: DashboardDataQuality | null;
  dataQualityDetails: DashboardDataQualityDetails | null;
  formatMoney: (value: number | null | undefined) => string | null;
};

function buildFallbackReviewQueueItem(
  selectedRepair: RepairDetailLike | null,
  selectedRepairDocument: RepairDetailLike["documents"][number] | null,
  manualReviewReasons: string[],
): ReviewDecisionItem | null {
  if (!selectedRepair || !selectedRepairDocument) {
    return null;
  }
  if (selectedRepairDocument.kind !== "order" && selectedRepairDocument.kind !== "repeat_scan") {
    return null;
  }
  if (selectedRepairDocument.status === "archived" || selectedRepair.status === "archived") {
    return null;
  }

  const unresolvedChecks = selectedRepair.checks.filter((item) => !item.is_resolved);
  const hasReviewWorkflowSignals =
    selectedRepairDocument.status === "needs_review" ||
    selectedRepairDocument.status === "ocr_error" ||
    selectedRepairDocument.status === "partially_recognized" ||
    selectedRepair.status === "in_review" ||
    selectedRepair.status === "employee_confirmed" ||
    selectedRepair.status === "ocr_error" ||
    selectedRepair.status === "suspicious" ||
    selectedRepair.is_partially_recognized ||
    unresolvedChecks.length > 0;

  if (!hasReviewWorkflowSignals) {
    return null;
  }

  const issueTitles: string[] = [];
  const pushIssue = (value: string | null) => {
    if (!value || issueTitles.includes(value)) {
      return;
    }
    issueTitles.push(value);
  };

  if (selectedRepairDocument.status === "needs_review") {
    pushIssue("Требуется ручная проверка");
  } else if (selectedRepairDocument.status === "ocr_error") {
    pushIssue("Ошибка OCR");
  } else if (selectedRepairDocument.status === "partially_recognized") {
    pushIssue("Частичное распознавание");
  }

  if (selectedRepair.status === "employee_confirmed") {
    pushIssue("Ожидает финального подтверждения администратора");
  } else if (selectedRepair.status === "suspicious") {
    pushIssue("Подозрительный ремонт");
  } else if (selectedRepair.status === "ocr_error") {
    pushIssue("Ошибка распознавания в ремонте");
  } else if (selectedRepair.status === "in_review") {
    pushIssue("Ремонт находится на ручной проверке");
  }

  manualReviewReasons.forEach(pushIssue);
  unresolvedChecks.forEach((item) => pushIssue(item.title));

  let category: ReviewQueueItem["category"] = "manual_review";
  if (
    selectedRepair.status === "suspicious" ||
    unresolvedChecks.some((item) => item.severity === "suspicious" || item.severity === "error")
  ) {
    category = "suspicious";
  } else if (selectedRepairDocument.status === "ocr_error" || selectedRepair.status === "ocr_error") {
    category = "ocr_error";
  } else if (selectedRepair.status === "employee_confirmed") {
    category = "employee_confirmation";
  } else if (selectedRepairDocument.status === "partially_recognized" || selectedRepair.is_partially_recognized) {
    category = "partial_recognition";
  }

  const priorityBucket: ReviewQueueItem["priority_bucket"] =
    category === "suspicious" ? "suspicious" : category === "ocr_error" ? "critical" : "review";

  return {
    priority_bucket: priorityBucket,
    issue_titles: issueTitles,
    document: {
      id: selectedRepairDocument.id,
    },
  };
}

export function useRepairDerivedViewModel({
  selectedDocumentId,
  selectedFiles,
  userRole,
  selectedRepair,
  reviewQueue,
  summary,
  dataQuality,
  dataQualityDetails,
  formatMoney,
}: UseRepairDerivedViewModelParams) {
  const matchedReviewQueueItem = reviewQueue.find((item) => item.document.id === selectedDocumentId) ?? null;
  const selectedRepairDocument = selectedRepair?.documents.find((item) => item.id === selectedDocumentId) ?? null;
  const selectedRepairDocumentPayload = getLatestRepairDocumentPayload(selectedRepair, selectedDocumentId);
  const selectedRepairDocumentConfidenceMap = getLatestRepairDocumentConfidenceMap(selectedRepair, selectedDocumentId);
  const selectedRepairDocumentExtractedFields = getPayloadExtractedFields(selectedRepairDocumentPayload);
  const selectedRepairDocumentExtractedItems = getPayloadExtractedItems(selectedRepairDocumentPayload);
  const selectedRepairDocumentOcrServiceName =
    typeof selectedRepairDocumentExtractedFields?.service_name === "string"
      ? selectedRepairDocumentExtractedFields.service_name.trim()
      : "";
  const selectedRepairDocumentWorks = Array.isArray(selectedRepairDocumentExtractedItems?.works)
    ? selectedRepairDocumentExtractedItems.works
    : [];
  const selectedRepairDocumentParts = Array.isArray(selectedRepairDocumentExtractedItems?.parts)
    ? selectedRepairDocumentExtractedItems.parts
    : [];
  const selectedRepairUnresolvedChecks = selectedRepair
    ? selectedRepair.checks.filter((item) => !item.is_resolved)
    : [];
  const sourceRepairDocument = selectedRepair
    ? (selectedRepair.source_document_id !== null
        ? selectedRepair.documents.find((document) => document.id === selectedRepair.source_document_id)
        : null) ??
      selectedRepair.documents.find((document) => document.is_primary) ??
      selectedRepair.documents[0] ??
      null
    : null;
  const selectedRepairAwaitingOcr =
    sourceRepairDocument !== null
      ? isDocumentAwaitingOcr(sourceRepairDocument.status) || documentHasActiveImportJob(sourceRepairDocument)
      : false;
  const selectedRepairHasBlockingFindings = selectedRepairUnresolvedChecks.some(
    (item) => item.severity === "suspicious" || item.severity === "error",
  );
  const selectedRepairReportSections = groupRepairChecksForReport(selectedRepairUnresolvedChecks);
  const selectedRepairDocumentManualReviewReasons =
    Array.isArray(selectedRepairDocumentPayload?.manual_review_reasons)
      ? selectedRepairDocumentPayload.manual_review_reasons.filter((item): item is string => typeof item === "string")
      : [];
  const selectedReviewItem =
    matchedReviewQueueItem !== null
      ? {
          document: {
            id: matchedReviewQueueItem.document.id,
          },
          priority_bucket: matchedReviewQueueItem.priority_bucket,
          issue_titles: matchedReviewQueueItem.issue_titles,
        }
      : buildFallbackReviewQueueItem(selectedRepair, selectedRepairDocument, selectedRepairDocumentManualReviewReasons);
  const repairVisualBars = buildRepairVisualBars(summary, dataQuality);
  const repairVisualMax = Math.max(...repairVisualBars.map((item) => item.value), 0);
  const qualityVisualBars = buildQualityVisualBars(dataQuality);
  const qualityVisualMax = Math.max(...qualityVisualBars.map((item) => item.value), 0);
  const attentionVisualBars = buildAttentionVisualBars(dataQualityDetails);
  const attentionVisualMax = Math.max(...attentionVisualBars.map((item) => item.value), 0);
  const topAttentionServices = dataQualityDetails?.services.slice(0, 5) || [];
  const reviewRequiredFieldComparisons: ReviewRequiredFieldComparisonItem[] = selectedRepair
    ? [
        {
          key: "vehicle",
          label: "Машина",
          currentValue:
            !isPlaceholderVehicle(selectedRepair.vehicle.external_id) &&
            (selectedRepair.vehicle.plate_number || selectedRepair.vehicle.model || selectedRepair.vehicle.id)
              ? selectedRepair.vehicle.plate_number || selectedRepair.vehicle.model || `ID ${selectedRepair.vehicle.id}`
              : "",
          ocrValue:
            typeof selectedRepairDocumentExtractedFields?.plate_number === "string"
              ? selectedRepairDocumentExtractedFields.plate_number
              : typeof selectedRepairDocumentExtractedFields?.vin === "string"
                ? selectedRepairDocumentExtractedFields.vin
                : "",
          currentDisplay:
            !isPlaceholderVehicle(selectedRepair.vehicle.external_id) &&
            (selectedRepair.vehicle.plate_number || selectedRepair.vehicle.model || selectedRepair.vehicle.id)
              ? selectedRepair.vehicle.plate_number || selectedRepair.vehicle.model || `ID ${selectedRepair.vehicle.id}`
              : "Не привязана",
          ocrDisplay:
            typeof selectedRepairDocumentExtractedFields?.plate_number === "string"
              ? selectedRepairDocumentExtractedFields.plate_number
              : typeof selectedRepairDocumentExtractedFields?.vin === "string"
                ? selectedRepairDocumentExtractedFields.vin
                : "—",
          currentSourceLabel: "Карточка ремонта",
          ocrSourceLabel:
            typeof selectedRepairDocumentExtractedFields?.plate_number === "string"
              ? getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "plate_number")
              : typeof selectedRepairDocumentExtractedFields?.vin === "string"
                ? getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "vin")
                : "Документ",
          status:
            !isPlaceholderVehicle(selectedRepair.vehicle.external_id) &&
            (selectedRepair.vehicle.plate_number || selectedRepair.vehicle.model || selectedRepair.vehicle.id)
              ? "match"
              : "missing",
          confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "plate_number", "vin"),
        },
        {
          key: "order_number",
          label: "Номер заказ-наряда",
          currentValue: selectedRepair.order_number || "",
          ocrValue: selectedRepairDocumentExtractedFields?.order_number,
          currentDisplay: selectedRepair.order_number || "—",
          ocrDisplay: String(selectedRepairDocumentExtractedFields?.order_number || "—"),
          currentSourceLabel: "Карточка ремонта",
          ocrSourceLabel: getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "order_number"),
          confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "order_number"),
          status: getReviewComparisonStatus(selectedRepair.order_number, selectedRepairDocumentExtractedFields?.order_number),
        },
        {
          key: "repair_date",
          label: "Дата ремонта",
          currentValue: selectedRepair.repair_date || "",
          ocrValue: selectedRepairDocumentExtractedFields?.repair_date,
          currentDisplay: selectedRepair.repair_date || "—",
          ocrDisplay: String(selectedRepairDocumentExtractedFields?.repair_date || "—"),
          currentSourceLabel: "Карточка ремонта",
          ocrSourceLabel: getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "repair_date"),
          confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "repair_date"),
          status: getReviewComparisonStatus(selectedRepair.repair_date, selectedRepairDocumentExtractedFields?.repair_date),
        },
        {
          key: "service",
          label: "Сервис",
          currentValue: selectedRepair.service?.name || "",
          ocrValue: selectedRepairDocumentExtractedFields?.service_name,
          currentDisplay: selectedRepair.service?.name || "—",
          ocrDisplay: String(selectedRepairDocumentExtractedFields?.service_name || "—"),
          currentSourceLabel: "Карточка ремонта",
          ocrSourceLabel: getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "service_name"),
          confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "service_name"),
          status: getReviewComparisonStatus(selectedRepair.service?.name, selectedRepairDocumentExtractedFields?.service_name),
        },
        {
          key: "mileage",
          label: "Пробег",
          currentValue: selectedRepair.mileage,
          ocrValue: selectedRepairDocumentExtractedFields?.mileage,
          currentDisplay: selectedRepair.mileage > 0 ? String(selectedRepair.mileage) : "—",
          ocrDisplay: String(selectedRepairDocumentExtractedFields?.mileage || "—"),
          currentSourceLabel: "Карточка ремонта",
          ocrSourceLabel: getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "mileage"),
          confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "mileage"),
          status: getReviewComparisonStatus(selectedRepair.mileage, selectedRepairDocumentExtractedFields?.mileage, "int"),
        },
        {
          key: "grand_total",
          label: "Итоговая сумма",
          currentValue: selectedRepair.grand_total,
          ocrValue: selectedRepairDocumentExtractedFields?.grand_total,
          currentDisplay: formatMoney(selectedRepair.grand_total) || "—",
          ocrDisplay:
            typeof selectedRepairDocumentExtractedFields?.grand_total === "number"
              ? formatMoney(selectedRepairDocumentExtractedFields.grand_total) || "—"
              : "—",
          currentSourceLabel: "Карточка ремонта",
          ocrSourceLabel: getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "grand_total"),
          confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "grand_total"),
          status: getReviewComparisonStatus(selectedRepair.grand_total, selectedRepairDocumentExtractedFields?.grand_total, "money"),
        },
      ]
    : [];
  const selectedRepairDocumentFieldSnapshots: ReviewExtractedFieldSnapshot[] = [
    {
      key: "order_number",
      label: "Номер заказ-наряда",
      value: String(selectedRepairDocumentExtractedFields?.order_number || "—"),
      sourceLabel: getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "order_number"),
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "order_number"),
    },
    {
      key: "repair_date",
      label: "Дата ремонта",
      value: String(selectedRepairDocumentExtractedFields?.repair_date || "—"),
      sourceLabel: getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "repair_date"),
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "repair_date"),
    },
    {
      key: "service_name",
      label: "Сервис по OCR",
      value: selectedRepairDocumentOcrServiceName || "—",
      sourceLabel: getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "service_name"),
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "service_name"),
    },
    {
      key: "mileage",
      label: "Пробег",
      value: String(selectedRepairDocumentExtractedFields?.mileage || "—"),
      sourceLabel: getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "mileage"),
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "mileage"),
    },
    {
      key: "plate_number",
      label: "Госномер",
      value: String(selectedRepairDocumentExtractedFields?.plate_number || "—"),
      sourceLabel: getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "plate_number"),
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "plate_number"),
    },
    {
      key: "vin",
      label: "VIN",
      value: String(selectedRepairDocumentExtractedFields?.vin || "—"),
      sourceLabel: getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "vin"),
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "vin"),
    },
    {
      key: "grand_total",
      label: "Итоговая сумма",
      value:
        typeof selectedRepairDocumentExtractedFields?.grand_total === "number"
          ? formatMoney(selectedRepairDocumentExtractedFields.grand_total) || "—"
          : "—",
      sourceLabel: getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "grand_total"),
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "grand_total"),
    },
    {
      key: "work_total",
      label: "Работы",
      value:
        typeof selectedRepairDocumentExtractedFields?.work_total === "number"
          ? formatMoney(selectedRepairDocumentExtractedFields.work_total) || "—"
          : "—",
      sourceLabel: getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "work_total"),
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "work_total"),
    },
    {
      key: "parts_total",
      label: "Запчасти",
      value:
        typeof selectedRepairDocumentExtractedFields?.parts_total === "number"
          ? formatMoney(selectedRepairDocumentExtractedFields.parts_total) || "—"
          : "—",
      sourceLabel: getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "parts_total"),
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "parts_total"),
    },
    {
      key: "vat_total",
      label: "НДС",
      value:
        typeof selectedRepairDocumentExtractedFields?.vat_total === "number"
          ? formatMoney(selectedRepairDocumentExtractedFields.vat_total) || "—"
          : "—",
      sourceLabel: getExtractedFieldSourceLabel(selectedRepairDocumentPayload, "vat_total"),
      confidenceValue: readConfidenceValue(selectedRepairDocumentConfidenceMap, "vat_total"),
    },
  ].filter((item) => item.value !== "—" || item.confidenceValue !== null);
  const reviewMissingRequiredFields = reviewRequiredFieldComparisons
    .filter((item) => item.status === "missing")
    .map((item) => item.label);
  const selectedRepairComparisonAttentionCount = reviewRequiredFieldComparisons.filter(
    (item) => item.status === "missing" || item.status === "mismatch",
  ).length;
  const reviewReadyFieldsCount = reviewRequiredFieldComparisons.filter((item) => item.status !== "missing").length;
  const hasUnresolvedReviewChecks = selectedRepairUnresolvedChecks.length > 0;
  const canConfirmSelectedReview = reviewMissingRequiredFields.length === 0 && !hasUnresolvedReviewChecks;
  const uploadMissingRequirements = [
    selectedFiles.length === 0 ? "файл" : null,
  ].filter(Boolean) as string[];
  const canLinkVehicleFromSelectedDocument =
    selectedDocumentId !== null &&
    Boolean(selectedRepair) &&
    selectedRepair?.status !== "archived" &&
    selectedRepairDocument?.status !== "archived" &&
    isPlaceholderVehicle(selectedRepair?.vehicle.external_id);
  const canCreateVehicleFromSelectedDocument =
    userRole === "admin" &&
    selectedRepair?.status !== "archived" &&
    selectedRepairDocument?.status !== "archived" &&
    isPlaceholderVehicle(selectedRepair?.vehicle.external_id) &&
    selectedDocumentId !== null;

  return {
    selectedReviewItem,
    selectedRepairDocument,
    selectedRepairDocumentPayload,
    selectedRepairDocumentConfidenceMap,
    selectedRepairDocumentExtractedFields,
    selectedRepairDocumentOcrServiceName,
    selectedRepairDocumentWorks,
    selectedRepairDocumentParts,
    selectedRepairUnresolvedChecks,
    selectedRepairAwaitingOcr,
    selectedRepairHasBlockingFindings,
    selectedRepairReportSections,
    selectedRepairDocumentManualReviewReasons,
    repairVisualBars,
    repairVisualMax,
    qualityVisualBars,
    qualityVisualMax,
    attentionVisualBars,
    attentionVisualMax,
    topAttentionServices,
    reviewRequiredFieldComparisons,
    selectedRepairDocumentFieldSnapshots,
    reviewMissingRequiredFields,
    selectedRepairComparisonAttentionCount,
    reviewReadyFieldsCount,
    canConfirmSelectedReview,
    uploadMissingRequirements,
    canLinkVehicleFromSelectedDocument,
    canCreateVehicleFromSelectedDocument,
  };
}
