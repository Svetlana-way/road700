import { Box, Button, Chip, Grid, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import type { VehicleType } from "../shared/workspaceBootstrapTypes";
import type { DocumentVehicleFormState } from "../shared/workspaceFormTypes";

type DocumentVehicleCreatePanelProps = {
  documentVehicleForm: DocumentVehicleFormState;
  documentVehicleSaving: boolean;
  ocrPlateNumber: string | null;
  ocrVin: string | null;
  onFormChange: <K extends keyof DocumentVehicleFormState>(field: K, value: DocumentVehicleFormState[K]) => void;
  onCreate: () => void;
  formatVehicleTypeLabel: (value: VehicleType) => string;
};

export function DocumentVehicleCreatePanel({
  documentVehicleForm,
  documentVehicleSaving,
  ocrPlateNumber,
  ocrVin,
  onFormChange,
  onCreate,
  formatVehicleTypeLabel,
}: DocumentVehicleCreatePanelProps) {
  return (
    <Paper className="repair-summary" elevation={0}>
      <Stack spacing={1.5}>
        <Box>
          <Typography variant="h6">Создать карточку техники</Typography>
          <Typography className="muted-copy">
            Для непривязанного заказ-наряда можно сразу завести технику и перепривязать ремонт.
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap">
          <Chip
            size="small"
            variant="outlined"
            label={`Тип: ${formatVehicleTypeLabel(documentVehicleForm.vehicle_type)}`}
          />
          {ocrPlateNumber ? <Chip size="small" variant="outlined" label={`OCR госномер: ${ocrPlateNumber}`} /> : null}
          {ocrVin ? <Chip size="small" variant="outlined" label={`OCR VIN: ${ocrVin}`} /> : null}
        </Stack>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              fullWidth
              label="Тип техники"
              value={documentVehicleForm.vehicle_type}
              onChange={(event) => onFormChange("vehicle_type", event.target.value as VehicleType)}
            >
              <MenuItem value="truck">Грузовик</MenuItem>
              <MenuItem value="trailer">Прицеп</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Госномер"
              value={documentVehicleForm.plate_number}
              onChange={(event) => onFormChange("plate_number", event.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="VIN" value={documentVehicleForm.vin} onChange={(event) => onFormChange("vin", event.target.value)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="Марка" value={documentVehicleForm.brand} onChange={(event) => onFormChange("brand", event.target.value)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField fullWidth label="Модель" value={documentVehicleForm.model} onChange={(event) => onFormChange("model", event.target.value)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Год"
              value={documentVehicleForm.year}
              onChange={(event) => onFormChange("year", event.target.value.replace(/[^\d]/g, "").slice(0, 4))}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              label="Комментарий"
              value={documentVehicleForm.comment}
              onChange={(event) => onFormChange("comment", event.target.value)}
            />
          </Grid>
        </Grid>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="contained" disabled={documentVehicleSaving} onClick={onCreate}>
            {documentVehicleSaving ? "Создание..." : "Создать и привязать"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
