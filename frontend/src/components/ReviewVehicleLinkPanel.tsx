import { Box, Button, Chip, Paper, Stack, TextField, Typography } from "@mui/material";

type VehicleType = "truck" | "trailer";

type ReviewVehicleLinkPanelProps = {
  plateNumber: string | null;
  vin: string | null;
  reviewVehicleSearch: string;
  reviewVehicleSearchLoading: boolean;
  reviewVehicleLinkingId: number | null;
  reviewVehicleSearchResults: Array<{
    id: number;
    vehicle_type: VehicleType;
    vin: string | null;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  }>;
  userRole: "admin" | "employee" | undefined;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  onLinkVehicle: (vehicleId: number) => void;
  formatVehicle: (vehicle: {
    id: number;
    plate_number: string | null;
    brand: string | null;
    model: string | null;
  }) => string;
  formatVehicleTypeLabel: (value: VehicleType) => string;
};

export function ReviewVehicleLinkPanel({
  plateNumber,
  vin,
  reviewVehicleSearch,
  reviewVehicleSearchLoading,
  reviewVehicleLinkingId,
  reviewVehicleSearchResults,
  userRole,
  onSearchChange,
  onSearch,
  onLinkVehicle,
  formatVehicle,
  formatVehicleTypeLabel,
}: ReviewVehicleLinkPanelProps) {
  return (
    <Paper className="repair-line repair-review-split" elevation={0}>
      <Stack spacing={1.25}>
        <Box>
          <Typography variant="subtitle1">Привязка техники</Typography>
          <Typography className="muted-copy">
            Заказ-наряд пока висит на placeholder-технике. Найдите существующую карточку и перепривяжите ремонт прямо из review.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {plateNumber ? <Chip size="small" variant="outlined" label={`OCR госномер: ${plateNumber}`} /> : null}
          {vin ? <Chip size="small" variant="outlined" label={`OCR VIN: ${vin}`} /> : null}
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            fullWidth
            label="Найти технику"
            value={reviewVehicleSearch}
            onChange={(event) => onSearchChange(event.target.value)}
            helperText="Поиск по госномеру, VIN, марке или модели."
          />
          <Button variant="outlined" disabled={reviewVehicleSearchLoading || reviewVehicleLinkingId !== null} onClick={onSearch}>
            {reviewVehicleSearchLoading ? "Поиск..." : "Найти"}
          </Button>
        </Stack>
        {reviewVehicleSearchResults.length > 0 ? (
          <Stack spacing={1}>
            {reviewVehicleSearchResults.map((vehicle) => (
              <Paper className="repair-line" key={`review-vehicle-${vehicle.id}`} elevation={0}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                >
                  <Box>
                    <Typography>{formatVehicle(vehicle)}</Typography>
                    <Typography className="muted-copy">
                      {formatVehicleTypeLabel(vehicle.vehicle_type)} · {vehicle.vin || "VIN не указан"}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="contained"
                    disabled={reviewVehicleLinkingId !== null}
                    onClick={() => onLinkVehicle(vehicle.id)}
                  >
                    {reviewVehicleLinkingId === vehicle.id ? "Привязка..." : "Выбрать технику"}
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : reviewVehicleSearch.trim() && !reviewVehicleSearchLoading ? (
          <Typography className="muted-copy">
            По этому запросу техника не найдена. {userRole === "admin" ? "Ниже можно создать новую карточку техники." : ""}
          </Typography>
        ) : null}
      </Stack>
    </Paper>
  );
}
