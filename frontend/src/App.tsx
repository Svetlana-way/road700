import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

type UserRole = "admin" | "employee";
type VehicleType = "truck" | "trailer";
type DocumentKind = "order" | "repeat_scan" | "attachment" | "confirmation";
type DocumentStatus =
  | "uploaded"
  | "recognized"
  | "partially_recognized"
  | "needs_review"
  | "confirmed"
  | "ocr_error"
  | "archived";

type DashboardSummary = {
  vehicles_total: number;
  repairs_total: number;
  repairs_draft: number;
  repairs_suspicious: number;
  documents_total: number;
  documents_review_queue: number;
};

type User = {
  id: number;
  full_name: string;
  login: string;
  email: string;
  role: UserRole;
  is_active: boolean;
};

type Vehicle = {
  id: number;
  vehicle_type: VehicleType;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
  current_driver_name: string | null;
};

type VehiclesResponse = {
  items: Vehicle[];
  total: number;
};

type VehiclePreview = {
  id: number;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
};

type DocumentItem = {
  id: number;
  original_filename: string;
  source_type: string;
  kind: DocumentKind;
  status: DocumentStatus;
  created_at: string;
  notes: string | null;
  parsed_payload?: {
    extracted_fields?: {
      order_number?: string;
      mileage?: number;
      grand_total?: number;
      service_name?: string;
    };
    extracted_items?: {
      works?: Array<Record<string, unknown>>;
      parts?: Array<Record<string, unknown>>;
    };
    manual_review_reasons?: string[];
    labor_norm_applicability?: {
      eligible?: boolean;
      reason?: string;
      matched_count?: number;
      unmatched_count?: number;
      brand_family?: string | null;
    };
  } | null;
  repair: {
    id: number;
    order_number: string | null;
    repair_date: string;
    mileage: number;
    status: string;
  };
  vehicle: {
    id: number;
    vehicle_type: VehicleType;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  };
};

type DocumentsResponse = {
  items: DocumentItem[];
};

type LaborNormCatalogItem = {
  id: number;
  code: string;
  category: string | null;
  name_ru: string;
  name_ru_alt: string | null;
  name_cn: string | null;
  name_en: string | null;
  normalized_name: string;
  standard_hours: number;
  source_sheet: string | null;
  source_file: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type LaborNormCatalogResponse = {
  items: LaborNormCatalogItem[];
  total: number;
  limit: number;
  offset: number;
  categories: string[];
  source_files: string[];
};

type LaborNormImportResponse = {
  message: string;
  filename: string;
  imported_at: string;
  created: number;
  updated: number;
  skipped: number;
};

type ReviewPriorityBucket = "review" | "critical" | "suspicious";
type HistoryFilter = "all" | "repair" | "documents" | "uploads" | "primary" | "comparison";
type ReviewQueueCategory =
  | "all"
  | "suspicious"
  | "ocr_error"
  | "partial_recognition"
  | "employee_confirmation"
  | "manual_review";

type ReviewQueueItem = {
  category: ReviewQueueCategory;
  priority_score: number;
  priority_bucket: ReviewPriorityBucket;
  issue_count: number;
  issue_titles: string[];
  manual_review_reasons: string[];
  extracted_order_number: string | null;
  extracted_grand_total: number | null;
  document: {
    id: number;
    original_filename: string;
    source_type: string;
    kind: DocumentKind;
    status: DocumentStatus;
    created_at: string;
    updated_at: string;
    ocr_confidence: number | null;
    review_queue_priority: number;
  };
  repair: {
    id: number;
    order_number: string | null;
    repair_date: string;
    mileage: number;
    status: string;
    is_partially_recognized: boolean;
    unresolved_checks_total: number;
    suspicious_checks_total: number;
  };
  vehicle: {
    id: number;
    vehicle_type: VehicleType;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  };
};

type ReviewQueueResponse = {
  items: ReviewQueueItem[];
  counts: Record<ReviewQueueCategory, number>;
  total: number;
  limit: number;
  offset: number;
};

type ReviewActionResponse = {
  message: string;
  document_id: number;
  repair_id: number;
  document_status: DocumentStatus;
  repair_status: string;
  queue_item: ReviewQueueItem | null;
};

type DocumentComparisonResponse = {
  left_document: DocumentItem;
  right_document: DocumentItem;
  compared_fields: Array<{
    field_name: string;
    label: string;
    left_value: string | null;
    right_value: string | null;
    is_different: boolean;
  }>;
  works_count_left: number;
  works_count_right: number;
  parts_count_left: number;
  parts_count_right: number;
};

type DocumentComparisonReviewResponse = {
  message: string;
  action: string;
  document_id: number;
  repair_id: number;
  source_document_id: number | null;
};

type LoginResponse = {
  access_token: string;
};

type CheckSeverity = "normal" | "warning" | "suspicious" | "error";

type RepairDetail = {
  id: number;
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
  is_partially_recognized: boolean;
  is_manually_completed: boolean;
  created_at: string;
  updated_at: string;
  vehicle: {
    id: number;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  };
  service: {
    id: number;
    name: string;
    city: string | null;
  } | null;
  works: Array<{
    id: number;
    work_code: string | null;
    work_name: string;
    quantity: number;
    standard_hours: number | null;
    actual_hours: number | null;
    price: number;
    line_total: number;
    status: string;
    reference_payload: Record<string, unknown> | null;
  }>;
  parts: Array<{
    id: number;
    article: string | null;
    part_name: string;
    quantity: number;
    unit_name: string | null;
    price: number;
    line_total: number;
    status: string;
  }>;
  checks: Array<{
    id: number;
    check_type: string;
    severity: CheckSeverity;
    title: string;
    details: string | null;
    calculation_payload: Record<string, unknown> | null;
    is_resolved: boolean;
    created_at: string;
  }>;
  documents: Array<{
    id: number;
    original_filename: string;
    source_type: string;
    kind: DocumentKind;
    mime_type: string | null;
    status: string;
    is_primary: boolean;
    ocr_confidence: number | null;
    review_queue_priority: number;
    notes: string | null;
    created_at: string;
    updated_at: string;
    versions: Array<{
      id: number;
      version_number: number;
      created_at: string;
      change_summary: string | null;
      parsed_payload: Record<string, unknown> | null;
    }>;
  }>;
  document_history: Array<{
    id: number;
    action_type: string;
    created_at: string;
    user_name: string | null;
    document_id: number | null;
    document_filename: string | null;
    document_kind: DocumentKind | null;
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
  }>;
  history: Array<{
    id: number;
    action_type: string;
    created_at: string;
    user_name: string | null;
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
  }>;
};

type RepairHistoryEntry = RepairDetail["history"][number];
type RepairDocumentHistoryEntry = RepairDetail["document_history"][number];

type CheckResolutionMeta = {
  is_resolved?: boolean;
  comment?: string | null;
  user_id?: number;
  user_name?: string | null;
  resolved_at?: string | null;
};

type WorkLaborNormMeta = {
  applicable: boolean | null;
  applicabilityReason: string | null;
  code: string | null;
  name: string | null;
  category: string | null;
  matchedBy: string | null;
  matchScore: number | null;
  standardHours: number | null;
};

type EditableWorkDraft = {
  work_code: string;
  work_name: string;
  quantity: number;
  standard_hours: number | "";
  actual_hours: number | "";
  price: number;
  line_total: number;
  status: string;
};

type EditablePartDraft = {
  article: string;
  part_name: string;
  quantity: number;
  unit_name: string;
  price: number;
  line_total: number;
  status: string;
};

type EditableRepairDraft = {
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

type UploadFormState = {
  vehicleId: string;
  documentKind: DocumentKind;
  repairDate: string;
  mileage: string;
  orderNumber: string;
  reason: string;
  employeeComment: string;
  notes: string;
};

const TOKEN_STORAGE_KEY = "road700.access_token";
const API_BASE_URL =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8000/api"
    : "/api";

const emptyUploadForm = (): UploadFormState => ({
  vehicleId: "",
  documentKind: "order",
  repairDate: new Date().toISOString().slice(0, 10),
  mileage: "",
  orderNumber: "",
  reason: "",
  employeeComment: "",
  notes: "",
});

const summaryCards: Array<{ key: keyof DashboardSummary; label: string }> = [
  { key: "vehicles_total", label: "Техника в доступе" },
  { key: "repairs_total", label: "Ремонтов в базе" },
  { key: "documents_total", label: "Документов загружено" },
  { key: "documents_review_queue", label: "Очередь проверки" },
];

const reviewQueueFilters: Array<{ key: ReviewQueueCategory; label: string }> = [
  { key: "all", label: "Все" },
  { key: "suspicious", label: "Подозрительные" },
  { key: "ocr_error", label: "OCR ошибки" },
  { key: "partial_recognition", label: "Частично распознано" },
  { key: "employee_confirmation", label: "Ждут подтверждения" },
  { key: "manual_review", label: "Ручная проверка" },
];

const historyFilters: Array<{ key: HistoryFilter; label: string }> = [
  { key: "all", label: "Все события" },
  { key: "repair", label: "Ремонт" },
  { key: "documents", label: "Документы" },
  { key: "uploads", label: "Загрузки" },
  { key: "primary", label: "Основной документ" },
  { key: "comparison", label: "Сверки" },
];

const documentKindOptions: Array<{ value: DocumentKind; label: string }> = [
  { value: "order", label: "Основной заказ-наряд" },
  { value: "repeat_scan", label: "Повторный скан" },
  { value: "attachment", label: "Приложение" },
  { value: "confirmation", label: "Подтверждающий файл" },
];

const rootDocumentKindOptions = documentKindOptions.filter(
  (option) => option.value === "order" || option.value === "repeat_scan",
);
const HISTORY_DETAIL_PREVIEW_LIMIT = 220;
const historyActionLabels: Record<string, string> = {
  manual_update: "Ручное редактирование ремонта",
  check_resolution_update: "Изменение статуса проверки",
  review_confirm: "Подтверждение администратором",
  review_send_to_review: "Возврат в ручную проверку",
  primary_document_changed: "Смена основного документа",
  set_primary: "Документ назначен основным",
  document_uploaded: "Загрузка нового документа",
  document_attached: "Прикрепление документа к ремонту",
  document_comparison_reviewed: "Результат сверки документов",
  comparison_keep_current_primary: "Сверка: оставлен текущий основной документ",
  comparison_make_document_primary: "Сверка: выбран новый основной документ",
  comparison_mark_reviewed: "Сверка отмечена как проверенная",
};
const repairStatusLabels: Record<string, string> = {
  draft: "Черновик",
  in_review: "На проверке",
  employee_confirmed: "Подтверждено сотрудником",
  suspicious: "Подозрительный ремонт",
  ocr_error: "Ошибка OCR",
  confirmed: "Подтверждено",
  archived: "Архив",
};
const documentStatusLabels: Record<string, string> = {
  uploaded: "Загружен",
  recognized: "Распознан",
  partially_recognized: "Распознан частично",
  needs_review: "Требует ручной проверки",
  confirmed: "Подтвержден",
  ocr_error: "Ошибка OCR",
  archived: "Архив",
};

function formatStatus(status: string) {
  return status.split("_").join(" ");
}

function formatMoney(value?: number) {
  if (typeof value !== "number") {
    return null;
  }
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(value);
}

function getLaborNormApplicability(
  payload: Record<string, unknown> | null | undefined,
):
  | {
      eligible: boolean;
      reason: string | null;
      matchedCount: number;
      unmatchedCount: number;
    }
  | null {
  const rawValue = payload?.labor_norm_applicability;
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return null;
  }

  const rawApplicability = rawValue as Record<string, unknown>;
  return {
    eligible: rawApplicability.eligible === true,
    reason: typeof rawApplicability.reason === "string" ? rawApplicability.reason : null,
    matchedCount:
      typeof rawApplicability.matched_count === "number" ? rawApplicability.matched_count : 0,
    unmatchedCount:
      typeof rawApplicability.unmatched_count === "number" ? rawApplicability.unmatched_count : 0,
  };
}

function formatLaborNormApplicability(payload: Record<string, unknown> | null | undefined) {
  const applicability = getLaborNormApplicability(payload);
  if (!applicability) {
    return null;
  }

  if (!applicability.eligible) {
    return `Нормо-часы: ${applicability.reason || "справочник не применяется к этой технике"}`;
  }

  if (applicability.matchedCount > 0) {
    if (applicability.unmatchedCount > 0) {
      return `Нормо-часы: найдено совпадений ${applicability.matchedCount}, без совпадения ${applicability.unmatchedCount}`;
    }
    return `Нормо-часы: найдено совпадений ${applicability.matchedCount}`;
  }

  if (applicability.unmatchedCount > 0) {
    return "Нормо-часы: справочник применим, но совпадения не найдены";
  }

  return "Нормо-часы: применимость проверена";
}

function formatHours(value: number | null | undefined) {
  if (typeof value !== "number") {
    return null;
  }
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ч`;
}

function formatMatchMethod(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const labels: Record<string, string> = {
    code: "по коду",
    normalized_name: "по нормализованному названию",
    name_contains: "по частичному совпадению",
    name_tokens: "по токенам названия",
  };
  return labels[value] || value;
}

function readWorkLaborNormMeta(referencePayload: Record<string, unknown> | null | undefined): WorkLaborNormMeta | null {
  if (!referencePayload) {
    return null;
  }
  return {
    applicable:
      typeof referencePayload.labor_norm_applicable === "boolean"
        ? referencePayload.labor_norm_applicable
        : null,
    applicabilityReason:
      typeof referencePayload.labor_norm_applicability_reason === "string"
        ? referencePayload.labor_norm_applicability_reason
        : null,
    code:
      typeof referencePayload.labor_norm_code === "string" ? referencePayload.labor_norm_code : null,
    name:
      typeof referencePayload.labor_norm_name === "string" ? referencePayload.labor_norm_name : null,
    category:
      typeof referencePayload.labor_norm_category === "string"
        ? referencePayload.labor_norm_category
        : null,
    matchedBy:
      typeof referencePayload.labor_norm_matched_by === "string"
        ? referencePayload.labor_norm_matched_by
        : null,
    matchScore:
      typeof referencePayload.labor_norm_match_score === "number"
        ? referencePayload.labor_norm_match_score
        : null,
    standardHours:
      typeof referencePayload.labor_norm_standard_hours === "number"
        ? referencePayload.labor_norm_standard_hours
        : null,
  };
}

function formatWorkLaborNormMeta(item: RepairDetail["works"][number]) {
  const meta = readWorkLaborNormMeta(item.reference_payload);
  if (!meta) {
    return null;
  }

  if (meta.code && meta.name) {
    const scoreSuffix =
      typeof meta.matchScore === "number" ? ` · уверенность ${Math.round(meta.matchScore * 100)}%` : "";
    const methodSuffix = formatMatchMethod(meta.matchedBy) ? ` · ${formatMatchMethod(meta.matchedBy)}` : "";
    const hoursSuffix = formatHours(meta.standardHours) ? ` · норма ${formatHours(meta.standardHours)}` : "";
    const categorySuffix = meta.category ? ` · ${meta.category}` : "";
    return `Матчинг: ${meta.code} · ${meta.name}${categorySuffix}${hoursSuffix}${methodSuffix}${scoreSuffix}`;
  }

  if (meta.applicable === false) {
    return `Матчинг: справочник не применён${meta.applicabilityReason ? ` · ${meta.applicabilityReason}` : ""}`;
  }

  if (meta.applicable === true) {
    return "Матчинг: справочник применим, но совпадение не найдено";
  }

  return null;
}

function formatVehicle(vehicle: VehiclePreview) {
  const parts = [vehicle.plate_number, vehicle.brand, vehicle.model].filter(Boolean);
  return parts.join(" • ") || `#${vehicle.id}`;
}

function statusColor(status: DocumentStatus): "default" | "success" | "error" | "warning" {
  if (status === "confirmed" || status === "recognized") {
    return "success";
  }
  if (status === "ocr_error") {
    return "error";
  }
  if (status === "needs_review" || status === "partially_recognized") {
    return "warning";
  }
  return "default";
}

function checkSeverityColor(severity: CheckSeverity): "default" | "success" | "error" | "warning" {
  if (severity === "error") {
    return "error";
  }
  if (severity === "warning" || severity === "suspicious") {
    return "warning";
  }
  if (severity === "normal") {
    return "success";
  }
  return "default";
}

function reviewPriorityColor(bucket: ReviewPriorityBucket): "default" | "error" | "warning" {
  if (bucket === "suspicious") {
    return "error";
  }
  if (bucket === "critical") {
    return "warning";
  }
  return "default";
}

function formatReviewPriority(bucket: ReviewPriorityBucket) {
  if (bucket === "suspicious") {
    return "Подозрительно";
  }
  if (bucket === "critical") {
    return "Критично";
  }
  return "Проверить";
}

function formatDocumentKind(kind: DocumentKind) {
  if (kind === "order") {
    return "Заказ-наряд";
  }
  if (kind === "repeat_scan") {
    return "Повторный скан";
  }
  if (kind === "attachment") {
    return "Приложение";
  }
  return "Подтверждение";
}

function formatRepairStatus(status: string | null | undefined) {
  if (!status) {
    return "—";
  }
  return repairStatusLabels[status] || formatStatus(status);
}

function formatDocumentStatusLabel(status: string | null | undefined) {
  if (!status) {
    return "—";
  }
  return documentStatusLabels[status] || formatStatus(status);
}

function formatHistoryActionLabel(actionType: string) {
  return historyActionLabels[actionType] || formatStatus(actionType);
}

function formatComparisonActionLabel(action: string | null | undefined) {
  if (!action) {
    return "Результат не указан";
  }
  const labels: Record<string, string> = {
    keep_current_primary: "Оставлен текущий основной документ",
    make_document_primary: "Сравниваемый документ назначен основным",
    mark_reviewed: "Сверка отмечена как проверенная",
  };
  return labels[action] || formatStatus(action);
}

function formatDateValue(value: string) {
  const normalizedValue = value.length === 10 ? `${value}T00:00:00` : value;
  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(
    "ru-RU",
    value.length === 10 ? { dateStyle: "short" } : { dateStyle: "short", timeStyle: "short" },
  ).format(parsed);
}

function safeJsonStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function areHistoryValuesEqual(left: unknown, right: unknown) {
  if (left === right) {
    return true;
  }
  return safeJsonStringify(left) === safeJsonStringify(right);
}

function formatHistoryFieldLabel(fieldName: string, context: "repair" | "document" | "generic" = "generic") {
  if (fieldName === "status") {
    return context === "document" ? "Статус документа" : "Статус ремонта";
  }

  const labels: Record<string, string> = {
    order_number: "Номер заказ-наряда",
    repair_date: "Дата ремонта",
    mileage: "Пробег",
    reason: "Причина обращения",
    employee_comment: "Комментарий сотрудника",
    service_name: "Сервис",
    work_total: "Сумма работ",
    parts_total: "Сумма запчастей",
    vat_total: "НДС",
    grand_total: "Итоговая сумма",
    repair_status: "Статус ремонта",
    document_status: "Статус документа",
    review_queue_priority: "Приоритет очереди",
    source_document_id: "Основной документ",
    is_preliminary: "Черновик",
    is_partially_recognized: "Частичное распознавание",
    is_primary: "Основной документ",
    kind: "Тип документа",
    document_kind: "Тип документа",
    notes: "Комментарий",
  };

  return labels[fieldName] || formatStatus(fieldName);
}

function formatHistoryScalar(
  fieldName: string,
  value: unknown,
  context: "repair" | "document" | "generic" = "generic",
) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Да" : "Нет";
  }
  if (typeof value === "number") {
    if (
      fieldName === "work_total" ||
      fieldName === "parts_total" ||
      fieldName === "vat_total" ||
      fieldName === "grand_total"
    ) {
      return formatMoney(value) || "—";
    }
    return new Intl.NumberFormat("ru-RU").format(value);
  }
  if (typeof value === "string") {
    if (fieldName === "repair_date") {
      return formatDateValue(value);
    }
    if (fieldName === "status" || fieldName === "repair_status") {
      return formatRepairStatus(value);
    }
    if (fieldName === "document_status") {
      return formatDocumentStatusLabel(value);
    }
    if (fieldName === "kind" || fieldName === "document_kind") {
      return formatDocumentKind(value as DocumentKind);
    }
    if (fieldName.endsWith("_at")) {
      return formatDateValue(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return `${value.length}`;
  }
  if (typeof value === "object") {
    if (fieldName === "status" && context === "document") {
      return formatDocumentStatusLabel(String((value as Record<string, unknown>).status || ""));
    }
    return safeJsonStringify(value);
  }
  return String(value);
}

function collectChangedFieldLines(
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  fieldNames: string[],
  context: "repair" | "document" | "generic" = "generic",
) {
  const lines: string[] = [];
  fieldNames.forEach((fieldName) => {
    const previous = oldValue?.[fieldName];
    const next = newValue?.[fieldName];
    if (areHistoryValuesEqual(previous, next)) {
      return;
    }
    lines.push(
      `${formatHistoryFieldLabel(fieldName, context)}: ${formatHistoryScalar(fieldName, previous, context)} -> ${formatHistoryScalar(fieldName, next, context)}`,
    );
  });
  return lines;
}

function summarizeChecks(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }
  const unresolved = value.filter((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }
    return !Boolean((item as Record<string, unknown>).is_resolved);
  }).length;
  return `${unresolved} открыто из ${value.length}`;
}

