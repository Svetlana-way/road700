import { formatStatus } from "../../shared/formattersCore";

export type VehicleTypeFormatter = "truck" | "trailer";
export type VehicleStatusFormatter = "active" | "in_repair" | "waiting_repair" | "inactive" | "decommissioned" | "archived";

export function formatVehicleTypeLabel(value: VehicleTypeFormatter | "" | null | undefined) {
  if (value === "truck") {
    return "Грузовик";
  }
  if (value === "trailer") {
    return "Прицеп";
  }
  return "Любой";
}

export function formatVehicleStatusLabel(value: string | null | undefined) {
  if (!value) {
    return "Не указан";
  }
  const labels: Record<string, string> = {
    active: "В работе",
    in_repair: "В ремонте",
    waiting_repair: "Ожидает ремонта",
    inactive: "Не используется",
    decommissioned: "Списан",
    archived: "Архив",
  };
  return labels[value] || formatStatus(value);
}

export function vehicleStatusColor(status: VehicleStatusFormatter | string): "default" | "success" | "warning" | "error" {
  if (status === "active") {
    return "success";
  }
  if (status === "in_repair" || status === "waiting_repair") {
    return "warning";
  }
  if (status === "decommissioned") {
    return "error";
  }
  return "default";
}
