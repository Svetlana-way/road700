import type { FormEvent, RefObject } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { ChipProps } from "@mui/material/Chip";
import type {
  DocumentItem,
  DocumentKind,
  DocumentStatus,
  ImportJobStatus,
  Vehicle,
} from "../shared/workspaceBootstrapTypes";
import type { UploadFormState } from "../shared/workspaceFormTypes";

type DocumentKindOption = {
  value: DocumentKind;
  label: string;
};

type UploadField = keyof UploadFormState;

type DocumentsUploadPanelProps = {
  uploadForm: UploadFormState;
  vehicles: Vehicle[];
  rootDocumentKindOptions: DocumentKindOption[];
  selectedFile: File | null;
  uploadMissingRequirements: string[];
  uploadLoading: boolean;
  lastUploadedDocument: DocumentItem | null;
  uploadFileInputRef: RefObject<HTMLInputElement>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onUploadFieldChange: (field: UploadField, value: string) => void;
  onFileSelect: (file: File | null) => void;
  onOpenFilePicker: () => void;
  onOpenUploadedRepair: (documentId: number, repairId: number) => void;
  onHideUploadedResult: () => void;
  formatVehicle: (vehicle: Vehicle | DocumentItem["vehicle"]) => string;
  formatDocumentKind: (kind: DocumentKind) => string;
  importJobStatusColor: (status: ImportJobStatus) => ChipProps["color"];
  formatStatus: (value: string) => string;
  statusColor: (status: DocumentStatus) => ChipProps["color"];
  formatDocumentStatusLabel: (status: string | null | undefined) => string;
  isDocumentAwaitingOcr: (status: DocumentStatus | string | null | undefined) => boolean;
  documentHasActiveImportJob: (document: DocumentItem | null | undefined) => boolean;
  isPlaceholderVehicle: (externalId: string | null | undefined) => boolean;
  formatConfidence: (value: number | null) => string;
};

