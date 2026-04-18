import type { DocumentKind } from "../../contracts/domain/workspace";

type HistoryContext = "repair" | "document" | "generic";

export type AuditLogHistoryItem = {
  entity_type: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

export type RepairHistoryItem = {
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

export type RepairDocumentHistoryItem = {
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
};

export type HistoryDetailFormatters = {
  formatStatus: (value: string) => string;
  formatRepairStatus: (value: string | null | undefined) => string;
  formatDocumentStatusLabel: (value: string | null | undefined) => string;
  formatDocumentKind: (value: DocumentKind) => string;
  formatMoney: (value?: number | null) => string | null;
  formatDateValue: (value: string) => string;
  formatJsonPretty: (value: unknown) => string;
  readComparisonReviewMeta: (value: Record<string, unknown> | null) => Record<string, unknown> | null;
};

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

function formatHistoryFieldLabel(fieldName: string, formatStatus: HistoryDetailFormatters["formatStatus"], context: HistoryContext = "generic") {
  if (fieldName === "status") {
    if (context === "document") {
      return "Статус документа";
    }
    if (context === "repair") {
      return "Статус ремонта";
    }
    return "Статус";
  }

  const labels: Record<string, string> = {
    document_id: "Документ",
    job_id: "Импорт",
    repair_id: "Ремонт",
    service_id: "Сервис",
    vehicle_id: "Техника",
    vehicle: "Техника",
    external_id: "Внешний ID",
    vin: "VIN",
    order_number: "Номер заказ-наряда",
    repair_date: "Дата ремонта",
    mileage: "Пробег",
    reason: "Причина обращения",
    employee_comment: "Комментарий сотрудника",
    name: "Название",
    service_name: "Сервис",
    city: "Город",
    contact: "Контакт",
    created_by_user_id: "Создал",
    confirmed_by_user_id: "Подтвердил",
    work_total: "Сумма работ",
    parts_total: "Сумма запчастей",
    vat_total: "НДС",
    grand_total: "Итоговая сумма",
    repair_status: "Статус ремонта",
    document_status: "Статус документа",
    review_queue_priority: "Приоритет очереди",
    ocr_confidence: "Уверенность OCR",
    source_document_id: "Основной документ",
    source_key: "Ключ импорта",
    source_type: "Источник файла",
    mime_type: "MIME-тип",
    storage_key: "Файл в хранилище",
    is_preliminary: "Черновик",
    is_partially_recognized: "Частичное распознавание",
    is_primary: "Основной документ",
    kind: "Тип документа",
    document_kind: "Тип документа",
    original_filename: "Файл",
    source_filename: "Файл-источник",
    full_name: "ФИО",
    login: "Логин",
    email: "E-mail",
    role: "Роль",
    is_active: "Активен",
    assignment_id: "Назначение",
    vehicle_type: "Тип техники",
    starts_at: "Дата начала",
    ends_at: "Дата окончания",
    archived_at: "Дата архивации",
    comment: "Комментарий",
    plate_number: "Госномер",
    brand: "Марка",
    model: "Модель",
    notes: "Комментарий",
    created_new_vehicle: "Создана новая карточка техники",
    scope: "Каталог",
    catalog_id: "ID каталога",
    catalog_name: "Название каталога",
    brand_family: "Семейство бренда",
    brand_keywords: "Ключевые слова марок",
    model_keywords: "Ключевые слова моделей",
    vin_prefixes: "Префиксы VIN",
    year_from: "Год от",
    year_to: "Год до",
    priority: "Приоритет",
    auto_match_enabled: "Авто-матчинг",
    code: "Код",
    category: "Категория",
    name_ru: "Название",
    name_ru_alt: "Доп. название",
    name_cn: "Название CN",
    name_en: "Название EN",
    standard_hours: "Нормо-часы",
    source_sheet: "Лист",
    source_file: "Исходный файл",
    resolution_payload: "Решение",
    filename: "Файл",
    backup_id: "Резервная копия",
    backup_type: "Тип копии",
    source: "Источник",
    size_bytes: "Размер",
    storage_files_total: "Файлов в хранилище",
    tables_total: "Таблиц",
    included_sections: "Включённые разделы",
    excluded_sections: "Исключённые разделы",
    restore_effects: "Эффекты восстановления",
    requested_by_user_id: "Запросил ID пользователя",
    requested_by_login: "Запросил пользователь",
    created_at: "Создано",
    restored_at: "Восстановлено",
    created: "Создано",
    updated: "Обновлено",
    skipped: "Пропущено",
    error: "Ошибка",
    password_updated: "Пароль обновлён",
    invalidated_password_reset_tokens: "Сброшено токенов восстановления",
    password_reset: "Пароль сброшен",
    self_service: "Самообслуживание",
    delivery_status: "Статус доставки",
    delivery_error: "Ошибка доставки",
    password_recovered: "Пароль восстановлен",
  };

  return labels[fieldName] || formatStatus(fieldName);
}

function formatHistoryScalar(
  fieldName: string,
  value: unknown,
  formatters: HistoryDetailFormatters,
  context: HistoryContext = "generic",
): string {
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
      return formatters.formatMoney(value) || "—";
    }
    if (fieldName === "standard_hours") {
      return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} ч`;
    }
    if (fieldName === "ocr_confidence") {
      return `${Math.round(value * 100)}%`;
    }
    if (fieldName === "size_bytes") {
      return `${new Intl.NumberFormat("ru-RU").format(value)} Б`;
    }
    return new Intl.NumberFormat("ru-RU").format(value);
  }
  if (typeof value === "string") {
    if (fieldName === "repair_date") {
      return formatters.formatDateValue(value);
    }
    if (fieldName === "role") {
      return value === "admin" ? "Администратор" : value === "employee" ? "Сотрудник" : value;
    }
    if (fieldName === "vehicle_type") {
      return value === "truck" ? "Грузовик" : value === "trailer" ? "Прицеп" : value;
    }
    if (fieldName === "scope") {
      return value
        .trim()
        .split(/[_\-\s]+/)
        .filter(Boolean)
        .map((part) => {
          if (/\d/.test(part) || part.length <= 3) {
            return part.toUpperCase();
          }
          return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join(" ");
    }
    if (fieldName === "source_type") {
      return value === "pdf" ? "PDF" : value === "image" ? "Изображение" : value === "xlsx" ? "XLSX" : value;
    }
    if (fieldName === "source") {
      return value === "manual" ? "Вручную" : value;
    }
    if (fieldName === "delivery_status") {
      return value === "sent"
        ? "Отправлено"
        : value === "pending"
          ? "В ожидании"
          : value === "pending_manual"
            ? "Ожидает ручной передачи"
            : value;
    }
    if (fieldName === "included_sections" || fieldName === "excluded_sections") {
      const labels: Record<string, string> = {
        database: "База данных",
        storage_files: "Файлы хранилища",
        backup_archives: "Архивы резервных копий",
      };
      return labels[value] || value;
    }
    if (fieldName === "restore_effects") {
      const labels: Record<string, string> = {
        replace_database: "Замена базы данных",
        replace_storage_files: "Замена файлов хранилища",
        keep_backup_archives: "Сохранение архивов резервных копий",
        relogin_required: "Требуется повторный вход",
      };
      return labels[value] || value;
    }
    if (fieldName === "status") {
      if (context === "document") {
        return formatters.formatDocumentStatusLabel(value);
      }
      if (context === "repair") {
        return formatters.formatRepairStatus(value);
      }
      return formatters.formatStatus(value);
    }
    if (fieldName === "repair_status") {
      return formatters.formatRepairStatus(value);
    }
    if (fieldName === "document_status") {
      return formatters.formatDocumentStatusLabel(value);
    }
    if (fieldName === "kind" || fieldName === "document_kind") {
      return formatters.formatDocumentKind(value as DocumentKind);
    }
    if (fieldName.endsWith("_at")) {
      return formatters.formatDateValue(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "—";
    }
    if (value.every((item) => item === null || ["string", "number", "boolean"].includes(typeof item))) {
      return value.map((item) => formatHistoryScalar(fieldName, item, formatters, context)).join(", ");
    }
    return `${value.length}`;
  }
  if (typeof value === "object") {
    if (fieldName === "status" && context === "document") {
      return formatters.formatDocumentStatusLabel(String((value as Record<string, unknown>).status || ""));
    }
    return safeJsonStringify(value);
  }
  return String(value);
}

function collectChangedFieldLines(
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
  fieldNames: string[],
  formatters: HistoryDetailFormatters,
  context: HistoryContext = "generic",
) {
  const lines: string[] = [];
  fieldNames.forEach((fieldName) => {
    const previous = oldValue?.[fieldName];
    const next = newValue?.[fieldName];
    if (areHistoryValuesEqual(previous, next)) {
      return;
    }
    lines.push(
      `${formatHistoryFieldLabel(fieldName, formatters.formatStatus, context)}: ${formatHistoryScalar(fieldName, previous, formatters, context)} -> ${formatHistoryScalar(fieldName, next, formatters, context)}`,
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

function buildHistoryFallbackLine(oldValue: Record<string, unknown> | null, newValue: Record<string, unknown> | null) {
  if (!oldValue && !newValue) {
    return "Изменение зафиксировано без дополнительных данных.";
  }
  return `Снимок изменения: ${safeJsonStringify({ before: oldValue, after: newValue })}`;
}

function readHistoryRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function formatVehicleSnapshotSummary(value: unknown) {
  const record = readHistoryRecord(value);
  if (!record) {
    return null;
  }
  const pieces = [
    typeof record.plate_number === "string" && record.plate_number ? record.plate_number : null,
    typeof record.brand === "string" && record.brand ? record.brand : null,
    typeof record.model === "string" && record.model ? record.model : null,
  ].filter((item): item is string => Boolean(item));
  if (pieces.length > 0) {
    return pieces.join(" · ");
  }
  if (typeof record.id === "number") {
    return `#${record.id}`;
  }
  return null;
}

