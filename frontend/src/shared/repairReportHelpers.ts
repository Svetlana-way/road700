import { formatCompactNumber, formatHours, formatMoney } from "./displayFormatters";

type RepairWorkLike = {
  reference_payload: Record<string, unknown> | null;
};

type RepairCheckLike = {
  check_type: string;
  calculation_payload: Record<string, unknown> | null;
};

type WorkLaborNormMeta = {
  applicable: boolean | null;
  applicabilityReason: string | null;
  scope: string | null;
  catalogName: string | null;
  code: string | null;
  name: string | null;
  category: string | null;
  matchedBy: string | null;
  matchScore: number | null;
  standardHours: number | null;
};

type CheckResolutionMeta = {
  is_resolved?: boolean;
  comment?: string | null;
  user_id?: number;
  user_name?: string | null;
  resolved_at?: string | null;
};

export type RepairReportSectionKey = "catalogs" | "labor_norms" | "amounts" | "history" | "ocr";

export type RepairReportSection<TCheck extends RepairCheckLike = RepairCheckLike> = {
  key: RepairReportSectionKey;
  title: string;
  checks: TCheck[];
};

export function readStringValue(item: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function readNumberValue(item: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

export function formatOcrLineUnit(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const normalizedValue = value.trim();
  return normalizedValue || null;
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
    scope:
      typeof referencePayload.labor_norm_scope === "string" ? referencePayload.labor_norm_scope : null,
    catalogName:
      typeof referencePayload.labor_norm_catalog_name === "string"
        ? referencePayload.labor_norm_catalog_name
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

export function formatWorkLaborNormMeta<TWork extends RepairWorkLike>(item: TWork) {
  const meta = readWorkLaborNormMeta(item.reference_payload);
  if (!meta) {
    return null;
  }

  if (meta.code && meta.name) {
    const scoreSuffix =
      typeof meta.matchScore === "number" ? ` · уверенность ${Math.round(meta.matchScore * 100)}%` : "";
    const methodLabel = formatMatchMethod(meta.matchedBy);
    const methodSuffix = methodLabel ? ` · ${methodLabel}` : "";
    const hoursLabel = formatHours(meta.standardHours);
    const hoursSuffix = hoursLabel ? ` · справочник ${hoursLabel}` : "";
    const categorySuffix = meta.category ? ` · ${meta.category}` : "";
    const catalogSuffix = meta.catalogName ? ` · ${meta.catalogName}` : meta.scope ? ` · ${meta.scope}` : "";
    return `Матчинг: ${meta.code} · ${meta.name}${categorySuffix}${catalogSuffix}${hoursSuffix}${methodSuffix}${scoreSuffix}`;
  }

  if (meta.applicable === false) {
    const scopeSuffix = meta.catalogName ? ` · ${meta.catalogName}` : meta.scope ? ` · ${meta.scope}` : "";
    return `Матчинг: справочник не применён${scopeSuffix}${meta.applicabilityReason ? ` · ${meta.applicabilityReason}` : ""}`;
  }

  if (meta.applicable === true) {
    return "Матчинг: справочник применим, но совпадение не найдено";
  }

  return null;
}

export function readCheckResolutionMeta<TCheck extends RepairCheckLike>(check: TCheck): CheckResolutionMeta | null {
  const resolution = check.calculation_payload?.resolution;
  if (!resolution || typeof resolution !== "object") {
    return null;
  }
  return resolution as CheckResolutionMeta;
}

function getRepairCheckReportSectionKey(checkType: string): RepairReportSectionKey {
  if (checkType.includes("vehicle") || checkType.includes("service")) {
    return "catalogs";
  }
  if (checkType.includes("standard_hours")) {
    return "labor_norms";
  }
  if (checkType.includes("work_reference")) {
    return "history";
  }
  if (
    checkType.includes("total")
    || checkType.includes("duplicate")
    || checkType.includes("expected_total")
  ) {
    return "amounts";
  }
  if (checkType.includes("repeat_repair")) {
    return "history";
  }
  return "ocr";
}

export function groupRepairChecksForReport<TCheck extends RepairCheckLike>(checks: TCheck[]): RepairReportSection<TCheck>[] {
  const sectionTitles: Record<RepairReportSectionKey, string> = {
    catalogs: "Справочники",
    labor_norms: "Нормо-часы",
    amounts: "Суммы и структура",
    history: "История и аномалии",
    ocr: "OCR и ручная проверка",
  };
  const sectionOrder: RepairReportSectionKey[] = ["catalogs", "labor_norms", "amounts", "history", "ocr"];
  const grouped = new Map<RepairReportSectionKey, TCheck[]>();

  for (const check of checks) {
    const key = getRepairCheckReportSectionKey(check.check_type);
    const existing = grouped.get(key) ?? [];
    grouped.set(key, [...existing, check]);
  }

  return sectionOrder
    .filter((key) => (grouped.get(key)?.length ?? 0) > 0)
    .map((key) => ({
      key,
      title: sectionTitles[key],
      checks: grouped.get(key) ?? [],
    }));
}

export function buildCheckPayloadDetails<TCheck extends RepairCheckLike>(check: TCheck) {
  const payload = check.calculation_payload;
  if (!payload) {
    return [];
  }

  const lines: string[] = [];
  const workName = readStringValue(payload, "work_name");
  const partName = readStringValue(payload, "part_name");

  if (check.check_type === "ocr_expected_total_exceeded") {
    const actualTotal = readNumberValue(payload, "actual_total");
    const expectedTotal = readNumberValue(payload, "expected_total");
    const actualWorkTotal = readNumberValue(payload, "actual_work_total");
    const expectedWorkTotal = readNumberValue(payload, "expected_work_total");
    const lineBreakdown = Array.isArray(payload.line_breakdown) ? payload.line_breakdown.length : 0;
    if (actualTotal !== null || expectedTotal !== null) {
      lines.push(`Факт: ${formatMoney(actualTotal) || "—"} · ожидалось: ${formatMoney(expectedTotal) || "—"}`);
    }
    if (actualWorkTotal !== null || expectedWorkTotal !== null) {
      lines.push(`Работы: ${formatMoney(actualWorkTotal) || "—"} · по модели: ${formatMoney(expectedWorkTotal) || "—"}`);
    }
    if (lineBreakdown > 0) {
      lines.push(`В расчёте учтено строк работ: ${lineBreakdown}`);
    }
  }

  if (check.check_type === "ocr_repeat_repair_detected") {
    const previousRepairId = readNumberValue(payload, "previous_repair_id");
    const previousRepairDate = readStringValue(payload, "previous_repair_date");
    const previousOrderNumber = readStringValue(payload, "previous_order_number");
    const daysSincePrevious = readNumberValue(payload, "days_since_previous");
    if (workName) {
      lines.push(`Работа: ${workName}`);
    }
    lines.push(
      `Предыдущий ремонт: #${previousRepairId !== null ? String(previousRepairId) : "—"}`
      + `${previousOrderNumber ? ` · заказ-наряд ${previousOrderNumber}` : ""}`
      + `${previousRepairDate ? ` · ${previousRepairDate}` : ""}`
      + `${daysSincePrevious !== null ? ` · ${formatCompactNumber(daysSincePrevious)} дн. назад` : ""}`,
    );
  }

  if (check.check_type === "ocr_duplicate_work_lines" || check.check_type === "ocr_duplicate_part_lines") {
    const duplicateCount = readNumberValue(payload, "duplicate_count");
    const quantity = readNumberValue(payload, "quantity");
    const price = readNumberValue(payload, "price");
    const lineTotal = readNumberValue(payload, "line_total");
    if (workName || partName) {
      lines.push(`${workName || partName}`);
    }
    lines.push(
      `Совпадающих строк: ${duplicateCount !== null ? formatCompactNumber(duplicateCount) : "—"}`
      + `${quantity !== null ? ` · кол-во ${formatCompactNumber(quantity)}` : ""}`
      + `${price !== null ? ` · цена ${formatMoney(price)}` : ""}`
      + `${lineTotal !== null ? ` · сумма ${formatMoney(lineTotal)}` : ""}`,
    );
  }

  if (check.check_type === "ocr_document_standard_hours_exceeded") {
    const documentHours = readNumberValue(payload, "document_standard_hours");
    const catalogHours = readNumberValue(payload, "catalog_standard_hours");
    if (workName) {
      lines.push(`Работа: ${workName}`);
    }
    lines.push(`Норма в документе: ${formatHours(documentHours) || "—"} · справочник: ${formatHours(catalogHours) || "—"}`);
  }

  if (check.check_type === "ocr_standard_hours_exceeded") {
    const actualHours = readNumberValue(payload, "actual_hours");
    const standardHours = readNumberValue(payload, "standard_hours");
    if (workName) {
      lines.push(`Работа: ${workName}`);
    }
    lines.push(`Факт: ${formatHours(actualHours) || "—"} · норма: ${formatHours(standardHours) || "—"}`);
  }

  if (check.check_type === "ocr_work_lines_total_mismatch" || check.check_type === "ocr_part_lines_total_mismatch") {
    const linesTotal = readNumberValue(payload, "lines_total");
    const headerTotal = readNumberValue(payload, "header_total");
    lines.push(`По строкам: ${formatMoney(linesTotal) || "—"} · в шапке: ${formatMoney(headerTotal) || "—"}`);
  }

  if (check.check_type === "ocr_total_mismatch") {
    const calculatedTotal = readNumberValue(payload, "calculated_total");
    const grandTotal = readNumberValue(payload, "grand_total");
    const workTotal = readNumberValue(payload, "work_total");
    const partsTotal = readNumberValue(payload, "parts_total");
    const vatTotal = readNumberValue(payload, "vat_total");
    lines.push(`Сумма строк: ${formatMoney(calculatedTotal) || "—"} · итог документа: ${formatMoney(grandTotal) || "—"}`);
    lines.push(
      `Работы ${formatMoney(workTotal) || "—"} · запчасти ${formatMoney(partsTotal) || "—"} · НДС ${formatMoney(vatTotal) || "—"}`,
    );
  }

  if (check.check_type === "ocr_work_reference_missing") {
    const comparisonSourceLabel = readStringValue(payload, "comparison_source_label");
    const repairMileage = readNumberValue(payload, "repair_mileage");
    if (workName) {
      lines.push(`Работа: ${workName}`);
    }
    lines.push(
      `${comparisonSourceLabel || "История"}: недостаточно данных`
      + `${repairMileage !== null ? ` · текущий пробег ${formatCompactNumber(repairMileage)} км` : ""}`,
    );
  }

  if (check.check_type === "ocr_work_reference_price_deviation") {
    const currentPrice = readNumberValue(payload, "current_price");
    const medianPrice = readNumberValue(payload, "median_price");
    const sampleLines = readNumberValue(payload, "sample_lines");
    const allSampleLines = readNumberValue(payload, "all_sample_lines");
    const historicalSampleLines = readNumberValue(payload, "historical_sample_lines");
    const operationalSampleLines = readNumberValue(payload, "operational_sample_lines");
    const comparisonSourceLabel = readStringValue(payload, "comparison_source_label");
    if (workName) {
      lines.push(`Работа: ${workName}`);
    }
    lines.push(
      `Цена: ${formatMoney(currentPrice) || "—"} · медиана: ${formatMoney(medianPrice) || "—"}`
      + `${comparisonSourceLabel ? ` · ${comparisonSourceLabel}` : ""}`,
    );
    lines.push(
      `Выборка: ${sampleLines !== null ? formatCompactNumber(sampleLines) : "—"} строк`
      + `${allSampleLines !== null ? ` из ${formatCompactNumber(allSampleLines)}` : ""}`
      + `${historicalSampleLines !== null ? ` · архив ${formatCompactNumber(historicalSampleLines)}` : ""}`
      + `${operationalSampleLines !== null ? ` · новые ${formatCompactNumber(operationalSampleLines)}` : ""}`,
    );
  }

  if (check.check_type === "ocr_work_reference_mileage_outlier") {
    const repairMileage = readNumberValue(payload, "repair_mileage");
    const medianMileage = readNumberValue(payload, "median_mileage");
    const minMileage = readNumberValue(payload, "min_mileage");
    const maxMileage = readNumberValue(payload, "max_mileage");
    const sampleLines = readNumberValue(payload, "sample_lines");
    const comparisonSourceLabel = readStringValue(payload, "comparison_source_label");
    if (workName) {
      lines.push(`Работа: ${workName}`);
    }
    lines.push(
      `Пробег сейчас: ${repairMileage !== null ? `${formatCompactNumber(repairMileage)} км` : "—"}`
      + `${medianMileage !== null ? ` · медиана ${formatCompactNumber(medianMileage)} км` : ""}`,
    );
    lines.push(
      `Диапазон: ${minMileage !== null ? formatCompactNumber(minMileage) : "—"}-${maxMileage !== null ? formatCompactNumber(maxMileage) : "—"} км`
      + `${comparisonSourceLabel ? ` · ${comparisonSourceLabel}` : ""}`
      + `${sampleLines !== null ? ` · выборка ${formatCompactNumber(sampleLines)}` : ""}`,
    );
  }

  return lines;
}

export function getCheckLinkedRepairId<TCheck extends RepairCheckLike>(check: TCheck) {
  if (check.check_type !== "ocr_repeat_repair_detected") {
    return null;
  }
  return readNumberValue(check.calculation_payload || {}, "previous_repair_id");
}

export function readComparisonReviewMeta(value: Record<string, unknown> | null): Record<string, unknown> | null {
  const review = value?.comparison_review;
  if (!review || typeof review !== "object") {
    return null;
  }
  return review as Record<string, unknown>;
}
