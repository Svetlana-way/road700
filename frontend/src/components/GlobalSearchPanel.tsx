import type { FormEvent } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ChipProps } from "@mui/material/Chip";

type VehicleType = "truck" | "trailer";
type VehicleStatus = "active" | "in_repair" | "waiting_repair" | "inactive" | "decommissioned" | "archived";
type DocumentStatus =
  | "uploaded"
  | "recognized"
  | "partially_recognized"
  | "needs_review"
  | "confirmed"
  | "ocr_error"
  | "archived";

type GlobalSearchDocumentItem = {
  document_id: number;
  repair_id: number | null;
  vehicle_id: number | null;
  original_filename: string;
  document_status: DocumentStatus;
  ocr_confidence: number | null;
  order_number: string | null;
  repair_date: string | null;
  service_name: string | null;
  plate_number: string | null;
  vin: string | null;
  matched_by: string[];
  created_at: string;
};

type GlobalSearchRepairItem = {
  repair_id: number;
  vehicle_id: number;
  order_number: string | null;
  repair_date: string;
  repair_status: string;
  service_name: string | null;
  plate_number: string | null;
  vin: string | null;
  grand_total: number;
  matched_by: string[];
  created_at: string;
};

type GlobalSearchVehicleItem = {
  vehicle_id: number;
  vehicle_type: VehicleType;
  plate_number: string | null;
  vin: string | null;
  brand: string | null;
  model: string | null;
  status: VehicleStatus;
  archived_at: string | null;
  matched_by: string[];
  updated_at: string;
};

type GlobalSearchResponse = {
  query: string;
  documents_total: number;
  repairs_total: number;
  vehicles_total: number;
  documents: GlobalSearchDocumentItem[];
  repairs: GlobalSearchRepairItem[];
  vehicles: GlobalSearchVehicleItem[];
};

type GlobalSearchPanelProps = {
  query: string;
  loading: boolean;
  result: GlobalSearchResponse | null;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  onOpenRepair: (documentId: number | null, repairId: number) => void;
  onOpenVehicle: (vehicleId: number) => void;
  statusColor: (status: DocumentStatus) => ChipProps["color"];
  vehicleStatusColor: (status: VehicleStatus | string) => ChipProps["color"];
  formatDocumentStatusLabel: (status: string | null | undefined) => string;
  formatRepairStatus: (status: string | null | undefined) => string;
  formatVehicleTypeLabel: (value: VehicleType | "" | null | undefined) => string;
  formatVehicleStatusLabel: (status: string | null | undefined) => string;
  formatConfidence: (value: number | null) => string;
  formatDateTime: (value: string) => string;
  formatMoney: (value?: number | null) => string | null;
};