function buildVehicleSnapshotLine(
  oldValue: Record<string, unknown> | null,
  newValue: Record<string, unknown> | null,
) {
  const previous = formatVehicleSnapshotSummary(oldValue?.vehicle);
  const next = formatVehicleSnapshotSummary(newValue?.vehicle);
  if (previous === next || (!previous && !next)) {
    return null;
  }
  return `Техника: ${previous || "—"} -> ${next || "—"}`;
}

function formatComparisonActionLabel(action: string | null | undefined, formatStatus: HistoryDetailFormatters["formatStatus"]) {
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

export function buildAuditEntryDetails(entry: AuditLogHistoryItem, formatters: HistoryDetailFormatters) {
  const documentFields = [
    "document_id",
    "repair_id",
    "original_filename",
    "kind",
    "status",
    "is_primary",
    "created_new_vehicle",
    "notes",
    "review_queue_priority",
    "document_status",
    "repair_status",
    "source_document_id",
  ];
  const repairFields = [
    "job_id",
    "order_number",
    "repair_date",
    "mileage",
    "vehicle_id",
    "service_id",
    "reason",
    "employee_comment",
    "service_name",
    "source_filename",
    "source_key",
    "work_total",
    "parts_total",
    "vat_total",
    "grand_total",
    "status",
    "repair_status",
    "document_status",
    "created_new_vehicle",
    "review_queue_priority",
    "is_preliminary",
    "is_partially_recognized",
    "source_document_id",
  ];
  const vehicleFields = ["plate_number", "vin", "brand", "model", "status", "archived_at", "comment"];
  const serviceFields = ["name", "city", "contact", "comment", "status", "created_by_user_id", "confirmed_by_user_id"];
  const laborNormCatalogFields = [
    "scope",
    "catalog_name",
    "brand_family",
    "vehicle_type",
    "brand_keywords",
    "model_keywords",
    "vin_prefixes",
    "year_from",
    "year_to",
    "priority",
    "auto_match_enabled",
    "status",
    "notes",
  ];
  const laborNormItemFields = [
    "scope",
    "catalog_name",
    "brand_family",
    "code",
    "category",
    "name_ru",
    "name_ru_alt",
    "name_cn",
    "name_en",
    "standard_hours",
    "source_sheet",
    "source_file",
    "status",
  ];
  const laborNormImportFields = ["scope", "catalog_id", "catalog_name", "brand_family", "filename", "created", "updated", "skipped", "error"];
  const importConflictFields = ["status", "resolution_payload"];
  const systemFields = [
    "backup_id",
    "filename",
    "backup_type",
    "source",
    "status",
    "size_bytes",
    "storage_files_total",
    "tables_total",
    "included_sections",
    "excluded_sections",
    "restore_effects",
    "requested_by_user_id",
    "requested_by_login",
    "created_at",
    "restored_at",
  ];
  const userFields = [
    "full_name",
    "login",
    "email",
    "role",
    "is_active",
    "assignment_id",
    "vehicle_id",
    "plate_number",
    "starts_at",
    "ends_at",
    "comment",
    "password_updated",
    "invalidated_password_reset_tokens",
    "password_reset",
    "self_service",
    "delivery_status",
    "delivery_error",
    "password_recovered",
  ];
  const genericFields = ["document_id", "repair_id", "original_filename", "source_filename", "status", "comment", "notes", "created_new_vehicle"];

  let context: HistoryContext = "generic";
  let fields = genericFields;
  if (entry.entity_type === "repair") {
    context = "repair";
    fields = repairFields;
  } else if (entry.entity_type === "document") {
    context = "document";
    fields = documentFields;
  } else if (entry.entity_type === "vehicle") {
    fields = vehicleFields;
  } else if (entry.entity_type === "service") {
    fields = serviceFields;
  } else if (entry.entity_type === "labor_norm_catalog") {
    fields = laborNormCatalogFields;
  } else if (entry.entity_type === "labor_norm_item") {
    fields = laborNormItemFields;
  } else if (entry.entity_type === "labor_norm_import") {
    fields = laborNormImportFields;
  } else if (entry.entity_type === "import_conflict") {
    fields = importConflictFields;
  } else if (entry.entity_type === "system") {
    fields = systemFields;
  } else if (entry.entity_type === "user") {
    fields = userFields;
  }

  const lines = collectChangedFieldLines(entry.old_value, entry.new_value, fields, formatters, context);
  const vehicleLine = buildVehicleSnapshotLine(entry.old_value, entry.new_value);
  if (vehicleLine) {
    lines.push(vehicleLine);
  }
  if (lines.length > 0) {
    return lines;
  }

  const snapshotLines: string[] = [];
  const appendSnapshot = (title: string, value: Record<string, unknown> | null) => {
    if (!value || Object.keys(value).length === 0) {
      return;
    }
    const pieces = fields
      .filter((fieldName) => value[fieldName] !== undefined && value[fieldName] !== null && value[fieldName] !== "")
      .map((fieldName) => {
        const scalar = formatHistoryScalar(fieldName, value[fieldName], formatters, context);
        return `${formatHistoryFieldLabel(fieldName, formatters.formatStatus, context)}: ${scalar}`;
      });
    if (pieces.length > 0) {
      snapshotLines.push(`${title}: ${pieces.join(" · ")}`);
      return;
    }
    snapshotLines.push(`${title}: ${formatters.formatJsonPretty(value)}`);
  };

  appendSnapshot("Было", entry.old_value);
  appendSnapshot("Стало", entry.new_value);
  if (snapshotLines.length > 0) {
    return snapshotLines;
  }
  return ["Подробные изменения не записаны."];
}

export function buildRepairHistoryDetails(entry: RepairHistoryItem, formatters: HistoryDetailFormatters) {
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
      formatters,
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
    formatters,
    "repair",
  );
  if (sourceDocumentChange.length > 0) {
    lines.push(...sourceDocumentChange);
  }

  const reviewMeta = formatters.readComparisonReviewMeta(entry.new_value);
  if (reviewMeta) {
    lines.push(`Результат сверки: ${formatComparisonActionLabel(String(reviewMeta.action || ""), formatters.formatStatus)}`);
    if (reviewMeta.comment) {
      lines.push(`Комментарий: ${String(reviewMeta.comment)}`);
    }
    if (reviewMeta.compared_document_id || reviewMeta.with_document_id) {
      lines.push(`Документы: ${String(reviewMeta.compared_document_id || "—")} и ${String(reviewMeta.with_document_id || "—")}`);
    }
  }

  if (lines.length === 0) {
    lines.push(buildHistoryFallbackLine(entry.old_value, entry.new_value));
  }
  return lines;
}

