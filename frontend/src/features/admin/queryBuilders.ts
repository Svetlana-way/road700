export function buildLaborNormQueryString(query: string, scope: string, category: string, limit = 12, offset = 0) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (query.trim()) {
    params.set("q", query.trim());
  }
  if (scope) {
    params.set("scope", scope);
  }
  if (category) {
    params.set("category", category);
  }
  return params.toString();
}

export function buildServiceQueryString(
  query: string,
  city: string,
  statusFilter: string,
  limit = 100,
  offset = 0,
) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (query.trim()) {
    params.set("q", query.trim());
  }
  if (city) {
    params.set("city", city);
  }
  if (statusFilter) {
    params.set("status", statusFilter);
  }
  return params.toString();
}

export function buildHistoricalWorkReferenceQueryString(
  query: string,
  minSamplesValue: string,
  limit = 20,
  offset = 0,
) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  const normalizedQuery = query.trim();
  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }
  const normalizedMinSamples = Number(minSamplesValue.trim());
  if (Number.isFinite(normalizedMinSamples) && normalizedMinSamples > 0) {
    params.set("min_samples", String(Math.round(normalizedMinSamples)));
  }
  return params.toString();
}

export function buildImportJobsQueryString(importType: string, limit = 20, offset = 0) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (importType) {
    params.set("import_type", importType);
  }
  return params.toString();
}

export function buildImportConflictsQueryString(status: string, limit = 20, offset = 0) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (status) {
    params.set("status", status);
  }
  return params.toString();
}

export function buildOcrRulesQueryString(profileScope: string) {
  const params = new URLSearchParams();
  if (profileScope) {
    params.set("profile_scope", profileScope);
  }
  return params.toString();
}

export function buildOcrProfileMatchersQueryString(profileScope: string) {
  const params = new URLSearchParams();
  if (profileScope) {
    params.set("profile_scope", profileScope);
  }
  return params.toString();
}

export function buildOcrLearningSignalsQueryString(
  statusFilter: string,
  targetFieldFilter: string,
  profileScopeFilter: string,
  limit = 50,
  offset = 0,
) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  if (statusFilter) {
    params.set("status", statusFilter);
  }
  if (targetFieldFilter) {
    params.set("target_field", targetFieldFilter);
  }
  if (profileScopeFilter) {
    params.set("profile_scope", profileScopeFilter);
  }
  return params.toString();
}

export function buildUsersQueryString(search: string) {
  const params = new URLSearchParams();
  params.set("include_inactive", "true");
  if (search.trim()) {
    params.set("search", search.trim());
  }
  return params.toString();
}