function buildCollectionCountLine(label: string, previous: unknown, next: unknown) {
  if (!Array.isArray(previous) || !Array.isArray(next)) {
    return null;
  }
  if (previous.length === next.length) {
    return null;
  }
  return `${label}: ${previous.length} -> ${next.length}`;
}

function buildCheckSummaryLine(previous: unknown, next: unknown) {
  const previousSummary = summarizeChecks(previous);
  const nextSummary = summarizeChecks(next);
  if (!previousSummary || !nextSummary || previousSummary === nextSummary) {
    return null;
  }
  return `Открытые проверки: ${previousSummary} -> ${nextSummary}`;
}

function buildHistoryFallbackLine(
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
) {
  if (!oldValue && !newValue) {
    return "Изменение зафиксировано без дополнительных данных.";
  }
  return `Снимок изменения: ${safeJsonStringify({ before: oldValue, after: newValue })}`;
}

function buildRepairHistoryDetails(entry: RepairHistoryEntry) {
  const lines = [
    ...collectChangedFieldLines(
      entry.old_value,
      entry.new_value,
      [
        "order_number",
        "repair_date",
        "mileage",
        "service_name",
        "grand_total",
        "status",
        "repair_status",
        "document_status",
        "review_queue_priority",
        "is_preliminary",
        "is_partially_recognized",
      ],
      "repair",
    ),
  ];

  const worksLine = buildCollectionCountLine("Работы", entry.old_value?.works, entry.new_value?.works);
  if (worksLine) {
    lines.push(worksLine);
  }
  const partsLine = buildCollectionCountLine("Запчасти", entry.old_value?.parts, entry.new_value?.parts);
  if (partsLine) {
    lines.push(partsLine);
  }
  const documentsLine = buildCollectionCountLine("Документы", entry.old_value?.documents, entry.new_value?.documents);
  if (documentsLine) {
    lines.push(documentsLine);
  }
  const checksLine =
    buildCheckSummaryLine(entry.old_value?.checks, entry.new_value?.checks) ||
    buildCheckSummaryLine(entry.old_value?.unresolved_checks, entry.new_value?.unresolved_checks);
  if (checksLine) {
    lines.push(checksLine);
  }

  const sourceDocumentChange = collectChangedFieldLines(
    entry.old_value,
    entry.new_value,
    ["source_document_id"],
    "repair",
  );
  if (sourceDocumentChange.length > 0) {
    lines.push(...sourceDocumentChange);
  }

  const reviewMeta = readComparisonReviewMeta(entry.new_value);
  if (reviewMeta) {
    lines.push(`Результат сверки: ${formatComparisonActionLabel(String(reviewMeta.action || ""))}`);
    if (reviewMeta.comment) {
      lines.push(`Комментарий: ${String(reviewMeta.comment)}`);
    }
    if (reviewMeta.compared_document_id || reviewMeta.with_document_id) {
      lines.push(
        `Документы: ${String(reviewMeta.compared_document_id || "—")} и ${String(reviewMeta.with_document_id || "—")}`,
      );
    }
  }

  if (lines.length === 0) {
    lines.push(buildHistoryFallbackLine(entry.old_value, entry.new_value));
  }
  return lines;
}

