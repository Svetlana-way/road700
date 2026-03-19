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

type ServiceStatus = "preliminary" | "confirmed" | "archived";

type ServiceItem = {
  id: number;
  name: string;
  city: string | null;
  contact: string | null;
  comment: string | null;
  status: ServiceStatus;
  created_by_user_id: number | null;
  confirmed_by_user_id: number | null;
  created_at: string;
  updated_at: string;
};

type ServiceFormState = {
  id: number | null;
  name: string;
  city: string;
  contact: string;
  comment: string;
  status: ServiceStatus;
};

type ServicesAdminPanelProps = {
  serviceQuery: string;
  serviceCityFilter: string;
  serviceCities: string[];
  serviceLoading: boolean;
  showServiceEditor: boolean;
  serviceForm: ServiceFormState;
  serviceSaving: boolean;
  services: ServiceItem[];
  showServiceListDialog: boolean;
  onServiceQueryChange: (value: string) => void;
  onServiceCityFilterChange: (value: string) => void;
  onRefresh: () => void;
  onReset: () => void;
  onToggleEditor: () => void;
  onServiceFormChange: (field: keyof ServiceFormState, value: string) => void;
  onSaveService: () => void;
  onResetEditor: () => void;
  onOpenListDialog: () => void;
  onCloseListDialog: () => void;
  onEditService: (item: ServiceItem) => void;
  formatStatus: (value: string) => string;
};

export function ServicesAdminPanel({
  serviceQuery,
  serviceCityFilter,
  serviceCities,
  serviceLoading,
  showServiceEditor,
  serviceForm,
  serviceSaving,
  services,
  showServiceListDialog,
  onServiceQueryChange,
  onServiceCityFilterChange,
  onRefresh,
  onReset,
  onToggleEditor,
  onServiceFormChange,
  onSaveService,
  onResetEditor,
  onOpenListDialog,
  onCloseListDialog,
  onEditService,
  formatStatus,
}: ServicesAdminPanelProps) {
  return (
    <Paper className="workspace-panel" elevation={0}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h5">Справочник сервисов</Typography>
          <Typography className="muted-copy">
            Каталог сервисов для OCR, ручной правки ремонтов и нормализации названий.
          </Typography>
        </Box>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={5}>
            <TextField
              label="Поиск по названию, городу или контакту"
              value={serviceQuery}
              onChange={(event) => onServiceQueryChange(event.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              select
              label="Город"
              value={serviceCityFilter}
              onChange={(event) => onServiceCityFilterChange(event.target.value)}
              fullWidth
            >
              <MenuItem value="">Все города</MenuItem>
              {serviceCities.map((city) => (
                <MenuItem key={city} value={city}>
                  {city}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={3}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="outlined" onClick={onRefresh} disabled={serviceLoading}>
                {serviceLoading ? "Загрузка..." : "Обновить"}
              </Button>
              <Button variant="text" disabled={serviceLoading} onClick={onReset}>
                Сбросить
              </Button>
            </Stack>
          </Grid>
        </Grid>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant={showServiceEditor ? "outlined" : "contained"} onClick={onToggleEditor}>
            {showServiceEditor ? "Скрыть карточку сервиса" : "Открыть форму редактирования"}
          </Button>
        </Stack>
        {showServiceEditor ? (
          <Paper className="repair-line" elevation={0}>
            <Stack spacing={1.25}>
              <Typography className="metric-label">Редактирование карточки сервиса</Typography>
              <Typography className="muted-copy">
                Сервисы из папки `Сервисы` синхронизируются автоматически. При необходимости можно добавить сервис вручную.
              </Typography>
              <Grid container spacing={1.5}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Название"
                    value={serviceForm.name}
                    onChange={(event) => onServiceFormChange("name", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Город"
                    value={serviceForm.city}
                    onChange={(event) => onServiceFormChange("city", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Контакт"
                    value={serviceForm.contact}
                    onChange={(event) => onServiceFormChange("contact", event.target.value)}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <TextField
                    select
                    label="Статус"
                    value={serviceForm.status}
                    onChange={(event) => onServiceFormChange("status", event.target.value)}
                    fullWidth
                  >
                    <MenuItem value="preliminary">Предварительный</MenuItem>
                    <MenuItem value="confirmed">Подтверждён</MenuItem>
                    <MenuItem value="archived">Архив</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Комментарий"
                    value={serviceForm.comment}
                    onChange={(event) => onServiceFormChange("comment", event.target.value)}
                    fullWidth
                    multiline
                    minRows={2}
                  />
                </Grid>
              </Grid>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button variant="contained" disabled={serviceSaving} onClick={onSaveService}>
                  {serviceSaving ? "Сохранение..." : serviceForm.id ? "Сохранить сервис" : "Создать сервис"}
                </Button>
                <Button variant="text" disabled={serviceSaving} onClick={onResetEditor}>
                  Сбросить форму
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ) : null}
        <Typography className="muted-copy">В справочнике сервисов {services.length} записей по текущему фильтру.</Typography>
        {serviceLoading ? (
          <Stack spacing={1} alignItems="center">
            <CircularProgress size={24} />
            <Typography className="muted-copy">Загрузка сервисов...</Typography>
          </Stack>
        ) : services.length > 0 ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
            <Button variant="outlined" onClick={onOpenListDialog}>
              Открыть список сервисов
            </Button>
            <Typography className="muted-copy">Полный список сервисов скрыт с основной страницы.</Typography>
          </Stack>
        ) : (
          <Typography className="muted-copy">По текущему фильтру сервисы не найдены.</Typography>
        )}
        <Dialog open={showServiceListDialog} onClose={onCloseListDialog} fullWidth maxWidth="lg">
          <DialogTitle>Справочник сервисов</DialogTitle>
          <DialogContent dividers>
            {services.length > 0 ? (
              <Stack spacing={1}>
                {services.map((item) => (
                  <Paper className="repair-line" key={`service-${item.id}`} elevation={0}>
                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography>{item.name}</Typography>
                        <Chip
                          size="small"
                          color={item.status === "confirmed" ? "success" : item.status === "preliminary" ? "warning" : "default"}
                          label={formatStatus(item.status)}
                        />
                      </Stack>
                      <Typography className="muted-copy">
                        {item.city || "Без города"}
                        {item.contact ? ` · ${item.contact}` : ""}
                      </Typography>
                      {item.comment ? <Typography className="muted-copy">{item.comment}</Typography> : null}
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            onCloseListDialog();
                            onEditService(item);
                          }}
                        >
                          Редактировать
                        </Button>
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Typography className="muted-copy">По текущему фильтру сервисы не найдены.</Typography>
            )}
          </DialogContent>
        </Dialog>
      </Stack>
    </Paper>
  );
}
