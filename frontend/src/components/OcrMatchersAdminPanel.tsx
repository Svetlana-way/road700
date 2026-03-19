import { Box, Button, Chip, Grid, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";

type OcrProfileMatcherItem = {
  id: number;
  profile_scope: string;
  title: string;
  source_type: string | null;
  filename_pattern: string | null;
  text_pattern: string | null;
  service_name_pattern: string | null;
  priority: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type OcrProfileMatcherFormState = {
  id: number | null;
  profile_scope: string;
  title: string;
  source_type: string;
  filename_pattern: string;
  text_pattern: string;
  service_name_pattern: string;
  priority: string;
  is_active: "true" | "false";
  notes: string;
};

type OcrMatchersAdminPanelProps = {
  ocrProfileMatcherProfileFilter: string;
  ocrProfileMatcherProfiles: string[];
  ocrProfileMatchers: OcrProfileMatcherItem[];
  ocrProfileMatcherForm: OcrProfileMatcherFormState;
  ocrProfileMatcherSaving: boolean;
  onProfileFilterChange: (value: string) => void;
  onRefresh: () => void;
  onResetFilter: () => void;
  onFormChange: (field: keyof OcrProfileMatcherFormState, value: string) => void;
  onSave: () => void;
  onResetForm: () => void;
  onEdit: (item: OcrProfileMatcherItem) => void;
  formatOcrProfileName: (value: string | null | undefined) => string;
  formatSourceTypeLabel: (value: string | null | undefined) => string;
};

export function OcrMatchersAdminPanel({
  ocrProfileMatcherProfileFilter,
  ocrProfileMatcherProfiles,
  ocrProfileMatchers,
  ocrProfileMatcherForm,
  ocrProfileMatcherSaving,
  onProfileFilterChange,
  onRefresh,
  onResetFilter,
  onFormChange,
  onSave,
  onResetForm,
  onEdit,
  formatOcrProfileName,
  formatSourceTypeLabel,
}: OcrMatchersAdminPanelProps) {
  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Автовыбор шаблона OCR</Typography>
          <Typography className="muted-copy">
            Правила выбора шаблона распознавания по типу файла, имени файла, сервису и текстовым признакам документа. Если правил нет, используется история ремонта и затем базовый шаблон.
          </Typography>
        </Box>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Шаблон OCR"
              value={ocrProfileMatcherProfileFilter}
              onChange={(event) => onProfileFilterChange(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Все шаблоны</MenuItem>
              {ocrProfileMatcherProfiles.map((item) => (
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
            <Typography className="metric-label">Создание и редактирование правила выбора шаблона</Typography>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Шаблон OCR"
                  value={ocrProfileMatcherForm.profile_scope}
                  onChange={(event) => onFormChange("profile_scope", event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField
                  label="Название"
                  value={ocrProfileMatcherForm.title}
                  onChange={(event) => onFormChange("title", event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  select
                  label="Тип файла"
                  value={ocrProfileMatcherForm.source_type}
                  onChange={(event) => onFormChange("source_type", event.target.value)}
                  fullWidth
                >
                  <MenuItem value="">Любой</MenuItem>
                  <MenuItem value="pdf">PDF</MenuItem>
                  <MenuItem value="image">Изображение</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  label="Приоритет"
                  value={ocrProfileMatcherForm.priority}
                  onChange={(event) => onFormChange("priority", event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Шаблон имени файла"
                  value={ocrProfileMatcherForm.filename_pattern}
                  onChange={(event) => onFormChange("filename_pattern", event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Текстовый признак"
                  value={ocrProfileMatcherForm.text_pattern}
                  onChange={(event) => onFormChange("text_pattern", event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Признак сервиса"
                  value={ocrProfileMatcherForm.service_name_pattern}
                  onChange={(event) => onFormChange("service_name_pattern", event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  select
                  label="Активность"
                  value={ocrProfileMatcherForm.is_active}
                  onChange={(event) => onFormChange("is_active", event.target.value)}
                  fullWidth
                >
                  <MenuItem value="true">Активно</MenuItem>
                  <MenuItem value="false">Отключено</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={9}>
                <TextField
                  label="Примечание"
                  value={ocrProfileMatcherForm.notes}
                  onChange={(event) => onFormChange("notes", event.target.value)}
                  fullWidth
                />
              </Grid>
            </Grid>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="contained" disabled={ocrProfileMatcherSaving} onClick={onSave}>
                {ocrProfileMatcherSaving
                  ? "Сохранение..."
                  : ocrProfileMatcherForm.id
                    ? "Сохранить правило выбора"
                    : "Создать правило выбора"}
              </Button>
              <Button variant="text" disabled={ocrProfileMatcherSaving} onClick={onResetForm}>
                Сбросить форму
              </Button>
            </Stack>
          </Stack>
        </Paper>
        <Typography className="muted-copy">В правилах выбора шаблона {ocrProfileMatchers.length} записей.</Typography>
        {ocrProfileMatchers.length > 0 ? (
          <Stack spacing={1}>
            {ocrProfileMatchers.map((item) => (
              <Paper className="repair-line" key={`ocr-matcher-${item.id}`} elevation={0}>
                <Stack spacing={0.5}>
                  <Stack direction="row" justifyContent="space-between" spacing={1}>
                    <Typography>{item.title}</Typography>
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
                    {item.source_type ? `тип файла ${formatSourceTypeLabel(item.source_type)} · ` : ""}
                    {`приоритет ${item.priority}`}
                  </Typography>
                  <Typography className="muted-copy">
                    Файл: {item.filename_pattern || "—"}
                    {` · Текст: ${item.text_pattern || "—"}`}
                    {` · Сервис: ${item.service_name_pattern || "—"}`}
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
          <Typography className="muted-copy">Правила выбора шаблона по текущему фильтру не найдены.</Typography>
        )}
      </Stack>
    </Paper>
  );
}
