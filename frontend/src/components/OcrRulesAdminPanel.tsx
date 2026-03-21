import { Box, Button, Chip, Grid, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import type { OcrRuleItem } from "../shared/workspaceBootstrapTypes";
import type { OcrRuleFormState } from "../shared/workspaceFormTypes";

type OcrRulesAdminPanelProps = {
  ocrRuleProfileFilter: string;
  ocrRuleProfiles: string[];
  ocrRuleTargetFields: string[];
  ocrRules: OcrRuleItem[];
  ocrRuleForm: OcrRuleFormState;
  ocrRuleSaving: boolean;
  onProfileFilterChange: (value: string) => void;
  onRefresh: () => void;
  onResetFilter: () => void;
  onFormChange: (field: keyof OcrRuleFormState, value: string) => void;
  onSave: () => void;
  onResetForm: () => void;
  onEdit: (item: OcrRuleItem) => void;
  formatOcrProfileName: (value: string | null | undefined) => string;
  formatOcrFieldLabel: (value: string) => string;
  formatValueParserLabel: (value: string) => string;
};

export function OcrRulesAdminPanel({
  ocrRuleProfileFilter,
  ocrRuleProfiles,
  ocrRuleTargetFields,
  ocrRules,
  ocrRuleForm,
  ocrRuleSaving,
  onProfileFilterChange,
  onRefresh,
  onResetFilter,
  onFormChange,
  onSave,
  onResetForm,
  onEdit,
  formatOcrProfileName,
  formatOcrFieldLabel,
  formatValueParserLabel,
}: OcrRulesAdminPanelProps) {
  const defaultTargetFields = [
    "order_number",
    "repair_date",
    "mileage",
    "plate_number",
    "vin",
    "service_name",
    "work_total",
    "parts_total",
    "vat_total",
    "grand_total",
  ];

  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Правила извлечения полей OCR</Typography>
          <Typography className="muted-copy">
            Шаблоны и правила поиска для извлечения номера заказ-наряда, даты, пробега, VIN, сервиса и сумм из разных форматов документов.
          </Typography>
        </Box>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Шаблон OCR"
              value={ocrRuleProfileFilter}
              onChange={(event) => onProfileFilterChange(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Все шаблоны</MenuItem>
              {ocrRuleProfiles.map((item) => (
                <MenuItem key={item} value={item}>
                  {formatOcrProfileName(item)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={8}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="outlined" onClick={onRefresh}>
                Обновить список
              </Button>
              <Button variant="text" onClick={onResetFilter}>
                Сбросить фильтр
              </Button>
            </Stack>
          </Grid>
        </Grid>
        <Paper className="repair-line" elevation={0}>
          <Stack spacing={1.25}>
            <Typography className="metric-label">Создание и редактирование OCR-правила</Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Шаблон OCR"
                  value={ocrRuleForm.profile_scope}
                  onChange={(event) => onFormChange("profile_scope", event.target.value)}
                  helperText="Например: Базовый или код шаблона сервиса"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  select
                  label="Поле"
                  value={ocrRuleForm.target_field}
                  onChange={(event) => onFormChange("target_field", event.target.value)}
                  fullWidth
                >
                  {[...defaultTargetFields, ...ocrRuleTargetFields.filter((item) => !defaultTargetFields.includes(item))].map((item) => (
                    <MenuItem key={item} value={item}>
                      {formatOcrFieldLabel(item)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  select
                  label="Обработка значения"
                  value={ocrRuleForm.value_parser}
                  onChange={(event) => onFormChange("value_parser", event.target.value)}
                  fullWidth
                >
                  <MenuItem value="raw">Без обработки</MenuItem>
                  <MenuItem value="date">Дата</MenuItem>
                  <MenuItem value="amount">Сумма</MenuItem>
                  <MenuItem value="digits_int">Целое число</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  label="Уверенность"
                  value={ocrRuleForm.confidence}
                  onChange={(event) => onFormChange("confidence", event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  label="Приоритет"
                  value={ocrRuleForm.priority}
                  onChange={(event) => onFormChange("priority", event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  select
                  label="Активность"
                  value={ocrRuleForm.is_active}
                  onChange={(event) => onFormChange("is_active", event.target.value)}
                  fullWidth
                >
                  <MenuItem value="true">Активно</MenuItem>
                  <MenuItem value="false">Отключено</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={9}>
                <TextField
                  label="Выражение поиска"
                  value={ocrRuleForm.pattern}
                  onChange={(event) => onFormChange("pattern", event.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Примечание"
                  value={ocrRuleForm.notes}
                  onChange={(event) => onFormChange("notes", event.target.value)}
                  fullWidth
                />
              </Grid>
            </Grid>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="contained" disabled={ocrRuleSaving} onClick={onSave}>
                {ocrRuleSaving ? "Сохранение..." : ocrRuleForm.id ? "Сохранить OCR-правило" : "Создать OCR-правило"}
              </Button>
              <Button variant="text" disabled={ocrRuleSaving} onClick={onResetForm}>
                Сбросить форму
              </Button>
            </Stack>
          </Stack>
        </Paper>
        <Typography className="muted-copy">В OCR-справочнике {ocrRules.length} правил по текущему фильтру.</Typography>
        {ocrRules.length > 0 ? (
          <Stack spacing={1}>
            {ocrRules.map((item) => (
              <Paper className="repair-line" key={`ocr-rule-${item.id}`} elevation={0}>
                <Stack spacing={0.5}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography>{formatOcrFieldLabel(item.target_field)}</Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip
                        size="small"
                        color={item.is_active ? "success" : "default"}
                        label={item.is_active ? "Активно" : "Отключено"}
                      />
                      <Chip size="small" variant="outlined" label={formatOcrProfileName(item.profile_scope)} />
                    </Stack>
                  </Stack>
                  <Typography className="muted-copy">
                    обработка {formatValueParserLabel(item.value_parser)} · уверенность {item.confidence} · приоритет {item.priority}
                  </Typography>
                  <Typography className="muted-copy" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {item.pattern}
                  </Typography>
                  {item.notes ? <Typography className="muted-copy">{item.notes}</Typography> : null}
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="outlined" onClick={() => onEdit(item)}>
                      Редактировать
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Typography className="muted-copy">OCR-правила по текущему фильтру не найдены.</Typography>
        )}
      </Stack>
    </Paper>
  );
}
