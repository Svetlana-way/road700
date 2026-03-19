import { Box, Button, Chip, CircularProgress, Grid, Paper, Stack, Typography } from "@mui/material";

type UserRole = "admin" | "employee";
type VehicleType = "truck" | "trailer";
type VehicleStatus = "active" | "in_repair" | "waiting_repair" | "inactive" | "decommissioned" | "archived";

type VehiclePreview = {
  id: number;
  external_id?: string | null;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
};

type VehicleDetail = {
  id: number;
  external_id: string | null;
  vehicle_type: VehicleType;
  vin: string | null;
  plate_number: string | null;
  brand: string | null;
  model: string | null;
  year: number | null;
  column_name: string | null;
  mechanic_name: string | null;
  current_driver_name: string | null;
  comment: string | null;
  status: VehicleStatus;
  updated_at: string;
  active_links: Array<{
    id: number;
    left_vehicle_id: number;
    right_vehicle_id: number;
    starts_at: string;
    ends_at: string | null;
    comment: string | null;
  }>;
  active_assignments: Array<{
    id: number;
    starts_at: string;
    ends_at: string | null;
    comment: string | null;
    user: {
      full_name: string;
      email: string;
      role: UserRole;
    };
  }>;
  repair_history: Array<{
    repair_id: number;
    order_number: string | null;
    repair_date: string;
    mileage: number;
    status: string;
    service_name: string | null;
    grand_total: number;
    documents_total: number;
    updated_at: string;
  }>;
  history_summary: {
    repairs_total: number;
    documents_total: number;
    confirmed_repairs: number;
    suspicious_repairs: number;
    last_repair_date: string | null;
    last_mileage: number | null;
  };
  historical_repair_history: Array<{
    repair_id: number;
    order_number: string | null;
    repair_date: string;
    mileage: number;
    service_name: string | null;
    grand_total: number;
    employee_comment: string | null;
  }>;
  historical_history_summary: {
    repairs_total: number;
    services_total: number;
    total_spend: number;
    first_repair_date: string | null;
    last_repair_date: string | null;
    last_mileage: number | null;
  };
};

type FleetVehicleDetailPanelProps = {
  selectedFleetVehicleLoading: boolean;
  selectedFleetVehicle: VehicleDetail | null;
  userRole?: UserRole;
  vehicleSaving: boolean;
  vehicleExportLoading: boolean;
  vehicles: VehiclePreview[];
  fleetVehicles: VehiclePreview[];
  onUpdateVehicleStatus: (status: VehicleStatus) => void;
  onExportVehicle: () => void;
  onOpenRepair: (repairId: number) => void;
  formatVehicle: (vehicle: VehiclePreview) => string;
  formatVehicleTypeLabel: (value: VehicleType | "" | null | undefined) => string;
  formatVehicleStatusLabel: (value: string | null | undefined) => string;
  formatDateValue: (value: string) => string;
  formatDateTime: (value: string) => string;
  formatMoney: (value: number | null | undefined) => string | null;
  formatUserRoleLabel: (value: UserRole) => string;
  formatRepairStatus: (value: string) => string;
  vehicleStatusColor: (status: VehicleStatus | string) => "default" | "success" | "warning" | "error";
};

