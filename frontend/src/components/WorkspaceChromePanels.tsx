import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";

type UserRole = "admin" | "employee";
type WorkspaceTab = "documents" | "repair" | "admin" | "tech_admin" | "fleet" | "search" | "audit";

type DashboardSummary = {
  vehicles_total: number;
  repairs_total: number;
  repairs_draft: number;
  repairs_suspicious: number;
  documents_total: number;
  documents_review_queue: number;
};

type WorkspaceChromePanelsProps = {
  user: {
    full_name: string;
    email: string;
    role: UserRole;
  } | null;
  showPasswordChange: boolean;
  currentPasswordValue: string;
  newPasswordValue: string;
  passwordChangeLoading: boolean;
  errorMessage: string;
  successMessage: string;
  bootLoading: boolean;
  activeWorkspaceTab: WorkspaceTab;
  documentsCount: number;
  selectedRepairId: number | null;
  showTechAdminTab: boolean;
  vehiclesCount: number;
  workspaceDescription: string;
  summary: DashboardSummary | null;
  summaryCards: Array<{ key: keyof DashboardSummary; label: string }>;
  onTogglePasswordChange: () => void;
  onCurrentPasswordValueChange: (value: string) => void;
  onNewPasswordValueChange: (value: string) => void;
  onChangePassword: () => void;
  onCancelPasswordChange: () => void;
  onLogout: () => void;
  onWorkspaceTabChange: (value: WorkspaceTab) => void;
};

export function WorkspaceChromePanels({
  user,
  showPasswordChange,
  currentPasswordValue,
  newPasswordValue,
  passwordChangeLoading,
  errorMessage,
  successMessage,
  bootLoading,
  activeWorkspaceTab,
  documentsCount,
  selectedRepairId,
  showTechAdminTab,
  vehiclesCount,
  workspaceDescription,
  summary,
  summaryCards,
  onTogglePasswordChange,
  onCurrentPasswordValueChange,
  onNewPasswordValueChange,
  onChangePassword,
  onCancelPasswordChange,
  onLogout,
  onWorkspaceTabChange,
}: WorkspaceChromePanelsProps) {
  return (
    <>
      <Paper className="topbar" elevation={0}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between">
          <Box>
            <Typography variant="overline" className="eyebrow">
              Road700 workspace
            </Typography>
            <Typography variant="h4" component="h1">
              Операционная панель заказ-нарядов
            </Typography>
            <Typography className="muted-copy">
              {user ? `${user.full_name} · ${user.role}` : "Загрузка профиля"}
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
            <Chip label={user?.email || "user"} />
            <Button variant={showPasswordChange ? "contained" : "outlined"} onClick={onTogglePasswordChange}>
              Сменить пароль
            </Button>
            <Button variant="outlined" onClick={onLogout}>
              Выйти
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {showPasswordChange ? (
        <Paper className="workspace-panel" elevation={0}>
          <Stack spacing={1.5}>
            <Box>
              <Typography variant="h6">Смена пароля</Typography>
              <Typography className="muted-copy">Новый пароль должен быть не короче 8 символов.</Typography>
            </Box>
            <Grid container spacing={1.5}>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Текущий пароль"
                  type="password"
                  value={currentPasswordValue}
                  onChange={(event) => onCurrentPasswordValueChange(event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  label="Новый пароль"
                  type="password"
                  value={newPasswordValue}
                  onChange={(event) => onNewPasswordValueChange(event.target.value)}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button variant="contained" disabled={passwordChangeLoading} onClick={onChangePassword}>
                    {passwordChangeLoading ? "Сохранение..." : "Обновить пароль"}
                  </Button>
                  <Button variant="text" disabled={passwordChangeLoading} onClick={onCancelPasswordChange}>
                    Отмена
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </Paper>
      ) : null}

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}

      {bootLoading ? (
        <Paper className="loading-panel" elevation={0}>
          <Stack spacing={2} alignItems="center">
            <CircularProgress />
            <Typography>Обновление данных...</Typography>
          </Stack>
        </Paper>
      ) : null}

      <Paper className="workspace-panel" elevation={0}>
        <Stack spacing={1.5}>
          <Tabs
            value={activeWorkspaceTab}
            onChange={(_event, value: WorkspaceTab) => onWorkspaceTabChange(value)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
          >
            <Tab label={`Документы · ${documentsCount}`} value="documents" />
            <Tab label={selectedRepairId ? `Ремонт · #${selectedRepairId}` : "Ремонт"} value="repair" />
            <Tab label="Поиск" value="search" />
            <Tab label="Журнал" value="audit" />
            {user?.role === "admin" ? <Tab label="Админка" value="admin" /> : null}
            {user?.role === "admin" && showTechAdminTab ? <Tab label="Тех. админка" value="tech_admin" /> : null}
            <Tab label={`Техника · ${summary?.vehicles_total ?? vehiclesCount}`} value="fleet" />
          </Tabs>
          <Typography className="muted-copy">{workspaceDescription}</Typography>
        </Stack>
      </Paper>

      <Grid container spacing={2}>
        {summaryCards.map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.key}>
            <Paper className="metric-card" elevation={0}>
              <Typography className="metric-label">{card.label}</Typography>
              <Typography variant="h3">{summary ? summary[card.key] : "—"}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
