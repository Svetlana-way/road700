import {
  Box,
  Button,
  Chip,
  CircularProgress,
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

type VehicleType = "truck" | "trailer";

type LaborNormCatalogItem = {
  id: number;
  scope: string;
  brand_family: string | null;
  catalog_name: string | null;
  code: string;
  category: string | null;
  name_ru: string;
  name_ru_alt: string | null;
  name_cn: string | null;
  name_en: string | null;
  normalized_name: string;
  standard_hours: number;
  source_sheet: string | null;
  source_file: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type LaborNormCatalogConfigItem = {
  id: number;
  scope: string;
  catalog_name: string;
  brand_family: string | null;
  vehicle_type: VehicleType | null;
  year_from: number | null;
  year_to: number | null;
  brand_keywords: string[] | null;
  model_keywords: string[] | null;
  vin_prefixes: string[] | null;
  priority: number;
  auto_match_enabled: boolean;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type LaborNormCatalogFormState = {
  scope: string;
  catalog_name: string;
  brand_family: string;
  vehicle_type: "" | VehicleType;
  year_from: string;
  year_to: string;
  brand_keywords: string;
  model_keywords: string;
  vin_prefixes: string;
  priority: string;
  auto_match_enabled: "true" | "false";
  status: string;
  notes: string;
};

type LaborNormEntryFormState = {
  id: number | null;
  scope: string;
  code: string;
  category: string;
  name_ru: string;
  name_ru_alt: string;
  name_cn: string;
  name_en: string;
  standard_hours: string;
  source_sheet: string;
  source_file: string;
  status: string;
};

type LaborNormsAdminPanelProps = {
  showLaborNormCatalogEditor: boolean;
  showLaborNormImport: boolean;
  showLaborNormEntryEditor: boolean;
  editingLaborNormCatalogId: number | null;
  laborNormCatalogForm: LaborNormCatalogFormState;
  laborNormCatalogSaving: boolean;
  laborNormCatalogs: LaborNormCatalogConfigItem[];
  laborNormQuery: string;
  laborNormScope: string;
  laborNormScopes: string[];
  laborNormCategory: string;
  laborNormCategories: string[];
  laborNormLoading: boolean;
  laborNormImportScope: string;
  laborNormImportBrandFamily: string;
  laborNormImportCatalogName: string;
  laborNormFile: File | null;
  laborNormImportLoading: boolean;
  laborNormEntryForm: LaborNormEntryFormState;
  laborNormEntrySaving: boolean;
  laborNormTotal: number;
  laborNormSourceFiles: string[];
  showLaborNormListDialog: boolean;
  laborNorms: LaborNormCatalogItem[];
  onToggleCatalogEditor: () => void;
  onToggleImport: () => void;
  onToggleEntryEditor: () => void;
  onCatalogFormChange: (field: keyof LaborNormCatalogFormState, value: string) => void;
  onSaveCatalog: () => void;
  onResetCatalogForm: () => void;
  onEditCatalog: (item: LaborNormCatalogConfigItem) => void;
  onSelectCatalogScope: (scope: string) => void;
  onQueryChange: (value: string) => void;
  onScopeChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSearch: () => void;
  onResetFilters: () => void;
  onImportBrandFamilyChange: (value: string) => void;
  onImportCatalogNameChange: (value: string) => void;
  onImportFileChange: (file: File | null) => void;
  onImport: () => void;
  onEntryFormChange: (field: keyof LaborNormEntryFormState, value: string) => void;
  onSaveEntry: () => void;
  onResetEntryForm: () => void;
  onOpenListDialog: () => void;
  onCloseListDialog: () => void;
  onEditItem: (item: LaborNormCatalogItem) => void;
  onArchiveItem: (item: LaborNormCatalogItem) => void;
  formatCatalogCodeLabel: (value: string | null | undefined) => string;
  formatStatus: (value: string) => string;
  formatHours: (value: number | null | undefined) => string | null;
};

export function LaborNormsAdminPanel({
  showLaborNormCatalogEditor,
  showLaborNormImport,
  showLaborNormEntryEditor,
  editingLaborNormCatalogId,
  laborNormCatalogForm,
  laborNormCatalogSaving,
  laborNormCatalogs,
  laborNormQuery,
  laborNormScope,
  laborNormScopes,
  laborNormCategory,
  laborNormCategories,
  laborNormLoading,
  laborNormImportScope,
  laborNormImportBrandFamily,
  laborNormImportCatalogName,
  laborNormFile,
  laborNormImportLoading,
  laborNormEntryForm,
  laborNormEntrySaving,
  laborNormTotal,
  laborNormSourceFiles,
  showLaborNormListDialog,
  laborNorms,
  onToggleCatalogEditor,
  onToggleImport,
  onToggleEntryEditor,
  onCatalogFormChange,
  onSaveCatalog,
  onResetCatalogForm,
  onEditCatalog,
  onSelectCatalogScope,
  onQueryChange,
  onScopeChange,
  onCategoryChange,
  onSearch,
  onResetFilters,
  onImportBrandFamilyChange,
  onImportCatalogNameChange,
  onImportFileChange,
  onImport,
  onEntryFormChange,
  onSaveEntry,
  onResetEntryForm,
  onOpenListDialog,
  onCloseListDialog,
  onEditItem,
  onArchiveItem,
  formatCatalogCodeLabel,
  formatStatus,
  formatHours,
}: LaborNormsAdminPanelProps) {
  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Справочник нормо-часов</Typography>
          <Typography className="muted-copy">
            Администратор управляет каталогами, правилами применимости, импортом и отдельными строками без участия разработчика.
          </Typography>
        </Box>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" useFlexGap>
          <Button variant={showLaborNormCatalogEditor ? "outlined" : "contained"} onClick={onToggleCatalogEditor}>
            {showLaborNormCatalogEditor ? "Скрыть каталог" : "Каталоги и применимость"}
          </Button>
          <Button variant={showLaborNormImport ? "outlined" : "contained"} onClick={onToggleImport}>
            {showLaborNormImport ? "Скрыть импорт" : "Импорт справочника"}
          </Button>
          <Button variant={showLaborNormEntryEditor ? "outlined" : "contained"} onClick={onToggleEntryEditor}>
            {showLaborNormEntryEditor ? "Скрыть форму записи" : "Добавить запись"}
          </Button>
        </Stack>

        {showLaborNormCatalogEditor ? (
          <Paper className="repair-line" elevation={0}>
            <Stack spacing={1.25}>
              <Typography className="metric-label">Каталоги и правила применимости</Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Код каталога"
                    value={laborNormCatalogForm.scope}
                    onChange={(event) => onCatalogFormChange("scope", event.target.value)}
                    fullWidth
                    disabled={editingLaborNormCatalogId !== null}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Название каталога"
                    value={laborNormCatalogForm.catalog_name}
                    onChange={(event) => onCatalogFormChange("catalog_name", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Семейство бренда"
                    value={laborNormCatalogForm.brand_family}
                    onChange={(event) => onCatalogFormChange("brand_family", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    select
                    label="Тип техники"
                    value={laborNormCatalogForm.vehicle_type}
                    onChange={(event) => onCatalogFormChange("vehicle_type", event.target.value)}
                    fullWidth
                  >
                    <MenuItem value="">Любой</MenuItem>
                    <MenuItem value="truck">Грузовик</MenuItem>
                    <MenuItem value="trailer">Прицеп</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Год от"
                    type="number"
                    value={laborNormCatalogForm.year_from}
                    onChange={(event) => onCatalogFormChange("year_from", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Год до"
                    type="number"
                    value={laborNormCatalogForm.year_to}
                    onChange={(event) => onCatalogFormChange("year_to", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Приоритет"
                    type="number"
                    value={laborNormCatalogForm.priority}
                    onChange={(event) => onCatalogFormChange("priority", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    label="Авто-матчинг"
                    value={laborNormCatalogForm.auto_match_enabled}
                    onChange={(event) => onCatalogFormChange("auto_match_enabled", event.target.value)}
                    fullWidth
                  >
                    <MenuItem value="true">Включён</MenuItem>
                    <MenuItem value="false">Выключен</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    label="Статус"
                    value={laborNormCatalogForm.status}
                    onChange={(event) => onCatalogFormChange("status", event.target.value)}
                    fullWidth
                  >
                    <MenuItem value="preliminary">Предварительный</MenuItem>
                    <MenuItem value="confirmed">Подтверждён</MenuItem>
                    <MenuItem value="merged">Объединён</MenuItem>
                    <MenuItem value="archived">Архив</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="VIN-префиксы"
                    value={laborNormCatalogForm.vin_prefixes}
                    onChange={(event) => onCatalogFormChange("vin_prefixes", event.target.value)}
                    helperText="По одному значению в строке"
                    fullWidth
                    multiline
                    minRows={3}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Ключевые бренды"
                    value={laborNormCatalogForm.brand_keywords}
                    onChange={(event) => onCatalogFormChange("brand_keywords", event.target.value)}
                    helperText="Например: dongfeng, dfh4180"
                    fullWidth
                    multiline
                    minRows={3}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Ключевые модели"
                    value={laborNormCatalogForm.model_keywords}
                    onChange={(event) => onCatalogFormChange("model_keywords", event.target.value)}
                    helperText="Например: тягач"
                    fullWidth
                    multiline
                    minRows={3}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Примечание"
                    value={laborNormCatalogForm.notes}
                    onChange={(event) => onCatalogFormChange("notes", event.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                </Grid>
              </Grid>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button variant="contained" disabled={laborNormCatalogSaving} onClick={onSaveCatalog}>
                  {laborNormCatalogSaving ? "Сохранение..." : editingLaborNormCatalogId ? "Сохранить каталог" : "Создать каталог"}
                </Button>
                <Button variant="text" onClick={onResetCatalogForm} disabled={laborNormCatalogSaving}>
                  Сбросить форму
                </Button>
              </Stack>
              {laborNormCatalogs.length > 0 ? (
                <Stack spacing={1}>
                  {laborNormCatalogs.map((item) => (
                    <Paper className="repair-line" key={`catalog-${item.id}`} elevation={0}>
                      <Stack spacing={0.75}>
                        <Stack direction="row" justifyContent="space-between" spacing={1}>
                          <Typography>{item.catalog_name}</Typography>
                          <Stack direction="row" spacing={1}>
                            <Chip
                              size="small"
                              color={item.auto_match_enabled ? "success" : "default"}
                              label={item.auto_match_enabled ? "Авто-матчинг" : "Только вручную"}
                            />
                            <Chip size="small" variant="outlined" label={formatCatalogCodeLabel(item.scope)} />
                          </Stack>
                        </Stack>
                        <Typography className="muted-copy">
                          {item.brand_family ? `${item.brand_family} · ` : ""}
                          {item.vehicle_type === "truck"
                            ? "Грузовик"
                            : item.vehicle_type === "trailer"
                              ? "Прицеп"
                              : "Тип не ограничен"}
                          {item.year_from !== null || item.year_to !== null ? ` · годы ${item.year_from ?? "—"}-${item.year_to ?? "—"}` : ""}
                          {` · приоритет ${item.priority}`}
                          {` · статус ${formatStatus(item.status)}`}
                        </Typography>
                        <Typography className="muted-copy">
                          Бренды: {(item.brand_keywords || []).join(", ") || "—"}
                          {` · модели: ${(item.model_keywords || []).join(", ") || "—"}`}
                          {` · VIN: ${(item.vin_prefixes || []).join(", ") || "—"}`}
                        </Typography>
                        {item.notes ? <Typography className="muted-copy">{item.notes}</Typography> : null}
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          <Button size="small" variant="outlined" onClick={() => onEditCatalog(item)}>
                            Редактировать
                          </Button>
                          <Button size="small" variant="text" onClick={() => onSelectCatalogScope(item.scope)}>
                            Использовать в импорте
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Typography className="muted-copy">Каталоги ещё не настроены.</Typography>
              )}
            </Stack>
          </Paper>
        ) : null}

        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Поиск по коду или названию"
              value={laborNormQuery}
              onChange={(event) => onQueryChange(event.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Каталог"
              value={laborNormScope}
              onChange={(event) => onScopeChange(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Все каталоги</MenuItem>
              {laborNormScopes.map((scope) => (
                <MenuItem key={scope} value={scope}>
                  {formatCatalogCodeLabel(scope)}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Категория"
              value={laborNormCategory}
              onChange={(event) => onCategoryChange(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Все категории</MenuItem>
              {laborNormCategories.map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" onClick={onSearch} disabled={laborNormLoading}>
            {laborNormLoading ? "Загрузка..." : "Обновить список"}
          </Button>
          <Button variant="text" onClick={onResetFilters} disabled={laborNormLoading}>
            Сбросить фильтр
          </Button>
        </Stack>

        {showLaborNormImport ? (
          <Paper className="repair-line" elevation={0}>
            <Stack spacing={1.25}>
              <Typography className="metric-label">Импорт / обновление каталога</Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    label="Каталог"
                    value={laborNormImportScope}
                    onChange={(event) => onSelectCatalogScope(event.target.value)}
                    fullWidth
                  >
                    {laborNormCatalogs.length === 0 ? (
                      <MenuItem value="" disabled>
                        Сначала создайте каталог
                      </MenuItem>
                    ) : null}
                    {laborNormCatalogs.map((item) => (
                      <MenuItem key={`import-${item.scope}`} value={item.scope}>
                        {item.catalog_name} · {formatCatalogCodeLabel(item.scope)}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Семейство бренда"
                    value={laborNormImportBrandFamily}
                    onChange={(event) => onImportBrandFamilyChange(event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Название каталога"
                    value={laborNormImportCatalogName}
                    onChange={(event) => onImportCatalogNameChange(event.target.value)}
                    fullWidth
                  />
                </Grid>
              </Grid>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
                <Button component="label" variant="outlined">
                  Выбрать .xlsx/.csv
                  <input
                    hidden
                    type="file"
                    accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    onChange={(event) => onImportFileChange(event.target.files?.[0] ?? null)}
                  />
                </Button>
                <Typography className="muted-copy">{laborNormFile ? laborNormFile.name : "Файл не выбран"}</Typography>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button
                  variant="contained"
                  disabled={laborNormImportLoading || !laborNormFile || !laborNormImportScope}
                  onClick={onImport}
                >
                  {laborNormImportLoading ? "Импорт..." : "Импортировать справочник"}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ) : null}

        {showLaborNormEntryEditor ? (
          <Paper className="repair-line" elevation={0}>
            <Stack spacing={1.25}>
              <Typography className="metric-label">Ручное добавление и правка строк</Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={3}>
                  <TextField
                    select
                    label="Каталог"
                    value={laborNormEntryForm.scope}
                    onChange={(event) => onEntryFormChange("scope", event.target.value)}
                    fullWidth
                  >
                    {laborNormCatalogs.length === 0 ? (
                      <MenuItem value="" disabled>
                        Сначала создайте каталог
                      </MenuItem>
                    ) : null}
                    {laborNormCatalogs.map((item) => (
                      <MenuItem key={`entry-${item.scope}`} value={item.scope}>
                        {item.catalog_name} · {item.scope}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Код"
                    value={laborNormEntryForm.code}
                    onChange={(event) => onEntryFormChange("code", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Категория"
                    value={laborNormEntryForm.category}
                    onChange={(event) => onEntryFormChange("category", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Нормо-часы"
                    value={laborNormEntryForm.standard_hours}
                    onChange={(event) => onEntryFormChange("standard_hours", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Название на русском"
                    value={laborNormEntryForm.name_ru}
                    onChange={(event) => onEntryFormChange("name_ru", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Альтернативное название на русском"
                    value={laborNormEntryForm.name_ru_alt}
                    onChange={(event) => onEntryFormChange("name_ru_alt", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Название на китайском"
                    value={laborNormEntryForm.name_cn}
                    onChange={(event) => onEntryFormChange("name_cn", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Название на английском"
                    value={laborNormEntryForm.name_en}
                    onChange={(event) => onEntryFormChange("name_en", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    label="Лист"
                    value={laborNormEntryForm.source_sheet}
                    onChange={(event) => onEntryFormChange("source_sheet", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    label="Источник"
                    value={laborNormEntryForm.source_file}
                    onChange={(event) => onEntryFormChange("source_file", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    select
                    label="Статус"
                    value={laborNormEntryForm.status}
                    onChange={(event) => onEntryFormChange("status", event.target.value)}
                    fullWidth
                  >
                    <MenuItem value="preliminary">Предварительный</MenuItem>
                    <MenuItem value="confirmed">Подтверждён</MenuItem>
                    <MenuItem value="merged">Объединён</MenuItem>
                    <MenuItem value="archived">Архив</MenuItem>
                  </TextField>
                </Grid>
              </Grid>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button variant="contained" disabled={laborNormEntrySaving} onClick={onSaveEntry}>
                  {laborNormEntrySaving ? "Сохранение..." : laborNormEntryForm.id ? "Сохранить запись" : "Создать запись"}
                </Button>
                <Button variant="text" disabled={laborNormEntrySaving} onClick={onResetEntryForm}>
                  Сбросить форму
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ) : null}

        <Typography className="muted-copy">
          В каталоге {laborNormTotal} записей
          {laborNormSourceFiles.length > 0 ? ` · источники: ${laborNormSourceFiles.join(", ")}` : ""}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
          <Button variant="outlined" disabled={laborNormLoading || laborNorms.length === 0} onClick={onOpenListDialog}>
            Открыть список записей
          </Button>
          <Typography className="muted-copy">
            Полный список скрыт с основной страницы, чтобы не растягивать экран.
          </Typography>
        </Stack>

        {laborNormLoading ? (
          <Stack spacing={1} alignItems="center">
            <CircularProgress size={24} />
            <Typography className="muted-copy">Загрузка каталога...</Typography>
          </Stack>
        ) : laborNorms.length === 0 ? (
          <Typography className="muted-copy">По текущему фильтру записи не найдены.</Typography>
        ) : null}

        <Dialog open={showLaborNormListDialog} onClose={onCloseListDialog} fullWidth maxWidth="lg">
          <DialogTitle>Записи нормо-часов</DialogTitle>
          <DialogContent dividers>
            {laborNorms.length > 0 ? (
              <Stack spacing={1}>
                {laborNorms.map((item) => (
                  <Paper className="repair-line" key={item.id} elevation={0}>
                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography>{item.code} · {item.name_ru}</Typography>
                        <Typography>{formatHours(item.standard_hours) || "—"}</Typography>
                      </Stack>
                      <Typography className="muted-copy">
                        {item.catalog_name || item.scope}
                        {item.brand_family ? ` · ${item.brand_family}` : ""}
                        {item.category ? ` · ${item.category}` : " · Без категории"}
                        {item.name_ru_alt ? ` · доп. название: ${item.name_ru_alt}` : ""}
                        {` · статус ${formatStatus(item.status)}`}
                      </Typography>
                      <Typography className="muted-copy">
                        Источник: {item.source_file || "—"}
                        {item.source_sheet ? ` · лист ${item.source_sheet}` : ""}
                      </Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            onCloseListDialog();
                            onEditItem(item);
                          }}
                        >
                          Редактировать
                        </Button>
                        {item.status !== "archived" ? (
                          <Button size="small" variant="text" disabled={laborNormEntrySaving} onClick={() => onArchiveItem(item)}>
                            В архив
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography className="muted-copy">По текущему фильтру записи не найдены.</Typography>
            )}
          </DialogContent>
        </Dialog>
      </Stack>
    </Paper>
  );
}