export function FleetVehicleDetailPanel({
  selectedFleetVehicleLoading,
  selectedFleetVehicle,
  userRole,
  vehicleSaving,
  vehicleExportLoading,
  vehicles,
  fleetVehicles,
  onUpdateVehicleStatus,
  onExportVehicle,
  onOpenRepair,
  formatVehicle,
  formatVehicleTypeLabel,
  formatVehicleStatusLabel,
  formatDateValue,
  formatDateTime,
  formatMoney,
  formatUserRoleLabel,
  formatRepairStatus,
  vehicleStatusColor,
}: FleetVehicleDetailPanelProps) {
  if (selectedFleetVehicleLoading) {
    return (
      <Stack spacing={1} alignItems="center" className="repair-placeholder">
        <CircularProgress size={24} />
        <Typography className="muted-copy">Загрузка карточки техники...</Typography>
      </Stack>
    );
  }

  if (!selectedFleetVehicle) {
    return (
      <Stack spacing={1} alignItems="center" className="repair-placeholder">
        <Typography className="muted-copy">Выберите технику из списка, чтобы открыть карточку.</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={1.5}>
      <Paper className="repair-summary" elevation={0}>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
            <Box>
              <Typography variant="h6">{formatVehicle(selectedFleetVehicle)}</Typography>
              <Typography className="muted-copy">
                {selectedFleetVehicle.external_id ? `Внешний код: ${selectedFleetVehicle.external_id}` : "Внешний код не указан"}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="flex-end">
              {userRole === "admin" ? (
                selectedFleetVehicle.status === "archived" ? (
                  <Button variant="outlined" disabled={vehicleSaving} onClick={() => onUpdateVehicleStatus("active")}>
                    {vehicleSaving ? "Сохранение..." : "Вернуть из архива"}
                  </Button>
                ) : (
                  <Button variant="outlined" color="warning" disabled={vehicleSaving} onClick={() => onUpdateVehicleStatus("archived")}>
                    {vehicleSaving ? "Сохранение..." : "В архив"}
                  </Button>
                )
              ) : null}
              <Button variant="outlined" onClick={onExportVehicle} disabled={vehicleExportLoading}>
                {vehicleExportLoading ? "Экспорт..." : "Экспорт Excel"}
              </Button>
              <Chip size="small" variant="outlined" label={formatVehicleTypeLabel(selectedFleetVehicle.vehicle_type)} />
              <Chip size="small" color={vehicleStatusColor(selectedFleetVehicle.status)} label={formatVehicleStatusLabel(selectedFleetVehicle.status)} />
            </Stack>
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography className="metric-label">VIN</Typography>
              <Typography>{selectedFleetVehicle.vin || "Не указан"}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography className="metric-label">Год</Typography>
              <Typography>{selectedFleetVehicle.year || "Не указан"}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography className="metric-label">Водитель</Typography>
              <Typography>{selectedFleetVehicle.current_driver_name || "Не указан"}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography className="metric-label">Механик</Typography>
              <Typography>{selectedFleetVehicle.mechanic_name || "Не указан"}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography className="metric-label">Колонна</Typography>
              <Typography>{selectedFleetVehicle.column_name || "Не указана"}</Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography className="metric-label">Обновлено</Typography>
              <Typography>{formatDateTime(selectedFleetVehicle.updated_at)}</Typography>
            </Grid>
          </Grid>
          {selectedFleetVehicle.comment ? (
            <Box>
              <Typography className="metric-label">Комментарий</Typography>
              <Typography>{selectedFleetVehicle.comment}</Typography>
            </Box>
          ) : null}
        </Stack>
      </Paper>

      <Paper className="repair-summary" elevation={0}>
        <Stack spacing={1.5}>
          <Typography variant="h6">История по технике</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Typography className="metric-label">Ремонтов</Typography>
              <Typography>{selectedFleetVehicle.history_summary.repairs_total}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography className="metric-label">Документов</Typography>
              <Typography>{selectedFleetVehicle.history_summary.documents_total}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography className="metric-label">Подтверждено</Typography>
              <Typography>{selectedFleetVehicle.history_summary.confirmed_repairs}</Typography>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Typography className="metric-label">Подозрительных</Typography>
              <Typography>{selectedFleetVehicle.history_summary.suspicious_repairs}</Typography>
            </Grid>
            <Grid item xs={6} sm={6}>
              <Typography className="metric-label">Последний ремонт</Typography>
              <Typography>
                {selectedFleetVehicle.history_summary.last_repair_date
                  ? formatDateValue(selectedFleetVehicle.history_summary.last_repair_date)
                  : "Не найден"}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={6}>
              <Typography className="metric-label">Последний пробег</Typography>
              <Typography>
                {typeof selectedFleetVehicle.history_summary.last_mileage === "number"
                  ? selectedFleetVehicle.history_summary.last_mileage
                  : "Не указан"}
              </Typography>
            </Grid>
          </Grid>
        </Stack>
      </Paper>

      <Paper className="repair-summary" elevation={0}>
        <Stack spacing={1.5}>
          <Typography variant="h6">История из 2025 для ИИ</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={4}>
              <Typography className="metric-label">Исторических ремонтов</Typography>
              <Typography>{selectedFleetVehicle.historical_history_summary.repairs_total}</Typography>
            </Grid>
            <Grid item xs={6} sm={4}>
              <Typography className="metric-label">Сервисов</Typography>
              <Typography>{selectedFleetVehicle.historical_history_summary.services_total}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography className="metric-label">Сумма по истории</Typography>
              <Typography>{formatMoney(selectedFleetVehicle.historical_history_summary.total_spend)}</Typography>
            </Grid>
            <Grid item xs={6} sm={6}>
              <Typography className="metric-label">Первый ремонт в истории</Typography>
              <Typography>
                {selectedFleetVehicle.historical_history_summary.first_repair_date
                  ? formatDateValue(selectedFleetVehicle.historical_history_summary.first_repair_date)
                  : "Не найден"}
              </Typography>
            </Grid>
            <Grid item xs={6} sm={6}>
              <Typography className="metric-label">Последний ремонт в истории</Typography>
              <Typography>
                {selectedFleetVehicle.historical_history_summary.last_repair_date
                  ? formatDateValue(selectedFleetVehicle.historical_history_summary.last_repair_date)
                  : "Не найден"}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography className="metric-label">Последний исторический пробег</Typography>
              <Typography>
                {typeof selectedFleetVehicle.historical_history_summary.last_mileage === "number"
                  ? selectedFleetVehicle.historical_history_summary.last_mileage
                  : "Не указан"}
              </Typography>
            </Grid>
          </Grid>
          {selectedFleetVehicle.historical_repair_history.length > 0 ? (
            selectedFleetVehicle.historical_repair_history.map((repair) => (
              <Paper className="repair-line" key={`vehicle-historical-repair-${repair.repair_id}`} elevation={0}>
                <Stack spacing={0.75}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    spacing={1}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Typography>
                      История #{repair.repair_id}
                      {repair.order_number ? ` · ${repair.order_number}` : ""}
                    </Typography>
                    <Chip size="small" variant="outlined" label={formatMoney(repair.grand_total)} />
                  </Stack>
                  <Typography className="muted-copy">
                    {[formatDateValue(repair.repair_date), `пробег ${repair.mileage}`, repair.service_name].filter(Boolean).join(" · ")}
                  </Typography>
                  {repair.employee_comment ? <Typography className="muted-copy">{repair.employee_comment}</Typography> : null}
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button size="small" variant="outlined" onClick={() => onOpenRepair(repair.repair_id)}>
                      Открыть исторический ремонт
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))
          ) : (
            <Typography className="muted-copy">По этой технике история из `2025 для ИИ` не найдена.</Typography>
          )}
        </Stack>
      </Paper>

      <Paper className="repair-summary" elevation={0}>
        <Stack spacing={1.25}>
          <Typography variant="h6">Текущие закрепления</Typography>
          {selectedFleetVehicle.active_assignments.length > 0 ? (
            selectedFleetVehicle.active_assignments.map((assignment) => (
              <Paper className="repair-line" key={`vehicle-assignment-${assignment.id}`} elevation={0}>
                <Stack spacing={0.5}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    spacing={1}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Typography>{assignment.user.full_name}</Typography>
                    <Chip size="small" variant="outlined" label={formatUserRoleLabel(assignment.user.role)} />
                  </Stack>
                  <Typography className="muted-copy">{assignment.user.email}</Typography>
                  <Typography className="muted-copy">
                    С {formatDateValue(assignment.starts_at)}
                    {assignment.ends_at ? ` по ${formatDateValue(assignment.ends_at)}` : " по настоящее время"}
                  </Typography>
                  {assignment.comment ? <Typography className="muted-copy">{assignment.comment}</Typography> : null}
                </Stack>
              </Paper>
            ))
          ) : (
            <Typography className="muted-copy">Сейчас техника ни за кем не закреплена.</Typography>
          )}
        </Stack>
      </Paper>

      <Paper className="repair-summary" elevation={0}>
        <Stack spacing={1.25}>
          <Typography variant="h6">Активные связки</Typography>
          {selectedFleetVehicle.active_links.length > 0 ? (
            selectedFleetVehicle.active_links.map((link) => {
              const linkedVehicleId =
                link.left_vehicle_id === selectedFleetVehicle.id ? link.right_vehicle_id : link.left_vehicle_id;
              const linkedVehicle =
                vehicles.find((item) => item.id === linkedVehicleId) ??
                fleetVehicles.find((item) => item.id === linkedVehicleId) ??
                null;

              return (
                <Paper className="repair-line" key={`vehicle-link-${link.id}`} elevation={0}>
                  <Stack spacing={0.5}>
                    <Typography>{linkedVehicle ? formatVehicle(linkedVehicle) : `Техника #${linkedVehicleId}`}</Typography>
                    <Typography className="muted-copy">
                      С {formatDateValue(link.starts_at)}
                      {link.ends_at ? ` по ${formatDateValue(link.ends_at)}` : " по настоящее время"}
                    </Typography>
                    {link.comment ? <Typography className="muted-copy">{link.comment}</Typography> : null}
                  </Stack>
                </Paper>
              );
            })
          ) : (
            <Typography className="muted-copy">Активные связки для этой единицы техники не найдены.</Typography>
          )}
        </Stack>
      </Paper>

      <Paper className="repair-summary" elevation={0}>
        <Stack spacing={1.25}>
          <Typography variant="h6">История ремонтов</Typography>
          {selectedFleetVehicle.repair_history.length > 0 ? (
            selectedFleetVehicle.repair_history.map((repair) => (
              <Paper className="repair-line" key={`vehicle-repair-${repair.repair_id}`} elevation={0}>
                <Stack spacing={0.75}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    spacing={1}
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Typography>
                      Ремонт #{repair.repair_id}
                      {repair.order_number ? ` · ${repair.order_number}` : ""}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip size="small" variant="outlined" label={formatRepairStatus(repair.status)} />
                      <Chip size="small" variant="outlined" label={`документов ${repair.documents_total}`} />
                    </Stack>
                  </Stack>
                  <Typography className="muted-copy">
                    {[formatDateValue(repair.repair_date), `пробег ${repair.mileage}`, repair.service_name, formatMoney(repair.grand_total)]
                      .filter(Boolean)
                      .join(" · ")}
                  </Typography>
                  <Typography className="muted-copy">Обновлено {formatDateTime(repair.updated_at)}</Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button size="small" variant="outlined" onClick={() => onOpenRepair(repair.repair_id)}>
                      Открыть ремонт
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))
          ) : (
            <Typography className="muted-copy">По этой технике ремонтов пока нет.</Typography>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