function buildDocumentHistoryDetails(entry: RepairDocumentHistoryEntry) {
  const lines = [
    ...collectChangedFieldLines(
      entry.old_value,
      entry.new_value,
      ["status", "document_status", "repair_status", "review_queue_priority", "is_primary", "kind", "notes"],
      "document",
    ),
    ...collectChangedFieldLines(entry.old_value, entry.new_value, ["source_document_id"], "document"),
  ];

  const reviewMeta = readComparisonReviewMeta(entry.new_value);
  if (reviewMeta) {
    lines.push(`Результат сверки: ${formatComparisonActionLabel(String(reviewMeta.action || ""))}`);
    if (reviewMeta.comment) {
      lines.push(`Комментарий: ${String(reviewMeta.comment)}`);
    }
    if (reviewMeta.compared_document_id || reviewMeta.with_document_id) {
      lines.push(
        `Документы: ${String(reviewMeta.compared_document_id || "—")} и ${String(reviewMeta.with_document_id || "—")}`,
      );
    }
  }

  if (lines.length === 0 && entry.new_value) {
    lines.push(buildHistoryFallbackLine(entry.old_value, entry.new_value));
  }
  if (lines.length === 0) {
    lines.push("Событие зафиксировано без дополнительных деталей.");
  }
  return lines;
}

function matchesTextSearch(parts: Array<string | null | undefined>, search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }
  return parts.some((part) => part?.toLowerCase().includes(normalizedSearch));
}

