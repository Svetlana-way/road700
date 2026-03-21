import { Alert, Box, Button, Chip, Grid, Paper, Stack, TextField, Typography } from "@mui/material";
import type {
  HistoricalRepairImportResponse,
  HistoricalWorkReferenceItem,
  ImportConflictItem,
  ImportJobItem,
} from "../shared/importAdminTypes";

type HistoricalImportsAdminPanelProps = {
  historicalImportLoading: boolean;
  historicalImportFile: File | null;
  historicalImportLimit: string;
  historicalImportResult: HistoricalRepairImportResponse | null;
  historicalImportJobs: ImportJobItem[];
  historicalImportJobsLoading: boolean;
  historicalWorkReference: HistoricalWorkReferenceItem[];
  historicalWorkReferenceLoading: boolean;
  historicalWorkReferenceTotal: number;
  historicalWorkReferenceQuery: string;
  historicalWorkReferenceMinSamples: string;
  importConflicts: ImportConflictItem[];
  importConflictsLoading: boolean;
  canRefreshJournal: boolean;
  onHistoricalImportFileChange: (file: File | null) => void;
  onHistoricalImportLimitChange: (value: string) => void;
  onStartHistoricalImport: () => void;
  onRefreshJournal: () => void;
  onOpenImportedRepair: (repairId: number) => void;
  onHistoricalWorkReferenceQueryChange: (value: string) => void;
  onHistoricalWorkReferenceMinSamplesChange: (value: string) => void;
  onRefreshHistoricalWorkReference: () => void;
  onOpenImportConflict: (conflictId: number) => void;
  formatStatus: (value: string) => string;
  formatMoney: (value?: number | null) => string | null;
  formatCompactNumber: (value: number | null | undefined) => string | null;
  formatHours: (value?: number | null) => string | null;
  formatDateValue: (value: string) => string;
  formatDateTime: (value: string) => string;
};