export function GlobalSearchPanel({
  query,
  loading,
  result,
  onQueryChange,
  onSubmit,
  onReset,
  onOpenRepair,
  onOpenVehicle,
  statusColor,
  vehicleStatusColor,
  formatDocumentStatusLabel,
  formatRepairStatus,
  formatVehicleTypeLabel,
  formatVehicleStatusLabel,
  formatConfidence,
  formatDateTime,
  formatMoney,
}: GlobalSearchPanelProps) {
  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Глобальный поиск</Typography>
          <Typography className="muted-copy">
            Ищет по VIN, госномеру, номеру заказ-наряда, сервису, артикулу и названию работы.
          </Typography>
        </Box>
        <Box component="form" onSubmit={onSubmit}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={8}>
              <TextField
                label="Запрос"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                fullWidth
                helperText="Минимум 2 символа"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button type="submit" variant="contained" disabled={loading}>
                  {loading ? "Поиск..." : "Найти"}
                </Button>
                <Button variant="text" disabled={loading} onClick={onReset}>
                  Сбросить
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Box>

        {loading ? (
          <Stack spacing={1} alignItems="center" className="repair-placeholder">
            <CircularProgress size={24} />
            <Typography className="muted-copy">Ищем по заказ-нарядам, ремонтам и технике...</Typography>
          </Stack>
        ) : null}

        {result ? (
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Paper className="metric-card" elevation={0}>
                  <Typography className="metric-label">Документы</Typography>
                  <Typography variant="h3">{result.documents_total}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper className="metric-card" elevation={0}>
                  <Typography className="metric-label">Ремонты</Typography>
                  <Typography variant="h3">{result.repairs_total}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} md={4}>
                <Paper className="metric-card" elevation={0}>
                  <Typography className="metric-label">Техника</Typography>
                  <Typography variant="h3">{result.vehicles_total}</Typography>
                </Paper>
              </Grid>
            </Grid>

            <Paper className="repair-summary" elevation={0}>
              <Stack spacing={1.5}>
                <Typography variant="h6">Заказ-наряды и документы</Typography>
                {result.documents.length > 0 ? (
                  result.documents.map((item) => (
                    <Paper className="repair-line" key={`search-document-${item.document_id}`} elevation={0}>
                      <Stack spacing={1}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          spacing={1}
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Typography variant="subtitle1">{item.original_filename}</Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip
                              size="small"
                              color={statusColor(item.document_status)}
                              label={formatDocumentStatusLabel(item.document_status)}
                            />
                            {item.matched_by.map((reason) => (
                              <Chip key={`doc-match-${item.document_id}-${reason}`} size="small" variant="outlined" label={reason} />
                            ))}
                          </Stack>
                        </Stack>
                        <Typography className="muted-copy">
                          {[item.plate_number, item.vin, item.service_name].filter(Boolean).join(" · ") || "Связанные данные ещё не заполнены"}
                        </Typography>
                        <Typography className="muted-copy">
                          {[
                            item.order_number ? `заказ-наряд ${item.order_number}` : null,
                            item.repair_date,
                            typeof item.ocr_confidence === "number" ? `OCR ${formatConfidence(item.ocr_confidence)}` : null,
                            formatDateTime(item.created_at),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button
                            variant="outlined"
                            disabled={!item.repair_id}
                            onClick={() => {
                              if (item.repair_id) {
                                onOpenRepair(item.document_id, item.repair_id);
                              }
                            }}
                          >
                            Открыть ремонт
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))
                ) : (
                  <Typography className="muted-copy">Совпадений по документам нет.</Typography>
                )}
              </Stack>
            </Paper>

            <Paper className="repair-summary" elevation={0}>
              <Stack spacing={1.5}>
                <Typography variant="h6">Ремонты</Typography>
                {result.repairs.length > 0 ? (
                  result.repairs.map((item) => (
                    <Paper className="repair-line" key={`search-repair-${item.repair_id}`} elevation={0}>
                      <Stack spacing={1}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          spacing={1}
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Typography variant="subtitle1">
                            Ремонт #{item.repair_id}
                            {item.order_number ? ` · ${item.order_number}` : ""}
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip size="small" variant="outlined" label={formatRepairStatus(item.repair_status)} />
                            {item.matched_by.map((reason) => (
                              <Chip key={`repair-match-${item.repair_id}-${reason}`} size="small" variant="outlined" label={reason} />
                            ))}
                          </Stack>
                        </Stack>
                        <Typography className="muted-copy">
                          {[item.plate_number, item.vin, item.service_name].filter(Boolean).join(" · ") || "Техника или сервис пока не определены"}
                        </Typography>
                        <Typography className="muted-copy">
                          {[item.repair_date, formatMoney(item.grand_total), formatDateTime(item.created_at)].filter(Boolean).join(" · ")}
                        </Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button
                            variant="outlined"
                            onClick={() => {
                              onOpenRepair(null, item.repair_id);
                            }}
                          >
                            Открыть ремонт
                          </Button>
                          <Button
                            variant="text"
                            onClick={() => {
                              onOpenVehicle(item.vehicle_id);
                            }}
                          >
                            Открыть технику
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))
                ) : (
                  <Typography className="muted-copy">Совпадений по ремонтам нет.</Typography>
                )}
              </Stack>
            </Paper>

            <Paper className="repair-summary" elevation={0}>
              <Stack spacing={1.5}>
                <Typography variant="h6">Техника</Typography>
                {result.vehicles.length > 0 ? (
                  result.vehicles.map((item) => (
                    <Paper className="repair-line" key={`search-vehicle-${item.vehicle_id}`} elevation={0}>
                      <Stack spacing={1}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          justifyContent="space-between"
                          spacing={1}
                          alignItems={{ xs: "flex-start", sm: "center" }}
                        >
                          <Typography variant="subtitle1">
                            {[item.plate_number, item.brand, item.model].filter(Boolean).join(" • ") || `Техника #${item.vehicle_id}`}
                          </Typography>
                          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip size="small" variant="outlined" label={formatVehicleTypeLabel(item.vehicle_type)} />
                            <Chip size="small" color={vehicleStatusColor(item.status)} label={formatVehicleStatusLabel(item.status)} />
                            {item.matched_by.map((reason) => (
                              <Chip key={`vehicle-match-${item.vehicle_id}-${reason}`} size="small" variant="outlined" label={reason} />
                            ))}
                          </Stack>
                        </Stack>
                        <Typography className="muted-copy">
                          {[item.vin, item.archived_at ? `архив ${formatDateTime(item.archived_at)}` : null].filter(Boolean).join(" · ") || "VIN не указан"}
                        </Typography>
                        <Typography className="muted-copy">Обновлено {formatDateTime(item.updated_at)}</Typography>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                          <Button
                            variant="outlined"
                            onClick={() => {
                              onOpenVehicle(item.vehicle_id);
                            }}
                          >
                            Открыть карточку
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))
                ) : (
                  <Typography className="muted-copy">Совпадений по технике нет.</Typography>
                )}
              </Stack>
            </Paper>
          </Stack>
        ) : query.trim().length >= 2 ? (
          <Typography className="muted-copy">
            Введите запрос и запустите поиск.
          </Typography>
        ) : (
          <Typography className="muted-copy">
            Поиск объединяет документы, ремонты и архивные карточки техники в одном экране.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
