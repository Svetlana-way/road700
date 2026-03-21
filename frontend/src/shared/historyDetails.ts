import type { DocumentKind } from "./workspaceBootstrapTypes";

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
    repair_id: "Ремонт",
    vehicle_id: "Техника",
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
    original_filename: "Файл",
    source_filename: "Файл-источник",
    full_name: "ФИО",
    login: "Логин",
    email: "E-mail",
    role: "Роль",
    is_active: "Активен",
    starts_at: "Дата начала",
    ends_at: "Дата окончания",
    comment: "Комментарий",
    plate_number: "Госномер",
    brand: "Марка",
    model: "Модель",
    notes: "Комментарий",
  };

  return labels[fieldName] || formatStatus(fieldName);
}

function formatHistoryScalar(
  fieldName: string,
  value: unknown,
  formatters: HistoryDetailFormatters,
  context: HistoryContext = "generic",
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
      return formatters.formatMoney(value) || "—";
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
    if (fieldName === "status" && context === "generic") {
      return formatters.formatStatus(value);
    }
    if (fieldName === "status" || fieldName === "repair_status") {
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
    "notes",
    "review_queue_priority",
    "document_status",
    "repair_status",
    "source_document_id",
  ];
  const repairFields = [
    "order_number",
    "repair_date",
    "mileage",
    "reason",
    "employee_comment",
    "service_name",
    "work_total",
    "parts_total",
    "vat_total",
    "grand_total",
    "status",
    "repair_status",
    "document_status",
    "review_queue_priority",
    "is_preliminary",
    "is_partially_recognized",
    "source_document_id",
  ];
  const vehicleFields = ["plate_number", "vin", "brand", "model", "status", "comment"];
  const userFields = ["full_name", "login", "email", "role", "is_active", "vehicle_id", "starts_at", "ends_at", "comment"];
  const genericFields = ["document_id", "repair_id", "original_filename", "source_filename", "status", "comment", "notes"];

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
  } else if (entry.entity_type === "user") {
    fields = userFields;
  }

  const lines = collectChangedFieldLines(entry.old_value, entry.new_value, fields, formatters, context);
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
    ...collectChangedFieldLines(entry.old_value, entry.new_value, ["source_document_id"], formatters, "document"),
  ];

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