function createRepairDraft(repair: RepairDetail): EditableRepairDraft {
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatConfidence(value: number | null) {
  if (typeof value !== "number") {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
}

function readCheckResolutionMeta(check: RepairDetail["checks"][number]): CheckResolutionMeta | null {
  const resolution = check.calculation_payload?.resolution;
  if (!resolution || typeof resolution !== "object") {
    return null;
  }
  return resolution as CheckResolutionMeta;
}

function readComparisonReviewMeta(value: Record<string, unknown> | null): Record<string, unknown> | null {
  const review = value?.comparison_review;
  if (!review || typeof review !== "object") {
    return null;
  }
  return review as Record<string, unknown>;
}

async function downloadDocumentFile(documentId: number, token: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/documents/${documentId}/download`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail || `Request failed: ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail || `Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY) || "");
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [laborNorms, setLaborNorms] = useState<LaborNormCatalogItem[]>([]);
  const [laborNormTotal, setLaborNormTotal] = useState(0);
  const [laborNormCategories, setLaborNormCategories] = useState<string[]>([]);
  const [laborNormSourceFiles, setLaborNormSourceFiles] = useState<string[]>([]);
  const [laborNormQuery, setLaborNormQuery] = useState("");
  const [laborNormCategory, setLaborNormCategory] = useState("");
  const [laborNormLoading, setLaborNormLoading] = useState(false);
  const [laborNormImportLoading, setLaborNormImportLoading] = useState(false);
  const [laborNormFile, setLaborNormFile] = useState<File | null>(null);
  const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
  const [reviewQueueCounts, setReviewQueueCounts] = useState<Record<ReviewQueueCategory, number>>({
    all: 0,
    suspicious: 0,
    ocr_error: 0,
    partial_recognition: 0,
    employee_confirmation: 0,
    manual_review: 0,
  });
  const [selectedReviewCategory, setSelectedReviewCategory] = useState<ReviewQueueCategory>("all");
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedRepair, setSelectedRepair] = useState<RepairDetail | null>(null);
  const [repairDraft, setRepairDraft] = useState<EditableRepairDraft | null>(null);
  const [isEditingRepair, setIsEditingRepair] = useState(false);
  const [loginValue, setLoginValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [uploadForm, setUploadForm] = useState<UploadFormState>(emptyUploadForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [bootLoading, setBootLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [attachDocumentLoading, setAttachDocumentLoading] = useState(false);
  const [repairLoading, setRepairLoading] = useState(false);
  const [reprocessLoading, setReprocessLoading] = useState(false);
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [checkActionLoadingId, setCheckActionLoadingId] = useState<number | null>(null);
  const [documentOpenLoadingId, setDocumentOpenLoadingId] = useState<number | null>(null);
  const [primaryDocumentLoadingId, setPrimaryDocumentLoadingId] = useState<number | null>(null);
  const [documentComparisonLoadingId, setDocumentComparisonLoadingId] = useState<number | null>(null);
  const [documentComparisonReviewLoading, setDocumentComparisonReviewLoading] = useState(false);
  const [saveRepairLoading, setSaveRepairLoading] = useState(false);
  const [checkComments, setCheckComments] = useState<Record<number, string>>({});
  const [attachedDocumentKind, setAttachedDocumentKind] = useState<DocumentKind>("repeat_scan");
  const [attachedDocumentNotes, setAttachedDocumentNotes] = useState("");
  const [attachedDocumentFile, setAttachedDocumentFile] = useState<File | null>(null);
  const [documentComparison, setDocumentComparison] = useState<DocumentComparisonResponse | null>(null);
  const [documentComparisonComment, setDocumentComparisonComment] = useState("");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historySearch, setHistorySearch] = useState("");
  const [expandedHistoryEntries, setExpandedHistoryEntries] = useState<Record<string, boolean>>({});
  const [reviewActionComment, setReviewActionComment] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedReviewItem =
    reviewQueue.find((item) => item.document.id === selectedDocumentId) ?? null;
  const filteredRepairHistory = selectedRepair
    ? selectedRepair.history.filter((entry) => {
        if (historyFilter === "documents" || historyFilter === "uploads") {
          return false;
        }
        if (historyFilter === "primary" && entry.action_type !== "primary_document_changed") {
          return false;
        }
        if (historyFilter === "comparison" && entry.action_type !== "document_comparison_reviewed") {
          return false;
        }
        return matchesTextSearch(
          [
            entry.user_name,
            entry.action_type,
            JSON.stringify(entry.old_value),
            JSON.stringify(entry.new_value),
          ],
          historySearch,
        );
      })
    : [];
  const filteredDocumentHistory = selectedRepair
    ? selectedRepair.document_history.filter((entry) => {
        if (historyFilter === "repair") {
          return false;
        }
        if (
          historyFilter === "uploads" &&
          entry.action_type !== "document_uploaded" &&
          entry.action_type !== "document_attached"
        ) {
          return false;
        }
        if (
          historyFilter === "primary" &&
          entry.action_type !== "set_primary" &&
          entry.action_type !== "primary_document_changed"
        ) {
          return false;
        }
        if (historyFilter === "comparison" && !entry.action_type.startsWith("comparison_")) {
          return false;
        }
        return matchesTextSearch(
          [
            entry.user_name,
            entry.action_type,
            entry.document_filename,
            entry.document_kind ? formatDocumentKind(entry.document_kind) : null,
            JSON.stringify(entry.old_value),
            JSON.stringify(entry.new_value),
          ],
          historySearch,
        );
      })
    : [];

  function buildLaborNormQueryString(
    query: string = laborNormQuery,
    category: string = laborNormCategory,
  ) {
    const params = new URLSearchParams();
    params.set("limit", "12");
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (category) {
      params.set("category", category);
    }
    return params.toString();
  }

  async function loadLaborNormCatalog(activeToken: string, query: string = laborNormQuery, category: string = laborNormCategory) {
    setLaborNormLoading(true);
    try {
      const payload = await apiRequest<LaborNormCatalogResponse>(
        `/labor-norms?${buildLaborNormQueryString(query, category)}`,
        { method: "GET" },
        activeToken,
      );
      setLaborNorms(payload.items);
      setLaborNormTotal(payload.total);
      setLaborNormCategories(payload.categories);
      setLaborNormSourceFiles(payload.source_files);
    } finally {
      setLaborNormLoading(false);
    }
  }

  async function loadWorkspace(activeToken: string, reviewCategory: ReviewQueueCategory = selectedReviewCategory) {
    setBootLoading(true);
    try {
      const me = await apiRequest<User>("/auth/me", { method: "GET" }, activeToken);
      const [
        dashboard,
        vehicleList,
        recentDocuments,
        reviewQueueData,
        laborNormCatalog,
      ] = await Promise.all([
        apiRequest<DashboardSummary>("/dashboard/summary", { method: "GET" }, activeToken),
        apiRequest<VehiclesResponse>("/vehicles?limit=200", { method: "GET" }, activeToken),
        apiRequest<DocumentsResponse>("/documents?limit=8", { method: "GET" }, activeToken),
        apiRequest<ReviewQueueResponse>(
          `/review/queue?limit=6&category=${reviewCategory}`,
          { method: "GET" },
          activeToken,
        ),
        me.role === "admin"
          ? apiRequest<LaborNormCatalogResponse>(
              `/labor-norms?${buildLaborNormQueryString()}`,
              { method: "GET" },
              activeToken,
            )
          : Promise.resolve(null),
      ]);

      setUser(me);
      setSummary(dashboard);
      setVehicles(vehicleList.items);
      setDocuments(recentDocuments.items);
      setLaborNorms(laborNormCatalog?.items || []);
      setLaborNormTotal(laborNormCatalog?.total || 0);
      setLaborNormCategories(laborNormCatalog?.categories || []);
      setLaborNormSourceFiles(laborNormCatalog?.source_files || []);
      setReviewQueue(reviewQueueData.items);
      setReviewQueueCounts(reviewQueueData.counts);
      if (selectedDocumentId === null) {
        const defaultDocumentId =
          reviewQueueData.items[0]?.document.id ?? recentDocuments.items[0]?.id ?? null;
        if (defaultDocumentId !== null) {
          setSelectedDocumentId(defaultDocumentId);
        }
      }
      setErrorMessage("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load workspace";
      setErrorMessage(message);
      if (message.toLowerCase().includes("validate credentials")) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        setToken("");
        setUser(null);
      }
    } finally {
      setBootLoading(false);
    }
  }

  useEffect(() => {
    if (!token) {
      setUser(null);
      setSummary(null);
      setVehicles([]);
      setDocuments([]);
      setLaborNorms([]);
      setLaborNormTotal(0);
      setLaborNormCategories([]);
      setLaborNormSourceFiles([]);
      setReviewQueue([]);
      setReviewQueueCounts({
        all: 0,
        suspicious: 0,
        ocr_error: 0,
        partial_recognition: 0,
        employee_confirmation: 0,
        manual_review: 0,
      });
      setSelectedDocumentId(null);
      setSelectedRepair(null);
      return;
    }
    void loadWorkspace(token, selectedReviewCategory);
  }, [selectedReviewCategory, token]);

  useEffect(() => {
    if (!token || selectedDocumentId === null) {
      setSelectedRepair(null);
      return;
    }

    const selectedRepairId =
      documents.find((item) => item.id === selectedDocumentId)?.repair.id ??
      reviewQueue.find((item) => item.document.id === selectedDocumentId)?.repair.id;

    if (!selectedRepairId) {
      setSelectedRepair(null);
      return;
    }

    setRepairLoading(true);
    void apiRequest<RepairDetail>(`/repairs/${selectedRepairId}`, { method: "GET" }, token)
      .then((payload) => {
        setSelectedRepair(payload);
        setCheckComments({});
        setDocumentComparison(null);
        setDocumentComparisonComment("");
        setHistoryFilter("all");
        setHistorySearch("");
        setExpandedHistoryEntries({});
        setAttachedDocumentKind("repeat_scan");
        setAttachedDocumentNotes("");
        setAttachedDocumentFile(null);
        if (!isEditingRepair) {
          setRepairDraft(createRepairDraft(payload));
        }
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load repair");
      })
      .finally(() => {
        setRepairLoading(false);
      });
  }, [documents, isEditingRepair, reviewQueue, selectedDocumentId, token]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoginLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const body = new URLSearchParams();
      body.set("username", loginValue);
      body.set("password", passwordValue);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail || "Login failed");
      }

      const payload = (await response.json()) as LoginResponse;
      localStorage.setItem(TOKEN_STORAGE_KEY, payload.access_token);
      setToken(payload.access_token);
      setPasswordValue("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Login failed");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || !selectedFile) {
      setErrorMessage("Select a file before uploading");
      return;
    }

    setUploadLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const body = new FormData();
      body.append("vehicle_id", uploadForm.vehicleId);
      body.append("kind", uploadForm.documentKind);
      body.append("repair_date", uploadForm.repairDate);
      body.append("mileage", uploadForm.mileage);
      body.append("order_number", uploadForm.orderNumber);
      body.append("reason", uploadForm.reason);
      body.append("employee_comment", uploadForm.employeeComment);
      body.append("notes", uploadForm.notes);
      body.append("file", selectedFile);

      const result = await apiRequest<{ message: string }>("/documents/upload", {
        method: "POST",
        body,
      }, token);

      setSuccessMessage(result.message);
      setUploadForm(emptyUploadForm());
      setSelectedFile(null);
      await loadWorkspace(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadLoading(false);
    }
  }

  async function openRepairByIds(documentId: number, repairId: number) {
    setSelectedDocumentId(documentId);
    if (!token) {
      return;
    }
    setRepairLoading(true);
    setErrorMessage("");
    try {
      const payload = await apiRequest<RepairDetail>(`/repairs/${repairId}`, { method: "GET" }, token);
      setSelectedRepair(payload);
      setDocumentComparison(null);
      setDocumentComparisonComment("");
      setHistoryFilter("all");
      setHistorySearch("");
      setExpandedHistoryEntries({});
      setAttachedDocumentKind("repeat_scan");
      setAttachedDocumentNotes("");
      setAttachedDocumentFile(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load repair");
    } finally {
      setRepairLoading(false);
    }
  }

  async function handleOpenRepair(document: DocumentItem) {
    await openRepairByIds(document.id, document.repair.id);
  }

  async function handleOpenReviewQueueItem(item: ReviewQueueItem) {
    await openRepairByIds(item.document.id, item.repair.id);
  }

  async function handleReprocessDocumentById(documentId: number, repairId: number) {
    if (!token) {
      return;
    }
    setReprocessLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<{ message: string }>(
        `/documents/${documentId}/process`,
        { method: "POST" },
        token,
      );
      setSuccessMessage(result.message);
      await loadWorkspace(token);
      await openRepairByIds(documentId, repairId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to reprocess document");
    } finally {
      setReprocessLoading(false);
    }
  }

  async function handleReprocessDocument(document: DocumentItem) {
    await handleReprocessDocumentById(document.id, document.repair.id);
  }

  async function handleOpenDocumentFile(documentId: number) {
    if (!token) {
      return;
    }

    setDocumentOpenLoadingId(documentId);
    setErrorMessage("");
    try {
      const objectUrl = await downloadDocumentFile(documentId, token);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to open document");
    } finally {
      setDocumentOpenLoadingId(null);
    }
  }

  async function handleAttachDocumentToRepair() {
    if (!token || !selectedRepair || !attachedDocumentFile) {
      setErrorMessage("Select a file before uploading");
      return;
    }

    setAttachDocumentLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const body = new FormData();
      body.append("repair_id", String(selectedRepair.id));
      body.append("kind", attachedDocumentKind);
      body.append("notes", attachedDocumentNotes);
      body.append("file", attachedDocumentFile);

      const result = await apiRequest<{ document: { id: number }; message: string }>(
        "/documents/upload-to-repair",
        {
          method: "POST",
          body,
        },
        token,
      );

      setSuccessMessage(result.message);
      setAttachedDocumentNotes("");
      setAttachedDocumentFile(null);
      await loadWorkspace(token);
      await openRepairByIds(result.document.id, selectedRepair.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to upload document to repair");
    } finally {
      setAttachDocumentLoading(false);
    }
  }

  async function handleSetPrimaryDocument(documentId: number) {
    if (!token || !selectedRepair) {
      return;
    }

    setPrimaryDocumentLoadingId(documentId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<{ id: number }>(
        `/documents/${documentId}/set-primary`,
        {
          method: "POST",
        },
        token,
      );
      setSuccessMessage("Основной документ обновлён");
      await loadWorkspace(token);
      await openRepairByIds(result.id, selectedRepair.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to set primary document");
    } finally {
      setPrimaryDocumentLoadingId(null);
    }
  }

  async function handleCompareWithPrimary(documentId: number) {
    if (!token || !selectedRepair) {
      return;
    }

    const primaryDocument = selectedRepair.documents.find((item) => item.is_primary);
    if (!primaryDocument || primaryDocument.id === documentId) {
      return;
    }

    setDocumentComparisonLoadingId(documentId);
    setErrorMessage("");
    try {
      const result = await apiRequest<DocumentComparisonResponse>(
        `/documents/${documentId}/compare?with_document_id=${primaryDocument.id}`,
        {
          method: "GET",
        },
        token,
      );
      setDocumentComparison(result);
      setDocumentComparisonComment("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to compare documents");
    } finally {
      setDocumentComparisonLoadingId(null);
    }
  }

  async function handleReviewDocumentComparison(
    action: "keep_current_primary" | "make_document_primary" | "mark_reviewed",
  ) {
    if (!token || !selectedRepair || !documentComparison) {
      return;
    }

    setDocumentComparisonReviewLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<DocumentComparisonReviewResponse>(
        `/documents/${documentComparison.left_document.id}/compare/review`,
        {
          method: "POST",
          body: JSON.stringify({
            with_document_id: documentComparison.right_document.id,
            action,
            comment: documentComparisonComment.trim() || null,
          }),
        },
        token,
      );
      setSuccessMessage(result.message);
      setDocumentComparison(null);
      setDocumentComparisonComment("");
      await loadWorkspace(token);
      await openRepairByIds(result.document_id, result.repair_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to review document comparison");
    } finally {
      setDocumentComparisonReviewLoading(false);
    }
  }

  async function handleCheckResolution(checkId: number, isResolved: boolean) {
    if (!token || !selectedRepair) {
      return;
    }

    setCheckActionLoadingId(checkId);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const updatedRepair = await apiRequest<RepairDetail>(
        `/repairs/${selectedRepair.id}/checks/${checkId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            is_resolved: isResolved,
            comment: checkComments[checkId]?.trim() || null,
          }),
        },
        token,
      );
      setSelectedRepair(updatedRepair);
      setCheckComments((current) => ({ ...current, [checkId]: "" }));
      setSuccessMessage(isResolved ? "Проверка закрыта" : "Проверка возвращена в работу");
      await loadWorkspace(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update repair check");
    } finally {
      setCheckActionLoadingId(null);
    }
  }

  async function handleReviewAction(action: "confirm" | "send_to_review") {
    if (!token || !selectedReviewItem) {
      return;
    }

    setReviewActionLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const result = await apiRequest<ReviewActionResponse>(
        `/review/queue/${selectedReviewItem.document.id}/action`,
        {
          method: "POST",
          body: JSON.stringify({
            action,
            comment: reviewActionComment.trim() || null,
          }),
        },
        token,
      );
      setSuccessMessage(result.message);
      setReviewActionComment("");
      await loadWorkspace(token);
      await openRepairByIds(result.document_id, result.repair_id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to apply review action");
    } finally {
      setReviewActionLoading(false);
    }
  }

  async function handleLaborNormSearch() {
    if (!token || user?.role !== "admin") {
      return;
    }
    setErrorMessage("");
    try {
      await loadLaborNormCatalog(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load labor norms catalog");
    }
  }

  async function handleLaborNormImport() {
    if (!token || user?.role !== "admin" || !laborNormFile) {
      setErrorMessage("Выберите .xlsx файл справочника");
      return;
    }

    setLaborNormImportLoading(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const body = new FormData();
      body.append("file", laborNormFile);

      const result = await apiRequest<LaborNormImportResponse>(
        "/labor-norms/import",
        {
          method: "POST",
          body,
        },
        token,
      );

      setSuccessMessage(
        `${result.message}. Создано ${result.created}, обновлено ${result.updated}, пропущено ${result.skipped}.`,
      );
      setLaborNormFile(null);
      await loadLaborNormCatalog(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to import labor norms catalog");
    } finally {
      setLaborNormImportLoading(false);
    }
  }

  function handleStartRepairEdit() {
    if (!selectedRepair) {
      return;
    }
    setRepairDraft(createRepairDraft(selectedRepair));
    setIsEditingRepair(true);
  }

  function handleCancelRepairEdit() {
    if (selectedRepair) {
      setRepairDraft(createRepairDraft(selectedRepair));
    } else {
      setRepairDraft(null);
    }
    setIsEditingRepair(false);
  }

  function updateRepairDraftField<K extends keyof EditableRepairDraft>(field: K, value: EditableRepairDraft[K]) {
    setRepairDraft((current) => (current ? { ...current, [field]: value } : current));
  }

  function toggleHistoryEntry(entryKey: string) {
    setExpandedHistoryEntries((current) => ({
      ...current,
      [entryKey]: !current[entryKey],
    }));
  }

  function renderHistoryDetails(entryKey: string, lines: string[]) {
    const text = lines.join("\n");
    const isExpandable = text.length > HISTORY_DETAIL_PREVIEW_LIMIT || lines.length > 3;
    const isExpanded = Boolean(expandedHistoryEntries[entryKey]);
    const visibleText =
      !isExpandable || isExpanded
        ? text
        : `${text.slice(0, HISTORY_DETAIL_PREVIEW_LIMIT).trimEnd()}...`;

    return (
      <Stack spacing={0.5}>
        <Typography className="muted-copy" sx={{ whiteSpace: "pre-line" }}>
          {visibleText}
        </Typography>
        {isExpandable ? (
          <Box>
            <Button
              size="small"
              onClick={() => {
                toggleHistoryEntry(entryKey);
              }}
            >
              {isExpanded ? "Скрыть" : "Подробнее"}
            </Button>
          </Box>
        ) : null}
      </Stack>
    );
  }

  function updateWorkDraft(index: number, field: keyof EditableWorkDraft, value: EditableWorkDraft[keyof EditableWorkDraft]) {
    setRepairDraft((current) => {
      if (!current) {
        return current;
      }
      const works = [...current.works];
      works[index] = { ...works[index], [field]: value };
      return { ...current, works };
    });
  }

  function updatePartDraft(index: number, field: keyof EditablePartDraft, value: EditablePartDraft[keyof EditablePartDraft]) {
    setRepairDraft((current) => {
      if (!current) {
        return current;
      }
      const parts = [...current.parts];
      parts[index] = { ...parts[index], [field]: value };
      return { ...current, parts };
    });
  }

  function addWorkDraft() {
    setRepairDraft((current) =>
      current
        ? {
            ...current,
            works: [
              ...current.works,
              {
                work_code: "",
                work_name: "",
                quantity: 1,
                standard_hours: "",
                actual_hours: "",
                price: 0,
                line_total: 0,
                status: "preliminary",
              },
            ],
          }
        : current,
    );
  }

  function addPartDraft() {
    setRepairDraft((current) =>
      current
        ? {
            ...current,
            parts: [
              ...current.parts,
              {
                article: "",
                part_name: "",
                quantity: 1,
                unit_name: "шт",
                price: 0,
                line_total: 0,
                status: "preliminary",
              },
            ],
          }
        : current,
    );
  }

  function removeWorkDraft(index: number) {
    setRepairDraft((current) =>
      current
        ? { ...current, works: current.works.filter((_, itemIndex) => itemIndex !== index) }
        : current,
    );
  }

  function removePartDraft(index: number) {
    setRepairDraft((current) =>
      current
        ? { ...current, parts: current.parts.filter((_, itemIndex) => itemIndex !== index) }
        : current,
    );
  }

  async function handleSaveRepair() {
    if (!token || !selectedRepair || !repairDraft) {
      return;
    }

    setSaveRepairLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload = {
        order_number: repairDraft.order_number || null,
        repair_date: repairDraft.repair_date,
        mileage: Number(repairDraft.mileage),
        reason: repairDraft.reason || null,
        employee_comment: repairDraft.employee_comment || null,
        service_name: repairDraft.service_name || null,
        work_total: Number(repairDraft.work_total),
        parts_total: Number(repairDraft.parts_total),
        vat_total: Number(repairDraft.vat_total),
        grand_total: Number(repairDraft.grand_total),
        status: repairDraft.status,
        is_preliminary: repairDraft.is_preliminary,
        works: repairDraft.works.map((item) => ({
          work_code: item.work_code || null,
          work_name: item.work_name,
          quantity: Number(item.quantity),
          standard_hours: item.standard_hours === "" ? null : Number(item.standard_hours),
          actual_hours: item.actual_hours === "" ? null : Number(item.actual_hours),
          price: Number(item.price),
          line_total: Number(item.line_total),
          status: item.status,
          reference_payload: { source: "manual_edit" },
        })),
        parts: repairDraft.parts.map((item) => ({
          article: item.article || null,
          part_name: item.part_name,
          quantity: Number(item.quantity),
          unit_name: item.unit_name || null,
          price: Number(item.price),
          line_total: Number(item.line_total),
          status: item.status,
        })),
      };

      const savedRepair = await apiRequest<RepairDetail>(
        `/repairs/${selectedRepair.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        token,
      );

      setSelectedRepair(savedRepair);
      setRepairDraft(createRepairDraft(savedRepair));
      setIsEditingRepair(false);
      setSuccessMessage("Карточка ремонта обновлена");
      await loadWorkspace(token);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save repair");
    } finally {
      setSaveRepairLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken("");
    setSuccessMessage("");
    setErrorMessage("");
  }

  if (!token) {
    return (
      <Box className="app-shell">
        <Container maxWidth="md">
          <Paper className="hero-panel" elevation={0}>
            <Stack spacing={3}>
              <Box>
                <Chip label="Road700" color="primary" />
                <Typography variant="h2" component="h1" className="hero-title">
                  Контроль заказ-нарядов и ремонтов техники
                </Typography>
                <Typography className="hero-copy">
                  Вход в MVP-панель: загрузка PDF и фото, создание черновика ремонта,
                  контроль очереди проверки и история по технике.
                </Typography>
              </Box>

              <Box component="form" onSubmit={handleLogin} className="login-form">
                <Stack spacing={2}>
                  <TextField
                    label="Логин"
                    value={loginValue}
                    onChange={(event) => setLoginValue(event.target.value)}
                    required
                    fullWidth
                  />
                  <TextField
                    label="Пароль"
                    type="password"
                    value={passwordValue}
                    onChange={(event) => setPasswordValue(event.target.value)}
                    required
                    fullWidth
                  />
                  {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
                  <Button type="submit" variant="contained" size="large" disabled={loginLoading}>
                    {loginLoading ? "Вход..." : "Войти в систему"}
                  </Button>
                </Stack>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Card className="feature-card" elevation={0}>
                    <CardContent>
                      <Typography variant="h6">Документы</Typography>
                      <Typography className="muted-copy">
                        Приём PDF, сканов и фото с привязкой к ремонту и технике.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card className="feature-card" elevation={0}>
                    <CardContent>
                      <Typography variant="h6">Контроль</Typography>
                      <Typography className="muted-copy">
                        Очередь проверки, статусы, черновики ремонта и ручная верификация.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Card className="feature-card" elevation={0}>
                    <CardContent>
                      <Typography variant="h6">История</Typography>
                      <Typography className="muted-copy">
                        Вся техника, связи грузовик-прицеп и история документов в одном месте.
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Stack>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box className="app-shell">
      <Container maxWidth="xl">
        <Stack spacing={3}>
          <Paper className="topbar" elevation={0}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
              <Box>
                <Typography variant="overline" className="eyebrow">
                  Road700 workspace
                </Typography>
                <Typography variant="h4" component="h1">
                  Операционная панель заказ-нарядов
                </Typography>
                <Typography className="muted-copy">
                  {user ? `${user.full_name} · ${user.role}` : "Загрузка профиля"}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label={user?.email || "user"} />
                <Button variant="outlined" onClick={handleLogout}>
                  Выйти
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
          {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}

          {bootLoading ? (
            <Paper className="loading-panel" elevation={0}>
              <Stack spacing={2} alignItems="center">
                <CircularProgress />
                <Typography>Обновление данных...</Typography>
              </Stack>
            </Paper>
          ) : null}

          <Grid container spacing={2}>
            {summaryCards.map((card) => (
              <Grid item xs={12} sm={6} lg={3} key={card.key}>
                <Paper className="metric-card" elevation={0}>
                  <Typography className="metric-label">{card.label}</Typography>
                  <Typography variant="h3">
                    {summary ? summary[card.key] : "—"}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} lg={7}>
              <Paper className="workspace-panel" elevation={0}>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="h5">Загрузка заказ-наряда</Typography>
                    <Typography className="muted-copy">
                      После загрузки система создаёт черновик ремонта и ставит документ в очередь OCR.
                    </Typography>
                  </Box>

                  <Box component="form" onSubmit={handleUpload}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          select
                          label="Техника"
                          value={uploadForm.vehicleId}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, vehicleId: event.target.value }))
                          }
                          fullWidth
                          required
                        >
                          {vehicles.map((vehicle) => (
                            <MenuItem key={vehicle.id} value={String(vehicle.id)}>
                              {formatVehicle(vehicle)}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          select
                          label="Вид документа"
                          value={uploadForm.documentKind}
                          onChange={(event) =>
                            setUploadForm((current) => ({
                              ...current,
                              documentKind: event.target.value as DocumentKind,
                            }))
                          }
                          fullWidth
                          required
                        >
                          {rootDocumentKindOptions.map((option) => (
                            <MenuItem key={option.value} value={option.value}>
                              {option.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          label="Дата ремонта"
                          type="date"
                          value={uploadForm.repairDate}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, repairDate: event.target.value }))
                          }
                          InputLabelProps={{ shrink: true }}
                          fullWidth
                          required
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          label="Пробег"
                          type="number"
                          value={uploadForm.mileage}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, mileage: event.target.value }))
                          }
                          fullWidth
                          required
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Номер заказ-наряда"
                          value={uploadForm.orderNumber}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, orderNumber: event.target.value }))
                          }
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          label="Причина ремонта"
                          value={uploadForm.reason}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, reason: event.target.value }))
                          }
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label="Комментарий сотрудника"
                          value={uploadForm.employeeComment}
                          onChange={(event) =>
                            setUploadForm((current) => ({
                              ...current,
                              employeeComment: event.target.value,
                            }))
                          }
                          fullWidth
                          multiline
                          minRows={2}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          label="Примечание к документу"
                          value={uploadForm.notes}
                          onChange={(event) =>
                            setUploadForm((current) => ({ ...current, notes: event.target.value }))
                          }
                          fullWidth
                          multiline
                          minRows={2}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <Paper className="file-drop" elevation={0}>
                          <Stack
                            direction={{ xs: "column", md: "row" }}
                            spacing={2}
                            justifyContent="space-between"
                            alignItems={{ xs: "flex-start", md: "center" }}
                          >
                            <Box>
                              <Typography variant="subtitle1">Файл документа</Typography>
                              <Typography className="muted-copy">
                                Поддерживаются PDF и изображения. Для PDF с текстовым слоем OCR срабатывает автоматически, для фото и сканов используется локальное распознавание.
                              </Typography>
                            </Box>
                            <Button component="label" variant="outlined">
                              Выбрать файл
                              <input
                                hidden
                                type="file"
                                accept=".pdf,image/*"
                                onChange={(event) =>
                                  setSelectedFile(event.target.files?.[0] ?? null)
                                }
                              />
                            </Button>
                          </Stack>
                          <Typography className="selected-file">
                            {selectedFile ? selectedFile.name : "Файл ещё не выбран"}
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12}>
                        <Button
                          type="submit"
                          variant="contained"
                          size="large"
                          disabled={uploadLoading || !selectedFile || !uploadForm.vehicleId}
                        >
                          {uploadLoading ? "Загрузка..." : "Создать черновик ремонта"}
                        </Button>
                      </Grid>
                    </Grid>
                  </Box>
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12} lg={5}>
              <Stack spacing={3}>
                <Paper className="workspace-panel" elevation={0}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h5">Очередь проверки</Typography>
                      <Typography className="muted-copy">
                        Сначала показываются подозрительные и проблемные заказ-наряды по доступной технике.
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {reviewQueueFilters.map((filter) => (
                        <Chip
                          key={filter.key}
                          label={`${filter.label} · ${reviewQueueCounts[filter.key] || 0}`}
                          color={selectedReviewCategory === filter.key ? "primary" : "default"}
                          variant={selectedReviewCategory === filter.key ? "filled" : "outlined"}
                          onClick={() => {
                            setSelectedReviewCategory(filter.key);
                          }}
                        />
                      ))}
                    </Stack>
                    <Typography className="muted-copy">
                      Показано {reviewQueue.length} из {reviewQueueCounts[selectedReviewCategory] || 0} по выбранному фильтру.
                    </Typography>
                    <Stack spacing={1.5}>
                      {reviewQueue.map((item) => (
                        <Paper className="document-row" key={`review-${item.document.id}`} elevation={0}>
                          <Stack spacing={1.25}>
                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                              <Typography variant="subtitle1">{item.document.original_filename}</Typography>
                              <Stack direction="row" spacing={1}>
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={formatDocumentKind(item.document.kind)}
                                />
                                <Chip
                                  size="small"
                                  color={reviewPriorityColor(item.priority_bucket)}
                                  label={formatReviewPriority(item.priority_bucket)}
                                />
                                <Chip
                                  size="small"
                                  color={statusColor(item.document.status)}
                                  label={formatStatus(item.document.status)}
                                />
                              </Stack>
                            </Stack>
                            <Typography className="muted-copy">{formatVehicle(item.vehicle)}</Typography>
                            <Typography className="muted-copy">
                              Ремонт #{item.repair.id}
                              {item.repair.order_number ? ` · ${item.repair.order_number}` : ""}
                              {" · "}
                              {item.repair.repair_date}
                              {" · "}
                              пробег {item.repair.mileage}
                            </Typography>
                            <Typography className="muted-copy">
                              Приоритет {item.priority_score} · OCR {formatConfidence(item.document.ocr_confidence)} · нерешённых проверок {item.repair.unresolved_checks_total}
                            </Typography>
                            {item.extracted_order_number ? (
                              <Typography className="muted-copy">
                                OCR: заказ-наряд {item.extracted_order_number}
                                {item.extracted_grand_total !== null
                                  ? ` · итог ${formatMoney(item.extracted_grand_total)}`
                                  : ""}
                              </Typography>
                            ) : null}
                            {item.issue_titles.length > 0 ? (
                              <Typography className="muted-copy">
                                Требует внимания: {item.issue_titles.slice(0, 3).join(", ")}
                                {item.issue_titles.length > 3 ? ` и ещё ${item.issue_titles.length - 3}` : ""}
                              </Typography>
                            ) : null}
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  void handleOpenReviewQueueItem(item);
                                }}
                              >
                                Открыть ремонт
                              </Button>
                              {user?.role === "admin" ? (
                                <Button
                                  size="small"
                                  variant="text"
                                  disabled={reprocessLoading}
                                  onClick={() => {
                                    void handleReprocessDocumentById(item.document.id, item.repair.id);
                                  }}
                                >
                                  {reprocessLoading && selectedDocumentId === item.document.id ? "Повтор..." : "Повторить OCR"}
                                </Button>
                              ) : null}
                            </Stack>
                          </Stack>
                        </Paper>
                      ))}
                      {reviewQueue.length === 0 ? (
                        <Typography className="muted-copy">
                          По выбранному фильтру элементов нет.
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>
                </Paper>

                <Paper className="workspace-panel" elevation={0}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h5">Последние документы</Typography>
                      <Typography className="muted-copy">
                        Последние загруженные заказ-наряды и сканы по доступной технике.
                      </Typography>
                    </Box>
                    <Stack spacing={1.5}>
                      {documents.map((document) => (
                        <Paper
                          className={`document-row${selectedDocumentId === document.id ? " document-row-active" : ""}`}
                          key={document.id}
                          elevation={0}
                        >
                          <Stack spacing={1.25}>
                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                              <Typography variant="subtitle1">{document.original_filename}</Typography>
                              <Stack direction="row" spacing={1}>
                                <Chip size="small" variant="outlined" label={formatDocumentKind(document.kind)} />
                                <Chip
                                  size="small"
                                  color={statusColor(document.status)}
                                  label={formatStatus(document.status)}
                                />
                              </Stack>
                            </Stack>
                            <Typography className="muted-copy">
                              {formatVehicle(document.vehicle)}
                            </Typography>
                            <Typography className="muted-copy">
                              Ремонт #{document.repair.id} · {document.repair.repair_date} · пробег {document.repair.mileage}
                            </Typography>
                            {document.parsed_payload?.extracted_fields?.order_number ? (
                              <Typography className="muted-copy">
                                OCR: заказ-наряд {document.parsed_payload.extracted_fields.order_number}
                              </Typography>
                            ) : null}
                            {document.parsed_payload?.extracted_fields?.grand_total ? (
                              <Typography className="muted-copy">
                                OCR: итог {formatMoney(document.parsed_payload.extracted_fields.grand_total)}
                              </Typography>
                            ) : null}
                            {document.parsed_payload?.extracted_items ? (
                              <Typography className="muted-copy">
                                OCR: работ {document.parsed_payload.extracted_items.works?.length || 0}, запчастей {document.parsed_payload.extracted_items.parts?.length || 0}
                              </Typography>
                            ) : null}
                            {document.parsed_payload?.manual_review_reasons?.length ? (
                              <Typography className="muted-copy">
                                Проверить вручную: {document.parsed_payload.manual_review_reasons.join(", ")}
                              </Typography>
                            ) : null}
                            {formatLaborNormApplicability(document.parsed_payload ?? null) ? (
                              <Typography className="muted-copy">
                                {formatLaborNormApplicability(document.parsed_payload ?? null)}
                              </Typography>
                            ) : null}
                            {document.notes ? (
                              <Typography className="muted-copy">{document.notes}</Typography>
                            ) : null}
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => {
                                  void handleOpenRepair(document);
                                }}
                              >
                                Открыть ремонт
                              </Button>
                              {user?.role === "admin" ? (
                                <Button
                                  size="small"
                                  variant="text"
                                  disabled={reprocessLoading}
                                  onClick={() => {
                                    void handleReprocessDocument(document);
                                  }}
                                >
                                  {reprocessLoading && selectedDocumentId === document.id ? "Повтор..." : "Повторить OCR"}
                                </Button>
                              ) : null}
                            </Stack>
                          </Stack>
                        </Paper>
                      ))}
                      {documents.length === 0 ? (
                        <Typography className="muted-copy">
                          Документы ещё не загружались.
                        </Typography>
                      ) : null}
                    </Stack>
                  </Stack>
                </Paper>

                {user?.role === "admin" ? (
                  <Paper className="workspace-panel" elevation={0}>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="h5">Справочник нормо-часов</Typography>
                        <Typography className="muted-copy">
                          Каталог нормативных работ, импортируемый через админку и используемый для автоматического матчинга.
                        </Typography>
                      </Box>
                      <Grid container spacing={1.5}>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            label="Поиск по коду или названию"
                            value={laborNormQuery}
                            onChange={(event) => setLaborNormQuery(event.target.value)}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            select
                            label="Категория"
                            value={laborNormCategory}
                            onChange={(event) => setLaborNormCategory(event.target.value)}
                            fullWidth
                          >
                            <MenuItem value="">Все категории</MenuItem>
                            {laborNormCategories.map((category) => (
                              <MenuItem key={category} value={category}>
                                {category}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                      </Grid>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button variant="outlined" onClick={() => void handleLaborNormSearch()} disabled={laborNormLoading}>
                          {laborNormLoading ? "Загрузка..." : "Обновить список"}
                        </Button>
                        <Button
                          variant="text"
                          onClick={() => {
                            setLaborNormQuery("");
                            setLaborNormCategory("");
                            if (token) {
                              void loadLaborNormCatalog(token, "", "");
                            }
                          }}
                          disabled={laborNormLoading}
                        >
                          Сбросить фильтр
                        </Button>
                      </Stack>
                      <Paper className="repair-line" elevation={0}>
                        <Stack spacing={1.25}>
                          <Typography className="metric-label">
                            Импорт / обновление каталога
                          </Typography>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                            <Button component="label" variant="outlined">
                              Выбрать .xlsx
                              <input
                                hidden
                                type="file"
                                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                onChange={(event) => setLaborNormFile(event.target.files?.[0] ?? null)}
                              />
                            </Button>
                            <Typography className="muted-copy">
                              {laborNormFile ? laborNormFile.name : "Файл не выбран"}
                            </Typography>
                          </Stack>
                          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                            <Button
                              variant="contained"
                              disabled={laborNormImportLoading || !laborNormFile}
                              onClick={() => {
                                void handleLaborNormImport();
                              }}
                            >
                              {laborNormImportLoading ? "Импорт..." : "Импортировать справочник"}
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                      <Typography className="muted-copy">
                        В каталоге {laborNormTotal} записей
                        {laborNormSourceFiles.length > 0 ? ` · источники: ${laborNormSourceFiles.join(", ")}` : ""}
                      </Typography>
                      {laborNormLoading ? (
                        <Stack spacing={1} alignItems="center">
                          <CircularProgress size={24} />
                          <Typography className="muted-copy">Загрузка каталога...</Typography>
                        </Stack>
                      ) : laborNorms.length > 0 ? (
                        <Stack spacing={1}>
                          {laborNorms.map((item) => (
                            <Paper className="repair-line" key={item.id} elevation={0}>
                              <Stack spacing={0.5}>
                                <Stack direction="row" justifyContent="space-between" spacing={1}>
                                  <Typography>{item.code} · {item.name_ru}</Typography>
                                  <Typography>{formatHours(item.standard_hours) || "—"}</Typography>
                                </Stack>
                                <Typography className="muted-copy">
                                  {item.category || "Без категории"}
                                  {item.name_ru_alt ? ` · alt: ${item.name_ru_alt}` : ""}
                                </Typography>
                                <Typography className="muted-copy">
                                  Источник: {item.source_file || "—"}
                                  {item.source_sheet ? ` · лист ${item.source_sheet}` : ""}
                                </Typography>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      ) : (
                        <Typography className="muted-copy">По текущему фильтру записи не найдены.</Typography>
                      )}
                    </Stack>
                  </Paper>
                ) : null}

                <Paper className="workspace-panel" elevation={0}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h5">Карточка ремонта</Typography>
                      <Typography className="muted-copy">
                        Состав работ, материалов и проверки по выбранному документу.
                      </Typography>
                    </Box>
                    {repairLoading ? (
                      <Stack spacing={2} alignItems="center" className="repair-placeholder">
                        <CircularProgress size={28} />
                        <Typography className="muted-copy">Загрузка карточки ремонта...</Typography>
                      </Stack>
                    ) : selectedRepair ? (
                      <Stack spacing={2}>
                        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip size="small" label={formatStatus(selectedRepair.status)} />
                            {selectedReviewItem ? (
                              <Chip
                                size="small"
                                color={reviewPriorityColor(selectedReviewItem.priority_bucket)}
                                label={formatReviewPriority(selectedReviewItem.priority_bucket)}
                              />
                            ) : null}
                          </Stack>
                          {user?.role === "admin" ? (
                            <Stack direction="row" spacing={1}>
                              {isEditingRepair ? (
                                <>
                                  <Button variant="outlined" onClick={handleCancelRepairEdit} disabled={saveRepairLoading}>
                                    Отмена
                                  </Button>
                                  <Button variant="contained" onClick={() => void handleSaveRepair()} disabled={saveRepairLoading || !repairDraft}>
                                    {saveRepairLoading ? "Сохранение..." : "Сохранить"}
                                  </Button>
                                </>
                              ) : (
                                <Button variant="outlined" onClick={handleStartRepairEdit}>
                                  Редактировать
                                </Button>
                              )}
                            </Stack>
                          ) : null}
                        </Stack>

                        {selectedReviewItem && !isEditingRepair ? (
                          <Paper className="repair-summary" elevation={0}>
                            <Stack spacing={1.5}>
                              <Box>
                                <Typography variant="h6">Решение по проверке</Typography>
                                <Typography className="muted-copy">
                                  Финальное подтверждение снимает карточку с очереди и закрывает активные проверки.
                                </Typography>
                              </Box>
                              <Typography className="muted-copy">
                                Текущие причины: {selectedReviewItem.issue_titles.slice(0, 4).join(", ")}
                                {selectedReviewItem.issue_titles.length > 4
                                  ? ` и ещё ${selectedReviewItem.issue_titles.length - 4}`
                                  : ""}
                              </Typography>
                              <TextField
                                label="Комментарий администратора"
                                value={reviewActionComment}
                                onChange={(event) => setReviewActionComment(event.target.value)}
                                fullWidth
                                multiline
                                minRows={2}
                              />
                              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                <Button
                                  variant="contained"
                                  disabled={reviewActionLoading}
                                  onClick={() => {
                                    void handleReviewAction("confirm");
                                  }}
                                >
                                  {reviewActionLoading ? "Сохранение..." : "Подтвердить админом"}
                                </Button>
                                <Button
                                  variant="outlined"
                                  disabled={reviewActionLoading}
                                  onClick={() => {
                                    void handleReviewAction("send_to_review");
                                  }}
                                >
                                  Вернуть в ручную проверку
                                </Button>
                              </Stack>
                            </Stack>
                          </Paper>
                        ) : null}

                        {isEditingRepair && repairDraft ? (
                          <Stack spacing={2}>
                            <Paper className="repair-summary" elevation={0}>
                              <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    label="Заказ-наряд"
                                    value={repairDraft.order_number}
                                    onChange={(event) => updateRepairDraftField("order_number", event.target.value)}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    label="Сервис"
                                    value={repairDraft.service_name}
                                    onChange={(event) => updateRepairDraftField("service_name", event.target.value)}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    type="date"
                                    label="Дата ремонта"
                                    value={repairDraft.repair_date}
                                    onChange={(event) => updateRepairDraftField("repair_date", event.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <TextField
                                    type="number"
                                    label="Пробег"
                                    value={repairDraft.mileage}
                                    onChange={(event) => updateRepairDraftField("mileage", Number(event.target.value))}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  <TextField
                                    type="number"
                                    label="Работы"
                                    value={repairDraft.work_total}
                                    onChange={(event) => updateRepairDraftField("work_total", Number(event.target.value))}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  <TextField
                                    type="number"
                                    label="Запчасти"
                                    value={repairDraft.parts_total}
                                    onChange={(event) => updateRepairDraftField("parts_total", Number(event.target.value))}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  <TextField
                                    type="number"
                                    label="НДС"
                                    value={repairDraft.vat_total}
                                    onChange={(event) => updateRepairDraftField("vat_total", Number(event.target.value))}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid item xs={6}>
                                  <TextField
                                    type="number"
                                    label="Итого"
                                    value={repairDraft.grand_total}
                                    onChange={(event) => updateRepairDraftField("grand_total", Number(event.target.value))}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid item xs={12}>
                                  <TextField
                                    label="Причина ремонта"
                                    value={repairDraft.reason}
                                    onChange={(event) => updateRepairDraftField("reason", event.target.value)}
                                    fullWidth
                                    multiline
                                    minRows={2}
                                  />
                                </Grid>
                                <Grid item xs={12}>
                                  <TextField
                                    label="Комментарий сотрудника"
                                    value={repairDraft.employee_comment}
                                    onChange={(event) => updateRepairDraftField("employee_comment", event.target.value)}
                                    fullWidth
                                    multiline
                                    minRows={2}
                                  />
                                </Grid>
                              </Grid>
                            </Paper>

                            <Stack spacing={1}>
                              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                <Typography variant="h6">Работы</Typography>
                                <Button size="small" variant="text" onClick={addWorkDraft}>Добавить работу</Button>
                              </Stack>
                              {repairDraft.works.map((item, index) => (
                                <Paper className="repair-line" key={`work-${index}`} elevation={0}>
                                  <Grid container spacing={1.5}>
                                    <Grid item xs={12}>
                                      <TextField
                                        label="Наименование работы"
                                        value={item.work_name}
                                        onChange={(event) => updateWorkDraft(index, "work_name", event.target.value)}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        label="Код"
                                        value={item.work_code}
                                        onChange={(event) => updateWorkDraft(index, "work_code", event.target.value)}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        type="number"
                                        label="Кол-во"
                                        value={item.quantity}
                                        onChange={(event) => updateWorkDraft(index, "quantity", Number(event.target.value))}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        type="number"
                                        label="Нормо-часы"
                                        value={item.standard_hours}
                                        onChange={(event) => updateWorkDraft(index, "standard_hours", event.target.value === "" ? "" : Number(event.target.value))}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        type="number"
                                        label="Факт-часы"
                                        value={item.actual_hours}
                                        onChange={(event) => updateWorkDraft(index, "actual_hours", event.target.value === "" ? "" : Number(event.target.value))}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        type="number"
                                        label="Цена"
                                        value={item.price}
                                        onChange={(event) => updateWorkDraft(index, "price", Number(event.target.value))}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        type="number"
                                        label="Сумма"
                                        value={item.line_total}
                                        onChange={(event) => updateWorkDraft(index, "line_total", Number(event.target.value))}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={12}>
                                      <Button size="small" color="error" onClick={() => removeWorkDraft(index)}>
                                        Удалить работу
                                      </Button>
                                    </Grid>
                                  </Grid>
                                </Paper>
                              ))}
                            </Stack>

                            <Stack spacing={1}>
                              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                <Typography variant="h6">Запчасти</Typography>
                                <Button size="small" variant="text" onClick={addPartDraft}>Добавить запчасть</Button>
                              </Stack>
                              {repairDraft.parts.map((item, index) => (
                                <Paper className="repair-line" key={`part-${index}`} elevation={0}>
                                  <Grid container spacing={1.5}>
                                    <Grid item xs={12}>
                                      <TextField
                                        label="Наименование запчасти"
                                        value={item.part_name}
                                        onChange={(event) => updatePartDraft(index, "part_name", event.target.value)}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        label="Артикул"
                                        value={item.article}
                                        onChange={(event) => updatePartDraft(index, "article", event.target.value)}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        label="Ед. изм."
                                        value={item.unit_name}
                                        onChange={(event) => updatePartDraft(index, "unit_name", event.target.value)}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={4}>
                                      <TextField
                                        type="number"
                                        label="Кол-во"
                                        value={item.quantity}
                                        onChange={(event) => updatePartDraft(index, "quantity", Number(event.target.value))}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={4}>
                                      <TextField
                                        type="number"
                                        label="Цена"
                                        value={item.price}
                                        onChange={(event) => updatePartDraft(index, "price", Number(event.target.value))}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={4}>
                                      <TextField
                                        type="number"
                                        label="Сумма"
                                        value={item.line_total}
                                        onChange={(event) => updatePartDraft(index, "line_total", Number(event.target.value))}
                                        fullWidth
                                      />
                                    </Grid>
                                    <Grid item xs={12}>
                                      <Button size="small" color="error" onClick={() => removePartDraft(index)}>
                                        Удалить запчасть
                                      </Button>
                                    </Grid>
                                  </Grid>
                                </Paper>
                              ))}
                            </Stack>
                          </Stack>
                        ) : (
                          <>
                            <Paper className="repair-summary" elevation={0}>
                              <Grid container spacing={2}>
                                <Grid item xs={12} sm={6}>
                                  <Typography className="metric-label">Заказ-наряд</Typography>
                                  <Typography>{selectedRepair.order_number || "Не указан"}</Typography>
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                  <Typography className="metric-label">Техника</Typography>
                                  <Typography>{formatVehicle(selectedRepair.vehicle)}</Typography>
                                </Grid>
                                <Grid item xs={6}>
                                  <Typography className="metric-label">Работы</Typography>
                                  <Typography>{formatMoney(selectedRepair.work_total) || "—"}</Typography>
                                </Grid>
                                <Grid item xs={6}>
                                  <Typography className="metric-label">Запчасти</Typography>
                                  <Typography>{formatMoney(selectedRepair.parts_total) || "—"}</Typography>
                                </Grid>
                                <Grid item xs={6}>
                                  <Typography className="metric-label">НДС</Typography>
                                  <Typography>{formatMoney(selectedRepair.vat_total) || "—"}</Typography>
                                </Grid>
                                <Grid item xs={6}>
                                  <Typography className="metric-label">Итого</Typography>
                                  <Typography>{formatMoney(selectedRepair.grand_total) || "—"}</Typography>
                                </Grid>
                              </Grid>
                            </Paper>

                            <Stack spacing={1}>
                              <Typography variant="h6">Документы ремонта</Typography>
                              <Paper className="repair-line" elevation={0}>
                                <Stack spacing={1.5}>
                                  <Typography className="muted-copy">
                                    Добавьте повторный скан, корректирующий файл или дополнительный документ в текущий ремонт.
                                  </Typography>
                                  <TextField
                                    select
                                    label="Вид документа"
                                    value={attachedDocumentKind}
                                    onChange={(event) =>
                                      setAttachedDocumentKind(event.target.value as DocumentKind)
                                    }
                                    fullWidth
                                  >
                                    {documentKindOptions.map((option) => (
                                      <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                      </MenuItem>
                                    ))}
                                  </TextField>
                                  <TextField
                                    label="Примечание к новому документу"
                                    value={attachedDocumentNotes}
                                    onChange={(event) => setAttachedDocumentNotes(event.target.value)}
                                    fullWidth
                                    multiline
                                    minRows={2}
                                  />
                                  <Stack
                                    direction={{ xs: "column", sm: "row" }}
                                    spacing={1}
                                    justifyContent="space-between"
                                    alignItems={{ xs: "flex-start", sm: "center" }}
                                  >
                                    <Button component="label" variant="outlined">
                                      Выбрать файл
                                      <input
                                        hidden
                                        type="file"
                                        accept=".pdf,image/*"
                                        onChange={(event) =>
                                          setAttachedDocumentFile(event.target.files?.[0] ?? null)
                                        }
                                      />
                                    </Button>
                                    <Typography className="muted-copy">
                                      {attachedDocumentFile ? attachedDocumentFile.name : "Файл не выбран"}
                                    </Typography>
                                  </Stack>
                                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                    <Button
                                      variant="contained"
                                      disabled={attachDocumentLoading || !attachedDocumentFile}
                                      onClick={() => {
                                        void handleAttachDocumentToRepair();
                                      }}
                                    >
                                      {attachDocumentLoading ? "Загрузка..." : "Добавить документ"}
                                    </Button>
                                  </Stack>
                                </Stack>
                              </Paper>
                              {selectedRepair.documents.length > 0 ? (
                                selectedRepair.documents.map((document) => (
                                  <Paper className="repair-line" key={document.id} elevation={0}>
                                    <Stack spacing={1}>
                                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                        <Typography>{document.original_filename}</Typography>
                                        <Stack direction="row" spacing={1}>
                                          {document.is_primary ? <Chip size="small" label="основной" /> : null}
                                          <Chip size="small" variant="outlined" label={formatDocumentKind(document.kind)} />
                                          <Chip
                                            size="small"
                                            color={statusColor(document.status as DocumentStatus)}
                                            label={formatStatus(document.status)}
                                          />
                                        </Stack>
                                      </Stack>
                                      <Typography className="muted-copy">
                                        {formatDateTime(document.created_at)} · {document.source_type.toUpperCase()} · OCR {formatConfidence(document.ocr_confidence)}
                                      </Typography>
                                      {document.notes ? (
                                        <Typography className="muted-copy">{document.notes}</Typography>
                                      ) : null}
                                      <Stack direction="row" spacing={1} flexWrap="wrap">
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          disabled={documentOpenLoadingId === document.id}
                                          onClick={() => {
                                            void handleOpenDocumentFile(document.id);
                                          }}
                                        >
                                          {documentOpenLoadingId === document.id ? "Открытие..." : "Открыть файл"}
                                        </Button>
                                        {user?.role === "admin" ? (
                                          <Button
                                            size="small"
                                            variant="text"
                                            disabled={reprocessLoading}
                                            onClick={() => {
                                              void handleReprocessDocumentById(document.id, selectedRepair.id);
                                            }}
                                          >
                                            {reprocessLoading && selectedDocumentId === document.id ? "Повтор..." : "Повторить OCR"}
                                          </Button>
                                        ) : null}
                                        {user?.role === "admin" &&
                                        (document.kind === "order" || document.kind === "repeat_scan") &&
                                        !document.is_primary ? (
                                          <>
                                            <Button
                                              size="small"
                                              variant="text"
                                              disabled={documentComparisonLoadingId === document.id}
                                              onClick={() => {
                                                void handleCompareWithPrimary(document.id);
                                              }}
                                            >
                                              {documentComparisonLoadingId === document.id ? "Сравнение..." : "Сравнить с основным"}
                                            </Button>
                                            <Button
                                              size="small"
                                              variant="text"
                                              disabled={primaryDocumentLoadingId === document.id}
                                              onClick={() => {
                                                void handleSetPrimaryDocument(document.id);
                                              }}
                                            >
                                              {primaryDocumentLoadingId === document.id ? "Смена..." : "Сделать основным"}
                                            </Button>
                                          </>
                                        ) : null}
                                      </Stack>
                                      <Stack spacing={1}>
                                        <Typography className="metric-label">
                                          Версии обработки: {document.versions.length}
                                        </Typography>
                                        {document.versions.map((version) => (
                                          <Box key={version.id}>
                                            <Typography className="muted-copy">
                                              v{version.version_number} · {formatDateTime(version.created_at)}
                                              {version.change_summary ? ` · ${version.change_summary}` : ""}
                                            </Typography>
                                            {version.parsed_payload?.processor ? (
                                              <Typography className="muted-copy">
                                                Процессор: {String(version.parsed_payload.processor)}
                                              </Typography>
                                            ) : null}
                                            {version.parsed_payload?.manual_review_reasons &&
                                            Array.isArray(version.parsed_payload.manual_review_reasons) &&
                                            version.parsed_payload.manual_review_reasons.length > 0 ? (
                                              <Typography className="muted-copy">
                                                Ручная проверка: {version.parsed_payload.manual_review_reasons.join(", ")}
                                              </Typography>
                                            ) : null}
                                            {formatLaborNormApplicability(version.parsed_payload) ? (
                                              <Typography className="muted-copy">
                                                {formatLaborNormApplicability(version.parsed_payload)}
                                              </Typography>
                                            ) : null}
                                          </Box>
                                        ))}
                                      </Stack>
                                    </Stack>
                                  </Paper>
                                ))
                              ) : (
                                <Typography className="muted-copy">Документы к ремонту пока не привязаны.</Typography>
                              )}
                            </Stack>

                            {documentComparison ? (
                              <Stack spacing={1}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                  <Typography variant="h6">Сравнение документов</Typography>
                                  <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => {
                                      setDocumentComparison(null);
                                    }}
                                  >
                                    Закрыть
                                  </Button>
                                </Stack>
                                <Paper className="repair-line" elevation={0}>
                                  <Stack spacing={1.25}>
                                    <Typography>
                                      {documentComparison.left_document.original_filename} против {documentComparison.right_document.original_filename}
                                    </Typography>
                                    <Typography className="muted-copy">
                                      Работы: {documentComparison.works_count_left} / {documentComparison.works_count_right}
                                      {" · "}
                                      Запчасти: {documentComparison.parts_count_left} / {documentComparison.parts_count_right}
                                    </Typography>
                                    {documentComparison.compared_fields.map((field) => (
                                      <Box key={field.field_name}>
                                        <Typography className="metric-label">{field.label}</Typography>
                                        <Typography className="muted-copy">
                                          {field.left_value || "—"} / {field.right_value || "—"}
                                          {field.is_different ? " · отличается" : " · совпадает"}
                                        </Typography>
                                      </Box>
                                    ))}
                                    <TextField
                                      label="Комментарий по сверке"
                                      value={documentComparisonComment}
                                      onChange={(event) => setDocumentComparisonComment(event.target.value)}
                                      fullWidth
                                      multiline
                                      minRows={2}
                                    />
                                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                      <Button
                                        variant="outlined"
                                        disabled={documentComparisonReviewLoading}
                                        onClick={() => {
                                          void handleReviewDocumentComparison("keep_current_primary");
                                        }}
                                      >
                                        {documentComparisonReviewLoading ? "Сохранение..." : "Оставить текущий основной"}
                                      </Button>
                                      <Button
                                        variant="contained"
                                        disabled={documentComparisonReviewLoading}
                                        onClick={() => {
                                          void handleReviewDocumentComparison("make_document_primary");
                                        }}
                                      >
                                        Сделать сравниваемый основным
                                      </Button>
                                      <Button
                                        variant="text"
                                        disabled={documentComparisonReviewLoading}
                                        onClick={() => {
                                          void handleReviewDocumentComparison("mark_reviewed");
                                        }}
                                      >
                                        Отметить как проверенное
                                      </Button>
                                    </Stack>
                                  </Stack>
                                </Paper>
                              </Stack>
                            ) : null}

                            <Stack spacing={1}>
                              <Typography variant="h6">Работы</Typography>
                              {selectedRepair.works.length > 0 ? (
                                selectedRepair.works.map((item) => (
                                  <Paper className="repair-line" key={item.id} elevation={0}>
                                    <Stack spacing={0.75}>
                                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                                        <Box>
                                          <Typography>{item.work_name}</Typography>
                                          <Typography className="muted-copy">
                                            {item.work_code ? `${item.work_code} · ` : ""}
                                            Кол-во {item.quantity}
                                            {formatHours(item.standard_hours) ? ` · норма ${formatHours(item.standard_hours)}` : ""}
                                            {formatHours(item.actual_hours) ? ` · факт ${formatHours(item.actual_hours)}` : ""}
                                          </Typography>
                                        </Box>
                                        <Typography>{formatMoney(item.line_total) || "—"}</Typography>
                                      </Stack>
                                      {formatWorkLaborNormMeta(item) ? (
                                        <Typography className="muted-copy">
                                          {formatWorkLaborNormMeta(item)}
                                        </Typography>
                                      ) : null}
                                    </Stack>
                                  </Paper>
                                ))
                              ) : (
                                <Typography className="muted-copy">Строки работ не распознаны.</Typography>
                              )}
                            </Stack>

                            <Stack spacing={1}>
                              <Typography variant="h6">Запчасти</Typography>
                              {selectedRepair.parts.length > 0 ? (
                                selectedRepair.parts.map((item) => (
                                  <Paper className="repair-line" key={item.id} elevation={0}>
                                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                                      <Box>
                                        <Typography>{item.part_name}</Typography>
                                        <Typography className="muted-copy">
                                          {item.article ? `${item.article} · ` : ""}
                                          {item.quantity} {item.unit_name || "шт"}
                                        </Typography>
                                      </Box>
                                      <Typography>{formatMoney(item.line_total) || "—"}</Typography>
                                    </Stack>
                                  </Paper>
                                ))
                              ) : (
                                <Typography className="muted-copy">Строки запчастей не распознаны.</Typography>
                              )}
                            </Stack>

                            <Stack spacing={1}>
                              <Typography variant="h6">Проверки</Typography>
                              {selectedRepair.checks.length > 0 ? (
                                selectedRepair.checks.map((check) => (
                                  <Paper className="repair-line" key={check.id} elevation={0}>
                                    <Stack spacing={1}>
                                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                        <Typography>{check.title}</Typography>
                                        <Stack direction="row" spacing={1}>
                                          <Chip
                                            size="small"
                                            color={checkSeverityColor(check.severity)}
                                            label={formatStatus(check.severity)}
                                          />
                                          <Chip
                                            size="small"
                                            color={check.is_resolved ? "success" : "default"}
                                            label={check.is_resolved ? "решено" : "открыто"}
                                          />
                                        </Stack>
                                      </Stack>
                                      {check.details ? (
                                        <Typography className="muted-copy">{check.details}</Typography>
                                      ) : null}
                                      {readCheckResolutionMeta(check)?.user_name ? (
                                        <Typography className="muted-copy">
                                          Последнее действие: {readCheckResolutionMeta(check)?.user_name}
                                          {readCheckResolutionMeta(check)?.resolved_at
                                            ? ` · ${formatDateTime(String(readCheckResolutionMeta(check)?.resolved_at))}`
                                            : ""}
                                          {readCheckResolutionMeta(check)?.comment
                                            ? ` · ${String(readCheckResolutionMeta(check)?.comment)}`
                                            : ""}
                                        </Typography>
                                      ) : null}
                                      <TextField
                                        label="Комментарий по проверке"
                                        value={checkComments[check.id] || ""}
                                        onChange={(event) =>
                                          setCheckComments((current) => ({
                                            ...current,
                                            [check.id]: event.target.value,
                                          }))
                                        }
                                        fullWidth
                                        multiline
                                        minRows={2}
                                      />
                                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                                        <Button
                                          size="small"
                                          variant="contained"
                                          disabled={checkActionLoadingId === check.id || check.is_resolved}
                                          onClick={() => {
                                            void handleCheckResolution(check.id, true);
                                          }}
                                        >
                                          {checkActionLoadingId === check.id ? "Сохранение..." : "Закрыть проверку"}
                                        </Button>
                                        <Button
                                          size="small"
                                          variant="outlined"
                                          disabled={checkActionLoadingId === check.id || !check.is_resolved}
                                          onClick={() => {
                                            void handleCheckResolution(check.id, false);
                                          }}
                                        >
                                          Вернуть в работу
                                        </Button>
                                      </Stack>
                                    </Stack>
                                  </Paper>
                                ))
                              ) : (
                                <Typography className="muted-copy">Подозрительные проверки не найдены.</Typography>
                              )}
                            </Stack>

                            <Stack spacing={1}>
                              <Typography variant="h6">Журнал событий</Typography>
                              <TextField
                                label="Поиск по истории"
                                value={historySearch}
                                onChange={(event) => setHistorySearch(event.target.value)}
                                fullWidth
                              />
                              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {historyFilters.map((filter) => (
                                  <Chip
                                    key={filter.key}
                                    label={filter.label}
                                    color={historyFilter === filter.key ? "primary" : "default"}
                                    variant={historyFilter === filter.key ? "filled" : "outlined"}
                                    onClick={() => {
                                      setHistoryFilter(filter.key);
                                    }}
                                  />
                                ))}
                              </Stack>
                              <Typography className="muted-copy">
                                Найдено событий: {filteredDocumentHistory.length + filteredRepairHistory.length}
                              </Typography>
                            </Stack>

                            <Stack spacing={1}>
                              <Typography variant="h6">История по документам</Typography>
                              {filteredDocumentHistory.length > 0 ? (
                                filteredDocumentHistory.map((entry) => (
                                  <Paper className="repair-line" key={`document-history-${entry.id}`} elevation={0}>
                                    <Stack spacing={1}>
                                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                        <Typography>
                                          {entry.user_name || "Система"} · {formatHistoryActionLabel(entry.action_type)}
                                        </Typography>
                                        <Typography className="muted-copy">{formatDateTime(entry.created_at)}</Typography>
                                      </Stack>
                                      <Typography className="muted-copy">
                                        {entry.document_filename || "Документ"}
                                        {entry.document_kind ? ` · ${formatDocumentKind(entry.document_kind)}` : ""}
                                      </Typography>
                                      {renderHistoryDetails(
                                        `document-${entry.id}`,
                                        buildDocumentHistoryDetails(entry),
                                      )}
                                    </Stack>
                                  </Paper>
                                ))
                              ) : (
                                <Typography className="muted-copy">По текущему фильтру событий по документам нет.</Typography>
                              )}
                            </Stack>

                            <Stack spacing={1}>
                              <Typography variant="h6">История изменений</Typography>
                              {filteredRepairHistory.length > 0 ? (
                                filteredRepairHistory.map((entry) => (
                                  <Paper className="repair-line" key={entry.id} elevation={0}>
                                    <Stack spacing={1}>
                                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                                        <Typography>
                                          {entry.user_name || "Система"} · {formatHistoryActionLabel(entry.action_type)}
                                        </Typography>
                                        <Typography className="muted-copy">{formatDateTime(entry.created_at)}</Typography>
                                      </Stack>
                                      {renderHistoryDetails(
                                        `repair-${entry.id}`,
                                        buildRepairHistoryDetails(entry),
                                      )}
                                    </Stack>
                                  </Paper>
                                ))
                              ) : (
                                <Typography className="muted-copy">По текущему фильтру событий по ремонту нет.</Typography>
                              )}
                            </Stack>
                          </>
                        )}
                      </Stack>
                    ) : (
                      <Stack spacing={2} alignItems="center" className="repair-placeholder">
                        <Typography className="muted-copy">
                          Выберите документ, чтобы открыть карточку ремонта.
                        </Typography>
                      </Stack>
                    )}
                  </Stack>
                </Paper>

                <Paper className="workspace-panel" elevation={0}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h5">Срез по технике</Typography>
                      <Typography className="muted-copy">
                        Первые позиции из реестра техники, доступной текущему пользователю.
                      </Typography>
                    </Box>
                    <Stack spacing={1.25}>
                      {vehicles.slice(0, 8).map((vehicle, index) => (
                        <Box key={vehicle.id}>
                          <Stack direction="row" justifyContent="space-between" spacing={2}>
                            <Box>
                              <Typography>{formatVehicle(vehicle)}</Typography>
                              <Typography className="muted-copy">
                                {vehicle.current_driver_name || "Водитель не указан"}
                              </Typography>
                            </Box>
                            <Chip
                              size="small"
                              label={vehicle.vehicle_type === "truck" ? "Грузовик" : "Прицеп"}
                            />
                          </Stack>
                          {index < Math.min(vehicles.length, 8) - 1 ? <Divider sx={{ mt: 1.5 }} /> : null}
                        </Box>
                      ))}
                    </Stack>
                  </Stack>
                </Paper>
              </Stack>
            </Grid>
          </Grid>
        </Stack>
      </Container>
    </Box>
  );
}
