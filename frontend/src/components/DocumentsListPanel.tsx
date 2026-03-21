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
  UserRole,
} from "../shared/workspaceBootstrapTypes";

type DocumentsListPanelProps = {
  userRole: UserRole | null | undefined;
  documents: DocumentItem[];
  selectedDocumentId: number | null;
  batchReprocessLimit: string;
  batchReprocessStatusFilter: string;
  batchReprocessPrimaryOnly: "false" | "true";
  batchReprocessLoading: boolean;
  reprocessLoading: boolean;
  repairDeleteLoading: boolean;
  documentArchiveLoadingId: number | null;
  onBatchReprocessLimitChange: (value: string) => void;
  onBatchReprocessStatusFilterChange: (value: string) => void;
  onBatchReprocessPrimaryOnlyChange: (value: "false" | "true") => void;
  onBatchReprocess: () => void;
  onOpenRepair: (document: DocumentItem) => void;
  onReprocessDocument: (document: DocumentItem) => void;
  onDeleteRepair: (repairId: number) => void;
  onArchiveDocument: (documentId: number, repairId: number) => void;
  formatDocumentKind: (kind: DocumentKind) => string;
  importJobStatusColor: (status: ImportJobStatus) => ChipProps["color"];
  formatStatus: (value: string) => string;
  statusColor: (status: DocumentStatus) => ChipProps["color"];
  formatDocumentStatusLabel: (status: string | null | undefined) => string;
  formatVehicle: (vehicle: DocumentItem["vehicle"]) => string;
  formatMoney: (value?: number | null) => string | null;
  formatManualReviewReasons: (reasons: string[]) => string;
  formatOcrProfileMeta: (payload: Record<string, unknown> | null | undefined) => string | null;
  formatLaborNormApplicability: (payload: Record<string, unknown> | null | undefined) => string | null;
};

