import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { OcrLearningSignalItem, OcrLearningSummaryItem } from "../shared/workspaceBootstrapTypes";

type OcrLearningAdminPanelProps = {
  ocrLearningStatusFilter: string;
  ocrLearningTargetFieldFilter: string;
  ocrLearningProfileScopeFilter: string;
  ocrLearningStatuses: string[];
  ocrLearningTargetFields: string[];
  ocrLearningProfileScopes: string[];
  ocrLearningLoading: boolean;
  ocrLearningSummaries: OcrLearningSummaryItem[];
  ocrLearningSignals: OcrLearningSignalItem[];
  showOcrLearningListDialog: boolean;
  ocrLearningDraftId: number | null;
  ocrLearningUpdateId: number | null;
  onOcrLearningStatusFilterChange: (value: string) => void;
  onOcrLearningTargetFieldFilterChange: (value: string) => void;
  onOcrLearningProfileScopeFilterChange: (value: string) => void;
  onRefresh: () => void;
  onReset: () => void;
  onOpenListDialog: () => void;
  onCloseListDialog: () => void;
  onLoadDraft: (signalId: number, draftType: "ocr_rule" | "matcher") => void;
  onUpdateSignalStatus: (signalId: number, nextStatus: string) => void;
  formatOcrLearningStatusLabel: (value: string) => string;
  formatOcrProfileName: (value: string | null | undefined) => string;
  formatOcrFieldLabel: (value: string) => string;
  formatOcrSignalTypeLabel: (value: string) => string;
};

