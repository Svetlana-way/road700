import type { CheckSeverity } from "./workspaceViewTypes";

export type UserRoleFormatter = "admin" | "employee";
export type VehicleTypeFormatter = "truck" | "trailer";
export type VehicleStatusFormatter = "active" | "in_repair" | "waiting_repair" | "inactive" | "decommissioned" | "archived";
export type DocumentKindFormatter = "order" | "repeat_scan" | "attachment" | "confirmation";
export type DocumentStatusFormatter =
  | "uploaded"
  | "recognized"
  | "partially_recognized"
  | "needs_review"
  | "confirmed"
  | "ocr_error"
  | "archived";
export type CheckSeverityFormatter = CheckSeverity;
export type ReviewPriorityBucketFormatter = "review" | "critical" | "suspicious";

export type OcrProfileMeta = {
  scope: string | null;
  source: string | null;
  reason: string | null;
};

const historyActionLabels: Record<string, string> = {
  manual_update: "Ручное редактирование ремонта",
  repair_archived: "Ремонт отправлен в архив",
  repair_deleted: "Заказ-наряд удалён",
  service_assignment: "Назначение сервиса",
  review_field_update: "Обновление полей проверки",
  check_resolution_update: "Изменение статуса проверки",
  review_employee_confirm: "Подтверждение сотрудником",
  review_confirm: "Подтверждение администратором",
  review_send_to_review: "Возврат в ручную проверку",
  primary_document_changed: "Смена основного документа",
  set_primary: "Документ назначен основным",
  document_uploaded: "Загрузка нового документа",
  document_attached: "Прикрепление документа к ремонту",
  document_archived: "Документ отправлен в архив",
  document_status_updated: "Изменение статуса документа",
  document_comparison_reviewed: "Результат сверки документов",
  repair_vehicle_relinked: "Перепривязка ремонта к технике",
  document_vehicle_linked: "Привязка документа к технике",
  vehicle_created_from_document: "Карточка техники создана из документа",
  comparison_keep_current_primary: "Сверка: оставлен текущий основной документ",
  comparison_make_document_primary: "Сверка: выбран новый основной документ",
  comparison_mark_reviewed: "Сверка отмечена как проверенная",
  historical_import_created: "Исторический ремонт загружен",
  user_created: "Пользователь создан",
  user_updated: "Пользователь обновлён",
  user_password_reset: "Пароль пользователя сброшен администратором",
  user_password_changed: "Пользователь сменил пароль",
  user_password_recovery_requested: "Запрошено восстановление пароля",
  user_password_recovered: "Пароль восстановлен",
  user_assignment_created: "Назначение техники пользователю",
  user_assignment_updated: "Изменение назначения техники пользователю",
  vehicle_updated: "Карточка техники обновлена",
};

const auditEntityLabels: Record<string, string> = {
  repair: "Ремонт",
  document: "Документ",
  vehicle: "Техника",
  service: "Сервис",
  user: "Пользователь",
  labor_norm_catalog_item: "Нормо-час",
  labor_norm_catalog_config: "Каталог нормо-часов",
  review_rule: "Правило проверки",
  ocr_rule: "OCR правило",
  ocr_profile_matcher: "OCR подбор профиля",
  ocr_learning_signal: "OCR сигнал обучения",
  import_conflict: "Конфликт импорта",
};

