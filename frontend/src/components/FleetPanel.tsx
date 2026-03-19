import type { ReactNode } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ChipProps } from "@mui/material/Chip";

type VehicleType = "truck" | "trailer";
type VehicleStatus = "active" | "in_repair" | "waiting_repair" | "inactive" | "decommissioned" | "archived";

type FleetVehicleItem = {
  id: number;
  vehicle_type: VehicleType;
  vin: string | null;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
  mechanic_name: string | null;
  current_driver_name: string | null;
  status: VehicleStatus;
  archived_at: string | null;
  historical_repairs_total: number;
  historical_last_repair_date: string | null;
};

type FleetPanelProps = {
  viewMode: "list" | "detail";
  detailContent: ReactNode;
  fleetQuery: string;
  fleetVehicleTypeFilter: "" | VehicleType;
  fleetStatusFilter: "" | VehicleStatus;
  fleetVehiclesTotal: number;
  selectedFleetVehicleId: number | null;
  fleetVehicles: FleetVehicleItem[];
  fleetLoading: boolean;
  onFleetQueryChange: (value: string) => void;
  onFleetVehicleTypeFilterChange: (value: "" | VehicleType) => void;
  onFleetStatusFilterChange: (value: "" | VehicleStatus) => void;
  onRefresh: () => void;
  onReset: () => void;
  onReturnToList: () => void;
  onOpenVehicleCard: (vehicleId: number) => void;
  formatVehicle: (vehicle: FleetVehicleItem) => string;
  formatVehicleTypeLabel: (value: VehicleType | "" | null | undefined) => string;
  formatVehicleStatusLabel: (value: string | null | undefined) => string;
  formatDateValue: (value: string) => string;
  vehicleStatusColor: (status: VehicleStatus | string) => ChipProps["color"];
};

export function FleetPanel({
  viewMode,
  detailContent,
  fleetQuery,
  fleetVehicleTypeFilter,
  fleetStatusFilter,
  fleetVehiclesTotal,
  selectedFleetVehicleId,
  fleetVehicles,
  fleetLoading,
  onFleetQueryChange,
  onFleetVehicleTypeFilterChange,
  onFleetStatusFilterChange,
  onRefresh,
  onReset,
  onReturnToList,
  onOpenVehicleCard,
  formatVehicle,
  formatVehicleTypeLabel,
  formatVehicleStatusLabel,
  formatDateValue,
  vehicleStatusColor,
}: FleetPanelProps) {
  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Техника</Typography>
          <Typography className="muted-copy">
            Поиск по технике, фильтр по типу и просмотр активных связок по выбранной единице.
          </Typography>
        </Box>
        {viewMode === "detail" ? (
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", sm: "center" }}
            >
              <Button variant="text" onClick={onReturnToList}>
                Назад к списку
              </Button>
              <Typography className="muted-copy">
                Возврат сохранит фильтры и позицию списка.
              </Typography>
            </Stack>
            {detailContent}
          </Stack>
        ) : (
          <Stack spacing={1.5}>
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Поиск по VIN, госномеру, бренду или модели"
                  value={fleetQuery}
                  onChange={(event) => onFleetQueryChange(event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="Тип техники"
                  value={fleetVehicleTypeFilter}
                  onChange={(event) => onFleetVehicleTypeFilterChange(event.target.value as "" | VehicleType)}
                  fullWidth
                >
                  <MenuItem value="">Все</MenuItem>
                  <MenuItem value="truck">Грузовики</MenuItem>
                  <MenuItem value="trailer">Прицепы</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="Статус"
                  value={fleetStatusFilter}
                  onChange={(event) => onFleetStatusFilterChange(event.target.value as "" | VehicleStatus)}
                  fullWidth
                >
                  <MenuItem value="">Все</MenuItem>
                  <MenuItem value="active">В работе</MenuItem>
                  <MenuItem value="in_repair">В ремонте</MenuItem>
                  <MenuItem value="waiting_repair">Ожидает ремонта</MenuItem>
                  <MenuItem value="inactive">Не используется</MenuItem>
                  <MenuItem value="decommissioned">Списан</MenuItem>
                  <MenuItem value="archived">Архив</MenuItem>
                </TextField>
              </Grid>
            </Grid>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="outlined" disabled={fleetLoading} onClick={onRefresh}>
                {fleetLoading ? "Загрузка..." : "Обновить список"}
              </Button>
              <Button variant="text" disabled={fleetLoading} onClick={onReset}>
                Сбросить фильтр
              </Button>
            </Stack>
            <Typography className="muted-copy">
              Найдено {fleetVehicles.length} из {fleetVehiclesTotal}
            </Typography>
            {fleetLoading ? (
              <Stack spacing={1} alignItems="center" className="repair-placeholder">
                <CircularProgress size={24} />
                <Typography className="muted-copy">Загрузка списка техники...</Typography>
              </Stack>
            ) : fleetVehicles.length > 0 ? (
              <Stack spacing={1}>
                {fleetVehicles.map((vehicle) => (
                  <Paper
                    key={`fleet-${vehicle.id}`}
                    className={`document-row${selectedFleetVehicleId === vehicle.id ? " document-row-active" : ""}`}
                    elevation={0}
                  >
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
                        <Box>
                          <Typography>{formatVehicle(vehicle)}</Typography>
                          <Typography className="muted-copy">
                            {vehicle.vin || "VIN не указан"}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Chip size="small" variant="outlined" label={formatVehicleTypeLabel(vehicle.vehicle_type)} />
                          <Chip size="small" color={vehicleStatusColor(vehicle.status)} label={formatVehicleStatusLabel(vehicle.status)} />
                        </Stack>
                      </Stack>
                      <Typography className="muted-copy">
                        Водитель: {vehicle.current_driver_name || "не указан"}
                        {vehicle.mechanic_name ? ` · механик: ${vehicle.mechanic_name}` : ""}
                      </Typography>
                      <Typography className="muted-copy">
                        История 2025:{" "}
                        {vehicle.historical_repairs_total > 0
                          ? `${vehicle.historical_repairs_total} ремонтов${
                              vehicle.historical_last_repair_date
                                ? ` · последний ${formatDateValue(vehicle.historical_last_repair_date)}`
                                : ""
                            }`
                          : "не найдена"}
                      </Typography>
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            onOpenVehicleCard(vehicle.id);
                          }}
                        >
                          Открыть карточку
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography className="muted-copy">По текущему фильтру техника не найдена.</Typography>
            )}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