export function OcrLearningAdminPanel({
  ocrLearningStatusFilter,
  ocrLearningTargetFieldFilter,
  ocrLearningProfileScopeFilter,
  ocrLearningStatuses,
  ocrLearningTargetFields,
  ocrLearningProfileScopes,
  ocrLearningLoading,
  ocrLearningSummaries,
  ocrLearningSignals,
  showOcrLearningListDialog,
  ocrLearningDraftId,
  ocrLearningUpdateId,
  onOcrLearningStatusFilterChange,
  onOcrLearningTargetFieldFilterChange,
  onOcrLearningProfileScopeFilterChange,
  onRefresh,
  onReset,
  onOpenListDialog,
  onCloseListDialog,
  onLoadDraft,
  onUpdateSignalStatus,
  formatOcrLearningStatusLabel,
  formatOcrProfileName,
  formatOcrFieldLabel,
  formatOcrSignalTypeLabel,
}: OcrLearningAdminPanelProps) {
  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Очередь обучения OCR</Typography>
          <Typography className="muted-copy">
            Сигналы строятся из ручных исправлений администратора и показывают, где OCR регулярно ошибается или ничего не извлекает.
          </Typography>
        </Box>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Статус"
              value={ocrLearningStatusFilter}
              onChange={(event) => onOcrLearningStatusFilterChange(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Все кроме отклонённых</MenuItem>
              {ocrLearningStatuses.map((item) => (
                <MenuItem key={item} value={item}>
                  {formatOcrLearningStatusLabel(item)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Поле"
              value={ocrLearningTargetFieldFilter}
              onChange={(event) => onOcrLearningTargetFieldFilterChange(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Все поля</MenuItem>
              {ocrLearningTargetFields.map((item) => (
                <MenuItem key={item} value={item}>
                  {formatOcrFieldLabel(item)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Шаблон OCR"
              value={ocrLearningProfileScopeFilter}
              onChange={(event) => onOcrLearningProfileScopeFilterChange(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Все шаблоны</MenuItem>
              {ocrLearningProfileScopes.map((item) => (
                <MenuItem key={item} value={item}>
                  {formatOcrProfileName(item)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" onClick={onRefresh} disabled={ocrLearningLoading}>
            {ocrLearningLoading ? "Загрузка..." : "Обновить"}
          </Button>
          <Button variant="text" disabled={ocrLearningLoading} onClick={onReset}>
            Сбросить фильтр
          </Button>
        </Stack>
        {ocrLearningSummaries.length > 0 ? (
          <Stack spacing={1}>
            {ocrLearningSummaries.slice(0, 6).map((item, index) => (
              <Paper className="repair-line" key={`ocr-learning-summary-${index}`} elevation={0}>
                <Stack spacing={0.5}>
                  <Typography>{item.suggestion_summary}</Typography>
                  <Typography className="muted-copy">
                    Сигналов {item.count}
                    {item.ocr_profile_scope ? ` · шаблон ${formatOcrProfileName(item.ocr_profile_scope)}` : ""}
                    {` · поле ${formatOcrFieldLabel(item.target_field)}`}
                    {` · тип ${formatOcrSignalTypeLabel(item.signal_type)}`}
                  </Typography>
                  {item.example_services.length > 0 ? (
                    <Typography className="muted-copy">Сервисы: {item.example_services.join(", ")}</Typography>
                  ) : null}
                  {item.example_filenames.length > 0 ? (
                    <Typography className="muted-copy">Файлы: {item.example_filenames.join(", ")}</Typography>
                  ) : null}
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : null}
        {ocrLearningSignals.length > 0 ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
            <Button variant="outlined" disabled={ocrLearningLoading} onClick={onOpenListDialog}>
              Открыть список сигналов
            </Button>
            <Typography className="muted-copy">
              На основной странице показана только сводка, полный список сигналов скрыт.
            </Typography>
          </Stack>
        ) : (
          <Typography className="muted-copy">Сигналы обучения пока не накоплены.</Typography>
        )}
        <Dialog open={showOcrLearningListDialog} onClose={onCloseListDialog} fullWidth maxWidth="lg">
          <DialogTitle>Сигналы обучения OCR</DialogTitle>
          <DialogContent dividers>
            {ocrLearningSignals.length > 0 ? (
              <Stack spacing={1}>
                {ocrLearningSignals.map((item) => (
                  <Paper className="repair-line" key={`ocr-learning-${item.id}`} elevation={0}>
                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography>
                          {formatOcrFieldLabel(item.target_field)} · {formatOcrSignalTypeLabel(item.signal_type)}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                          <Chip size="small" variant="outlined" label={formatOcrLearningStatusLabel(item.status)} />
                          {item.ocr_profile_scope ? (
                            <Chip size="small" variant="outlined" label={formatOcrProfileName(item.ocr_profile_scope)} />
                          ) : null}
                        </Stack>
                      </Stack>
                      <Typography className="muted-copy">
                        Ремонт #{item.repair_id}
                        {item.document_id ? ` · документ #${item.document_id}` : ""}
                        {item.service_name ? ` · ${item.service_name}` : ""}
                        {item.document_filename ? ` · ${item.document_filename}` : ""}
                      </Typography>
                      <Typography className="muted-copy">
                        OCR: {item.extracted_value || "не извлечено"}
                        {` · Исправлено: ${item.corrected_value}`}
                      </Typography>
                      {item.suggestion_summary ? <Typography className="muted-copy">{item.suggestion_summary}</Typography> : null}
                      {item.text_excerpt ? (
                        <Typography className="muted-copy">
                          Фрагмент: {item.text_excerpt.slice(0, 180)}
                          {item.text_excerpt.length > 180 ? "..." : ""}
                        </Typography>
                      ) : null}
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={ocrLearningDraftId === item.id}
                          onClick={() => onLoadDraft(item.id, "ocr_rule")}
                        >
                          В OCR-правило
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={ocrLearningDraftId === item.id}
                          onClick={() => onLoadDraft(item.id, "matcher")}
                        >
                          В правило выбора
                        </Button>
                        {item.status !== "reviewed" ? (
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={ocrLearningUpdateId === item.id}
                            onClick={() => onUpdateSignalStatus(item.id, "reviewed")}
                          >
                            Пометить просмотренным
                          </Button>
                        ) : null}
                        {item.status !== "applied" ? (
                          <Button
                            size="small"
                            variant="text"
                            disabled={ocrLearningUpdateId === item.id}
                            onClick={() => onUpdateSignalStatus(item.id, "applied")}
                          >
                            Применить
                          </Button>
                        ) : null}
                        {item.status !== "rejected" ? (
                          <Button
                            size="small"
                            variant="text"
                            disabled={ocrLearningUpdateId === item.id}
                            onClick={() => onUpdateSignalStatus(item.id, "rejected")}
                          >
                            Отклонить
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography className="muted-copy">Сигналы обучения пока не накоплены.</Typography>
            )}
          </DialogContent>
        </Dialog>
      </Stack>
    </Paper>
  );
}
