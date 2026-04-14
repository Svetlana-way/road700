export function buildFleetVehiclesQueryString(
  limit: number,
  offset: number,
  query: string,
  vehicleType: string,
  statusFilter: string,
) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("offset", String(offset));
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