const repairStatusLabels: Record<string, string> = {
  draft: "Черновик",
  in_review: "На проверке",
  suspicious: "Подозрительный",
  confirmed: "Подтверждён",
  partially_recognized: "Частично распознан",
  ocr_error: "Ошибка OCR",
  archived: "Архивный",
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

const genericStatusLabels: Record<string, string> = {
  preliminary: "Предварительный",
  confirmed: "Подтверждено",
  archived: "Архив",
  draft: "Черновик",
  queued: "В очереди",
  retry: "Повтор",
  processing: "В обработке",
  completed: "Готово",
  completed_with_conflicts: "Готово с конфликтами",
  failed: "Ошибка",
  ignored: "Игнорировано",
  resolved: "Решено",
  active: "Активен",
  inactive: "Неактивен",
  in_repair: "В ремонте",
  waiting_repair: "Ожидает ремонта",
  decommissioned: "Списан",
  normal: "Норма",
  warning: "Предупреждение",
  suspicious: "Подозрение",
  error: "Ошибка",
  new: "Новый",
  reviewed: "Просмотрен",
  applied: "Применён",
  rejected: "Отклонён",
  review: "Проверить",
  critical: "Критично",
  learning: "Обучение",
  matchers: "Подбор профиля",
  rules: "Правила OCR",
  match: "Совпадение",
  mismatch: "Расхождение",
  missing: "Не заполнено",
  ocr_missing: "Не распознано",
  amount_mismatch: "Сумма отличается от истории",
  repeated_repair: "Есть похожий ремонт",
  work_missing_from_reference: "Работа вне справочника",
  service_name_missing: "Сервис не указан",
  vehicle_missing: "Техника не указана",
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

export function formatStatus(status: string) {
  return genericStatusLabels[status] || status.split("_").join(" ");
}

export function formatAuditEntityLabel(entityType: string | null | undefined) {
  if (!entityType) {
    return "Сущность";
  }
  return auditEntityLabels[entityType] || formatStatus(entityType);
}

export function formatJsonPretty(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatMoney(value?: number | null) {
  if (typeof value !== "number") {
    return null;
  }
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatFileSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 Б";
  }
  const units = ["Б", "КБ", "МБ", "ГБ"];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[unitIndex]}`;
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

export function formatValueParserLabel(value: string) {
  const labels: Record<string, string> = {
    raw: "Без обработки",
    date: "Дата",
    amount: "Сумма",
    digits_int: "Целое число",
  };
  return labels[value] || value;
}

export function formatReviewBucketLabel(value: string | null | undefined) {
  if (!value) {
    return "Без переопределения";
  }
  const labels: Record<string, string> = {
    review: "Обычный",
    critical: "Критичный",
    suspicious: "Подозрительный",
  };
  return labels[value] || value;
}

export function formatReviewRuleTypeLabel(value: string) {
  const labels: Record<string, string> = {
    manual_review_reason: "Причина ручной проверки",
    document_status: "Статус документа",
    repair_status: "Статус ремонта",
    check_severity: "Уровень проверки",
    signal: "Сигнал системы",
  };
  return labels[value] || value;
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

export function formatOcrLearningStatusLabel(value: string) {
  const labels: Record<string, string> = {
    new: "Новый",
    reviewed: "Просмотрен",
    applied: "Применён",
    rejected: "Отклонён",
  };
  return labels[value] || value;
}

export function formatOcrSignalTypeLabel(value: string) {
  const labels: Record<string, string> = {
    corrected_value: "Исправленное значение",
    missing_value: "Не извлечено",
    mismatched_value: "Извлечено неверно",
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

export function formatCatalogCodeLabel(value: string | null | undefined) {
  if (!value) {
    return "Не указан";
  }
  return value;
}

export function formatHours(value: number | null | undefined) {
  if (typeof value !== "number") {
    return null;
  }
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ч`;
}

export function formatCompactNumber(value: number | null | undefined) {
  if (typeof value !== "number") {
    return null;
  }
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
}

export function formatVehicleTypeLabel(value: VehicleTypeFormatter | "" | null | undefined) {
  if (value === "truck") {
    return "Грузовик";
  }
  if (value === "trailer") {
    return "Прицеп";
  }
  return "Любой";
}

export function formatUserRoleLabel(value: UserRoleFormatter) {
  if (value === "admin") {
    return "Администратор";
  }
  return "Сотрудник";
}

export function formatVehicleStatusLabel(value: string | null | undefined) {
  if (!value) {
    return "Не указан";
  }
  const labels: Record<string, string> = {
    active: "В работе",
    in_repair: "В ремонте",
    waiting_repair: "Ожидает ремонта",
    inactive: "Не используется",
    decommissioned: "Списан",
    archived: "Архив",
  };
  return labels[value] || formatStatus(value);
}

export function vehicleStatusColor(status: VehicleStatusFormatter | string): "default" | "success" | "warning" | "error" {
  if (status === "active") {
    return "success";
  }
  if (status === "in_repair" || status === "waiting_repair") {
    return "warning";
  }
  if (status === "decommissioned") {
    return "error";
  }
  return "default";
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

export function checkSeverityColor(severity: CheckSeverity): "default" | "success" | "error" | "warning" {
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

export function executiveRiskColor(level: "low" | "medium" | "high"): "success" | "warning" | "error" {
  if (level === "high") {
    return "error";
  }
  if (level === "medium") {
    return "warning";
  }
  return "success";
}

export function formatExecutiveRiskLabel(level: "low" | "medium" | "high") {
  if (level === "high") {
    return "Высокий риск";
  }
  if (level === "medium") {
    return "Средний риск";
  }
  return "Низкий риск";
}

export function reviewPriorityColor(bucket: ReviewPriorityBucketFormatter): "default" | "error" | "warning" {
  if (bucket === "suspicious") {
    return "error";
  }
  if (bucket === "critical") {
    return "warning";
  }
  return "default";
}

export function formatReviewPriority(bucket: ReviewPriorityBucketFormatter) {
  if (bucket === "suspicious") {
    return "Подозрительно";
  }
  if (bucket === "critical") {
    return "Критично";
  }
  return "Проверить";
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

export function formatRepairStatus(status: string | null | undefined) {
  if (!status) {
    return "—";
  }
  return repairStatusLabels[status] || formatStatus(status);
}

export function formatDocumentStatusLabel(status: string | null | undefined) {
  if (!status) {
    return "—";
  }
  return documentStatusLabels[status] || formatStatus(status);
}

export function formatManualReviewReason(reason: string) {
  return manualReviewReasonLabels[reason] || formatStatus(reason);
}

export function formatManualReviewReasons(reasons: string[]) {
  return reasons.map((reason) => formatManualReviewReason(reason)).join(", ");
}

export function formatHistoryActionLabel(actionType: string) {
  return historyActionLabels[actionType] || formatStatus(actionType);
}

export function formatDateValue(value: string) {
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

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatConfidence(value: number | null) {
  if (typeof value !== "number") {
    return "—";
  }
  return `${Math.round(value * 100)}%`;
}

export function getConfidenceColor(value: number | null): "default" | "success" | "warning" | "error" {
  if (value === null) {
    return "default";
  }
  if (value >= 0.9) {
    return "success";
  }
  if (value >= 0.7) {
    return "warning";
  }
  return "error";
}

export function formatConfidenceLabel(value: number | null) {
  return value === null ? "OCR без оценки" : `OCR ${formatConfidence(value)}`;
}

function isImportJobActive(status: string | null | undefined) {
  return status === "queued" || status === "retry" || status === "processing";
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
