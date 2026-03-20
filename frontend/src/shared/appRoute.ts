export type WorkspaceTab = "documents" | "repair" | "admin" | "tech_admin" | "fleet" | "search" | "audit";
export type AdminTab = "services" | "control" | "labor_norms" | "imports" | "employees" | "backups";
export type TechAdminTab = "learning" | "matchers" | "rules";
export type RepairTab = "overview" | "works" | "parts" | "documents" | "checks" | "history";
export type FleetViewMode = "list" | "detail";

export type AppRoute =
  | { workspace: "documents" }
  | { workspace: "search" }
  | { workspace: "audit" }
  | { workspace: "admin"; adminTab: AdminTab }
  | { workspace: "tech_admin"; techAdminTab: TechAdminTab }
  | { workspace: "fleet"; vehicleId: number | null }
  | { workspace: "repair"; repairId: number | null; repairTab: RepairTab; documentId: number | null };

export type AppRouteStateSnapshot = {
  activeWorkspaceTab: WorkspaceTab;
  activeAdminTab: AdminTab;
  activeTechAdminTab: TechAdminTab;
  activeRepairTab: RepairTab;
  fleetViewMode: FleetViewMode;
  selectedFleetVehicleId: number | null;
  selectedRepairId: number | null;
  selectedDocumentId: number | null;
};

function normalizeAdminTab(value: string | null): AdminTab {
  if (value === "employees" || value === "control" || value === "labor_norms" || value === "imports" || value === "backups") {
    return value;
  }
  return "services";
}

function normalizeTechAdminTab(value: string | null): TechAdminTab {
  if (value === "matchers" || value === "rules") {
    return value;
  }
  return "learning";
}

function normalizeRepairTab(value: string | null): RepairTab {
  if (value === "works" || value === "parts" || value === "documents" || value === "checks" || value === "history") {
    return value;
  }
  return "overview";
}

function parsePositiveId(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function readAppRoute(location: Location): AppRoute {
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const searchParams = new URLSearchParams(location.search);

  if (pathSegments[0] === "search") {
    return { workspace: "search" };
  }
  if (pathSegments[0] === "audit") {
    return { workspace: "audit" };
  }
  if (pathSegments[0] === "admin") {
    return { workspace: "admin", adminTab: normalizeAdminTab(pathSegments[1] ?? null) };
  }
  if (pathSegments[0] === "tech-admin") {
    return { workspace: "tech_admin", techAdminTab: normalizeTechAdminTab(pathSegments[1] ?? null) };
  }
  if (pathSegments[0] === "fleet") {
    return { workspace: "fleet", vehicleId: parsePositiveId(pathSegments[1]) };
  }
  if (pathSegments[0] === "repair") {
    return {
      workspace: "repair",
      repairId: null,
      repairTab: normalizeRepairTab(searchParams.get("tab")),
      documentId: parsePositiveId(searchParams.get("document")),
    };
  }
  if (pathSegments[0] === "repairs") {
    return {
      workspace: "repair",
      repairId: parsePositiveId(pathSegments[1]),
      repairTab: normalizeRepairTab(searchParams.get("tab")),
      documentId: parsePositiveId(searchParams.get("document")),
    };
  }
  if (pathSegments[0] === "documents") {
    return { workspace: "documents" };
  }

  return { workspace: "documents" };
}

export function buildAppRouteUrl(route: AppRoute): string {
  if (route.workspace === "documents") {
    return "/documents";
  }
  if (route.workspace === "search") {
    return "/search";
  }
  if (route.workspace === "audit") {
    return "/audit";
  }
  if (route.workspace === "admin") {
    return `/admin/${route.adminTab}`;
  }
  if (route.workspace === "tech_admin") {
    return `/tech-admin/${route.techAdminTab}`;
  }
  if (route.workspace === "fleet") {
    return route.vehicleId ? `/fleet/${route.vehicleId}` : "/fleet";
  }

  const params = new URLSearchParams();
  if (route.repairTab !== "overview") {
    params.set("tab", route.repairTab);
  }
  if (route.documentId !== null) {
    params.set("document", String(route.documentId));
  }
  const query = params.toString();
  const path = route.repairId ? `/repairs/${route.repairId}` : "/repair";
  return query ? `${path}?${query}` : path;
}

export function buildAppRouteFromState(
  state: AppRouteStateSnapshot,
  targetWorkspaceTab: WorkspaceTab = state.activeWorkspaceTab,
): AppRoute {
  if (targetWorkspaceTab === "admin") {
    return { workspace: "admin", adminTab: state.activeAdminTab };
  }
  if (targetWorkspaceTab === "tech_admin") {
    return { workspace: "tech_admin", techAdminTab: state.activeTechAdminTab };
  }
  if (targetWorkspaceTab === "fleet") {
    return {
      workspace: "fleet",
      vehicleId: state.fleetViewMode === "detail" ? state.selectedFleetVehicleId : null,
    };
  }
  if (targetWorkspaceTab === "repair") {
    return {
      workspace: "repair",
      repairId: state.selectedRepairId,
      repairTab: state.activeRepairTab,
      documentId: state.selectedDocumentId,
    };
  }
  if (targetWorkspaceTab === "search") {
    return { workspace: "search" };
  }
  if (targetWorkspaceTab === "audit") {
    return { workspace: "audit" };
  }
  return { workspace: "documents" };
}

export function areAppRoutesEqual(left: AppRoute, right: AppRoute) {
  if (left.workspace !== right.workspace) {
    return false;
  }
  if (left.workspace === "admin" && right.workspace === "admin") {
    return left.adminTab === right.adminTab;
  }
  if (left.workspace === "tech_admin" && right.workspace === "tech_admin") {
    return left.techAdminTab === right.techAdminTab;
  }
  if (left.workspace === "fleet" && right.workspace === "fleet") {
    return left.vehicleId === right.vehicleId;
  }
  if (left.workspace === "repair" && right.workspace === "repair") {
    return left.repairId === right.repairId && left.repairTab === right.repairTab && left.documentId === right.documentId;
  }
  return true;
}