export function DocumentsUploadPanel({
  uploadForm,
  vehicles,
  rootDocumentKindOptions,
  selectedFile,
  uploadMissingRequirements,
  uploadLoading,
  lastUploadedDocument,
  uploadFileInputRef,
  onSubmit,
  onUploadFieldChange,
  onFileSelect,
  onOpenFilePicker,
  onOpenUploadedRepair,
  onHideUploadedResult,
  formatVehicle,
  formatDocumentKind,
  importJobStatusColor,
  formatStatus,
  statusColor,
  formatDocumentStatusLabel,
  isDocumentAwaitingOcr,
  documentHasActiveImportJob,
  isPlaceholderVehicle,
  formatConfidence,
}: DocumentsUploadPanelProps) {
  return (
    <Grid item xs={12} md={7}>
      <Paper className="workspace-panel" elevation={0}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h5">Загрузка заказ-наряда</Typography>
            <Typography className="muted-copy">
              После загрузки система сама распознаёт документ, сопоставляет машину и сервис, сверяет данные по базе, справочникам и истории, а затем показывает короткий итог.
            </Typography>
          </Box>

          <Box component="form" onSubmit={onSubmit}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  label="Техника"
                  value={uploadForm.vehicleId}
                  onChange={(event) => onUploadFieldChange("vehicleId", event.target.value)}
                  fullWidth
                  helperText="Можно оставить пустым: OCR попробует определить технику по документу"
                >
                  <MenuItem value="">Определить автоматически после OCR</MenuItem>
                  {vehicles.map((vehicle) => (
                    <MenuItem key={vehicle.id} value={String(vehicle.id)}>
                      {formatVehicle(vehicle)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  label="Вид документа"
                  value={uploadForm.documentKind}
                  onChange={(event) => onUploadFieldChange("documentKind", event.target.value)}
                  fullWidth
                  required
                >
                  {rootDocumentKindOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Дата ремонта"
                  type="date"
                  value={uploadForm.repairDate}
                  onChange={(event) => onUploadFieldChange("repairDate", event.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                  helperText="Необязательно. Если оставить пустым, система попытается распознать дату из файла"
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  label="Пробег"
                  type="number"
                  value={uploadForm.mileage}
                  onChange={(event) => onUploadFieldChange("mileage", event.target.value)}
                  fullWidth
                  helperText="Необязательно. OCR попытается найти пробег автоматически"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Номер заказ-наряда"
                  value={uploadForm.orderNumber}
                  onChange={(event) => onUploadFieldChange("orderNumber", event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Причина ремонта"
                  value={uploadForm.reason}
                  onChange={(event) => onUploadFieldChange("reason", event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Комментарий сотрудника"
                  value={uploadForm.employeeComment}
                  onChange={(event) => onUploadFieldChange("employeeComment", event.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Примечание к документу"
                  value={uploadForm.notes}
                  onChange={(event) => onUploadFieldChange("notes", event.target.value)}
                  fullWidth
                  multiline
                  minRows={2}
                />
              </Grid>
              <Grid item xs={12}>
                <Paper className="file-drop" elevation={0}>
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    justifyContent="space-between"
                    alignItems={{ xs: "stretch", sm: "center" }}
                  >
                    <Box>
                      <Typography variant="subtitle1">Файл документа</Typography>
                      <Typography className="muted-copy">
                        Поддерживаются PDF и изображения. Для PDF с текстовым слоем OCR срабатывает автоматически, для фото и сканов используется локальное распознавание.
                      </Typography>
                    </Box>
                    <input
                      ref={uploadFileInputRef}
                      hidden
                      type="file"
                      accept=".pdf,image/*"
                      onClick={(event) => {
                        event.currentTarget.value = "";
                      }}
                      onChange={(event) => {
                        onFileSelect(event.target.files?.[0] ?? null);
                      }}
                    />
                    <Button
                      variant="outlined"
                      onClick={onOpenFilePicker}
                      sx={{
                        flexShrink: 0,
                        width: { xs: "100%", sm: "auto" },
                        minWidth: { xs: 0, sm: 152 },
                        whiteSpace: "normal",
                        textAlign: "center",
                        fontWeight: 700,
                        textTransform: "none",
                      }}
                    >
                      Выбрать файл
                    </Button>
                  </Stack>
                  {selectedFile ? (
                    <Alert severity="success" className="selected-file-alert">
                      <Typography className="selected-file-title">Файл выбран</Typography>
                      <Typography className="selected-file">{selectedFile.name}</Typography>
                      <Typography className="muted-copy">
                        Файл пока только выбран локально. Можно загружать сразу: техника, дата и пробег теперь необязательны, OCR попытается заполнить их автоматически.
                      </Typography>
                    </Alert>
                  ) : (
                    <Typography className="selected-file">Файл ещё не выбран</Typography>
                  )}
                  {selectedFile && uploadMissingRequirements.length > 0 ? (
                    <Alert severity="info">
                      Для загрузки ещё нужно указать: {uploadMissingRequirements.join(", ")}.
                    </Alert>
                  ) : selectedFile ? (
                    <Alert severity="info">
                      После загрузки система создаст черновик ремонта, выполнит OCR, проверит машину, сервис, справочники и историю, а затем подготовит короткий итог по заказ-наряду.
                    </Alert>
                  ) : null}
                </Paper>
              </Grid>
              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={uploadLoading || uploadMissingRequirements.length > 0}
                >
                  {uploadLoading ? "Загрузка..." : "Загрузить и запустить проверку"}
                </Button>
              </Grid>
              {lastUploadedDocument ? (
                <Grid item xs={12}>
                  <Paper className="repair-summary upload-result-card" elevation={0}>
                    <Stack spacing={1.5}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                      >
                        <Box>
                          <Typography variant="subtitle1">Короткий итог по загрузке</Typography>
                          <Typography className="muted-copy">
                            Система приняла заказ-наряд и подготовила карточку ремонта для автоматической проверки.
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip size="small" variant="outlined" label={formatDocumentKind(lastUploadedDocument.kind)} />
                          {lastUploadedDocument.latest_import_job ? (
                            <Chip
                              size="small"
                              color={importJobStatusColor(lastUploadedDocument.latest_import_job.status)}
                              label={`OCR: ${formatStatus(lastUploadedDocument.latest_import_job.status)}`}
                            />
                          ) : null}
                          <Chip
                            size="small"
                            color={statusColor(lastUploadedDocument.status)}
                            label={formatDocumentStatusLabel(lastUploadedDocument.status)}
                          />
                        </Stack>
                      </Stack>
                      <Typography>
                        {isDocumentAwaitingOcr(lastUploadedDocument.status) || documentHasActiveImportJob(lastUploadedDocument)
                          ? `Заказ-наряд ${lastUploadedDocument.repair.order_number || "без номера"} загружен. Сейчас идет распознавание и автоматическая сверка по машине, сервису, справочникам и истории.`
                          : `Заказ-наряд ${lastUploadedDocument.repair.order_number || "без номера"} загружен и обработан. Карточка ремонта заполнена, можно открыть итог проверки.`}
                      </Typography>
                      {lastUploadedDocument.latest_import_job?.error_message ? (
                        <Alert severity="warning">
                          OCR-задача завершилась с ошибкой: {lastUploadedDocument.latest_import_job.error_message}
                        </Alert>
                      ) : null}
                      <Typography className="selected-file">{lastUploadedDocument.original_filename}</Typography>
                      <Typography className="muted-copy">
                        Машина: {!isPlaceholderVehicle(lastUploadedDocument.vehicle.external_id)
                          ? formatVehicle(lastUploadedDocument.vehicle)
                          : "не определена автоматически"}
                      </Typography>
                      <Typography className="muted-copy">
                        Сервис: {lastUploadedDocument.parsed_payload?.extracted_fields?.service_name
                          ? String(lastUploadedDocument.parsed_payload.extracted_fields.service_name)
                          : "будет уточнен после проверки"}
                      </Typography>
                      <Typography className="muted-copy">
                        Ремонт #{lastUploadedDocument.repair.id}
                        {lastUploadedDocument.repair.order_number ? ` · ${lastUploadedDocument.repair.order_number}` : ""}
                        {lastUploadedDocument.repair.repair_date ? ` · ${lastUploadedDocument.repair.repair_date}` : ""}
                        {lastUploadedDocument.repair.mileage > 0 ? ` · пробег ${lastUploadedDocument.repair.mileage}` : ""}
                      </Typography>
                      <Typography className="muted-copy">
                        Статус: {isDocumentAwaitingOcr(lastUploadedDocument.status)
                          ? "идет автоматическая проверка"
                          : "автоматическая обработка выполнена"}
                        {typeof lastUploadedDocument.ocr_confidence === "number"
                          ? ` · OCR ${formatConfidence(lastUploadedDocument.ocr_confidence)}`
                          : ""}
                      </Typography>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                        <Button
                          variant="contained"
                          onClick={() => onOpenUploadedRepair(lastUploadedDocument.id, lastUploadedDocument.repair.id)}
                        >
                          Открыть итог по заказ-наряду
                        </Button>
                        <Button variant="outlined" onClick={onHideUploadedResult}>
                          Скрыть
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                </Grid>
              ) : null}
            </Grid>
          </Box>
        </Stack>
      </Paper>
    </Grid>
  );
}
