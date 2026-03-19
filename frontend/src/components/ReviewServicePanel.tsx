import { Box, Button, Chip, Grid, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";

type ServiceStatus = "preliminary" | "confirmed" | "archived";

type ReviewServiceForm = {
  name: string;
  city: string;
  contact: string;
  status: ServiceStatus;
  comment: string;
};

type ReviewServicePanelProps = {
  currentServiceName: string | null;
  ocrServiceName: string;
  reviewServiceName: string;
  services: Array<{
    id: number;
    name: string;
  }>;
  reviewServiceAssigning: boolean;
  reviewServiceSaving: boolean;
  reviewFieldSaving: boolean;
  reviewVehicleLinking: boolean;
  showReviewServiceEditor: boolean;
  reviewServiceForm: ReviewServiceForm;
  userRole: "admin" | "employee" | undefined;
  onServiceNameChange: (value: string) => void;
  onAssign: () => void;
  onToggleCreate: () => void;
  onClear: () => void;
  onFormChange: <K extends keyof ReviewServiceForm>(field: K, value: ReviewServiceForm[K]) => void;
  onCreate: () => void;
};

export function ReviewServicePanel({
  currentServiceName,
  ocrServiceName,
  reviewServiceName,
  services,
  reviewServiceAssigning,
  reviewServiceSaving,
  reviewFieldSaving,
  reviewVehicleLinking,
  showReviewServiceEditor,
  reviewServiceForm,
  userRole,
  onServiceNameChange,
  onAssign,
  onToggleCreate,
  onClear,
  onFormChange,
  onCreate,
}: ReviewServicePanelProps) {
  const controlsDisabled =
    reviewServiceAssigning || reviewServiceSaving || reviewFieldSaving || reviewVehicleLinking;

  return (
    <Paper className="repair-line repair-review-split" elevation={0}>
      <Stack spacing={1.25}>
        <Box>
          <Typography variant="subtitle1">Сервис ремонта</Typography>
          <Typography className="muted-copy">
            Назначьте сервис из справочника или создайте новый прямо из review.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip size="small" variant="outlined" label={`В ремонте: ${currentServiceName || "не назначен"}`} />
          {ocrServiceName ? (
            <Chip size="small" variant="outlined" color="warning" label={`OCR: ${ocrServiceName}`} />
          ) : null}
        </Stack>
        <TextField
          fullWidth
          label="Выбрать сервис"
          value={reviewServiceName}
          onChange={(event) => onServiceNameChange(event.target.value)}
          inputProps={{ list: "review-services-list" }}
          helperText={
            services.length > 0
              ? "Справочник включает сервисы из папки `Сервисы` и ручные добавления."
              : "Список сервисов будет доступен после загрузки справочника."
          }
        />
        <datalist id="review-services-list">
          {services.map((item) => (
            <option key={`review-service-option-${item.id}`} value={item.name} />
          ))}
        </datalist>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="contained" disabled={controlsDisabled} onClick={onAssign}>
            {reviewServiceAssigning ? "Назначение..." : "Назначить сервис"}
          </Button>
          <Button variant="outlined" disabled={controlsDisabled} onClick={onToggleCreate}>
            {showReviewServiceEditor ? "Скрыть создание" : "Создать новый сервис"}
          </Button>
          {currentServiceName ? (
            <Button variant="text" disabled={controlsDisabled} onClick={onClear}>
              Очистить сервис
            </Button>
          ) : null}
        </Stack>
        {showReviewServiceEditor ? (
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Название сервиса"
                value={reviewServiceForm.name}
                onChange={(event) => onFormChange("name", event.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Город"
                value={reviewServiceForm.city}
                onChange={(event) => onFormChange("city", event.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Контакт"
                value={reviewServiceForm.contact}
                onChange={(event) => onFormChange("contact", event.target.value)}
              />
            </Grid>
            {userRole === "admin" ? (
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  fullWidth
                  label="Статус"
                  value={reviewServiceForm.status}
                  onChange={(event) => onFormChange("status", event.target.value as ServiceStatus)}
                >
                  <MenuItem value="confirmed">Подтверждён</MenuItem>
                  <MenuItem value="preliminary">Предварительный</MenuItem>
                </TextField>
              </Grid>
            ) : null}
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                minRows={2}
                label="Комментарий"
                value={reviewServiceForm.comment}
                onChange={(event) => onFormChange("comment", event.target.value)}
                helperText={
                  userRole === "admin"
                    ? undefined
                    : "Сервис будет создан как предварительный и сразу станет доступен для назначения."
                }
              />
            </Grid>
            <Grid item xs={12}>
              <Button variant="contained" disabled={reviewServiceSaving || reviewServiceAssigning} onClick={onCreate}>
                {reviewServiceSaving ? "Создание..." : "Создать и назначить"}
              </Button>
            </Grid>
          </Grid>
        ) : null}
      </Stack>
    </Paper>
  );
}