export function buildDocumentHistoryDetails(entry: RepairDocumentHistoryItem, formatters: HistoryDetailFormatters) {
  const lines = [
    ...collectChangedFieldLines(
      entry.old_value,
      entry.new_value,
      ["status", "document_status", "repair_status", "review_queue_priority", "is_primary", "kind", "notes"],
      formatters,
      "document",
    ),
    ...collectChangedFieldLines(entry.old_value, entry.new_value, ["created_new_vehicle"], formatters, "document"),
    ...collectChangedFieldLines(entry.old_value, entry.new_value, ["source_document_id"], formatters, "document"),
  ];

  const vehicleLine = buildVehicleSnapshotLine(entry.old_value, entry.new_value);
  if (vehicleLine) {
    lines.push(vehicleLine);
  }

  const reviewMeta = formatters.readComparisonReviewMeta(entry.new_value);
  if (reviewMeta) {
    lines.push(`Результат сверки: ${formatComparisonActionLabel(String(reviewMeta.action || ""), formatters.formatStatus)}`);
    if (reviewMeta.comment) {
      lines.push(`Комментарий: ${String(reviewMeta.comment)}`);
    }
    if (reviewMeta.compared_document_id || reviewMeta.with_document_id) {
      lines.push(`Документы: ${String(reviewMeta.compared_document_id || "—")} и ${String(reviewMeta.with_document_id || "—")}`);
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
