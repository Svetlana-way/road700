import { useEffect, useRef, useState } from "react";
import type { LoadRepairDetailResult } from "./useRepairDetailLoader";
import {
  areAppRoutesEqual,
  buildAppRouteFromState,
  buildAppRouteUrl,
  readAppRoute,
  type AdminTab,
  type AppRoute,
  type FleetViewMode,
  type RepairTab,
  type TechAdminTab,
  type WorkspaceTab,
} from "../shared/appRoute";
import type { UserRole } from "../shared/workspaceBootstrapTypes";

type LoadRepairDetailOptions = {
  silent?: boolean;
  resetTransientState?: boolean;
};

type PendingRepairNavigationKind = "contextual" | "direct" | "internal";

type UseAppNavigationParams = {
  userRole: UserRole | null | undefined;
  token: string | null;
  activeWorkspaceTab: WorkspaceTab;
  setActiveWorkspaceTab: (value: WorkspaceTab) => void;
  activeAdminTab: AdminTab;
  setActiveAdminTab: (value: AdminTab) => void;
  activeTechAdminTab: TechAdminTab;
  setActiveTechAdminTab: (value: TechAdminTab) => void;
  activeRepairTab: RepairTab;
  setActiveRepairTab: (value: RepairTab) => void;
  showTechAdminTab: boolean;
  setShowTechAdminTab: (value: boolean) => void;
  fleetViewMode: FleetViewMode;
  setFleetViewMode: (value: FleetViewMode) => void;
  selectedFleetVehicleId: number | null;
  selectedFleetVehicleMissing: boolean;
  setSelectedFleetVehicleId: (value: number | null) => void;
  selectedRepairId: number | null;
  selectedRepairDefaultDocumentId: number | null;
  selectedDocumentId: number | null;
  setSelectedDocumentId: (value: number | null) => void;
  clearSelectedRepair: () => void;
  loadRepairDetail: (
    token: string,
    repairId: number,
    preferredDocumentId: number | null,
    options?: LoadRepairDetailOptions,
  ) => Promise<LoadRepairDetailResult>;
};

