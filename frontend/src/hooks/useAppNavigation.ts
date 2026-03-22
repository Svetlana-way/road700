import { useEffect, useRef, useState } from "react";
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
  setSelectedFleetVehicleId: (value: number | null) => void;
  selectedRepairId: number | null;
  selectedDocumentId: number | null;
  setSelectedDocumentId: (value: number | null) => void;
  loadRepairDetail: (
    token: string,
    repairId: number,
    preferredDocumentId: number | null,
    options?: LoadRepairDetailOptions,
  ) => Promise<void>;
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
  setSelectedFleetVehicleId,
  selectedRepairId,
  selectedDocumentId,
  setSelectedDocumentId,
  loadRepairDetail,
}: UseAppNavigationParams) {
  const [routeSnapshot, setRouteSnapshot] = useState<AppRoute>(() => readAppRoute(window.location));
  const repairReturnTabRef = useRef<WorkspaceTab>("documents");
  const repairReturnRouteRef = useRef<AppRoute>({ workspace: "documents" });
  const repairScrollPositionRef = useRef(0);
  const [repairHasReturnTarget, setRepairHasReturnTarget] = useState(false);
  const loadRepairDetailRef = useRef(loadRepairDetail);

  useEffect(() => {
    loadRepairDetailRef.current = loadRepairDetail;
  }, [loadRepairDetail]);

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
    if (value === activeWorkspaceTab) {
      return;
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
      updateBrowserRoute({
        workspace: "repair",
        repairId: selectedRepairId,
        repairTab: value,
        documentId: selectedDocumentId,
      });
    }
  }

  function openAdminTab(value: AdminTab) {
    setActiveWorkspaceTab("admin");
    setActiveAdminTab(value);
    updateBrowserRoute({ workspace: "admin", adminTab: value }, "push");
  }

  function openTechAdmin(tab: TechAdminTab = "learning") {
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
    await loadRepairDetailRef.current(token, repairId, documentId, { resetTransientState: true });
  }

  function returnFromRepairPage() {
    const nextTab = repairHasReturnTarget ? repairReturnTabRef.current : "documents";
    const nextRoute = repairHasReturnTarget ? repairReturnRouteRef.current : ({ workspace: "documents" } as const);
    setActiveWorkspaceTab(nextTab);
    updateBrowserRoute(nextRoute, "push");
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: repairHasReturnTarget ? repairScrollPositionRef.current : 0, behavior: "auto" });
    });
  }

  useEffect(() => {
    if (userRole === "admin") {
      return;
    }
    if (activeWorkspaceTab === "admin" || activeWorkspaceTab === "tech_admin") {
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
      if (activeWorkspaceTab !== "audit") {
        setActiveWorkspaceTab("audit");
      }
      return;
    }

    if (routeSnapshot.workspace === "admin") {
      if (userRole !== "admin") {
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
      if (userRole !== "admin") {
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
    if (!token || routeSnapshot.repairId === null) {
      return;
    }
    const repairMatches = selectedRepairId === routeSnapshot.repairId;
    const documentMatches = routeSnapshot.documentId === null || selectedDocumentId === routeSnapshot.documentId;
    if (!repairMatches || !documentMatches) {
      void loadRepairDetailRef.current(token, routeSnapshot.repairId, routeSnapshot.documentId, {
        silent: repairMatches,
        resetTransientState: !repairMatches,
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
    selectedRepairId,
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
