export type UserRoleFormatter = "admin" | "employee";

const genericStatusLabels: Record<string, string> = {
  preliminary: "Предварительный",
  employee_confirmed: "Подтверждён сотрудником",
  employee_confirmation: "Ждут подтверждения",
  confirmed: "Подтверждено",
  archived: "Архив",
  merged: "Объединён",
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
  manual_review: "Ручная проверка",
  partial_recognition: "Частично распознано",
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

export function formatStatus(status: string) {
  return genericStatusLabels[status] || status.split("_").join(" ");
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

export function formatUserRoleLabel(value: UserRoleFormatter) {
  if (value === "admin") {
    return "Администратор";
  }
  return "Сотрудник";
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
