import { useEffect, useRef, useState } from "react";
import { apiRequest, downloadApiFile } from "../shared/api";
import type { AppRoute, WorkspaceTab } from "../shared/appRoute";
import { buildFleetVehiclesQueryString } from "../shared/queryBuilders";
import type { Vehicle, VehicleDetail, VehicleStatus, VehicleType, VehiclesResponse } from "../shared/workspaceBootstrapTypes";

type VehicleUpdatePayload = {
  status?: VehicleStatus;
  comment?: string | null;
};

type UseFleetWorkspaceParams = {
  token: string;
  activeWorkspaceTab: WorkspaceTab;
  vehiclesFullListLimit: number;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
};

type RouteUpdater = (route: AppRoute, mode?: "push" | "replace") => void;

export function useFleetWorkspace({
  token,
  activeWorkspaceTab,
  vehiclesFullListLimit,
  setErrorMessage,
  setSuccessMessage,
}: UseFleetWorkspaceParams) {
  const [fleetVehicles, setFleetVehicles] = useState<Vehicle[]>([]);
  const [fleetVehiclesTotal, setFleetVehiclesTotal] = useState(0);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [fleetQuery, setFleetQuery] = useState("");
  const [fleetVehicleTypeFilter, setFleetVehicleTypeFilter] = useState<"" | VehicleType>("");
  const [fleetStatusFilter, setFleetStatusFilter] = useState<"" | VehicleStatus>("");
  const [selectedFleetVehicleId, setSelectedFleetVehicleId] = useState<number | null>(null);
  const [selectedFleetVehicle, setSelectedFleetVehicle] = useState<VehicleDetail | null>(null);
  const [selectedFleetVehicleLoading, setSelectedFleetVehicleLoading] = useState(false);
  const [fleetViewMode, setFleetViewMode] = useState<"list" | "detail">("list");
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [vehicleExportLoading, setVehicleExportLoading] = useState(false);
  const fleetListScrollPositionRef = useRef(0);

  async function loadFleetVehicles(
    query: string = fleetQuery,
    vehicleType: "" | VehicleType = fleetVehicleTypeFilter,
    statusFilter: "" | VehicleStatus = fleetStatusFilter,
  ) {
    if (!token) {
      return;
    }
    setFleetLoading(true);
    try {
      const payload = await apiRequest<VehiclesResponse>(
        `/vehicles?${buildFleetVehiclesQueryString(vehiclesFullListLimit, query, vehicleType, statusFilter)}`,
        { method: "GET" },
        token,
      );
      setFleetVehicles(payload.items);
      setFleetVehiclesTotal(payload.total);
      setSelectedFleetVehicleId((current) => {
        if (current && payload.items.some((item) => item.id === current)) {
          return current;
        }
        return payload.items[0]?.id ?? null;
      });
    } finally {
      setFleetLoading(false);
    }
  }

  async function loadFleetVehicleDetail(vehicleId: number) {
    if (!token) {
      return;
    }
    setSelectedFleetVehicleLoading(true);
    try {
      const payload = await apiRequest<VehicleDetail>(`/vehicles/${vehicleId}`, { method: "GET" }, token);
      setSelectedFleetVehicle(payload);
    } finally {
      setSelectedFleetVehicleLoading(false);
    }
  }

  function applyBootstrapVehicleList(vehicleList: VehiclesResponse) {
    setFleetVehicles(vehicleList.items);
    setFleetVehiclesTotal(vehicleList.total);
    setSelectedFleetVehicleId((current) => current ?? vehicleList.items[0]?.id ?? null);
  }

  function openFleetVehicleCard(vehicleId: number, updateBrowserRoute: RouteUpdater) {
    fleetListScrollPositionRef.current = window.scrollY;
    setSelectedFleetVehicleId(vehicleId);
    setFleetViewMode("detail");
    updateBrowserRoute({ workspace: "fleet", vehicleId }, "push");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function returnToFleetList(updateBrowserRoute: RouteUpdater) {
    setFleetViewMode("list");
    updateBrowserRoute({ workspace: "fleet", vehicleId: null }, "push");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: fleetListScrollPositionRef.current, behavior: "auto" });
    });
  }

  function openFleetVehicleById(
    vehicleId: number,
    setActiveWorkspaceTab: (workspaceTab: WorkspaceTab) => void,
    updateBrowserRoute: RouteUpdater,
  ) {
    setActiveWorkspaceTab("fleet");
    setSelectedFleetVehicleId(vehicleId);
    setFleetViewMode("detail");
    updateBrowserRoute({ workspace: "fleet", vehicleId }, "push");
  }

  async function handleUpdateVehicle(payload: VehicleUpdatePayload) {
    if (!token || !selectedFleetVehicle) {
      return;
    }
    setVehicleSaving(true);
    setErrorMessage("");
    try {
      const result = await apiRequest<VehicleDetail>(
        `/vehicles/${selectedFleetVehicle.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        token,
      );
      setSelectedFleetVehicle(result);
      setSuccessMessage(payload.status === "archived" ? "Техника отправлена в архив" : "Карточка техники обновлена");
      await loadFleetVehicles();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось обновить карточку техники");
    } finally {
      setVehicleSaving(false);
    }
  }

  async function handleExportVehicle() {
    if (!token || !selectedFleetVehicle) {
      return;
    }
    setVehicleExportLoading(true);
    setErrorMessage("");
    try {
      await downloadApiFile(`/vehicles/${selectedFleetVehicle.id}/export`, token, `vehicle_${selectedFleetVehicle.id}.xlsx`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось выгрузить карточку техники");
    } finally {
      setVehicleExportLoading(false);
    }
  }

  function resetFleetState() {
    setFleetVehicles([]);
    setFleetVehiclesTotal(0);
    setFleetLoading(false);
    setFleetQuery("");
    setFleetVehicleTypeFilter("");
    setFleetStatusFilter("");
    setSelectedFleetVehicleId(null);
    setSelectedFleetVehicle(null);
    setSelectedFleetVehicleLoading(false);
    setFleetViewMode("list");
    setVehicleSaving(false);
    setVehicleExportLoading(false);
    fleetListScrollPositionRef.current = 0;
  }

  useEffect(() => {
    if (!token || activeWorkspaceTab !== "fleet") {
      return;
    }
    void loadFleetVehicles().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить список техники");
    });
  }, [activeWorkspaceTab, token]);

  useEffect(() => {
    if (!token || activeWorkspaceTab !== "fleet" || selectedFleetVehicleId === null) {
      setSelectedFleetVehicle(null);
      return;
    }
    void loadFleetVehicleDetail(selectedFleetVehicleId).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить карточку техники");
    });
  }, [activeWorkspaceTab, selectedFleetVehicleId, token]);

  return {
    fleetVehicles,
    fleetVehiclesTotal,
    fleetLoading,
    fleetQuery,
    setFleetQuery,
    fleetVehicleTypeFilter,
    setFleetVehicleTypeFilter,
    fleetStatusFilter,
    setFleetStatusFilter,
    selectedFleetVehicleId,
    setSelectedFleetVehicleId,
    selectedFleetVehicle,
    selectedFleetVehicleLoading,
    fleetViewMode,
    setFleetViewMode,
    vehicleSaving,
    vehicleExportLoading,
    loadFleetVehicles,
    applyBootstrapVehicleList,
    openFleetVehicleCard,
    returnToFleetList,
    openFleetVehicleById,
    handleUpdateVehicle,
    handleExportVehicle,
    resetFleetState,
  };
}
