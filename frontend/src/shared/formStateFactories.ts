import type {
  LaborNormCatalogConfigItem,
  LaborNormCatalogItem,
  OcrProfileMatcherItem,
  OcrRuleItem,
  ReviewRuleItem,
  ServiceItem,
  UserItem,
} from "./workspaceBootstrapTypes";
import type {
  DocumentVehicleFormState,
  LaborNormCatalogFormState,
  LaborNormEntryFormState,
  OcrProfileMatcherFormState,
  OcrRuleFormState,
  ReviewRuleFormState,
  ServiceFormState,
  UserAssignmentFormState,
  UserFormState,
} from "./workspaceFormTypes";

export function splitEditorLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinEditorLines(values: string[] | null | undefined) {
  return (values || []).join("\n");
}

export function createEmptyCatalogForm(): LaborNormCatalogFormState {
  return {
    scope: "",
    catalog_name: "",
    brand_family: "",
    vehicle_type: "",
    year_from: "",
    year_to: "",
    brand_keywords: "",
    model_keywords: "",
    vin_prefixes: "",
    priority: "100",
    auto_match_enabled: "true",
    status: "confirmed",
    notes: "",
  };
}

export function createCatalogFormFromItem(item: LaborNormCatalogConfigItem): LaborNormCatalogFormState {
  return {
    scope: item.scope,
    catalog_name: item.catalog_name,
    brand_family: item.brand_family || "",
    vehicle_type: item.vehicle_type || "",
    year_from: item.year_from !== null ? String(item.year_from) : "",
    year_to: item.year_to !== null ? String(item.year_to) : "",
    brand_keywords: joinEditorLines(item.brand_keywords),
    model_keywords: joinEditorLines(item.model_keywords),
    vin_prefixes: joinEditorLines(item.vin_prefixes),
    priority: String(item.priority),
    auto_match_enabled: item.auto_match_enabled ? "true" : "false",
    status: item.status,
    notes: item.notes || "",
  };
}

export function createEmptyLaborNormEntryForm(scope = ""): LaborNormEntryFormState {
  return {
    id: null,
    scope,
    code: "",
    category: "",
    name_ru: "",
    name_ru_alt: "",
    name_cn: "",
    name_en: "",
    standard_hours: "",
    source_sheet: "",
    source_file: "",
    status: "confirmed",
  };
}

export function createLaborNormEntryFormFromItem(item: LaborNormCatalogItem): LaborNormEntryFormState {
  return {
    id: item.id,
    scope: item.scope,
    code: item.code,
    category: item.category || "",
    name_ru: item.name_ru,
    name_ru_alt: item.name_ru_alt || "",
    name_cn: item.name_cn || "",
    name_en: item.name_en || "",
    standard_hours: String(item.standard_hours),
    source_sheet: item.source_sheet || "",
    source_file: item.source_file || "",
    status: item.status,
  };
}

export function createEmptyServiceForm(): ServiceFormState {
  return {
    id: null,
    name: "",
    city: "",
    contact: "",
    comment: "",
    status: "confirmed",
  };
}

export function createServiceFormFromItem(item: ServiceItem): ServiceFormState {
  return {
    id: item.id,
    name: item.name,
    city: item.city || "",
    contact: item.contact || "",
    comment: item.comment || "",
    status: item.status,
  };
}

export function createEmptyUserForm(): UserFormState {
  return {
    id: null,
    full_name: "",
    login: "",
    email: "",
    role: "employee",
    is_active: "true",
    password: "",
  };
}

export function createUserFormFromItem(item: UserItem): UserFormState {
  return {
    id: item.id,
    full_name: item.full_name,
    login: item.login,
    email: item.email,
    role: item.role,
    is_active: item.is_active ? "true" : "false",
    password: "",
  };
}

export function createEmptyUserAssignmentForm(): UserAssignmentFormState {
  return {
    starts_at: new Date().toISOString().slice(0, 10),
    ends_at: "",
    comment: "",
  };
}

export function createEmptyDocumentVehicleForm(): DocumentVehicleFormState {
  return {
    vehicle_type: "truck",
    plate_number: "",
    vin: "",
    brand: "",
    model: "",
    year: "",
    comment: "",
  };
}

export function createEmptyReviewRuleForm(): ReviewRuleFormState {
  return {
    id: null,
    rule_type: "manual_review_reason",
    code: "",
    title: "",
    weight: "0",
    bucket_override: "",
    is_active: "true",
    sort_order: "100",
    notes: "",
  };
}

export function createReviewRuleFormFromItem(item: ReviewRuleItem): ReviewRuleFormState {
  return {
    id: item.id,
    rule_type: item.rule_type,
    code: item.code,
    title: item.title,
    weight: String(item.weight),
    bucket_override: item.bucket_override || "",
    is_active: item.is_active ? "true" : "false",
    sort_order: String(item.sort_order),
    notes: item.notes || "",
  };
}

export function createEmptyOcrRuleForm(): OcrRuleFormState {
  return {
    id: null,
    profile_scope: "default",
    target_field: "order_number",
    pattern: "",
    value_parser: "raw",
    confidence: "0.6",
    priority: "100",
    is_active: "true",
    notes: "",
  };
}

export function createOcrRuleFormFromItem(item: OcrRuleItem): OcrRuleFormState {
  return {
    id: item.id,
    profile_scope: item.profile_scope,
    target_field: item.target_field,
    pattern: item.pattern,
    value_parser: item.value_parser,
    confidence: String(item.confidence),
    priority: String(item.priority),
    is_active: item.is_active ? "true" : "false",
    notes: item.notes || "",
  };
}

export function createEmptyOcrProfileMatcherForm(): OcrProfileMatcherFormState {
  return {
    id: null,
    profile_scope: "default",
    title: "",
    source_type: "",
    filename_pattern: "",
    text_pattern: "",
    service_name_pattern: "",
    priority: "100",
    is_active: "true",
    notes: "",
  };
}

export function createOcrProfileMatcherFormFromItem(item: OcrProfileMatcherItem): OcrProfileMatcherFormState {
  return {
    id: item.id,
    profile_scope: item.profile_scope,
    title: item.title,
    source_type: item.source_type || "",
    filename_pattern: item.filename_pattern || "",
    text_pattern: item.text_pattern || "",
    service_name_pattern: item.service_name_pattern || "",
    priority: String(item.priority),
    is_active: item.is_active ? "true" : "false",
    notes: item.notes || "",
  };
}