export function HistoricalImportsAdminPanel({
  historicalImportLoading,
  historicalImportFile,
  historicalImportLimit,
  historicalImportResult,
  historicalImportJobs,
  historicalImportJobsLoading,
  historicalWorkReference,
  historicalWorkReferenceLoading,
  historicalWorkReferenceTotal,
  historicalWorkReferenceQuery,
  historicalWorkReferenceMinSamples,
  importConflicts,
  importConflictsLoading,
  canRefreshJournal,
  onHistoricalImportFileChange,
  onHistoricalImportLimitChange,
  onStartHistoricalImport,
  onRefreshJournal,
  onOpenImportedRepair,
  onHistoricalWorkReferenceQueryChange,
  onHistoricalWorkReferenceMinSamplesChange,
  onRefreshHistoricalWorkReference,
  onOpenImportConflict,
  formatStatus,
  formatMoney,
  formatCompactNumber,
  formatHours,
  formatDateValue,
  formatDateTime,
}: HistoricalImportsAdminPanelProps) {
  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Импорт исторических ремонтов</Typography>
          <Typography className="muted-copy">
            Загрузите Excel-выгрузку вида `2025 для ИИ.xlsx`. Импорт собирает строки в ремонты, связывает их с техникой,
            создаёт предварительные сервисы при необходимости и выносит проблемы в конфликты.
          </Typography>
        </Box>
        <Paper className="repair-line" elevation={0}>
          <Stack spacing={1.25}>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={5}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                  <Button component="label" variant="outlined">
                    Выбрать .xlsx
                    <input
                      hidden
                      type="file"
                      accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={(event) => onHistoricalImportFileChange(event.target.files?.[0] ?? null)}
                    />
                  </Button>
                  <Typography className="muted-copy">{historicalImportFile ? historicalImportFile.name : "Файл не выбран"}</Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  label="Сколько новых ремонтов за запуск"
                  type="number"
                  value={historicalImportLimit}
                  onChange={(event) => onHistoricalImportLimitChange(event.target.value)}
                  helperText="Оставьте пустым для полного импорта"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button variant="contained" disabled={historicalImportLoading || !historicalImportFile} onClick={onStartHistoricalImport}>
                    {historicalImportLoading ? "Импорт..." : "Импортировать историю"}
                  </Button>
                  <Button variant="text" disabled={!canRefreshJournal} onClick={onRefreshJournal}>
                    Обновить журнал
                  </Button>
                </Stack>
              </Grid>
            </Grid>
            <Alert severity="info">
              Для первого запуска безопаснее идти батчами по `500-1000` новых ремонтов: дубликаты будут пропущены, конфликты
              попадут в дашборд качества данных.
            </Alert>
          </Stack>
        </Paper>

        {historicalImportResult ? (
          <Paper className="repair-line" elevation={0}>
            <Stack spacing={1}>
              <Typography className="metric-label">Последний результат импорта</Typography>
              <Typography>
                {historicalImportResult.source_filename} · статус {formatStatus(historicalImportResult.status)}
              </Typography>
              <Typography className="muted-copy">
                Строк {historicalImportResult.rows_total} · групп ремонтов {historicalImportResult.grouped_repairs} · создано{" "}
                {historicalImportResult.created_repairs} · дублей {historicalImportResult.duplicate_repairs} · конфликтов{" "}
                {historicalImportResult.conflicts_created}
              </Typography>
              <Typography className="muted-copy">
                Сервисов создано {historicalImportResult.created_services} · строк работ {historicalImportResult.created_works} ·
                строк материалов {historicalImportResult.created_parts}
              </Typography>
              {historicalImportResult.sample_conflicts.length > 0 ? (
                <Stack spacing={0.5}>
                  {historicalImportResult.sample_conflicts.map((item, index) => (
                    <Typography className="muted-copy" key={`historical-import-conflict-${index}`}>
                      {item}
                    </Typography>
                  ))}
                </Stack>
              ) : null}
              {historicalImportResult.first_repair_id ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button variant="outlined" onClick={() => onOpenImportedRepair(historicalImportResult.first_repair_id as number)}>
                    Открыть первый импортированный ремонт
                  </Button>
                </Stack>
              ) : null}
            </Stack>
          </Paper>
        ) : null}

        <Paper className="repair-line" elevation={0}>
          <Stack spacing={1.25}>
            <Box>
              <Typography className="metric-label">Динамический справочник работ</Typography>
              <Typography className="muted-copy">
                Каталог собирается из архива `2025 для ИИ` и автоматически дополняется новыми подтвержденными ремонтами.
                Его можно использовать как актуальный эталон по ценам, повторяемости и пробегам.
              </Typography>
            </Box>
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Поиск по работе, коду или сервису"
                  value={historicalWorkReferenceQuery}
                  onChange={(event) => onHistoricalWorkReferenceQueryChange(event.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <TextField
                  fullWidth
                  type="number"
                  label="Мин. повторений"
                  value={historicalWorkReferenceMinSamples}
                  onChange={(event) => onHistoricalWorkReferenceMinSamplesChange(event.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Button fullWidth variant="contained" disabled={historicalWorkReferenceLoading} onClick={onRefreshHistoricalWorkReference}>
                  {historicalWorkReferenceLoading ? "Загрузка..." : "Обновить справочник"}
                </Button>
              </Grid>
            </Grid>
            <Typography className="muted-copy">Найдено агрегированных работ: {historicalWorkReferenceTotal}</Typography>
            {historicalWorkReferenceLoading ? (
              <Typography className="muted-copy">Собираем динамический справочник работ...</Typography>
            ) : historicalWorkReference.length > 0 ? (
              <Stack spacing={1}>
                {historicalWorkReference.map((item) => (
                  <Paper className="repair-line" key={item.key} elevation={0}>
                    <Stack spacing={0.75}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                      >
                        <Box>
                          <Typography>{item.work_name}</Typography>
                          <Typography className="muted-copy">
                            {item.work_code ? `${item.work_code} · ` : ""}
                            ремонтов {item.sample_repairs} · строк {item.sample_lines} · сервисов {item.services_count}
                          </Typography>
                        </Box>
                        <Chip size="small" variant="outlined" label={`Медиана ${formatMoney(item.median_line_total) || "—"}`} />
                      </Stack>
                      <Typography className="muted-copy">
                        Архив 2025: ремонтов {item.historical_sample_repairs} · строк {item.historical_sample_lines}
                        {` · `}
                        Новые подтвержденные: ремонтов {item.operational_sample_repairs} · строк {item.operational_sample_lines}
                      </Typography>
                      <Typography className="muted-copy">
                        Кол-во {formatCompactNumber(item.median_quantity)} · цена {formatMoney(item.median_price) || "—"} ·
                        диапазон {formatMoney(item.min_line_total) || "—"} - {formatMoney(item.max_line_total) || "—"}
                      </Typography>
                      <Typography className="muted-copy">
                        Типы ТС: {item.vehicle_types.join(", ") || "—"}
                        {item.median_mileage !== null ? ` · медианный пробег ${item.median_mileage}` : ""}
                        {item.min_mileage !== null && item.max_mileage !== null ? ` · диапазон пробега ${item.min_mileage}-${item.max_mileage}` : ""}
                        {item.median_standard_hours !== null ? ` · норма ${formatHours(item.median_standard_hours)}` : ""}
                        {item.median_actual_hours !== null ? ` · факт ${formatHours(item.median_actual_hours)}` : ""}
                        {item.recent_repair_date ? ` · последнее использование ${formatDateValue(item.recent_repair_date)}` : ""}
                        {item.recent_operational_repair_date
                          ? ` · последняя новая запись ${formatDateValue(item.recent_operational_repair_date)}`
                          : ""}
                      </Typography>
                      {item.top_services.length > 0 ? (
                        <Typography className="muted-copy">
                          Часто встречается: {item.top_services.map((service) => `${service.service_name} (${service.samples})`).join(", ")}
                        </Typography>
                      ) : null}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography className="muted-copy">
                Справочник пока пуст. Сначала импортируйте `2025 для ИИ.xlsx` или накопите подтвержденные ремонты.
              </Typography>
            )}
          </Stack>
        </Paper>

        <Paper className="repair-line" elevation={0}>
          <Stack spacing={1}>
            <Typography className="metric-label">Журнал импортов</Typography>
            {historicalImportJobsLoading ? (
              <Typography className="muted-copy">Загрузка журнала импортов...</Typography>
            ) : historicalImportJobs.length > 0 ? (
              historicalImportJobs.map((job) => (
                <Paper className="repair-line" key={`historical-job-${job.id}`} elevation={0}>
                  <Stack spacing={0.5}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                      <Typography>{job.source_filename}</Typography>
                      <Chip
                        size="small"
                        color={job.status === "failed" ? "error" : job.status === "completed_with_conflicts" ? "warning" : "default"}
                        label={formatStatus(job.status)}
                      />
                    </Stack>
                    <Typography className="muted-copy">Job #{job.id} · {formatDateTime(job.created_at)}</Typography>
                    {job.summary ? (
                      <Typography className="muted-copy">
                        Создано {String(job.summary.created_repairs ?? "0")} · конфликтов{" "}
                        {String(job.summary.conflicts_created ?? "0")} · дублей {String(job.summary.duplicate_repairs ?? "0")}
                      </Typography>
                    ) : null}
                    {job.error_message ? <Typography className="muted-copy">{job.error_message}</Typography> : null}
                  </Stack>
                </Paper>
              ))
            ) : (
              <Typography className="muted-copy">Исторические импорты пока не запускались.</Typography>
            )}
          </Stack>
        </Paper>

        <Paper className="repair-line" elevation={0}>
          <Stack spacing={1}>
            <Typography className="metric-label">Конфликты импорта в работе</Typography>
            {importConflictsLoading ? (
              <Typography className="muted-copy">Загрузка конфликтов...</Typography>
            ) : importConflicts.length > 0 ? (
              importConflicts.map((item) => (
                <Paper className="repair-line" key={`import-conflict-${item.id}`} elevation={0}>
                  <Stack spacing={0.75}>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                      <Typography>{item.entity_type}</Typography>
                      <Chip size="small" color="warning" label={formatStatus(item.status)} />
                    </Stack>
                    <Typography className="muted-copy">
                      {[item.conflict_key, item.source_filename, formatDateTime(item.created_at)].filter(Boolean).join(" · ")}
                    </Typography>
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button size="small" variant="contained" onClick={() => onOpenImportConflict(item.id)}>
                        Разобрать
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))
            ) : (
              <Typography className="muted-copy">Открытых конфликтов импорта сейчас нет.</Typography>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Paper>
  );
}
