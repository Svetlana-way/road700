export function buildGlobalSearchQueryString(query: string, limitPerSection = 8, offsetPerSection = 0) {
  const params = new URLSearchParams();
  params.set("q", query.trim());
  params.set("limit_per_section", String(limitPerSection));
  params.set("offset_per_section", String(offsetPerSection));
  return params.toString();
}

export function buildAuditLogQueryString(
  searchQuery: string,
  entityType: string,
  actionType: string,
  userId: string,
  dateFrom: string,
  dateTo: string,
  limit = 80,
  offset = 0,
) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
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
