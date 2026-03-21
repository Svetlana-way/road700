import { splitEditorLines } from "./formStateFactories";
import type {
  LaborNormCatalogFormState,
  LaborNormEntryFormState,
  OcrProfileMatcherFormState,
  OcrRuleFormState,
  ReviewRepairFieldsDraft,
  ReviewRuleFormState,
  ServiceFormState,
  UserFormState,
} from "./workspaceFormTypes";

export function buildUserPayload(form: UserFormState) {
  return {
    full_name: form.full_name.trim(),
    login: form.login.trim(),
    email: form.email.trim(),
    role: form.role,
    is_active: form.is_active === "true",
    ...(form.password.trim() ? { password: form.password.trim() } : {}),
  };
}

export function buildReviewRulePayload(form: ReviewRuleFormState) {
  return {
    rule_type: form.rule_type.trim(),
    code: form.code.trim(),
    title: form.title.trim(),
    weight: Number(form.weight || "0"),
    bucket_override: form.bucket_override || null,
    is_active: form.is_active === "true",
    sort_order: Number(form.sort_order || "100"),
    notes: form.notes.trim() || null,
  };
}

export function buildOcrRulePayload(form: OcrRuleFormState) {
  return {
    profile_scope: form.profile_scope.trim(),
    target_field: form.target_field.trim(),
    pattern: form.pattern,
    value_parser: form.value_parser.trim(),
    confidence: Number(form.confidence || "0.6"),
    priority: Number(form.priority || "100"),
    is_active: form.is_active === "true",
    notes: form.notes.trim() || null,
  };
}

export function buildOcrProfileMatcherPayload(form: OcrProfileMatcherFormState) {
  return {
    profile_scope: form.profile_scope.trim(),
    title: form.title.trim(),
    source_type: form.source_type || null,
    filename_pattern: form.filename_pattern.trim() || null,
    text_pattern: form.text_pattern.trim() || null,
    service_name_pattern: form.service_name_pattern.trim() || null,
    priority: Number(form.priority || "100"),
    is_active: form.is_active === "true",
    notes: form.notes.trim() || null,
  };
}

export function buildServicePayload(form: ServiceFormState, statusOverride?: ServiceFormState["status"]) {
  return {
    name: form.name.trim(),
    city: form.city.trim() || null,
    contact: form.contact.trim() || null,
    comment: form.comment.trim() || null,
    status: statusOverride ?? form.status,
  };
}

function parseOptionalNumber(value: string, label: string) {
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Поле \`${label}\` заполнено некорректно`);
  }
  return parsed;
}

export function buildReviewFieldsPayload(form: ReviewRepairFieldsDraft) {
  return {
    order_number: form.order_number.trim() || null,
    repair_date: form.repair_date || null,
    mileage: parseOptionalNumber(form.mileage, "Пробег"),
    work_total: parseOptionalNumber(form.work_total, "Работы"),
    parts_total: parseOptionalNumber(form.parts_total, "Запчасти"),
    vat_total: parseOptionalNumber(form.vat_total, "НДС"),
    grand_total: parseOptionalNumber(form.grand_total, "Итоговая сумма"),
    reason: form.reason.trim() || null,
    employee_comment: form.employee_comment.trim() || null,
  };
}

export function buildLaborNormCatalogPayload(form: LaborNormCatalogFormState) {
  return {
    catalog_name: form.catalog_name.trim(),
    brand_family: form.brand_family.trim() || null,
    vehicle_type: form.vehicle_type || null,
    year_from: form.year_from.trim() ? Number(form.year_from) : null,
    year_to: form.year_to.trim() ? Number(form.year_to) : null,
    brand_keywords: splitEditorLines(form.brand_keywords),
    model_keywords: splitEditorLines(form.model_keywords),
    vin_prefixes: splitEditorLines(form.vin_prefixes),
    priority: Number(form.priority || "100"),
    auto_match_enabled: form.auto_match_enabled === "true",
    status: form.status,
    notes: form.notes.trim() || null,
  };
}

export function buildLaborNormCatalogCreatePayload(form: LaborNormCatalogFormState) {
  return {
    scope: form.scope.trim(),
    ...buildLaborNormCatalogPayload(form),
  };
}

export function buildLaborNormEntryPayload(form: LaborNormEntryFormState) {
  return {
    scope: form.scope.trim(),
    code: form.code.trim(),
    category: form.category.trim() || null,
    name_ru: form.name_ru.trim(),
    name_ru_alt: form.name_ru_alt.trim() || null,
    name_cn: form.name_cn.trim() || null,
    name_en: form.name_en.trim() || null,
    standard_hours: Number(form.standard_hours.replace(",", ".")),
    source_sheet: form.source_sheet.trim() || null,
    source_file: form.source_file.trim() || null,
    status: form.status,
  };
}
