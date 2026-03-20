import { type ComponentProps } from "react";
import { AuditLogPanel } from "./AuditLogPanel";
import { FleetPanel } from "./FleetPanel";
import { FleetVehicleDetailPanel } from "./FleetVehicleDetailPanel";
import { GlobalSearchPanel } from "./GlobalSearchPanel";

type WorkspaceTab = "documents" | "repair" | "admin" | "tech_admin" | "fleet" | "search" | "audit";

type GlobalSearchPanelProps = ComponentProps<typeof GlobalSearchPanel>;
type AuditLogPanelProps = ComponentProps<typeof AuditLogPanel>;
type FleetPanelProps = ComponentProps<typeof FleetPanel>;
type FleetVehicleDetailPanelProps = ComponentProps<typeof FleetVehicleDetailPanel>;

type WorkspaceOperationsPanelsProps = {
  activeWorkspaceTab: WorkspaceTab;
  searchProps: GlobalSearchPanelProps;
  auditProps: AuditLogPanelProps;
  fleetProps: Omit<FleetPanelProps, "detailContent"> & {
    detailProps: FleetVehicleDetailPanelProps;
  };
};

export function WorkspaceOperationsPanels({
  activeWorkspaceTab,
  searchProps,
  auditProps,
  fleetProps,
}: WorkspaceOperationsPanelsProps) {
  if (activeWorkspaceTab === "search") {
    return <GlobalSearchPanel {...searchProps} />;
  }

  if (activeWorkspaceTab === "audit") {
    return <AuditLogPanel {...auditProps} />;
  }

  if (activeWorkspaceTab === "fleet") {
    const { detailProps, ...fleetPanelProps } = fleetProps;
    return <FleetPanel {...fleetPanelProps} detailContent={<FleetVehicleDetailPanel {...detailProps} />} />;
  }

  return null;
}
