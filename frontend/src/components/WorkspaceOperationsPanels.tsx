import { lazy, Suspense, type ComponentProps } from "react";
import { CircularProgress, Paper, Stack, Typography } from "@mui/material";
const AuditLogPanel = lazy(() => import("./AuditLogPanel").then((module) => ({ default: module.AuditLogPanel })));
const FleetPanel = lazy(() => import("./FleetPanel").then((module) => ({ default: module.FleetPanel })));
const FleetVehicleDetailPanel = lazy(() =>
  import("./FleetVehicleDetailPanel").then((module) => ({ default: module.FleetVehicleDetailPanel })),
);
const GlobalSearchPanel = lazy(() => import("./GlobalSearchPanel").then((module) => ({ default: module.GlobalSearchPanel })));

type WorkspaceTab = "documents" | "repair" | "admin" | "tech_admin" | "fleet" | "search" | "audit";

type GlobalSearchPanelProps = ComponentProps<(typeof import("./GlobalSearchPanel"))["GlobalSearchPanel"]>;
type AuditLogPanelProps = ComponentProps<(typeof import("./AuditLogPanel"))["AuditLogPanel"]>;
type FleetPanelProps = ComponentProps<(typeof import("./FleetPanel"))["FleetPanel"]>;
type FleetVehicleDetailPanelProps = ComponentProps<(typeof import("./FleetVehicleDetailPanel"))["FleetVehicleDetailPanel"]>;

type WorkspaceOperationsPanelsProps = {
  activeWorkspaceTab: WorkspaceTab;
  searchProps: GlobalSearchPanelProps;
  auditProps: AuditLogPanelProps;
  fleetProps: Omit<FleetPanelProps, "detailContent"> & {
    detailProps: FleetVehicleDetailPanelProps;
  };
};

function OperationsPanelFallback({ label }: { label: string }) {
  return (
    <Paper className="loading-panel" elevation={0}>
      <Stack spacing={1.5} alignItems="center">
        <CircularProgress size={24} />
        <Typography>{label}</Typography>
      </Stack>
    </Paper>
  );
}

export function WorkspaceOperationsPanels({
  activeWorkspaceTab,
  searchProps,
  auditProps,
  fleetProps,
}: WorkspaceOperationsPanelsProps) {
  if (activeWorkspaceTab === "search") {
    return (
      <Suspense fallback={<OperationsPanelFallback label="Загрузка поиска..." />}>
        <GlobalSearchPanel {...searchProps} />
      </Suspense>
    );
  }

  if (activeWorkspaceTab === "audit") {
    return (
      <Suspense fallback={<OperationsPanelFallback label="Загрузка журнала..." />}>
        <AuditLogPanel {...auditProps} />
      </Suspense>
    );
  }

  if (activeWorkspaceTab === "fleet") {
    const { detailProps, ...fleetPanelProps } = fleetProps;
    return (
      <Suspense fallback={<OperationsPanelFallback label="Загрузка раздела техники..." />}>
        <FleetPanel
          {...fleetPanelProps}
          detailContent={
            <Suspense fallback={<OperationsPanelFallback label="Загрузка карточки техники..." />}>
              <FleetVehicleDetailPanel {...detailProps} />
            </Suspense>
          }
        />
      </Suspense>
    );
  }

  return null;
}
