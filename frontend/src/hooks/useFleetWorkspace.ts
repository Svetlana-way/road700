import { useEffect, useRef, useState } from "react";
import { ApiError, apiRequest, downloadApiFile } from "../shared/api";
import type { AppRoute, WorkspaceTab } from "../shared/appRoute";
import { buildFleetVehiclesQueryString } from "../shared/queryBuilders";
import type { UserRole, Vehicle, VehicleDetail, VehicleStatus, VehicleType, VehiclesResponse } from "../shared/workspaceBootstrapTypes";

type VehicleUpdatePayload = {
  status?: VehicleStatus;
  comment?: string | null;
};

type UseFleetWorkspaceParams = {
  token: string;
  userRole: UserRole | null | undefined;
  activeWorkspaceTab: WorkspaceTab;
  vehiclesFullListLimit: number;
  setErrorMessage: (message: string) => void;
  setSuccessMessage: (message: string) => void;
};

type RouteUpdater = (route: AppRoute, mode?: "push" | "replace") => void;

export function useFleetWorkspace({
  token,
  userRole,
  activeWorkspaceTab,
  vehiclesFullListLimit,
  setErrorMessage,
  setSuccessMessage,
}: UseFleetWorkspaceParams) {
  const [vehicleOptions, setVehicleOptions] = useState<Vehicle[]>([]);
  const [fleetVehicles, setFleetVehicles] = useState<Vehicle[]>([]);
  const [fleetVehiclesTotal, setFleetVehiclesTotal] = useState(0);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [fleetQuery, setFleetQuery] = useState("");
  const [fleetVehicleTypeFilter, setFleetVehicleTypeFilter] = useState<"" | VehicleType>("");
  const [fleetStatusFilter, setFleetStatusFilter] = useState<"" | VehicleStatus>("");
  const [selectedFleetVehicleId, setSelectedFleetVehicleId] = useState<number | null>(null);
  const [selectedFleetVehicle, setSelectedFleetVehicle] = useState<VehicleDetail | null>(null);
  const [selectedFleetVehicleLoading, setSelectedFleetVehicleLoading] = useState(false);
  const [selectedFleetVehicleMissing, setSelectedFleetVehicleMissing] = useState(false);
  const [fleetViewMode, setFleetViewMode] = useState<"list" | "detail">("list");
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [vehicleExportLoading, setVehicleExportLoading] = useState(false);
  const [vehiclePdfExportLoading, setVehiclePdfExportLoading] = useState(false);
  const fleetListScrollPositionRef = useRef(0);
  const fleetListRequestIdRef = useRef(0);
  const vehicleOptionsRequestIdRef = useRef(0);
  const selectedFleetVehicleRequestIdRef = useRef(0);
  const vehicleOptionsInitializedRef = useRef(false);

  useEffect(() => {
    setSelectedFleetVehicleLoading(false);
    setSelectedFleetVehicleMissing(false);
    setVehicleSaving(false);
    setVehicleExportLoading(false);
    setVehiclePdfExportLoading(false);
  }, [selectedFleetVehicleId]);

  async function loadFleetVehicles(
    query: string = fleetQuery,
    vehicleType: "" | VehicleType = fleetVehicleTypeFilter,
    statusFilter: "" | VehicleStatus = fleetStatusFilter,
  ) {
    if (!token) {
      return;
    }
    const requestId = fleetListRequestIdRef.current + 1;
    fleetListRequestIdRef.current = requestId;
    setFleetLoading(true);
    try {
      const payload = await apiRequest<VehiclesResponse>(
        `/vehicles?${buildFleetVehiclesQueryString(vehiclesFullListLimit, query, vehicleType, statusFilter)}`,
        { method: "GET" },
        token,
      );
      if (fleetListRequestIdRef.current !== requestId) {
        return;
      }
      if (!query && !vehicleType && !statusFilter) {
        vehicleOptionsInitializedRef.current = true;
        setVehicleOptions(payload.items);
      }
      setFleetVehicles(payload.items);
      setFleetVehiclesTotal(payload.total);
      setSelectedFleetVehicleId((current) => {
        if (current && payload.items.some((item) => item.id === current)) {
          return current;
        }
        return payload.items[0]?.id ?? null;
      });
    } catch (error) {
      if (fleetListRequestIdRef.current !== requestId) {
        return;
      }
      throw error;
    } finally {
      if (fleetListRequestIdRef.current === requestId) {
        setFleetLoading(false);
      }
    }
  }

  async function loadVehicleOptions() {
    if (!token) {
      return;
    }
    const requestId = vehicleOptionsRequestIdRef.current + 1;
    vehicleOptionsRequestIdRef.current = requestId;
    const payload = await apiRequest<VehiclesResponse>(
      `/vehicles?${buildFleetVehiclesQueryString(vehiclesFullListLimit, "", "", "")}`,
      { method: "GET" },
      token,
    );
    if (vehicleOptionsRequestIdRef.current !== requestId) {
      return;
    }
    vehicleOptionsInitializedRef.current = true;
    setVehicleOptions(payload.items);
  }

  async function loadFleetVehicleDetail(vehicleId: number) {
    if (!token) {
      return;
    }
    const requestId = selectedFleetVehicleRequestIdRef.current + 1;
    selectedFleetVehicleRequestIdRef.current = requestId;
    setSelectedFleetVehicleLoading(true);
    setSelectedFleetVehicleMissing(false);
    try {
      const payload = await apiRequest<VehicleDetail>(`/vehicles/${vehicleId}`, { method: "GET" }, token);
      if (selectedFleetVehicleRequestIdRef.current !== requestId) {
        return;
      }
      setSelectedFleetVehicle(payload);
    } catch (error) {
      if (selectedFleetVehicleRequestIdRef.current !== requestId) {
        return;
      }
      setSelectedFleetVehicle(null);
      if (error instanceof ApiError && error.status === 404) {
        setSelectedFleetVehicleMissing(true);
        return;
      }
      throw error;
    } finally {
      if (selectedFleetVehicleRequestIdRef.current === requestId) {
        setSelectedFleetVehicleLoading(false);
      }
    }
  }

  function applyBootstrapVehicleList(vehicleList: VehiclesResponse | null) {
    if (vehicleList === null) {
      return;
    }
    vehicleOptionsInitializedRef.current = true;
    setVehicleOptions(vehicleList.items);
    setFleetVehicles(vehicleList.items);
    setFleetVehiclesTotal(vehicleList.total);
    setSelectedFleetVehicleId((current) => {
      if (current !== null && vehicleList.items.some((item) => item.id === current)) {
        return current;
      }
      return vehicleList.items[0]?.id ?? null;
    });
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
    if (userRole !== "admin") {
      setErrorMessage("Изменение статуса техники доступно только администратору");
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

  async function handleExportVehiclePdf() {
    if (!token || !selectedFleetVehicle) {
      return;
    }
    setVehiclePdfExportLoading(true);
    setErrorMessage("");
    try {
      await downloadApiFile(`/vehicles/${selectedFleetVehicle.id}/export.pdf`, token, `vehicle_${selectedFleetVehicle.id}.pdf`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось выгрузить карточку техники в PDF");
    } finally {
      setVehiclePdfExportLoading(false);
    }
  }

  function resetFleetState() {
    fleetListRequestIdRef.current += 1;
    vehicleOptionsRequestIdRef.current += 1;
    vehicleOptionsInitializedRef.current = false;
    selectedFleetVehicleRequestIdRef.current += 1;
    setVehicleOptions([]);
    setFleetVehicles([]);
    setFleetVehiclesTotal(0);
    setFleetLoading(false);
    setFleetQuery("");
    setFleetVehicleTypeFilter("");
    setFleetStatusFilter("");
    setSelectedFleetVehicleId(null);
    setSelectedFleetVehicle(null);
    setSelectedFleetVehicleLoading(false);
    setSelectedFleetVehicleMissing(false);
    setFleetViewMode("list");
    setVehicleSaving(false);
    setVehicleExportLoading(false);
    setVehiclePdfExportLoading(false);
    fleetListScrollPositionRef.current = 0;
  }

  useEffect(() => {
    if (!token || activeWorkspaceTab !== "documents") {
      vehicleOptionsRequestIdRef.current += 1;
      return;
    }
    if (vehicleOptionsInitializedRef.current) {
      return;
    }
    void loadVehicleOptions().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить список техники");
    });
  }, [activeWorkspaceTab, setErrorMessage, token]);

  useEffect(() => {
    if (!token || activeWorkspaceTab !== "fleet") {
      fleetListRequestIdRef.current += 1;
      setFleetLoading(false);
      return;
    }
    void loadFleetVehicles().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить список техники");
    });
  }, [activeWorkspaceTab, token]);

  useEffect(() => {
    if (!token || activeWorkspaceTab !== "fleet" || selectedFleetVehicleId === null) {
      selectedFleetVehicleRequestIdRef.current += 1;
      setSelectedFleetVehicle(null);
      setSelectedFleetVehicleLoading(false);
      setSelectedFleetVehicleMissing(false);
      return;
    }
    void loadFleetVehicleDetail(selectedFleetVehicleId).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Не удалось загрузить карточку техники");
    });
  }, [activeWorkspaceTab, selectedFleetVehicleId, token]);

  return {
    vehicleOptions,
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
    selectedFleetVehicleMissing,
    fleetViewMode,
    setFleetViewMode,
    vehicleSaving,
    vehicleExportLoading,
    vehiclePdfExportLoading,
    loadFleetVehicles,
    applyBootstrapVehicleList,
    openFleetVehicleCard,
    returnToFleetList,
    openFleetVehicleById,
    handleUpdateVehicle,
    handleExportVehicle,
    handleExportVehiclePdf,
    resetFleetState,
  };
}
