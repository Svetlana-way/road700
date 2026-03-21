import { Box, Chip, Grid, Paper, Stack, Typography } from "@mui/material";
import type { ReviewExtractedFieldSnapshot } from "../shared/workspaceFormTypes";

type ReviewExtractedDataPanelProps = {
  selectedRepairDocumentFieldSnapshots: ReviewExtractedFieldSnapshot[];
  selectedRepairDocumentExtractedFields: Record<string, unknown> | null;
  selectedRepairDocumentOcrServiceName: string;
  selectedRepairDocumentPayload: Record<string, unknown> | null;
  selectedRepairDocumentWorks: Array<Record<string, unknown>>;
  selectedRepairDocumentParts: Array<Record<string, unknown>>;
  getConfidenceColor: (value: number | null) => "default" | "success" | "warning" | "error";
  formatConfidenceLabel: (value: number | null) => string;
  formatMoney: (value: number | null | undefined) => string | null;
  formatCompactNumber: (value: number | null | undefined) => string | null;
  formatHours: (value: number | null | undefined) => string | null;
  formatManualReviewReasons: (reasons: string[]) => string;
  formatOcrProfileMeta: (payload: Record<string, unknown> | null | undefined) => string | null;
  formatLaborNormApplicability: (payload: Record<string, unknown> | null | undefined) => string | null;
  readStringValue: (item: Record<string, unknown>, ...keys: string[]) => string | null;
  readNumberValue: (item: Record<string, unknown>, ...keys: string[]) => number | null;
  formatOcrLineUnit: (value: string | null | undefined) => string | null;
};

