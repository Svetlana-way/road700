import { apiRequest } from "../../shared/apiCore";
import type { VehicleStatus, VehicleType, VehiclesResponse } from "../../contracts/domain/workspace";
import { buildFleetVehiclesQueryString } from "./queryBuilders";

export async function fetchVehiclesPage(
  token: string,
  query: string,
  limit: number,
  offset: number,
  vehicleType: "" | VehicleType = "",
  statusFilter: "" | VehicleStatus = "",
) {
  return apiRequest<VehiclesResponse>(
    `/vehicles?${buildFleetVehiclesQueryString(limit, offset, query, vehicleType, statusFilter)}`,
    { method: "GET" },
    token,
  );
}

export async function fetchAllMatchingVehicles(
  token: string,
  query: string,
  vehicleType: "" | VehicleType = "",
  statusFilter: "" | VehicleStatus = "",
  pageSize = 200,
) {
  const firstPage = await fetchVehiclesPage(token, query, pageSize, 0, vehicleType, statusFilter);
  if (firstPage.total <= firstPage.items.length) {
    return firstPage;
  }

  const items = [...firstPage.items];
  for (let offset = firstPage.items.length; offset < firstPage.total; offset += pageSize) {
    const nextPage = await fetchVehiclesPage(token, query, pageSize, offset, vehicleType, statusFilter);
    items.push(...nextPage.items);
  }

  return {
    ...firstPage,
    items,
    limit: pageSize,
  };
}
