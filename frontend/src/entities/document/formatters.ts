import { formatStatus } from "../../shared/formattersCore";

export type DocumentKindFormatter = "order" | "repeat_scan" | "attachment" | "confirmation";
export type DocumentStatusFormatter =
  | "uploaded"
  | "recognized"
  | "partially_recognized"
  | "needs_review"
  | "confirmed"
  | "ocr_error"
  | "archived";

export type OcrProfileMeta = {
  scope: string | null;
  source: string | null;
  reason: string | null;
};

const documentStatusLabels: Record<string, string> = {
  uploaded: "Загружен",
  recognized: "Распознан",
  partially_recognized: "Частично распознан",
  needs_review: "Требует проверки",
  confirmed: "Подтверждён",
  ocr_error: "Ошибка OCR",
  archived: "Архивирован",
};

const manualReviewReasonLabels: Record<string, string> = {
  service_name_unrecognized: "сервис не распознан",
  service_name_missing: "не удалось определить сервис",
  service_name_suspicious: "название сервиса выглядит сомнительно",
  vehicle_missing: "не удалось определить технику",
  vehicle_not_found: "техника не найдена в базе",
  mileage_missing: "не удалось определить пробег",
  order_number_missing: "не удалось определить номер заказ-наряда",
  repair_date_invalid: "дата ремонта распознана с ошибкой",
  repair_date_missing: "не удалось определить дату ремонта",
  service_not_found: "сервис не найден в справочнике",
  text_not_found: "не удалось извлечь текст из документа",
};

function isImportJobActive(status: string | null | undefined) {
  return status === "queued" || status === "retry" || status === "processing";
}

export function formatDocumentKind(kind: DocumentKindFormatter) {
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

export function formatDocumentStatusLabel(status: string | null | undefined) {
  if (!status) {
    return "—";
  }
  return documentStatusLabels[status] || formatStatus(status);
}

export function formatDocumentVersionSummary(summary: string | null | undefined) {
  if (!summary) {
    return null;
  }
  const labels: Record<string, string> = {
    "Initial upload": "Первичная загрузка",
    "Attached to existing repair": "Документ привязан к существующему ремонту",
    "Queued for reprocessing": "Поставлен в очередь на повторный OCR",
    "Stored without OCR": "Сохранён без OCR",
    "Document processed automatically": "Документ обработан автоматически",
    "Document processed partially and sent for review": "Документ обработан частично и отправлен на проверку",
    "Document processing did not extract text": "Не удалось извлечь текст из документа",
    "Image uploaded; manual review is required": "Изображение загружено, требуется ручная проверка",
  };
  return labels[summary] || summary;
}

export function formatDocumentProcessor(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const labels: Record<string, string> = {
    hybrid_document_ocr_v2: "Гибридный OCR v2",
    document_storage_only_v1: "Сохранение без OCR",
    "legacy-ocr": "Legacy OCR",
  };
  return labels[value] || formatStatus(value);
}

export function statusColor(status: DocumentStatusFormatter): "default" | "success" | "error" | "warning" {
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

export function importJobStatusColor(status: string | null | undefined): "default" | "success" | "error" | "warning" {
  if (status === "completed") {
    return "success";
  }
  if (status === "failed") {
    return "error";
  }
  if (status === "queued" || status === "retry" || status === "processing" || status === "completed_with_conflicts") {
    return "warning";
  }
  return "default";
}

export function isDocumentAwaitingOcr(status: string | null | undefined) {
  return status === "uploaded";
}

export function documentHasActiveImportJob(
  document: { latest_import_job?: { status?: string | null } | null } | null | undefined,
) {
  return isImportJobActive(document?.latest_import_job?.status);
}

export function getLaborNormApplicability(
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
    matchedCount: typeof rawApplicability.matched_count === "number" ? rawApplicability.matched_count : 0,
    unmatchedCount: typeof rawApplicability.unmatched_count === "number" ? rawApplicability.unmatched_count : 0,
  };
}

export function formatLaborNormApplicability(payload: Record<string, unknown> | null | undefined) {
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

export function readOcrProfileMeta(payload: Record<string, unknown> | null | undefined): OcrProfileMeta | null {
  if (!payload) {
    return null;
  }
  return {
    scope: typeof payload.ocr_profile_scope === "string" ? payload.ocr_profile_scope : null,
    source: typeof payload.ocr_profile_source === "string" ? payload.ocr_profile_source : null,
    reason: typeof payload.ocr_profile_reason === "string" ? payload.ocr_profile_reason : null,
  };
}

export function formatOcrProfileName(value: string | null | undefined) {
  if (!value) {
    return "Не указан";
  }
  if (value === "default") {
    return "Базовый";
  }
  return value;
}

export function formatOcrProfileMeta(payload: Record<string, unknown> | null | undefined) {
  const meta = readOcrProfileMeta(payload);
  if (!meta?.scope) {
    return null;
  }
  const sourceSuffix = meta.source ? ` · ${meta.source}` : "";
  const reasonSuffix = meta.reason ? ` · ${meta.reason}` : "";
  return `Шаблон OCR: ${formatOcrProfileName(meta.scope)}${sourceSuffix}${reasonSuffix}`;
}

export function formatOcrFieldLabel(value: string) {
  const labels: Record<string, string> = {
    order_number: "Номер заказ-наряда",
    repair_date: "Дата ремонта",
    mileage: "Пробег",
    plate_number: "Госномер",
    vin: "VIN",
    service_name: "Сервис",
    work_total: "Сумма работ",
    parts_total: "Сумма запчастей",
    vat_total: "НДС",
    grand_total: "Итоговая сумма",
  };
  return labels[value] || value;
}

export function formatSourceTypeLabel(value: string | null | undefined) {
  const labels: Record<string, string> = {
    pdf: "PDF",
    image: "Изображение",
  };
  if (!value) {
    return "Любой";
  }
  return labels[value] || value.toUpperCase();
}

export function formatManualReviewReason(reason: string) {
  return manualReviewReasonLabels[reason] || formatStatus(reason);
}

export function formatManualReviewReasons(reasons: string[]) {
  return reasons.map((reason) => formatManualReviewReason(reason)).join(", ");
}
