import { type ComponentProps } from "react";
import { HistoryDetailsPreview } from "../components/HistoryDetailsPreview";
import { WorkspaceOperationsPanels } from "../components/WorkspaceOperationsPanels";
import type { AppRoute, WorkspaceTab } from "./appRoute";
import { buildAuditEntryDetails } from "./historyDetails";

type WorkspaceOperationsPanelsProps = ComponentProps<typeof WorkspaceOperationsPanels>;
type SearchProps = WorkspaceOperationsPanelsProps["searchProps"];
type AuditProps = WorkspaceOperationsPanelsProps["auditProps"];
type FleetProps = WorkspaceOperationsPanelsProps["fleetProps"];
type FleetDetailProps = FleetProps["detailProps"];
type UpdateBrowserRoute = (route: AppRoute, mode?: "push" | "replace") => void;
export type BuildOperationsWorkspacePropsParams = {
  activeWorkspaceTab: WorkspaceOperationsPanelsProps["activeWorkspaceTab"];
  globalSearchQuery: SearchProps["query"];
  globalSearchLoading: SearchProps["loading"];
  globalSearchResult: SearchProps["result"];
  setGlobalSearchQuery: SearchProps["onQueryChange"];
  handleGlobalSearchSubmit: SearchProps["onSubmit"];
  resetGlobalSearch: SearchProps["onReset"];
  openRepairByIds: (...args: Parameters<SearchProps["onOpenRepair"]>) => void | Promise<void>;
  openFleetVehicleById: (vehicleId: number, setActiveWorkspaceTab: (value: WorkspaceTab) => void, updateBrowserRoute: UpdateBrowserRoute) => void;
  setActiveWorkspaceTab: (value: WorkspaceTab) => void;
  updateBrowserRoute: UpdateBrowserRoute;
  statusColor: SearchProps["statusColor"];
  vehicleStatusColor: FleetDetailProps["vehicleStatusColor"];
  formatDocumentStatusLabel: SearchProps["formatDocumentStatusLabel"];
  formatRepairStatus: SearchProps["formatRepairStatus"];
  formatVehicleTypeLabel: SearchProps["formatVehicleTypeLabel"];
  formatVehicleStatusLabel: SearchProps["formatVehicleStatusLabel"];
  formatConfidence: SearchProps["formatConfidence"];
  formatDateTime: SearchProps["formatDateTime"];
  formatMoney: SearchProps["formatMoney"];
  userRole: AuditProps["userRole"] | null;
  auditSearchQuery: AuditProps["auditSearchQuery"];
  auditEntityTypeFilter: AuditProps["auditEntityTypeFilter"];
  auditActionTypeFilter: AuditProps["auditActionTypeFilter"];
  auditUserIdFilter: AuditProps["auditUserIdFilter"];
  auditDateFrom: AuditProps["auditDateFrom"];
  auditDateTo: AuditProps["auditDateTo"];
  auditEntityTypes: AuditProps["auditEntityTypes"];
  auditActionTypes: AuditProps["auditActionTypes"];
  usersList: AuditProps["users"];
  auditLogLoading: AuditProps["auditLogLoading"];
  auditLogItems: AuditProps["auditLogItems"];
  auditLogTotal: AuditProps["auditLogTotal"];
  setAuditSearchQuery: AuditProps["onAuditSearchQueryChange"];
  setAuditEntityTypeFilter: AuditProps["onAuditEntityTypeFilterChange"];
  setAuditActionTypeFilter: AuditProps["onAuditActionTypeFilterChange"];
  setAuditUserIdFilter: AuditProps["onAuditUserIdFilterChange"];
  setAuditDateFrom: AuditProps["onAuditDateFromChange"];
  setAuditDateTo: AuditProps["onAuditDateToChange"];
  loadAuditLog: () => void | Promise<void>;
  resetAudit: AuditProps["onReset"];
  formatAuditEntityLabel: AuditProps["formatAuditEntityLabel"];
  formatHistoryActionLabel: AuditProps["formatHistoryActionLabel"];
  historyDetailFormatters: Parameters<typeof buildAuditEntryDetails>[1];
  fleetViewMode: FleetProps["viewMode"];
  selectedFleetVehicleLoading: FleetDetailProps["selectedFleetVehicleLoading"];
  selectedFleetVehicle: FleetDetailProps["selectedFleetVehicle"];
  vehicleSaving: FleetDetailProps["vehicleSaving"];
  vehicleExportLoading: FleetDetailProps["vehicleExportLoading"];
  vehicles: FleetDetailProps["vehicles"];
  fleetVehicles: FleetProps["fleetVehicles"];
  handleUpdateVehicle: (payload: { status: Parameters<FleetDetailProps["onUpdateVehicleStatus"]>[0] }) => void | Promise<void>;
  handleExportVehicle: () => void | Promise<void>;
  formatVehicle: FleetDetailProps["formatVehicle"];
  formatDateValue: FleetDetailProps["formatDateValue"];
  formatUserRoleLabel: FleetDetailProps["formatUserRoleLabel"];
  fleetQuery: FleetProps["fleetQuery"];
  fleetVehicleTypeFilter: FleetProps["fleetVehicleTypeFilter"];
  fleetStatusFilter: FleetProps["fleetStatusFilter"];
  fleetVehiclesTotal: FleetProps["fleetVehiclesTotal"];
  selectedFleetVehicleId: FleetProps["selectedFleetVehicleId"];
  fleetLoading: FleetProps["fleetLoading"];
  setFleetQuery: FleetProps["onFleetQueryChange"];
  setFleetVehicleTypeFilter: FleetProps["onFleetVehicleTypeFilterChange"];
  setFleetStatusFilter: FleetProps["onFleetStatusFilterChange"];
  loadFleetVehicles: (
    query?: FleetProps["fleetQuery"],
    vehicleType?: FleetProps["fleetVehicleTypeFilter"],
    statusFilter?: FleetProps["fleetStatusFilter"],
  ) => void | Promise<void>;
  returnToFleetList: (updateBrowserRoute: UpdateBrowserRoute) => void;
  openFleetVehicleCard: (vehicleId: number, updateBrowserRoute: UpdateBrowserRoute) => void;
};