export function useAppNavigation({
  userRole,
  token,
  activeWorkspaceTab,
  setActiveWorkspaceTab,
  activeAdminTab,
  setActiveAdminTab,
  activeTechAdminTab,
  setActiveTechAdminTab,
  activeRepairTab,
  setActiveRepairTab,
  showTechAdminTab,
  setShowTechAdminTab,
  fleetViewMode,
  setFleetViewMode,
  selectedFleetVehicleId,
  selectedFleetVehicleMissing,
  setSelectedFleetVehicleId,
  selectedRepairId,
  selectedRepairDefaultDocumentId,
  selectedDocumentId,
  setSelectedDocumentId,
  clearSelectedRepair,
  loadRepairDetail,
}: UseAppNavigationParams) {
  const [routeSnapshot, setRouteSnapshot] = useState<AppRoute>(() => readAppRoute(window.location));
  const repairReturnTabRef = useRef<WorkspaceTab>("documents");
  const repairReturnRouteRef = useRef<AppRoute>({ workspace: "documents" });
  const repairScrollPositionRef = useRef(0);
  const [repairHasReturnTarget, setRepairHasReturnTarget] = useState(false);
  const loadRepairDetailRef = useRef(loadRepairDetail);
  const routeRepairLoadKeyRef = useRef<string | null>(null);
  const repairRouteSessionKeyRef = useRef<string | null>(null);
  const pendingRepairNavigationKindRef = useRef<PendingRepairNavigationKind | null>(null);

  useEffect(() => {
    loadRepairDetailRef.current = loadRepairDetail;
  }, [loadRepairDetail]);

  function buildRepairRouteLoadKey(repairId: number, documentId: number | null) {
    return `${repairId}:${documentId ?? "none"}`;
  }

  function buildRepairRouteSessionKey(route: AppRoute) {
    if (route.workspace !== "repair") {
      return null;
    }
    return `${route.repairId ?? "none"}:${route.documentId ?? "none"}`;
  }

  function clearRepairReturnTarget() {
    repairReturnTabRef.current = "documents";
    repairReturnRouteRef.current = { workspace: "documents" };
    repairScrollPositionRef.current = 0;
    setRepairHasReturnTarget(false);
  }

  function handleMissingRepairRoute() {
    clearSelectedRepair();
    setSelectedDocumentId(null);
    setActiveRepairTab("overview");
    setActiveWorkspaceTab("documents");
    updateBrowserRoute({ workspace: "documents" });
  }

  function buildRouteFromState(targetWorkspaceTab: WorkspaceTab = activeWorkspaceTab): AppRoute {
    return buildAppRouteFromState(
      {
        activeWorkspaceTab,
        activeAdminTab,
        activeTechAdminTab,
        activeRepairTab,
        fleetViewMode,
        selectedFleetVehicleId,
        selectedRepairId,
        selectedDocumentId,
      },
      targetWorkspaceTab,
    );
  }

  function updateBrowserRoute(route: AppRoute, mode: "push" | "replace" = "replace") {
    const nextUrl = buildAppRouteUrl(route);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== nextUrl) {
      if (mode === "push") {
        window.history.pushState({}, "", nextUrl);
      } else {
        window.history.replaceState({}, "", nextUrl);
      }
    }
    setRouteSnapshot((current) => (areAppRoutesEqual(current, route) ? current : route));
  }

  function handleWorkspaceTabChange(value: WorkspaceTab) {
    if (userRole !== "admin" && (value === "admin" || value === "tech_admin" || value === "audit")) {
      return;
    }
    if (value === activeWorkspaceTab) {
      return;
    }
    if (value === "repair") {
      pendingRepairNavigationKindRef.current = "direct";
      clearRepairReturnTarget();
    }
    setActiveWorkspaceTab(value);
    updateBrowserRoute(buildRouteFromState(value), "push");
  }

  function handleAdminTabChange(value: AdminTab) {
    setActiveAdminTab(value);
    if (activeWorkspaceTab === "admin") {
      updateBrowserRoute({ workspace: "admin", adminTab: value });
    }
  }

  function handleTechAdminTabChange(value: TechAdminTab) {
    setActiveTechAdminTab(value);
    if (activeWorkspaceTab === "tech_admin") {
      updateBrowserRoute({ workspace: "tech_admin", techAdminTab: value });
    }
  }

  function handleRepairTabChange(value: RepairTab) {
    setActiveRepairTab(value);
    if (activeWorkspaceTab === "repair") {
      pendingRepairNavigationKindRef.current = "internal";
      updateBrowserRoute({
        workspace: "repair",
        repairId: selectedRepairId,
        repairTab: value,
        documentId: selectedDocumentId,
      });
    }
  }

  function openAdminTab(value: AdminTab) {
    if (userRole !== "admin") {
      return;
    }
    setActiveWorkspaceTab("admin");
    setActiveAdminTab(value);
    updateBrowserRoute({ workspace: "admin", adminTab: value }, "push");
  }

  function openTechAdmin(tab: TechAdminTab = "learning") {
    if (userRole !== "admin") {
      return;
    }
    setShowTechAdminTab(true);
    setActiveWorkspaceTab("tech_admin");
    setActiveTechAdminTab(tab);
    updateBrowserRoute({ workspace: "tech_admin", techAdminTab: tab }, "push");
  }

  function closeTechAdmin() {
    setShowTechAdminTab(false);
    setActiveTechAdminTab("learning");
    setActiveWorkspaceTab("admin");
    updateBrowserRoute({ workspace: "admin", adminTab: activeAdminTab }, "push");
  }

  function openReviewRulesAdmin() {
    openAdminTab("control");
  }

  function openLaborNormsAdmin() {
    openAdminTab("labor_norms");
  }

  async function openRepairByIds(documentId: number | null, repairId: number) {
    pendingRepairNavigationKindRef.current = activeWorkspaceTab !== "repair" ? "contextual" : "internal";
    if (activeWorkspaceTab !== "repair") {
      repairReturnTabRef.current = activeWorkspaceTab;
      repairReturnRouteRef.current = buildRouteFromState(activeWorkspaceTab);
      repairScrollPositionRef.current = window.scrollY;
      setRepairHasReturnTarget(true);
    }
    setActiveWorkspaceTab("repair");
    setActiveRepairTab("overview");
    updateBrowserRoute({ workspace: "repair", repairId, repairTab: "overview", documentId }, "push");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (!token) {
      return;
    }
    const routeLoadKey = buildRepairRouteLoadKey(repairId, documentId);
    routeRepairLoadKeyRef.current = routeLoadKey;
    try {
      const result = await loadRepairDetailRef.current(token, repairId, documentId, { resetTransientState: true });
      if (result === "not_found") {
        handleMissingRepairRoute();
      }
    } finally {
      if (routeRepairLoadKeyRef.current === routeLoadKey) {
        routeRepairLoadKeyRef.current = null;
      }
    }
  }

  function returnFromRepairPage() {
    const hasReturnTarget = repairHasReturnTarget;
    const nextTab = hasReturnTarget ? repairReturnTabRef.current : "documents";
    const nextRoute = hasReturnTarget ? repairReturnRouteRef.current : ({ workspace: "documents" } as const);
    const nextScrollPosition = hasReturnTarget ? repairScrollPositionRef.current : 0;
    pendingRepairNavigationKindRef.current = null;
    repairRouteSessionKeyRef.current = null;
    clearRepairReturnTarget();
    setActiveWorkspaceTab(nextTab);
    updateBrowserRoute(nextRoute, "push");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: nextScrollPosition, behavior: "auto" });
    });
  }

  useEffect(() => {
    if (token) {
      return;
    }
    const defaultRoute: AppRoute = { workspace: "documents" };
    if (!areAppRoutesEqual(routeSnapshot, defaultRoute)) {
      updateBrowserRoute(defaultRoute);
    }
  }, [routeSnapshot, token]);

  useEffect(() => {
    if (userRole == null || userRole === "admin") {
      return;
    }
    if (activeWorkspaceTab === "admin" || activeWorkspaceTab === "tech_admin" || activeWorkspaceTab === "audit") {
      setActiveWorkspaceTab("documents");
    }
    if (showTechAdminTab) {
      setShowTechAdminTab(false);
    }
  }, [activeWorkspaceTab, setActiveWorkspaceTab, setShowTechAdminTab, showTechAdminTab, userRole]);

  useEffect(() => {
    const handlePopState = () => {
      setRouteSnapshot(readAppRoute(window.location));
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    const repairRouteSessionKey = buildRepairRouteSessionKey(routeSnapshot);

    if (repairRouteSessionKey === null) {
      pendingRepairNavigationKindRef.current = null;
      repairRouteSessionKeyRef.current = null;
      if (repairHasReturnTarget) {
        clearRepairReturnTarget();
      }
      return;
    }

    const previousRepairRouteSessionKey = repairRouteSessionKeyRef.current;
    if (
      previousRepairRouteSessionKey !== null &&
      previousRepairRouteSessionKey !== repairRouteSessionKey &&
      pendingRepairNavigationKindRef.current === null &&
      repairHasReturnTarget
    ) {
      clearRepairReturnTarget();
    }

    repairRouteSessionKeyRef.current = repairRouteSessionKey;
    pendingRepairNavigationKindRef.current = null;
  }, [repairHasReturnTarget, routeSnapshot]);

  useEffect(() => {
    if (routeSnapshot.workspace !== "fleet" || routeSnapshot.vehicleId === null || !selectedFleetVehicleMissing) {
      return;
    }
    if (selectedFleetVehicleId !== null) {
      setSelectedFleetVehicleId(null);
    }
    if (fleetViewMode !== "list") {
      setFleetViewMode("list");
    }
    updateBrowserRoute({ workspace: "fleet", vehicleId: null });
  }, [
    fleetViewMode,
    routeSnapshot,
    selectedFleetVehicleId,
    selectedFleetVehicleMissing,
    setFleetViewMode,
    setSelectedFleetVehicleId,
  ]);

  useEffect(() => {
    if (routeSnapshot.workspace === "documents") {
      if (activeWorkspaceTab !== "documents") {
        setActiveWorkspaceTab("documents");
      }
      return;
    }

    if (routeSnapshot.workspace === "search") {
      if (activeWorkspaceTab !== "search") {
        setActiveWorkspaceTab("search");
      }
      return;
    }

    if (routeSnapshot.workspace === "audit") {
      if (userRole != null && userRole !== "admin") {
        updateBrowserRoute({ workspace: "documents" });
        return;
      }
      if (activeWorkspaceTab !== "audit") {
        setActiveWorkspaceTab("audit");
      }
      return;
    }

    if (routeSnapshot.workspace === "admin") {
      if (userRole != null && userRole !== "admin") {
        updateBrowserRoute({ workspace: "documents" });
        return;
      }
      if (activeWorkspaceTab !== "admin") {
        setActiveWorkspaceTab("admin");
      }
      if (activeAdminTab !== routeSnapshot.adminTab) {
        setActiveAdminTab(routeSnapshot.adminTab);
      }
      return;
    }

    if (routeSnapshot.workspace === "tech_admin") {
      if (userRole != null && userRole !== "admin") {
        updateBrowserRoute({ workspace: "documents" });
        return;
      }
      if (!showTechAdminTab) {
        setShowTechAdminTab(true);
      }
      if (activeWorkspaceTab !== "tech_admin") {
        setActiveWorkspaceTab("tech_admin");
      }
      if (activeTechAdminTab !== routeSnapshot.techAdminTab) {
        setActiveTechAdminTab(routeSnapshot.techAdminTab);
      }
      return;
    }

    if (routeSnapshot.workspace === "fleet") {
      if (activeWorkspaceTab !== "fleet") {
        setActiveWorkspaceTab("fleet");
      }
      if (routeSnapshot.vehicleId !== null && selectedFleetVehicleId !== routeSnapshot.vehicleId) {
        setSelectedFleetVehicleId(routeSnapshot.vehicleId);
      }
      if (fleetViewMode !== (routeSnapshot.vehicleId !== null ? "detail" : "list")) {
        setFleetViewMode(routeSnapshot.vehicleId !== null ? "detail" : "list");
      }
      return;
    }

    if (activeWorkspaceTab !== "repair") {
      setActiveWorkspaceTab("repair");
    }
    if (activeRepairTab !== routeSnapshot.repairTab) {
      setActiveRepairTab(routeSnapshot.repairTab);
    }
    if (routeSnapshot.documentId !== null && selectedDocumentId !== routeSnapshot.documentId) {
      setSelectedDocumentId(routeSnapshot.documentId);
    }
    if (routeSnapshot.repairId === null) {
      if (selectedDocumentId !== null) {
        setSelectedDocumentId(null);
      }
      clearSelectedRepair();
      return;
    }
    if (!token) {
      return;
    }
    const repairMatches = selectedRepairId === routeSnapshot.repairId;
    const routeWithoutDocumentShouldResetSelection =
      repairMatches &&
      routeSnapshot.documentId === null &&
      selectedDocumentId !== selectedRepairDefaultDocumentId;

    if (routeWithoutDocumentShouldResetSelection) {
      const routeLoadKey = buildRepairRouteLoadKey(routeSnapshot.repairId, routeSnapshot.documentId);
      if (routeRepairLoadKeyRef.current === routeLoadKey) {
        return;
      }
      routeRepairLoadKeyRef.current = routeLoadKey;
      void loadRepairDetailRef
        .current(token, routeSnapshot.repairId, null, {
          silent: true,
          resetTransientState: false,
        })
        .then((result) => {
          if (result === "not_found") {
            handleMissingRepairRoute();
          }
        })
        .finally(() => {
          if (routeRepairLoadKeyRef.current === routeLoadKey) {
            routeRepairLoadKeyRef.current = null;
          }
        });
      return;
    }

    const documentMatches = routeSnapshot.documentId === null || selectedDocumentId === routeSnapshot.documentId;
    if (!repairMatches || !documentMatches) {
      const routeLoadKey = buildRepairRouteLoadKey(routeSnapshot.repairId, routeSnapshot.documentId);
      if (routeRepairLoadKeyRef.current === routeLoadKey) {
        return;
      }
      routeRepairLoadKeyRef.current = routeLoadKey;
      void loadRepairDetailRef
        .current(token, routeSnapshot.repairId, routeSnapshot.documentId, {
          silent: repairMatches,
          resetTransientState: !repairMatches,
        })
        .then((result) => {
          if (result === "not_found") {
            handleMissingRepairRoute();
          }
        })
        .finally(() => {
          if (routeRepairLoadKeyRef.current === routeLoadKey) {
            routeRepairLoadKeyRef.current = null;
          }
        });
    }
  }, [
    activeAdminTab,
    activeRepairTab,
    activeTechAdminTab,
    activeWorkspaceTab,
    fleetViewMode,
    routeSnapshot,
    selectedDocumentId,
    selectedFleetVehicleId,
    selectedFleetVehicleMissing,
    selectedRepairId,
    selectedRepairDefaultDocumentId,
    setActiveAdminTab,
    setActiveRepairTab,
    setActiveTechAdminTab,
    setActiveWorkspaceTab,
    setFleetViewMode,
    setSelectedDocumentId,
    setSelectedFleetVehicleId,
    setShowTechAdminTab,
    showTechAdminTab,
    token,
    userRole,
  ]);

  useEffect(() => {
    if (!token) {
      setRepairHasReturnTarget(false);
    }
  }, [token]);

  return {
    repairHasReturnTarget,
    repairReturnTab: repairReturnTabRef.current,
    updateBrowserRoute,
    handleWorkspaceTabChange,
    handleAdminTabChange,
    handleTechAdminTabChange,
    handleRepairTabChange,
    openAdminTab,
    openTechAdmin,
    closeTechAdmin,
    openReviewRulesAdmin,
    openLaborNormsAdmin,
    openRepairByIds,
    returnFromRepairPage,
  };
}
