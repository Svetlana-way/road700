type LaborNormCatalogFormState = {
  scope: string;
  catalog_name: string;
  brand_family: string;
  vehicle_type: "" | "truck" | "trailer";
  year_from: string;
  year_to: string;
  brand_keywords: string;
  model_keywords: string;
  vin_prefixes: string;
  priority: string;
  auto_match_enabled: "true" | "false";
  status: string;
  notes: string;
};

type LaborNormCatalogConfigItem = {
  scope: string;
  catalog_name: string;
  brand_family: string | null;
  vehicle_type: "truck" | "trailer" | null;
  year_from: number | null;
  year_to: number | null;
  brand_keywords: string[] | null;
  model_keywords: string[] | null;
  vin_prefixes: string[] | null;
  priority: number;
  auto_match_enabled: boolean;
  status: string;
  notes: string | null;
};

type LaborNormEntryFormState = {
  id: number | null;
  scope: string;
  code: string;
  category: string;
  name_ru: string;
  name_ru_alt: string;
  name_cn: string;
  name_en: string;
  standard_hours: string;
  source_sheet: string;
  source_file: string;
  status: string;
};

type LaborNormCatalogItem = {
  id: number;
  scope: string;
  code: string;
  category: string | null;
  name_ru: string;
  name_ru_alt: string | null;
  name_cn: string | null;
  name_en: string | null;
  standard_hours: number;
  source_sheet: string | null;
  source_file: string | null;
  status: string;
};

type ServiceFormState = {
  id: number | null;
  name: string;
  city: string;
  contact: string;
  comment: string;
  status: "preliminary" | "confirmed" | "archived";
};

type ServiceItem = {
  id: number;
  name: string;
  city: string | null;
  contact: string | null;
  comment: string | null;
  status: "preliminary" | "confirmed" | "archived";
};

type UserFormState = {
  id: number | null;
  full_name: string;
  login: string;
  email: string;
  role: "admin" | "employee";
  is_active: "true" | "false";
  password: string;
};

type UserItem = {
  id: number;
  full_name: string;
  login: string;
  email: string;
  role: "admin" | "employee";
  is_active: boolean;
};

type UserAssignmentFormState = {
  starts_at: string;
  ends_at: string;
  comment: string;
};

type DocumentVehicleFormState = {
  vehicle_type: "truck" | "trailer";
  plate_number: string;
  vin: string;
  brand: string;
  model: string;
  year: string;
  comment: string;
};

type ReviewRuleFormState = {
  id: number | null;
  rule_type: string;
  code: string;
  title: string;
  weight: string;
  bucket_override: string;
  is_active: "true" | "false";
  sort_order: string;
  notes: string;
};

type ReviewRuleItem = {
  id: number;
  rule_type: string;
  code: string;
  title: string;
  weight: number;
  bucket_override: string | null;
  is_active: boolean;
  sort_order: number;
  notes: string | null;
};

type OcrRuleFormState = {
  id: number | null;
  profile_scope: string;
  target_field: string;
  pattern: string;
  value_parser: string;
  confidence: string;
  priority: string;
  is_active: "true" | "false";
  notes: string;
};

type OcrRuleItem = {
  id: number;
  profile_scope: string;
  target_field: string;
  pattern: string;
  value_parser: string;
  confidence: number;
  priority: number;
  is_active: boolean;
  notes: string | null;
};

type OcrProfileMatcherFormState = {
  id: number | null;
  profile_scope: string;
  title: string;
  source_type: string;
  filename_pattern: string;
  text_pattern: string;
  service_name_pattern: string;
  priority: string;
  is_active: "true" | "false";
  notes: string;
};

type OcrProfileMatcherItem = {
  id: number;
  profile_scope: string;
  title: string;
  source_type: string | null;
  filename_pattern: string | null;
  text_pattern: string | null;
  service_name_pattern: string | null;
  priority: number;
  is_active: boolean;
  notes: string | null;
};

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
