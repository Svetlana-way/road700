import { Alert, Box, Button, Chip, Grid, Paper, Stack, TextField, Typography } from "@mui/material";
import type { ReviewComparisonStatus } from "../shared/repairUiHelpers";
import type {
  ReviewRepairFieldsDraft,
  ReviewRequiredFieldComparisonItem,
} from "../shared/workspaceFormTypes";

type ReviewRequiredFieldsPanelProps = {
  canConfirmSelectedReview: boolean;
  reviewReadyFieldsCount: number;
  reviewRequiredFieldComparisons: ReviewRequiredFieldComparisonItem[];
  reviewFieldSaving: boolean;
  showReviewFieldEditor: boolean;
  reviewFieldDraft: ReviewRepairFieldsDraft | null;
  reviewMissingRequiredFields: string[];
  onToggleEditor: () => void;
  onFillFromOcr: () => void;
  onDraftChange: <K extends keyof ReviewRepairFieldsDraft>(field: K, value: ReviewRepairFieldsDraft[K]) => void;
  onSave: () => void;
  getReviewComparisonColor: (status: ReviewComparisonStatus) => "default" | "success" | "warning" | "error";
  getReviewComparisonLabel: (status: ReviewComparisonStatus) => string;
  getConfidenceColor: (value: number | null) => "default" | "success" | "warning" | "error";
  formatConfidenceLabel: (value: number | null) => string;
};

export function ReviewRequiredFieldsPanel({
  canConfirmSelectedReview,
  reviewReadyFieldsCount,
  reviewRequiredFieldComparisons,
  reviewFieldSaving,
  showReviewFieldEditor,
  reviewFieldDraft,
  reviewMissingRequiredFields,
  onToggleEditor,
  onFillFromOcr,
  onDraftChange,
  onSave,
  getReviewComparisonColor,
  getReviewComparisonLabel,
  getConfidenceColor,
  formatConfidenceLabel,
}: ReviewRequiredFieldsPanelProps) {
  return (
    <Paper className="repair-line repair-review-split" elevation={0}>
      <Stack spacing={1.25}>
        <Box>
          <Typography variant="subtitle1">Сверка обязательных полей</Typography>
          <Typography className="muted-copy">
            Перед подтверждением проверьте обязательные поля и при необходимости поправьте их прямо здесь.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            color={canConfirmSelectedReview ? "success" : "warning"}
            label={`Готово ${reviewReadyFieldsCount}/${reviewRequiredFieldComparisons.length}`}
          />
          <Button size="small" variant="outlined" disabled={reviewFieldSaving} onClick={onToggleEditor}>
            {showReviewFieldEditor ? "Скрыть правки" : "Править поля"}
          </Button>
          <Button size="small" variant="text" disabled={reviewFieldSaving} onClick={onFillFromOcr}>
            Заполнить из OCR
          </Button>
        </Stack>
        {!canConfirmSelectedReview ? (
          <Alert severity="warning">Для подтверждения нужно заполнить: {reviewMissingRequiredFields.join(", ")}.</Alert>
        ) : null}
        <Grid container spacing={1.25}>
          {reviewRequiredFieldComparisons.map((item) => (
            <Grid item xs={12} sm={6} key={item.key}>
              <Paper className="repair-line" elevation={0}>
                <Stack spacing={0.75}>
                  <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                    <Typography className="metric-label">{item.label}</Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap justifyContent="flex-end">
                      <Chip
                        size="small"
                        color={getReviewComparisonColor(item.status)}
                        label={getReviewComparisonLabel(item.status)}
                      />
                      <Chip
                        size="small"
                        variant="outlined"
                        color={getConfidenceColor(item.confidenceValue)}
                        label={formatConfidenceLabel(item.confidenceValue)}
                      />
                    </Stack>
                  </Stack>
                  <Typography>В ремонте: {item.currentDisplay}</Typography>
                  <Typography className="muted-copy">OCR: {item.ocrDisplay}</Typography>
                </Stack>
              </Paper>
            </Grid>
          ))}
        </Grid>
        {showReviewFieldEditor && reviewFieldDraft ? (
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Номер заказ-наряда"
                value={reviewFieldDraft.order_number}
                onChange={(event) => onDraftChange("order_number", event.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="date"
                fullWidth
                label="Дата ремонта"
                value={reviewFieldDraft.repair_date}
                onChange={(event) => onDraftChange("repair_date", event.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Пробег"
                value={reviewFieldDraft.mileage}
                onChange={(event) => onDraftChange("mileage", event.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Итоговая сумма"
                value={reviewFieldDraft.grand_total}
                onChange={(event) => onDraftChange("grand_total", event.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Работы"
                value={reviewFieldDraft.work_total}
                onChange={(event) => onDraftChange("work_total", event.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="Запчасти"
                value={reviewFieldDraft.parts_total}
                onChange={(event) => onDraftChange("parts_total", event.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="НДС"
                value={reviewFieldDraft.vat_total}
                onChange={(event) => onDraftChange("vat_total", event.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Причина ремонта"
                value={reviewFieldDraft.reason}
                onChange={(event) => onDraftChange("reason", event.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Комментарий сотрудника"
                value={reviewFieldDraft.employee_comment}
                onChange={(event) => onDraftChange("employee_comment", event.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <Button variant="contained" disabled={reviewFieldSaving} onClick={onSave}>
                {reviewFieldSaving ? "Сохранение..." : "Сохранить поля проверки"}
              </Button>
            </Grid>
          </Grid>
        ) : null}
      </Stack>
    </Paper>
  );
}