export function buildOperationsWorkspaceProps(params: BuildOperationsWorkspacePropsParams): WorkspaceOperationsPanelsProps {
  return {
    activeWorkspaceTab: params.activeWorkspaceTab,
    searchProps: {
      query: params.globalSearchQuery,
      loading: params.globalSearchLoading,
      result: params.globalSearchResult,
      onQueryChange: params.setGlobalSearchQuery,
      onSubmit: (event) => {
        void params.handleGlobalSearchSubmit(event);
      },
      onReset: params.resetGlobalSearch,
      onOpenRepair: (documentId, repairId) => {
        void params.openRepairByIds(documentId, repairId);
      },
      onOpenVehicle: (vehicleId) => {
        params.openFleetVehicleById(vehicleId, params.setActiveWorkspaceTab, params.updateBrowserRoute);
      },
      statusColor: params.statusColor,
      vehicleStatusColor: params.vehicleStatusColor,
      formatDocumentStatusLabel: params.formatDocumentStatusLabel,
      formatRepairStatus: params.formatRepairStatus,
      formatVehicleTypeLabel: params.formatVehicleTypeLabel,
      formatVehicleStatusLabel: params.formatVehicleStatusLabel,
      formatConfidence: params.formatConfidence,
      formatDateTime: params.formatDateTime,
      formatMoney: params.formatMoney,
    },
    auditProps: {
      userRole: params.userRole,
      auditSearchQuery: params.auditSearchQuery,
      auditEntityTypeFilter: params.auditEntityTypeFilter,
      auditActionTypeFilter: params.auditActionTypeFilter,
      auditUserIdFilter: params.auditUserIdFilter,
      auditDateFrom: params.auditDateFrom,
      auditDateTo: params.auditDateTo,
      auditEntityTypes: params.auditEntityTypes,
      auditActionTypes: params.auditActionTypes,
      users: params.usersList,
      auditLogLoading: params.auditLogLoading,
      auditLogItems: params.auditLogItems,
      auditLogTotal: params.auditLogTotal,
      onAuditSearchQueryChange: params.setAuditSearchQuery,
      onAuditEntityTypeFilterChange: params.setAuditEntityTypeFilter,
      onAuditActionTypeFilterChange: params.setAuditActionTypeFilter,
      onAuditUserIdFilterChange: params.setAuditUserIdFilter,
      onAuditDateFromChange: params.setAuditDateFrom,
      onAuditDateToChange: params.setAuditDateTo,
      onRefresh: () => {
        void params.loadAuditLog();
      },
      onReset: params.resetAudit,
      formatAuditEntityLabel: params.formatAuditEntityLabel,
      formatHistoryActionLabel: params.formatHistoryActionLabel,
      formatDateTime: params.formatDateTime,
      renderEntryDetails: (entry) =>
        <HistoryDetailsPreview lines={buildAuditEntryDetails(entry, params.historyDetailFormatters)} />,
    },
    fleetProps: {
      viewMode: params.fleetViewMode,
      detailProps: {
        selectedFleetVehicleLoading: params.selectedFleetVehicleLoading,
        selectedFleetVehicle: params.selectedFleetVehicle,
        userRole: params.userRole ?? undefined,
        vehicleSaving: params.vehicleSaving,
        vehicleExportLoading: params.vehicleExportLoading,
        vehicles: params.vehicles,
        fleetVehicles: params.fleetVehicles,
        onUpdateVehicleStatus: (status) => {
          void params.handleUpdateVehicle({ status });
        },
        onExportVehicle: () => {
          void params.handleExportVehicle();
        },
        onOpenRepair: (repairId) => {
          void params.openRepairByIds(null, repairId);
        },
        formatVehicle: params.formatVehicle,
        formatVehicleTypeLabel: params.formatVehicleTypeLabel,
        formatVehicleStatusLabel: params.formatVehicleStatusLabel,
        formatDateValue: params.formatDateValue,
        formatDateTime: params.formatDateTime,
        formatMoney: params.formatMoney,
        formatUserRoleLabel: params.formatUserRoleLabel,
        formatRepairStatus: params.formatRepairStatus,
        vehicleStatusColor: params.vehicleStatusColor,
      },
      fleetQuery: params.fleetQuery,
      fleetVehicleTypeFilter: params.fleetVehicleTypeFilter,
      fleetStatusFilter: params.fleetStatusFilter,
      fleetVehiclesTotal: params.fleetVehiclesTotal,
      selectedFleetVehicleId: params.selectedFleetVehicleId,
      fleetVehicles: params.fleetVehicles,
      fleetLoading: params.fleetLoading,
      onFleetQueryChange: params.setFleetQuery,
      onFleetVehicleTypeFilterChange: params.setFleetVehicleTypeFilter,
      onFleetStatusFilterChange: params.setFleetStatusFilter,
      onRefresh: () => {
        void params.loadFleetVehicles();
      },
      onReset: () => {
        params.setFleetQuery("");
        params.setFleetVehicleTypeFilter("");
        params.setFleetStatusFilter("");
        void params.loadFleetVehicles("", "", "");
      },
      onReturnToList: () => {
        params.returnToFleetList(params.updateBrowserRoute);
      },
      onOpenVehicleCard: (vehicleId) => {
        params.openFleetVehicleCard(vehicleId, params.updateBrowserRoute);
      },
      formatVehicle: params.formatVehicle,
      formatVehicleTypeLabel: params.formatVehicleTypeLabel,
      formatVehicleStatusLabel: params.formatVehicleStatusLabel,
      formatDateValue: params.formatDateValue,
      vehicleStatusColor: params.vehicleStatusColor,
    },
  };
}