export function DocumentsListPanel({
  userRole,
  documents,
  selectedDocumentId,
  batchReprocessLimit,
  batchReprocessStatusFilter,
  batchReprocessPrimaryOnly,
  batchReprocessLoading,
  reprocessLoading,
  repairDeleteLoading,
  documentArchiveLoadingId,
  onBatchReprocessLimitChange,
  onBatchReprocessStatusFilterChange,
  onBatchReprocessPrimaryOnlyChange,
  onBatchReprocess,
  onOpenRepair,
  onReprocessDocument,
  onDeleteRepair,
  onArchiveDocument,
  formatDocumentKind,
  importJobStatusColor,
  formatStatus,
  statusColor,
  formatDocumentStatusLabel,
  formatVehicle,
  formatMoney,
  formatManualReviewReasons,
  formatOcrProfileMeta,
  formatLaborNormApplicability,
}: DocumentsListPanelProps) {
  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Последние документы</Typography>
          <Typography className="muted-copy">
            Последние загруженные заказ-наряды и сканы по доступной технике.
          </Typography>
        </Box>
        {userRole === "admin" ? (
          <Paper className="repair-line" elevation={0}>
            <Stack spacing={1.25}>
              <Box>
                <Typography className="metric-label">Массовая переобработка заказ-нарядов</Typography>
                <Typography className="muted-copy">
                  Пересчитывает OCR, строки работ и применимость нормо-часов по уже загруженным документам.
                </Typography>
              </Box>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Сколько документов"
                    type="number"
                    value={batchReprocessLimit}
                    onChange={(event) => onBatchReprocessLimitChange(event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={5}>
                  <TextField
                    select
                    label="Статус документов"
                    value={batchReprocessStatusFilter}
                    onChange={(event) => onBatchReprocessStatusFilterChange(event.target.value)}
                    fullWidth
                  >
                    <MenuItem value="">Все рабочие статусы</MenuItem>
                    <MenuItem value="uploaded">Загружен</MenuItem>
                    <MenuItem value="recognized">Распознан</MenuItem>
                    <MenuItem value="partially_recognized">Распознан частично</MenuItem>
                    <MenuItem value="needs_review">Требует ручной проверки</MenuItem>
                    <MenuItem value="confirmed">Подтвержден</MenuItem>
                    <MenuItem value="ocr_error">Ошибка OCR</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    label="Какие документы брать"
                    value={batchReprocessPrimaryOnly}
                    onChange={(event) => onBatchReprocessPrimaryOnlyChange(event.target.value as "false" | "true")}
                    fullWidth
                  >
                    <MenuItem value="false">Все заказ-наряды и повторные сканы</MenuItem>
                    <MenuItem value="true">Только основные документы</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button variant="contained" disabled={batchReprocessLoading} onClick={onBatchReprocess}>
                  {batchReprocessLoading ? "Переобработка..." : "Массово пересчитать документы"}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ) : null}
        <Stack spacing={1.5}>
          {documents.map((document) => (
            <Paper
              className={`document-row${selectedDocumentId === document.id ? " document-row-active" : ""}`}
              key={document.id}
              elevation={0}
            >
              <Stack spacing={1.25}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                >
                  <Typography variant="subtitle1">{document.original_filename}</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip size="small" variant="outlined" label={formatDocumentKind(document.kind)} />
                    {document.latest_import_job ? (
                      <Chip
                        size="small"
                        color={importJobStatusColor(document.latest_import_job.status)}
                        label={`OCR: ${formatStatus(document.latest_import_job.status)}`}
                      />
                    ) : null}
                    <Chip
                      size="small"
                      color={statusColor(document.status)}
                      label={formatDocumentStatusLabel(document.status)}
                    />
                  </Stack>
                </Stack>
                <Typography className="muted-copy">{formatVehicle(document.vehicle)}</Typography>
                <Typography className="muted-copy">
                  Ремонт #{document.repair.id} · {document.repair.repair_date} · пробег {document.repair.mileage}
                </Typography>
                {document.latest_import_job ? (
                  <Typography className="muted-copy">
                    OCR-задача: {formatStatus(document.latest_import_job.status)}
                    {document.latest_import_job.attempts > 0 ? ` · попытка ${document.latest_import_job.attempts}` : ""}
                  </Typography>
                ) : null}
                {document.parsed_payload?.extracted_fields?.order_number ? (
                  <Typography className="muted-copy">
                    OCR: заказ-наряд {document.parsed_payload.extracted_fields.order_number}
                  </Typography>
                ) : null}
                {document.parsed_payload?.extracted_fields?.plate_number || document.parsed_payload?.extracted_fields?.vin ? (
                  <Typography className="muted-copy">
                    OCR:{" "}
                    {[
                      document.parsed_payload?.extracted_fields?.plate_number
                        ? `госномер ${document.parsed_payload.extracted_fields.plate_number}`
                        : null,
                      document.parsed_payload?.extracted_fields?.vin ? `VIN ${document.parsed_payload.extracted_fields.vin}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Typography>
                ) : null}
                {document.parsed_payload?.extracted_fields?.grand_total ? (
                  <Typography className="muted-copy">
                    OCR: итог {formatMoney(document.parsed_payload.extracted_fields.grand_total)}
                  </Typography>
                ) : null}
                {document.parsed_payload?.extracted_items ? (
                  <Typography className="muted-copy">
                    OCR: работ {document.parsed_payload.extracted_items.works?.length || 0}, запчастей {document.parsed_payload.extracted_items.parts?.length || 0}
                  </Typography>
                ) : null}
                {document.parsed_payload?.manual_review_reasons?.length ? (
                  <Typography className="muted-copy">
                    Проверить вручную: {formatManualReviewReasons(document.parsed_payload.manual_review_reasons)}
                  </Typography>
                ) : null}
                {document.latest_import_job?.error_message ? (
                  <Alert severity="warning">Ошибка OCR: {document.latest_import_job.error_message}</Alert>
                ) : null}
                {formatOcrProfileMeta(document.parsed_payload ?? null) ? (
                  <Typography className="muted-copy">{formatOcrProfileMeta(document.parsed_payload ?? null)}</Typography>
                ) : null}
                {formatLaborNormApplicability(document.parsed_payload ?? null) ? (
                  <Typography className="muted-copy">
                    {formatLaborNormApplicability(document.parsed_payload ?? null)}
                  </Typography>
                ) : null}
                {document.notes ? <Typography className="muted-copy">{document.notes}</Typography> : null}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      onOpenRepair(document);
                    }}
                  >
                    Открыть ремонт
                  </Button>
                  {userRole === "admin" ? (
                    <Button
                      size="small"
                      variant="text"
                      disabled={reprocessLoading || document.status === "archived"}
                      onClick={() => {
                        onReprocessDocument(document);
                      }}
                    >
                      {reprocessLoading && selectedDocumentId === document.id ? "Повтор..." : "Повторить OCR"}
                    </Button>
                  ) : null}
                  {userRole === "admin" && document.is_primary ? (
                    <Button
                      size="small"
                      variant="text"
                      color="error"
                      disabled={repairDeleteLoading}
                      onClick={() => {
                        onDeleteRepair(document.repair.id);
                      }}
                    >
                      {repairDeleteLoading ? "Удаление..." : "Удалить"}
                    </Button>
                  ) : null}
                  {userRole === "admin" && document.status !== "archived" ? (
                    <Button
                      size="small"
                      variant="text"
                      disabled={documentArchiveLoadingId === document.id}
                      onClick={() => {
                        onArchiveDocument(document.id, document.repair.id);
                      }}
                    >
                      {documentArchiveLoadingId === document.id ? "Архивация..." : "В архив"}
                    </Button>
                  ) : null}
                </Stack>
              </Stack>
            </Paper>
          ))}
          {documents.length === 0 ? (
            <Typography className="muted-copy">Документы ещё не загружались.</Typography>
          ) : null}
        </Stack>
      </Stack>
    </Paper>
  );
}
