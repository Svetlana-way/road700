export function buildLaborNormQueryString(query: string, scope: string, category: string) {
  const params = new URLSearchParams();
  params.set("limit", "12");
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

export function buildServiceQueryString(query: string, city: string) {
  const params = new URLSearchParams();
  params.set("limit", "100");
  if (query.trim()) {
    params.set("q", query.trim());
  }
  if (city) {
    params.set("city", city);
  }
  return params.toString();
}

export function buildHistoricalWorkReferenceQueryString(query: string, minSamplesValue: string) {
  const params = new URLSearchParams();
  params.set("limit", "20");
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

export function buildImportConflictsQueryString(status: string) {
  const params = new URLSearchParams();
  params.set("status", status);
  params.set("limit", "20");
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
) {
  const params = new URLSearchParams();
  params.set("limit", "50");
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

export function buildFleetVehiclesQueryString(
  limit: number,
  query: string,
  vehicleType: string,
  statusFilter: string,
) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (query.trim()) {
    params.set("search", query.trim());
  }
  if (vehicleType) {
    params.set("vehicle_type", vehicleType);
  }
  if (statusFilter) {
    params.set("status", statusFilter);
  }
  return params.toString();
}

export function buildGlobalSearchQueryString(query: string) {
  const params = new URLSearchParams();
  params.set("q", query.trim());
  params.set("limit_per_section", "8");
  return params.toString();
}

export function buildAuditLogQueryString(
  searchQuery: string,
  entityType: string,
  actionType: string,
  userId: string,
  dateFrom: string,
  dateTo: string,
) {
  const params = new URLSearchParams();
  params.set("limit", "80");
  if (searchQuery.trim()) {
    params.set("search", searchQuery.trim());
  }
  if (entityType) {
    params.set("entity_type", entityType);
  }
  if (actionType) {
    params.set("action_type", actionType);
  }
  if (userId) {
    params.set("user_id", userId);
  }
  if (dateFrom) {
    params.set("date_from", `${dateFrom}T00:00:00`);
  }
  if (dateTo) {
    params.set("date_to", `${dateTo}T00:00:00`);
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
