import { documentHasActiveImportJob, isDocumentAwaitingOcr } from "./displayFormatters";
import type { ReviewRepairFieldsDraft } from "./workspaceFormTypes";

export type EditableWorkDraft = {
  work_code: string;
  work_name: string;
  quantity: number;
  standard_hours: number | "";
  actual_hours: number | "";
  price: number;
  line_total: number;
  status: string;
};

export type EditablePartDraft = {
  article: string;
  part_name: string;
  quantity: number;
  unit_name: string;
  price: number;
  line_total: number;
  status: string;
};

export type EditableRepairDraft = {
  order_number: string;
  repair_date: string;
  mileage: number;
  reason: string;
  employee_comment: string;
  service_name: string;
  work_total: number;
  parts_total: number;
  vat_total: number;
  grand_total: number;
  status: string;
  is_preliminary: boolean;
  works: EditableWorkDraft[];
  parts: EditablePartDraft[];
};

export type ReviewComparisonStatus = "match" | "missing" | "mismatch" | "ocr_missing" | "empty";

export type RepairDetailForDraft = {
  order_number: string | null;
  repair_date: string;
  mileage: number;
  reason: string | null;
  employee_comment: string | null;
  work_total: number;
  parts_total: number;
  vat_total: number;
  grand_total: number;
  status: string;
  is_preliminary: boolean;
  service: {
    name: string;
  } | null;
  works: Array<{
    work_code: string | null;
    work_name: string;
    quantity: number;
    standard_hours: number | null;
    actual_hours: number | null;
    price: number;
    line_total: number;
    status: string;
  }>;
  parts: Array<{
    article: string | null;
    part_name: string;
    quantity: number;
    unit_name: string | null;
    price: number;
    line_total: number;
    status: string;
  }>;
  documents: Array<{
    id: number;
    status: string;
    is_primary: boolean;
    latest_import_job?: {
      status?: string | null;
    } | null;
  }>;
};

export function createRepairDraft(repair: RepairDetailForDraft): EditableRepairDraft {
  return {
    order_number: repair.order_number || "",
    repair_date: repair.repair_date,
    mileage: repair.mileage,
    reason: repair.reason || "",
    employee_comment: repair.employee_comment || "",
    service_name: repair.service?.name || "",
    work_total: repair.work_total,
    parts_total: repair.parts_total,
    vat_total: repair.vat_total,
    grand_total: repair.grand_total,
    status: repair.status,
    is_preliminary: repair.is_preliminary,
    works: repair.works.map((item) => ({
      work_code: item.work_code || "",
      work_name: item.work_name,
      quantity: item.quantity,
      standard_hours: item.standard_hours ?? "",
      actual_hours: item.actual_hours ?? "",
      price: item.price,
      line_total: item.line_total,
      status: item.status,
    })),
    parts: repair.parts.map((item) => ({
      article: item.article || "",
      part_name: item.part_name,
      quantity: item.quantity,
      unit_name: item.unit_name || "",
      price: item.price,
      line_total: item.line_total,
      status: item.status,
    })),
  };
}

export function createReviewRepairFieldsDraft(repair: RepairDetailForDraft): ReviewRepairFieldsDraft {
  return {
    order_number: repair.order_number || "",
    repair_date: repair.repair_date || "",
    mileage: repair.mileage > 0 ? String(repair.mileage) : "",
    work_total: String(repair.work_total ?? ""),
    parts_total: String(repair.parts_total ?? ""),
    vat_total: String(repair.vat_total ?? ""),
    grand_total: String(repair.grand_total ?? ""),
    reason: repair.reason || "",
    employee_comment: repair.employee_comment || "",
  };
}

function normalizeComparableText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value).trim().toLowerCase();
}

function normalizeComparableNumber(value: unknown, digits = 2): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number(value.toFixed(digits));
  }
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, "").replace(",", ".").trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return Number(parsed.toFixed(digits));
    }
  }
  return null;
}

export function getReviewComparisonStatus(
  currentValue: unknown,
  ocrValue: unknown,
  mode: "text" | "int" | "money" = "text",
): ReviewComparisonStatus {
  if (mode === "text") {
    const current = normalizeComparableText(currentValue);
    const ocr = normalizeComparableText(ocrValue);
    if (!current && !ocr) {
      return "empty";
    }
    if (!current && ocr) {
      return "missing";
    }
    if (current && !ocr) {
      return "ocr_missing";
    }
    return current === ocr ? "match" : "mismatch";
  }

  const digits = mode === "int" ? 0 : 2;
  const current = normalizeComparableNumber(currentValue, digits);
  const ocr = normalizeComparableNumber(ocrValue, digits);
  if (current === null && ocr === null) {
    return "empty";
  }
  if (current === null && ocr !== null) {
    return "missing";
  }
  if (current !== null && ocr === null) {
    return "ocr_missing";
  }
  return current === ocr ? "match" : "mismatch";
}

export function getReviewComparisonLabel(status: ReviewComparisonStatus) {
  switch (status) {
    case "match":
      return "Совпадает";
    case "missing":
      return "Нужно заполнить";
    case "mismatch":
      return "Расхождение";
    case "ocr_missing":
      return "Нет в OCR";
    default:
      return "Нет данных";
  }
}

export function getReviewComparisonColor(
  status: ReviewComparisonStatus,
): "default" | "success" | "warning" | "error" {
  switch (status) {
    case "match":
      return "success";
    case "missing":
      return "warning";
    case "mismatch":
      return "error";
    default:
      return "default";
  }
}

export function readConfidenceValue(
  confidenceMap: Record<string, unknown> | null | undefined,
  ...keys: string[]
) {
  for (const key of keys) {
    const rawValue = confidenceMap?.[key];
    if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      return rawValue;
    }
  }
  return null;
}

export function resolveRepairDocumentId(repair: RepairDetailForDraft, preferredDocumentId: number | null) {
  if (preferredDocumentId !== null && repair.documents.some((document) => document.id === preferredDocumentId)) {
    return preferredDocumentId;
  }
  return repair.documents.find((document) => document.is_primary)?.id ?? repair.documents[0]?.id ?? null;
}

export function repairHasDocumentsAwaitingOcr(repair: RepairDetailForDraft | null) {
  return (
    repair?.documents.some((document) => isDocumentAwaitingOcr(document.status) || documentHasActiveImportJob(document)) ??
    false
  );
}

export function getDocumentPreviewKind(mimeType: string | null | undefined): "pdf" | "image" | null {
  if (!mimeType) {
    return null;
  }
  if (mimeType === "application/pdf") {
    return "pdf";
  }
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  return null;
}