export function ReviewExtractedDataPanel({
  selectedRepairDocumentFieldSnapshots,
  selectedRepairDocumentExtractedFields,
  selectedRepairDocumentOcrServiceName,
  selectedRepairDocumentPayload,
  selectedRepairDocumentWorks,
  selectedRepairDocumentParts,
  getConfidenceColor,
  formatConfidenceLabel,
  formatMoney,
  formatCompactNumber,
  formatHours,
  formatManualReviewReasons,
  formatOcrProfileMeta,
  formatLaborNormApplicability,
  readStringValue,
  readNumberValue,
  formatOcrLineUnit,
}: ReviewExtractedDataPanelProps) {
  return (
    <Paper className="repair-line repair-review-split" elevation={0}>
      <Stack spacing={1.25}>
        <Box>
          <Typography variant="subtitle1">Распознанные данные</Typography>
          <Typography className="muted-copy">
            Полная сводка по шапке документа и строкам OCR перед подтверждением.
          </Typography>
        </Box>
        {selectedRepairDocumentFieldSnapshots.length > 0 ? (
          <Box className="ocr-lines-grid">
            {selectedRepairDocumentFieldSnapshots.map((item) => (
              <Paper className="ocr-line-card" key={`review-field-${item.key}`} elevation={0}>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                    <Typography className="metric-label">{item.label}</Typography>
                    <Chip
                      size="small"
                      variant="outlined"
                      color={getConfidenceColor(item.confidenceValue)}
                      label={formatConfidenceLabel(item.confidenceValue)}
                    />
                  </Stack>
                  <Typography className="ocr-line-title">{item.value}</Typography>
                </Stack>
              </Paper>
            ))}
          </Box>
        ) : null}
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={6}>
            <Typography className="metric-label">Номер заказ-наряда</Typography>
            <Typography>{String(selectedRepairDocumentExtractedFields?.order_number || "—")}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography className="metric-label">Дата ремонта</Typography>
            <Typography>{String(selectedRepairDocumentExtractedFields?.repair_date || "—")}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography className="metric-label">Сервис по OCR</Typography>
            <Typography>{selectedRepairDocumentOcrServiceName || "—"}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography className="metric-label">Пробег</Typography>
            <Typography>{String(selectedRepairDocumentExtractedFields?.mileage || "—")}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography className="metric-label">Госномер</Typography>
            <Typography>{String(selectedRepairDocumentExtractedFields?.plate_number || "—")}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography className="metric-label">VIN</Typography>
            <Typography>{String(selectedRepairDocumentExtractedFields?.vin || "—")}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography className="metric-label">Итоговая сумма</Typography>
            <Typography>
              {typeof selectedRepairDocumentExtractedFields?.grand_total === "number"
                ? formatMoney(selectedRepairDocumentExtractedFields.grand_total)
                : "—"}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography className="metric-label">Строки документа</Typography>
            <Typography>
              Работ {selectedRepairDocumentWorks.length} · Запчастей {selectedRepairDocumentParts.length}
            </Typography>
          </Grid>
        </Grid>
        {Array.isArray(selectedRepairDocumentPayload?.manual_review_reasons) &&
        selectedRepairDocumentPayload.manual_review_reasons.length > 0 ? (
          <Typography className="muted-copy">
            Требует ручной проверки: {formatManualReviewReasons(selectedRepairDocumentPayload.manual_review_reasons as string[])}
          </Typography>
        ) : null}
        {formatOcrProfileMeta(selectedRepairDocumentPayload) ? (
          <Typography className="muted-copy">{formatOcrProfileMeta(selectedRepairDocumentPayload)}</Typography>
        ) : null}
        {formatLaborNormApplicability(selectedRepairDocumentPayload) ? (
          <Typography className="muted-copy">{formatLaborNormApplicability(selectedRepairDocumentPayload)}</Typography>
        ) : null}
        {selectedRepairDocumentWorks.length > 0 ? (
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Typography className="metric-label">Работы OCR</Typography>
              <Chip size="small" variant="outlined" label={`${selectedRepairDocumentWorks.length} строк`} />
            </Stack>
            <Box className="ocr-lines-grid">
              {selectedRepairDocumentWorks.slice(0, 8).map((item, index) => {
                const name = readStringValue(item, "work_name", "name") || `Работа ${index + 1}`;
                const code = readStringValue(item, "work_code");
                const quantity = readNumberValue(item, "quantity");
                const unitName = formatOcrLineUnit(readStringValue(item, "unit_name"));
                const price = readNumberValue(item, "price");
                const lineTotal = readNumberValue(item, "line_total");
                const standardHours = readNumberValue(item, "standard_hours");
                const actualHours = readNumberValue(item, "actual_hours");

                return (
                  <Paper className="ocr-line-card" key={`review-work-${index}`} elevation={0}>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="flex-start">
                        <Box sx={{ minWidth: 0 }}>
                          <Typography className="ocr-line-title">{name}</Typography>
                          {code ? <Typography className="muted-copy">Код: {code}</Typography> : null}
                        </Box>
                        <Typography className="ocr-line-total">{formatMoney(lineTotal) || "—"}</Typography>
                      </Stack>
                      <Box className="ocr-line-meta">
                        <span>{`Кол-во ${quantity !== null ? formatCompactNumber(quantity) : "—"}${unitName ? ` ${unitName}` : ""}`}</span>
                        <span>{`Цена ${formatMoney(price) || "—"}`}</span>
                        <span>{`Сумма ${formatMoney(lineTotal) || "—"}`}</span>
                        {standardHours !== null ? <span>{`Норма ${formatHours(standardHours)}`}</span> : null}
                        {actualHours !== null ? <span>{`Факт ${formatHours(actualHours)}`}</span> : null}
                      </Box>
                    </Stack>
                  </Paper>
                );
              })}
            </Box>
            {selectedRepairDocumentWorks.length > 8 ? (
              <Typography className="muted-copy">И ещё {selectedRepairDocumentWorks.length - 8} строк работ.</Typography>
            ) : null}
          </Stack>
        ) : null}
        {selectedRepairDocumentParts.length > 0 ? (
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Typography className="metric-label">Запчасти OCR</Typography>
              <Chip size="small" variant="outlined" label={`${selectedRepairDocumentParts.length} строк`} />
            </Stack>
            <Box className="ocr-lines-grid">
              {selectedRepairDocumentParts.slice(0, 8).map((item, index) => {
                const name = readStringValue(item, "part_name", "name") || `Запчасть ${index + 1}`;
                const article = readStringValue(item, "article");
                const quantity = readNumberValue(item, "quantity");
                const unitName = formatOcrLineUnit(readStringValue(item, "unit_name"));
                const price = readNumberValue(item, "price");
                const lineTotal = readNumberValue(item, "line_total");

                return (
                  <Paper className="ocr-line-card" key={`review-part-${index}`} elevation={0}>
                    <Stack spacing={1}>
                      <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="flex-start">
                        <Box sx={{ minWidth: 0 }}>
                          <Typography className="ocr-line-title">{name}</Typography>
                          {article ? <Typography className="muted-copy">Артикул: {article}</Typography> : null}
                        </Box>
                        <Typography className="ocr-line-total">{formatMoney(lineTotal) || "—"}</Typography>
                      </Stack>
                      <Box className="ocr-line-meta">
                        <span>{`Кол-во ${quantity !== null ? formatCompactNumber(quantity) : "—"}${unitName ? ` ${unitName}` : ""}`}</span>
                        <span>{`Цена ${formatMoney(price) || "—"}`}</span>
                        <span>{`Сумма ${formatMoney(lineTotal) || "—"}`}</span>
                      </Box>
                    </Stack>
                  </Paper>
                );
              })}
            </Box>
            {selectedRepairDocumentParts.length > 8 ? (
              <Typography className="muted-copy">И ещё {selectedRepairDocumentParts.length - 8} строк запчастей.</Typography>
            ) : null}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  );
}
